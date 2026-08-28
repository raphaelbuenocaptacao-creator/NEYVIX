import { neon } from "@neondatabase/serverless";

export type HealthStatus = {
  ok: boolean;
  database: "connected" | "not_configured" | "error";
  project: "ready" | "missing" | "unknown";
  auth: {
    schema: "ready" | "missing" | "unknown";
    activeUsers: number | null;
    usersWithoutPassword: number | null;
  };
  billing: "ready" | "missing" | "unknown";
  mail: "ready" | "missing" | "unknown";
  estate: "ready" | "missing" | "unknown";
  schema: {
    automation: "ready" | "missing" | "unknown";
    memory: "ready" | "missing" | "unknown";
    ecosystem: "ready" | "partial" | "missing" | "unknown";
  };
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

function unavailableSchema() {
  return {
    automation: "unknown" as const,
    memory: "unknown" as const,
    ecosystem: "unknown" as const,
  };
}

function unavailableAuth() {
  return {
    schema: "unknown" as const,
    activeUsers: null,
    usersWithoutPassword: null,
  };
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
      auth: unavailableAuth(),
      billing: "unknown",
      mail: "unknown",
      estate: "unknown",
      schema: unavailableSchema(),
      integrations,
      launchReady: false,
    };
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT
        EXISTS (SELECT 1 FROM public.projects WHERE slug = 'neyvix' AND is_active = true) AS project_ready,
        to_regclass('public.users') IS NOT NULL
          AND to_regclass('public.sessions') IS NOT NULL
          AND to_regclass('public.password_reset_tokens') IS NOT NULL AS auth_schema_ready,
        CASE WHEN to_regclass('public.users') IS NOT NULL
          THEN (SELECT count(*)::int FROM public.users WHERE is_active = true)
          ELSE NULL END AS active_users,
        CASE WHEN to_regclass('public.users') IS NOT NULL
          THEN (SELECT count(*)::int FROM public.users WHERE password_hash IS NULL OR password_hash = '')
          ELSE NULL END AS users_without_password,
        to_regclass('public.neyvix_billing_events') IS NOT NULL
          AND to_regclass('public.plans') IS NOT NULL
          AND to_regclass('public.subscriptions') IS NOT NULL AS billing_ready,
        to_regclass('public.mailboxes') IS NOT NULL
          AND to_regclass('public.messages') IS NOT NULL AS mail_ready,
        to_regclass('public.neyvix_estate_sites') IS NOT NULL
          AND to_regclass('public.neyvix_estate_properties') IS NOT NULL AS estate_ready,
        to_regclass('public.neyvix_automations') IS NOT NULL
          AND to_regclass('public.neyvix_approval_requests') IS NOT NULL AS automation_ready,
        to_regclass('public.neyvix_memories') IS NOT NULL
          AND to_regclass('public.neyvix_memory_events') IS NOT NULL AS memory_ready,
        (
          (to_regclass('public.conversations') IS NOT NULL)::int +
          (to_regclass('public.chat_messages') IS NOT NULL)::int +
          (to_regclass('public.social_profiles') IS NOT NULL)::int +
          (to_regclass('public.drive_items') IS NOT NULL)::int +
          (to_regclass('public.documents') IS NOT NULL)::int +
          (to_regclass('public.meetings') IS NOT NULL)::int +
          (to_regclass('public.deploy_projects') IS NOT NULL)::int +
          (to_regclass('public.cloud_resources') IS NOT NULL)::int +
          (to_regclass('public.organizations') IS NOT NULL)::int +
          (to_regclass('public.wallets') IS NOT NULL)::int
        ) AS ecosystem_tables_ready
    `;

    const row = rows[0] ?? {};
    const projectReady = Boolean(row.project_ready);
    const authSchemaReady = Boolean(row.auth_schema_ready);
    const activeUsers = row.active_users == null ? null : Number(row.active_users);
    const usersWithoutPassword = row.users_without_password == null ? null : Number(row.users_without_password);
    const billingReady = Boolean(row.billing_ready);
    const mailReady = Boolean(row.mail_ready);
    const estateReady = Boolean(row.estate_ready);
    const automationReady = Boolean(row.automation_ready);
    const memoryReady = Boolean(row.memory_ready);
    const ecosystemTablesReady = Number(row.ecosystem_tables_ready ?? 0);
    const ecosystem = ecosystemTablesReady === 10 ? "ready" : ecosystemTablesReady > 0 ? "partial" : "missing";
    const authReady = authSchemaReady && Number(activeUsers ?? 0) > 0 && Number(usersWithoutPassword ?? 0) === 0;
    const coreReady = projectReady && authReady && billingReady && mailReady && estateReady;

    return {
      ok: coreReady,
      database: "connected",
      project: projectReady ? "ready" : "missing",
      auth: {
        schema: authSchemaReady ? "ready" : "missing",
        activeUsers,
        usersWithoutPassword,
      },
      billing: billingReady ? "ready" : "missing",
      mail: mailReady ? "ready" : "missing",
      estate: estateReady ? "ready" : "missing",
      schema: {
        automation: automationReady ? "ready" : "missing",
        memory: memoryReady ? "ready" : "missing",
        ecosystem,
      },
      integrations,
      launchReady: coreReady && automationReady && memoryReady && ecosystem === "ready" && externalReady,
    };
  } catch {
    return {
      ok: false,
      database: "error",
      project: "unknown",
      auth: unavailableAuth(),
      billing: "unknown",
      mail: "unknown",
      estate: "unknown",
      schema: unavailableSchema(),
      integrations,
      launchReady: false,
    };
  }
}
