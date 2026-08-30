import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, authCookieOptions, createSession } from "@/lib/auth";
import { ensureNeyvixSubscription } from "@/lib/subscription-heal";

const MAGIC_LOGIN_TOKEN_NAMESPACE = "neyvix:magic-login:v1:";
const MAGIC_LOGIN_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DEFAULT_PUBLIC_ORIGIN = "https://neyvix.vercel.app";

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function trustedPublicOrigin() {
  const configured = process.env.NEYVIX_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return DEFAULT_PUBLIC_ORIGIN;

  try {
    const url = new URL(configured);
    return url.protocol === "https:" ? url.origin : DEFAULT_PUBLIC_ORIGIN;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

function hashMagicLoginToken(token: string) {
  return createHash("sha256").update(`${MAGIC_LOGIN_TOKEN_NAMESPACE}${token}`).digest("hex");
}

function secureRedirect(path: string) {
  const response = NextResponse.redirect(new URL(path, trustedPublicOrigin()), 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim() ?? "";

    if (!MAGIC_LOGIN_TOKEN_PATTERN.test(token)) {
      return secureRedirect("/login?error=invalid");
    }

    const sql = getSql();
    if (!sql) return secureRedirect("/login?error=config");

    const tokenHash = hashMagicLoginToken(token);

    // Read the candidate first, but do not burn the one-time token until the
    // account is actually ready to enter. A transient entitlement repair
    // failure must not turn a valid magic link into an unusable one.
    const candidates = await sql`
      SELECT
        prt.id AS token_id,
        u.id AS user_id,
        u.email,
        COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)) AS name,
        u.updated_at
      FROM public.password_reset_tokens prt
      JOIN public.users u ON u.id = prt.user_id
      WHERE prt.token_hash = ${tokenHash}
        AND prt.used_at IS NULL
        AND prt.expires_at > now()
        AND u.is_active = true
      LIMIT 1
    ` as Array<{ token_id: string; user_id: string; email: string; name: string; updated_at: string }>;

    const candidate = candidates[0];
    if (!candidate) return secureRedirect("/login?error=invalid");

    const securityEpochMs = new Date(candidate.updated_at).getTime();
    if (!Number.isFinite(securityEpochMs)) {
      console.error("NEYVIX magic login blocked: invalid security epoch", { userId: candidate.user_id });
      return secureRedirect("/login?error=config");
    }

    const subscriptionReady = await ensureNeyvixSubscription(candidate.user_id);
    if (!subscriptionReady) {
      console.error("NEYVIX magic login blocked: subscription repair could not confirm entitlement", { userId: candidate.user_id });
      return secureRedirect("/login?error=config");
    }

    // Consume atomically after entitlement is ready. Concurrent replays can
    // race through the read above, but only one request can win this UPDATE.
    const consumed = await sql`
      UPDATE public.password_reset_tokens
      SET used_at = now()
      WHERE id = ${candidate.token_id}
        AND token_hash = ${tokenHash}
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING id
    ` as Array<{ id: string }>;

    if (!consumed[0]) return secureRedirect("/login?error=invalid");

    const response = secureRedirect("/dashboard");
    response.cookies.set(SESSION_COOKIE, createSession({ email: candidate.email, name: candidate.name }, securityEpochMs), {
      ...authCookieOptions,
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error("Falha no magic login do NEYVIX ID", error);
    return secureRedirect("/login?error=config");
  }
}
