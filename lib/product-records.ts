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
    RETURNING c.id
  `;

  return rows.length === 1;
}
