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
    productRecords: "ready" | "partial" | "missing" | "unknown";
    drive: "ready" | "partial" | "missing" | "unknown";
    docs: "ready" | "partial" | "missing" | "unknown";
    ecosystem: "ready" | "partial" | "missing" | "unknown";
    repairRequired: string[];
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

const DRIVE_REQUIRED_COLUMNS = [
  "id", "owner_user_id", "parent_id", "kind", "name", "mime_type", "size_bytes", "storage_key", "metadata", "created_at", "updated_at",
] as const;
const DOCS_REQUIRED_COLUMNS = [
  "id", "owner_user_id", "drive_item_id", "title", "content", "version", "created_at", "updated_at",
] as const;

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
    productRecords: "unknown" as const,
    drive: "unknown" as const,
    docs: "unknown" as const,
    ecosystem: "unknown" as const,
    repairRequired: [] as string[],
  };
}

function unavailableAuth() {
  return {
    schema: "unknown" as const,
    activeUsers: null,
    usersWithoutPassword: null,
  };
}

function shapeState(exists: boolean, actualColumns: Set<string>, requiredColumns: readonly string[]) {
  if (!exists) return "missing" as const;
  return requiredColumns.every((column) => actualColumns.has(column)) ? "ready" as const : "partial" as const;
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

    const catalogRows = await sql`
      SELECT
        to_regclass('public.projects') IS NOT NULL AS projects_table,
        to_regclass('public.users') IS NOT NULL AS users_table,
        to_regclass('public.sessions') IS NOT NULL AS sessions_table,
        to_regclass('public.password_reset_tokens') IS NOT NULL AS password_reset_tokens_table,
        to_regclass('public.neyvix_billing_events') IS NOT NULL AS billing_events_table,
        to_regclass('public.plans') IS NOT NULL AS plans_table,
        to_regclass('public.subscriptions') IS NOT NULL AS subscriptions_table,
        to_regclass('public.mailboxes') IS NOT NULL AS mailboxes_table,
        to_regclass('public.messages') IS NOT NULL AS messages_table,
        to_regclass('public.neyvix_estate_sites') IS NOT NULL AS estate_sites_table,
        to_regclass('public.neyvix_estate_properties') IS NOT NULL AS estate_properties_table,
        to_regclass('public.neyvix_automations') IS NOT NULL AS automations_table,
        to_regclass('public.neyvix_approval_requests') IS NOT NULL AS approval_requests_table,
        to_regclass('public.neyvix_memories') IS NOT NULL AS memories_table,
        to_regclass('public.neyvix_memory_events') IS NOT NULL AS memory_events_table,
        to_regclass('public.neyvix_studio_projects') IS NOT NULL AS studio_projects_table,
        to_regclass('public.neyvix_content_items') IS NOT NULL AS content_items_table,
        to_regclass('public.conversations') IS NOT NULL AS conversations_table,
        to_regclass('public.chat_messages') IS NOT NULL AS chat_messages_table,
        to_regclass('public.social_profiles') IS NOT NULL AS social_profiles_table,
        to_regclass('public.drive_items') IS NOT NULL AS drive_items_table,
        to_regclass('public.documents') IS NOT NULL AS documents_table,
        to_regclass('public.meetings') IS NOT NULL AS meetings_table,
        to_regclass('public.deploy_projects') IS NOT NULL AS deploy_projects_table,
        to_regclass('public.cloud_resources') IS NOT NULL AS cloud_resources_table,
        to_regclass('public.organizations') IS NOT NULL AS organizations_table,
        to_regclass('public.wallets') IS NOT NULL AS wallets_table
    `;

    const catalog = catalogRows[0] ?? {};
    const hasProjects = Boolean(catalog.projects_table);
    const hasUsers = Boolean(catalog.users_table);
    const authSchemaReady = hasUsers
      && Boolean(catalog.sessions_table)
      && Boolean(catalog.password_reset_tokens_table);

    let projectReady = false;
    if (hasProjects) {
      const projectRows = await sql`
        SELECT EXISTS (
          SELECT 1 FROM public.projects
          WHERE slug = 'neyvix' AND is_active = true
        ) AS project_ready
      `;
      projectReady = Boolean(projectRows[0]?.project_ready);
    }

    let activeUsers: number | null = null;
    let usersWithoutPassword: number | null = null;
    if (hasUsers) {
      const userRows = await sql`
        SELECT
          count(*) FILTER (WHERE is_active = true)::int AS active_users,
          count(*) FILTER (WHERE password_hash IS NULL OR password_hash = '')::int AS users_without_password
        FROM public.users
      `;
      activeUsers = userRows[0]?.active_users == null ? null : Number(userRows[0].active_users);
      usersWithoutPassword = userRows[0]?.users_without_password == null ? null : Number(userRows[0].users_without_password);
    }

    const billingReady = Boolean(catalog.billing_events_table)
      && Boolean(catalog.plans_table)
      && Boolean(catalog.subscriptions_table);
    const mailReady = Boolean(catalog.mailboxes_table) && Boolean(catalog.messages_table);
    const estateReady = Boolean(catalog.estate_sites_table) && Boolean(catalog.estate_properties_table);
    const automationReady = Boolean(catalog.automations_table) && Boolean(catalog.approval_requests_table);
    const memoryReady = Boolean(catalog.memories_table) && Boolean(catalog.memory_events_table);
    const productRecordTablesReady = [catalog.studio_projects_table, catalog.content_items_table].filter(Boolean).length;
    const productRecords = productRecordTablesReady === 2 ? "ready" : productRecordTablesReady > 0 ? "partial" : "missing";

    const shapeRows = await sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('drive_items', 'documents')
    ` as Array<{ table_name: string; column_name: string }>;
    const driveColumns = new Set(shapeRows.filter((column) => column.table_name === "drive_items").map((column) => column.column_name));
    const docsColumns = new Set(shapeRows.filter((column) => column.table_name === "documents").map((column) => column.column_name));
    const drive = shapeState(Boolean(catalog.drive_items_table), driveColumns, DRIVE_REQUIRED_COLUMNS);
    const docs = shapeState(Boolean(catalog.documents_table), docsColumns, DOCS_REQUIRED_COLUMNS);
    const driveReady = drive === "ready";
    const docsReady = docs === "ready";
    const repairRequired = [
      !driveReady ? "drive_items" : null,
      !docsReady ? "documents" : null,
    ].filter((value): value is string => Boolean(value));

    const ecosystemTablesReady = [
      catalog.conversations_table,
      catalog.chat_messages_table,
      catalog.social_profiles_table,
      driveReady,
      docsReady,
      catalog.meetings_table,
      catalog.deploy_projects_table,
      catalog.cloud_resources_table,
      catalog.organizations_table,
      catalog.wallets_table,
    ].filter(Boolean).length;
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
        productRecords,
        drive,
        docs,
        ecosystem,
        repairRequired,
      },
      integrations,
      launchReady: coreReady
        && automationReady
        && memoryReady
        && productRecords === "ready"
        && driveReady
        && docsReady
        && ecosystem === "ready"
        && externalReady,
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
