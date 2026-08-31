import { neon } from "@neondatabase/serverless";

export type AccountSecurityState = {
  isActive: boolean;
  isSuperadmin: boolean;
  updatedAt: string;
};

export async function getAccountSecurityState(email: string): Promise<AccountSecurityState | null> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  const sql = neon(url);
  const rows = await sql`
    SELECT is_active, is_superadmin, updated_at
    FROM public.users
    WHERE lower(email) = ${email.trim().toLowerCase()}
    LIMIT 1
  ` as Array<{ is_active: boolean; is_superadmin: boolean; updated_at: string }>;

  const row = rows[0];
  if (!row) return null;
  return {
    isActive: Boolean(row.is_active),
    isSuperadmin: Boolean(row.is_superadmin),
    updatedAt: String(row.updated_at),
  };
}

export async function revokeSessionsIssuedThrough(email: string, issuedAtMs: number) {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return false;
  if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) return false;

  const sql = neon(url);
  // Some legacy users.updated_at columns have second-level precision. Move the
  // security epoch to the next full second so a replayed cookie is always older
  // than the persisted epoch even when PostgreSQL truncates fractional seconds.
  // A subsequent login binds its new session to this exact database epoch.
  const cutoffMs = Math.ceil((issuedAtMs + 1) / 1000) * 1000;
  const cutoff = new Date(cutoffMs).toISOString();
  const rows = await sql`
    UPDATE public.users
    SET updated_at = GREATEST(updated_at, ${cutoff}::timestamptz)
    WHERE lower(email) = ${email.trim().toLowerCase()}
    RETURNING email
  ` as Array<{ email: string }>;

  return rows.length === 1;
}
