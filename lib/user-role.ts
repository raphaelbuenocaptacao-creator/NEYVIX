import { neon } from "@neondatabase/serverless";

export type NeyvixRole = "member" | "cro" | "admin" | "superadmin";

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

export async function getUserRole(email: string): Promise<NeyvixRole> {
  const sql = getSql();
  if (!sql) return "member";

  const rows = await sql`
    SELECT role, is_superadmin, is_active
    FROM public.users
    WHERE lower(email) = ${email.trim().toLowerCase()}
    LIMIT 1
  `;
  const row = rows[0] as { role?: string; is_superadmin?: boolean; is_active?: boolean } | undefined;
  if (!row?.is_active) return "member";
  if (row.role === "cro") return "cro";
  if (row.role === "admin") return "admin";
  if (row.role === "superadmin" || row.is_superadmin) return "superadmin";
  return "member";
}
