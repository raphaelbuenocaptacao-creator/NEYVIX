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

export async function getEntitlements(email: string): Promise<Entitlements> {
  const enforcementEnabled = isPlanEnforcementEnabled();
  const sql = getSql();
  if (!sql) {
    return { plan: "legacy", status: null, features: BUSINESS, trialEndsAt: null, enforcementEnabled, source: "fallback" };
  }

  try {
    const rows = await sql`
      SELECT
        s.status,
        s.trial_ends_at,
        p.slug AS plan_slug,
        p.features
      FROM public.subscriptions s
      JOIN public.users u ON u.id = s.user_id
      JOIN public.projects pr ON pr.id = s.project_id AND pr.slug = 'neyvix'
      LEFT JOIN public.neyvix_plans p ON p.id = s.plan_id
      WHERE u.email = ${email.trim().toLowerCase()}
      LIMIT 1
    `;

    const row = rows[0] as { status?: string; trial_ends_at?: string; plan_slug?: string; features?: unknown } | undefined;
    if (!row) return { plan: "legacy", status: null, features: BUSINESS, trialEndsAt: null, enforcementEnabled, source: "fallback" };

    const status = row.status ?? null;
    const trialEndsAt = row.trial_ends_at ? String(row.trial_ends_at) : null;
    const trialActive = status === "trialing" && (!trialEndsAt || new Date(trialEndsAt).getTime() > Date.now());
    if (trialActive) return { plan: "trial", status, features: PRO, trialEndsAt, enforcementEnabled, source: "database" };

    if (status === "active") {
      const slug = row.plan_slug === "business" ? "business" : row.plan_slug === "pro" ? "pro" : "start";
      const fallbackFeatures = slug === "business" ? BUSINESS : slug === "pro" ? PRO : START;
      const features = Array.isArray(row.features) ? row.features.filter((item): item is EntitlementFeature => typeof item === "string") : fallbackFeatures;
      return { plan: slug, status, features, trialEndsAt, enforcementEnabled, source: "database" };
    }

    if (["expired", "cancelled", "past_due"].includes(status ?? "")) {
      return { plan: "expired", status, features: ["pwa"], trialEndsAt, enforcementEnabled, source: "database" };
    }

    return { plan: "legacy", status, features: BUSINESS, trialEndsAt, enforcementEnabled, source: "fallback" };
  } catch (error) {
    console.warn("NEYVIX entitlements schema unavailable; using compatibility access", error);
    return { plan: "legacy", status: null, features: BUSINESS, trialEndsAt: null, enforcementEnabled, source: "fallback" };
  }
}

export function canUse(entitlements: Entitlements, feature: EntitlementFeature) {
  return !entitlements.enforcementEnabled || entitlements.features.includes(feature);
}
