import { neon } from "@neondatabase/serverless";

const USER_360_TABLES = {
  users: ["id", "name", "email", "is_active", "is_superadmin", "created_at"],
  projects: ["id", "slug"],
  subscriptions: ["user_id", "project_id", "status", "trial_ends_at"],
  neyvix_ai_messages: ["user_id", "role", "content", "created_at"],
  neyvix_studio_projects: ["user_id", "status", "title", "updated_at"],
  neyvix_content_items: ["user_id", "kind", "content", "created_at"],
  neyvix_estate_sites: ["user_id", "status", "brand", "city", "updated_at"],
  neyvix_automations: ["user_id", "status", "name", "updated_at"],
  neyvix_approval_requests: ["requested_by", "status", "title", "decided_at", "created_at"],
} as const;

type User360HealthChecks = {
  tables: boolean;
  columns: boolean;
};

export type AdminUser360Health = {
  ready: boolean;
  database: "connected" | "not_configured" | "error";
  checks: User360HealthChecks;
};

function emptyChecks(): User360HealthChecks {
  return { tables: false, columns: false };
}

export async function getAdminUser360Health(): Promise<AdminUser360Health> {
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
          'projects',
          'subscriptions',
          'neyvix_ai_messages',
          'neyvix_studio_projects',
          'neyvix_content_items',
          'neyvix_estate_sites',
          'neyvix_automations',
          'neyvix_approval_requests'
        )
      ORDER BY table_name, ordinal_position
    `) as Array<{ table_name: string; column_name: string }>;

    const columnsByTable = new Map<string, Set<string>>();
    for (const row of rows) {
      const columns = columnsByTable.get(row.table_name) ?? new Set<string>();
      columns.add(row.column_name);
      columnsByTable.set(row.table_name, columns);
    }

    const contracts = Object.entries(USER_360_TABLES);
    const checks: User360HealthChecks = {
      tables: contracts.every(([table]) => columnsByTable.has(table)),
      columns: contracts.every(([table, requiredColumns]) => {
        const columns = columnsByTable.get(table);
        return Boolean(columns) && requiredColumns.every((column) => columns?.has(column));
      }),
    };

    return {
      ready: checks.tables && checks.columns,
      database: "connected",
      checks,
    };
  } catch {
    return { ready: false, database: "error", checks: emptyChecks() };
  }
}
