import { neon } from "@neondatabase/serverless";

export type EntitlementFeature =
  | "ai"
  | "content"
  | "studio"
  | "pwa"
  | "history"
  | "automation"
  | "estate"
  | "deploy"
  | "admin"
  | "approvals"
  | "mail"
  | "team";

const START: EntitlementFeature[] = ["ai", "content", "studio", "pwa", "history"];
const PRO: EntitlementFeature[] = [...START, "automation", "estate", "deploy"];
const BUSINESS: EntitlementFeature[] = [...PRO, "admin", "approvals", "mail", "team"];
const LIMITED: EntitlementFeature[] = ["pwa"];

export type Entitlements = {
  plan: "start" | "pro" | "business" | "trial" | "legacy" | "expired";
  status: string | null;
  features: EntitlementFeature[];
  trialEndsAt: string | null;
  enforcementEnabled: boolean;
  source: "database" | "fallback";
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

export function isPlanEnforcementEnabled() {
  return process.env.NEYVIX_ENFORCE_PLANS === "true";
}

function compatibilityFallback(enforcementEnabled: boolean, status: string | null = null): Entitlements {
  if (enforcementEnabled) {
    return {
      plan: "expired",
      status,
      features: LIMITED,
      trialEndsAt: null,
      enforcementEnabled,
      source: "fallback",
    };
  }

  return {
    plan: "legacy",
    status,
    features: BUSINESS,
    trialEndsAt: null,
    enforcementEnabled,
    source: "fallback",
  };
}

function planFromCode(code?: string | null): "start" | "pro" | "business" {
  if (code?.startsWith("business")) return "business";
  if (code?.startsWith("pro")) return "pro";
  return "start";
}

function normalizeFeatures(raw: unknown, fallback: EntitlementFeature[]): EntitlementFeature[] {
  if (Array.isArray(raw)) {
    const allowed = new Set<EntitlementFeature>(BUSINESS);
    return raw.filter(
      (item): item is EntitlementFeature => typeof item === "string" && allowed.has(item as EntitlementFeature),
    );
  }
  if (raw && typeof raw === "object") {
    const allowed = new Set<EntitlementFeature>(BUSINESS);
    return Object.entries(raw as Record<string, unknown>)
      .filter(([key, value]) => value === true && allowed.has(key as EntitlementFeature))
      .map(([key]) => key as EntitlementFeature);
  }
  return fallback;
}

export async function getEntitlements(email: string): Promise<Entitlements> {
  const enforcementEnabled = isPlanEnforcementEnabled();
  const sql = getSql();
  if (!sql) return compatibilityFallback(enforcementEnabled);

  try {
    const rows = await sql`
      SELECT
        s.status,
        s.trial_ends_at,
        p.code AS plan_code,
        p.features
      FROM public.subscriptions s
      JOIN public.users u ON u.id = s.user_id
      JOIN public.projects pr ON pr.id = s.project_id AND pr.slug = 'neyvix'
      LEFT JOIN public.plans p ON p.id = s.plan_id AND p.project_id = pr.id
      WHERE lower(u.email) = ${email.trim().toLowerCase()}
      LIMIT 1
    `;

    const row = rows[0] as { status?: string; trial_ends_at?: string; plan_code?: string; features?: unknown } | undefined;
    if (!row) return compatibilityFallback(enforcementEnabled);

    const status = row.status ?? null;
    const trialEndsAt = row.trial_ends_at ? String(row.trial_ends_at) : null;
    const trialActive = status === "trialing" && (!trialEndsAt || new Date(trialEndsAt).getTime() > Date.now());
    if (trialActive) {
      return { plan: "trial", status, features: PRO, trialEndsAt, enforcementEnabled, source: "database" };
    }

    if (status === "active") {
      const slug = planFromCode(row.plan_code);
      const fallbackFeatures = slug === "business" ? BUSINESS : slug === "pro" ? PRO : START;
      const features = normalizeFeatures(row.features, fallbackFeatures);
      return { plan: slug, status, features, trialEndsAt, enforcementEnabled, source: "database" };
    }

    if (status === "trialing" || ["expired", "cancelled", "canceled", "past_due"].includes(status ?? "")) {
      return { plan: "expired", status, features: LIMITED, trialEndsAt, enforcementEnabled, source: "database" };
    }

    return compatibilityFallback(enforcementEnabled, status);
  } catch (error) {
    console.warn("NEYVIX entitlements unavailable; applying safe fallback", error);
    return compatibilityFallback(enforcementEnabled);
  }
}

export function canUse(entitlements: Entitlements, feature: EntitlementFeature) {
  return entitlements.features.includes(feature);
}
