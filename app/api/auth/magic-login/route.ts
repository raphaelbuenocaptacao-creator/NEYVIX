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

function secureRedirect(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim() ?? "";
    if (token.length < 32) return secureRedirect(request, "/login?error=invalid");

    const sql = getSql();
    if (!sql) return secureRedirect(request, "/login?error=config");

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
    if (!user) return secureRedirect(request, "/login?error=invalid");

    const response = secureRedirect(request, "/dashboard");
    response.cookies.set(SESSION_COOKIE, createSession({ email: user.email, name: user.name }), {
      ...authCookieOptions,
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error("Falha no magic login do NEYVIX ID", error);
    return secureRedirect(request, "/login?error=config");
  }
}
