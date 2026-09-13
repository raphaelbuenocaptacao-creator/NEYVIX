import { neon } from "@neondatabase/serverless";

const CONTENT_ITEM_COLUMNS = [
  "id",
  "user_id",
  "kind",
  "prompt",
  "content",
  "created_at",
] as const;

type ContentHealthChecks = {
  table: boolean;
  columns: boolean;
};

export type ContentHealth = {
  ready: boolean;
  database: "connected" | "not_configured" | "error";
  checks: ContentHealthChecks;
};

function emptyChecks(): ContentHealthChecks {
  return { table: false, columns: false };
}

export async function getContentHealth(): Promise<ContentHealth> {
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
        AND table_name = 'neyvix_content_items'
      ORDER BY ordinal_position
    `) as Array<{ column_name: string }>;

    const columns = new Set(rows.map((row) => row.column_name));
    const checks: ContentHealthChecks = {
      table: columns.size > 0,
      columns: CONTENT_ITEM_COLUMNS.every((column) => columns.has(column)),
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
