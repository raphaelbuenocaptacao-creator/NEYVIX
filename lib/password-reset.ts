import { randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function encodePassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `${salt}.${hash}`;
}

export async function resetAuthorizedAdminPassword(email: string, password: string) {
  const sql = getSql();
  if (!sql || password.length < 10) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = encodePassword(password);
  const rows = await sql`
    UPDATE public.users
    SET password_hash = ${passwordHash}
    WHERE lower(email) = ${normalizedEmail}
      AND is_active = true
      AND is_superadmin = true
    RETURNING id
  `;

  return rows.length === 1;
}
