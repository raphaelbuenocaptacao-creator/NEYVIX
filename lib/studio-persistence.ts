import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

export async function saveStudioProjectTyped(email: string, prompt: string, blueprintText: string) {
  const sql = getSql();
  if (!sql) return null;

  const cleanPrompt = prompt.trim();
  const title = cleanPrompt.slice(0, 80) || "Projeto NEYVIX Studio";
  const normalizedEmail = email.trim().toLowerCase();

  const rows = await sql`
    INSERT INTO public.neyvix_studio_projects (user_id, title, prompt, blueprint, status)
    SELECT
      id,
      ${title}::text,
      ${cleanPrompt}::text,
      jsonb_build_object('text', ${blueprintText}::text),
      'generated'
    FROM public.users
    WHERE email = ${normalizedEmail}::text
    RETURNING id, title, status, created_at, updated_at
  `;

  return rows[0] ?? null;
}
