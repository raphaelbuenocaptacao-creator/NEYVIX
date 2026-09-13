import { neon } from "@neondatabase/serverless";

const REQUIRED_COLUMNS = {
  users: ["id", "email", "is_active", "is_superadmin", "updated_at", "role"],
  sessions: ["id", "user_id", "refresh_token_hash", "expires_at", "revoked_at", "created_at"],
  projects: ["id", "slug", "is_active"],
  subscriptions: ["project_id", "user_id", "plan_id", "status", "trial_ends_at"],
  plans: ["id", "project_id", "code", "features"],
  neyvix_ai_messages: ["user_id", "role", "content", "created_at"],
  neyvix_studio_projects: ["user_id", "title", "status", "updated_at"],
  neyvix_content_items: ["user_id", "kind", "content", "created_at"],
  neyvix_estate_sites: ["user_id", "status", "brand", "city", "updated_at"],
  neyvix_automations: ["user_id", "status", "name", "updated_at"],
  neyvix_approval_requests: ["requested_by", "status", "title", "decided_at", "created_at"],
} as const;

type CommandCenterChecks = {
  identity: boolean;
  entitlements: boolean;
  activity: boolean;
};

export type CommandCenterHealth = {
  ready: boolean;
  database: "connected" | "not_configured" | "error";
  checks: CommandCenterChecks;
};

function emptyChecks(): CommandCenterChecks {
  return { identity: false, entitlements: false, activity: false };
}

function tableReady(columns: Map<string, Set<string>>, table: keyof typeof REQUIRED_COLUMNS) {
  const actual = columns.get(table) ?? new Set<string>();
  return REQUIRED_COLUMNS[table].every((column) => actual.has(column));
}

export async function getCommandCenterHealth(): Promise<CommandCenterHealth> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return { ready: false, database: "not_configured", checks: emptyChecks() };
  }

  try {
    const sql = neon(databaseUrl);
    const rows = (await sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'users',
          'sessions',
          'projects',
          'subscriptions',
          'plans',
          'neyvix_ai_messages',
          'neyvix_studio_projects',
          'neyvix_content_items',
          'neyvix_estate_sites',
          'neyvix_automations',
          'neyvix_approval_requests'
        )
    `) as Array<{ table_name: string; column_name: string }>;

    const columns = new Map<string, Set<string>>();
    for (const row of rows) {
      const actual = columns.get(row.table_name) ?? new Set<string>();
      actual.add(row.column_name);
      columns.set(row.table_name, actual);
    }

    const checks: CommandCenterChecks = {
      identity: tableReady(columns, "users") && tableReady(columns, "sessions"),
      entitlements: tableReady(columns, "projects")
        && tableReady(columns, "subscriptions")
        && tableReady(columns, "plans"),
      activity: tableReady(columns, "neyvix_ai_messages")
        && tableReady(columns, "neyvix_studio_projects")
        && tableReady(columns, "neyvix_content_items")
        && tableReady(columns, "neyvix_estate_sites")
        && tableReady(columns, "neyvix_automations")
        && tableReady(columns, "neyvix_approval_requests"),
    };

    return {
      ready: Object.values(checks).every(Boolean),
      database: "connected",
      checks,
    };
  } catch {
    return { ready: false, database: "error", checks: emptyChecks() };
  }
}
