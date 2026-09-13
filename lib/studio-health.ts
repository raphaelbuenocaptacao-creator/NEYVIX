import { neon } from "@neondatabase/serverless";

const STUDIO_PROJECT_COLUMNS = [
  "id",
  "user_id",
  "title",
  "prompt",
  "blueprint",
  "status",
  "created_at",
  "updated_at",
] as const;

type StudioHealthChecks = {
  table: boolean;
  columns: boolean;
};

export type StudioHealth = {
  ready: boolean;
  database: "connected" | "not_configured" | "error";
  checks: StudioHealthChecks;
};

function emptyChecks(): StudioHealthChecks {
  return { table: false, columns: false };
}

export async function getStudioHealth(): Promise<StudioHealth> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return { ready: false, database: "not_configured", checks: emptyChecks() };
  }

  try {
    const sql = neon(databaseUrl);
    const rows = (await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'neyvix_studio_projects'
      ORDER BY ordinal_position
    `) as Array<{ column_name: string }>;

    const columns = new Set(rows.map((row) => row.column_name));
    const checks: StudioHealthChecks = {
      table: columns.size > 0,
      columns: STUDIO_PROJECT_COLUMNS.every((column) => columns.has(column)),
    };

    return {
      ready: checks.table && checks.columns,
      database: "connected",
      checks,
    };
  } catch {
    return { ready: false, database: "error", checks: emptyChecks() };
  }
}
