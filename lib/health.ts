import { neon } from "@neondatabase/serverless";

export type HealthStatus = {
  ok: boolean;
  database: "connected" | "not_configured" | "error";
  project: "ready" | "missing" | "unknown";
  billing: "ready" | "missing" | "unknown";
  mail: "ready" | "missing" | "unknown";
  estate: "ready" | "missing" | "unknown";
  integrations: {
    aiGateway: boolean;
    billingWebhook: boolean;
    checkout: boolean;
    planEnforcement: boolean;
    mailTransport: boolean;
    mailInbound: boolean;
    storage: boolean;
  };
  launchReady: boolean;
};

function validHttps(value: string | undefined) {
  if (!value?.trim()) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function integrationStatus() {
  const aiGateway = validHttps(process.env.NEYVIX_AI_GATEWAY_URL);
  const billingWebhook = Boolean(process.env.NEYVIX_BILLING_WEBHOOK_SECRET?.trim());
  const checkout = [
    process.env.NEYVIX_CHECKOUT_START_URL,
    process.env.NEYVIX_CHECKOUT_PRO_URL,
    process.env.NEYVIX_CHECKOUT_BUSINESS_URL,
  ].every(validHttps);
  const planEnforcement = process.env.NEYVIX_ENFORCE_PLANS === "true";
  const mailTransport = validHttps(process.env.MAIL_TRANSPORT_URL) && Boolean(process.env.MAIL_TRANSPORT_SECRET?.trim());
  const mailInbound = Boolean(process.env.MAIL_WEBHOOK_SECRET?.trim());
  const storage = validHttps(process.env.STORAGE_UPLOAD_URL) && Boolean((process.env.STORAGE_UPLOAD_SECRET ?? process.env.STORAGE_TOKEN)?.trim());

  return { aiGateway, billingWebhook, checkout, planEnforcement, mailTransport, mailInbound, storage };
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const integrations = integrationStatus();
  const externalReady = Object.values(integrations).every(Boolean);

  if (!databaseUrl) {
    return {
      ok: false,
      database: "not_configured",
      project: "unknown",
      billing: "unknown",
      mail: "unknown",
      estate: "unknown",
      integrations,
      launchReady: false,
    };
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT
        EXISTS (SELECT 1 FROM public.projects WHERE slug = 'neyvix' AND is_active = true) AS project_ready,
        to_regclass('public.neyvix_billing_events') IS NOT NULL
          AND to_regclass('public.plans') IS NOT NULL
          AND to_regclass('public.subscriptions') IS NOT NULL AS billing_ready,
        to_regclass('public.mailboxes') IS NOT NULL
          AND to_regclass('public.messages') IS NOT NULL AS mail_ready,
        to_regclass('public.neyvix_estate_sites') IS NOT NULL
          AND to_regclass('public.neyvix_estate_properties') IS NOT NULL AS estate_ready
    `;

    const row = rows[0] ?? {};
    const projectReady = Boolean(row.project_ready);
    const billingReady = Boolean(row.billing_ready);
    const mailReady = Boolean(row.mail_ready);
    const estateReady = Boolean(row.estate_ready);
    const coreReady = projectReady && billingReady && mailReady && estateReady;

    return {
      ok: coreReady,
      database: "connected",
      project: projectReady ? "ready" : "missing",
      billing: billingReady ? "ready" : "missing",
      mail: mailReady ? "ready" : "missing",
      estate: estateReady ? "ready" : "missing",
      integrations,
      launchReady: coreReady && externalReady,
    };
  } catch {
    return {
      ok: false,
      database: "error",
      project: "unknown",
      billing: "unknown",
      mail: "unknown",
      estate: "unknown",
      integrations,
      launchReady: false,
    };
  }
}
