import { neon } from "@neondatabase/serverless";

const SMOKE_EMAIL_RE = /^e2e-smoke-[a-z0-9-]+@neyvix\.com$/i;

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

  const rows = await sql`
    DELETE FROM public.users u
    WHERE u.email = ${normalizedEmail}
      AND u.is_superadmin = false
      AND NOT EXISTS (
        SELECT 1 FROM public.loans l WHERE l.borrower_id = u.id
      )
    RETURNING u.id
  `;

  return rows.length === 1;
}
