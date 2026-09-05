import { neon } from "@neondatabase/serverless";

const SMOKE_EMAIL_RE = /^(?:e2e-smoke|e2e-ai-mem|business-negative|business-positive|mail-access)-[a-z0-9-]+@neyvix\.com$/i;

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

export function isSmokeAccountEmail(email: string) {
  return SMOKE_EMAIL_RE.test(email.trim().toLowerCase());
}

export async function deleteEphemeralSmokeUser(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isSmokeAccountEmail(normalizedEmail)) return false;

  const sql = getSql();
  if (!sql) return false;

  // There is currently no loans table in the NEYVIX production schema. The
  // previous cleanup queried public.loans unconditionally, so every cleanup
  // failed before the user DELETE could run. Stay conservative if a loans
  // table is introduced later: refuse automatic deletion until its ownership
  // semantics are explicitly reviewed instead of guessing about borrower data.
  const relations = await sql`
    SELECT to_regclass('public.loans')::text AS loans_table
  `;
  if (relations[0]?.loans_table) return false;

  const rows = await sql`
    DELETE FROM public.users u
    WHERE u.email = ${normalizedEmail}
      AND u.is_superadmin = false
    RETURNING u.id
  `;

  return rows.length === 1;
}
