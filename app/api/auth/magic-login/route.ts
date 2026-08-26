import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, authCookieOptions, createSession } from "@/lib/auth";

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (token.length < 32) return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);

  const sql = getSql();
  if (!sql) return NextResponse.redirect(new URL("/login?error=config", request.url), 303);

  const tokenHash = hashToken(token);
  const rows = await sql`
    WITH valid_token AS (
      SELECT prt.id, u.email, COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)) AS name
      FROM public.password_reset_tokens prt
      JOIN public.users u ON u.id = prt.user_id
      WHERE prt.token_hash = ${tokenHash}
        AND prt.used_at IS NULL
        AND prt.expires_at > now()
        AND u.is_active = true
        AND u.is_superadmin = true
      FOR UPDATE
    ), consumed AS (
      UPDATE public.password_reset_tokens prt
      SET used_at = now()
      FROM valid_token vt
      WHERE prt.id = vt.id
      RETURNING vt.email, vt.name
    )
    SELECT email, name FROM consumed
  ` as Array<{ email: string; name: string }>;

  const user = rows[0];
  if (!user) return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.cookies.set(SESSION_COOKIE, createSession({ email: user.email, name: user.name }), {
    ...authCookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
