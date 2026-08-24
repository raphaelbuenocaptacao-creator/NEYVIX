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
    mailTransport: boolean;
    storage: boolean;
  };
};

function integrationStatus() {
  return {
    aiGateway: Boolean(process.env.NEYVIX_AI_GATEWAY_URL?.trim() && process.env.NEYVIX_AI_GATEWAY_SECRET?.trim()),
    billingWebhook: Boolean(process.env.NEYVIX_BILLING_WEBHOOK_SECRET?.trim()),
    mailTransport: Boolean(process.env.NEYVIX_MAIL_TRANSPORT_URL?.trim() && process.env.NEYVIX_MAIL_TRANSPORT_SECRET?.trim()),
    storage: Boolean(process.env.NEYVIX_STORAGE_UPLOAD_URL?.trim() && process.env.NEYVIX_STORAGE_TOKEN?.trim()),
  };
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const integrations = integrationStatus();

  if (!databaseUrl) {
    return {
      ok: false,
      database: "not_configured",
      project: "unknown",
      billing: "unknown",
      mail: "unknown",
      estate: "unknown",
      integrations,
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

    return {
      ok: projectReady && billingReady && mailReady && estateReady,
      database: "connected",
      project: projectReady ? "ready" : "missing",
      billing: billingReady ? "ready" : "missing",
      mail: mailReady ? "ready" : "missing",
      estate: estateReady ? "ready" : "missing",
      integrations,
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
    };
  }
}
