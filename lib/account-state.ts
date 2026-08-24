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
