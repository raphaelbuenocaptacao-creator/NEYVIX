import { neon } from "@neondatabase/serverless";

const PRODUCT_RECORD_SCHEMA = {
  studio: {
    table: "neyvix_studio_projects",
    columns: ["id", "user_id", "title", "prompt", "blueprint", "status", "created_at", "updated_at"],
  },
  content: {
    table: "neyvix_content_items",
    columns: ["id", "user_id", "kind", "prompt", "content", "created_at"],
  },
} as const;

export type ProductRecordKind = keyof typeof PRODUCT_RECORD_SCHEMA;

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function isProductRecordSchemaReady(kind: ProductRecordKind) {
  const sql = getSql();
  if (!sql) return false;

  const contract = PRODUCT_RECORD_SCHEMA[kind];
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${contract.table}
  ` as Array<{ column_name?: unknown }>;

  const columns = new Set(
    rows
      .map((row) => typeof row.column_name === "string" ? row.column_name : "")
      .filter(Boolean),
  );

  return contract.columns.every((column) => columns.has(column));
}

export async function deleteStudioProject(email: string, id: string) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    DELETE FROM public.neyvix_studio_projects p
    USING public.users u
    WHERE p.id = ${id}
      AND p.user_id = u.id
      AND u.email = ${normalizeEmail(email)}
      AND u.is_active = true
    RETURNING p.id
  `;

  return rows.length === 1;
}

export async function updateStudioProjectTitle(email: string, id: string, title: string) {
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    UPDATE public.neyvix_studio_projects p
    SET title = ${title.trim()}, updated_at = now()
    FROM public.users u
    WHERE p.id = ${id}::uuid
      AND p.user_id = u.id
      AND lower(u.email) = ${normalizeEmail(email)}
      AND u.is_active = true
    RETURNING p.id, p.title, p.status, p.updated_at
  ` as Array<Record<string, unknown>>;

  return rows[0] ?? null;
}

export async function deleteContentItem(email: string, id: string) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    DELETE FROM public.neyvix_content_items c
    USING public.users u
    WHERE c.id = ${id}
      AND c.user_id = u.id
      AND u.email = ${normalizeEmail(email)}
      AND u.is_active = true
    RETURNING c.id
  `;

  return rows.length === 1;
}

export async function updateContentItem(email: string, id: string, content: string) {
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    UPDATE public.neyvix_content_items c
    SET content = ${content.trim()}
    FROM public.users u
    WHERE c.id = ${id}::uuid
      AND c.user_id = u.id
      AND lower(u.email) = ${normalizeEmail(email)}
      AND u.is_active = true
    RETURNING c.id, c.kind, c.prompt, c.content, c.created_at
  ` as Array<Record<string, unknown>>;

  return rows[0] ?? null;
}
