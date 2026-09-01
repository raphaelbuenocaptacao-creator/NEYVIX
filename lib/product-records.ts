import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
