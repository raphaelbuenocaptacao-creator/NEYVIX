import { createHash, randomBytes, scryptSync } from "node:crypto";
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

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function consumePasswordResetToken(token: string, password: string) {
  const sql = getSql();
  if (!sql || token.trim().length < 20 || password.length < 10) return false;

  const tokenHash = hashToken(token.trim());
  const passwordHash = encodePassword(password);

  const rows = await sql`
    WITH valid_token AS (
      SELECT prt.id, prt.user_id
      FROM public.password_reset_tokens prt
      JOIN public.users u ON u.id = prt.user_id
      WHERE prt.token_hash = ${tokenHash}
        AND prt.used_at IS NULL
        AND prt.expires_at > now()
        AND u.is_active = true
      FOR UPDATE
    ), updated_user AS (
      UPDATE public.users u
      SET password_hash = ${passwordHash}
      FROM valid_token vt
      WHERE u.id = vt.user_id
      RETURNING u.id
    )
    UPDATE public.password_reset_tokens prt
    SET used_at = now()
    FROM valid_token vt, updated_user uu
    WHERE prt.id = vt.id AND uu.id = vt.user_id
    RETURNING prt.id
  `;

  return rows.length === 1;
}
