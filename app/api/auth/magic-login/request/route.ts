import { createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { deliverMail, getMailTransportStatus } from "@/lib/mail-transport";
import { clientAddress, isRateLimited, rateLimitBucket, recordRateLimitEvent } from "@/lib/rate-limit";

const MAGIC_LOGIN_TTL_MINUTES = 10;
const MAGIC_LOGIN_ACCOUNT_LIMIT = 5;
const MAGIC_LOGIN_ORIGIN_LIMIT = 20;
const MAGIC_LOGIN_RATE_WINDOW_MINUTES = 30;
const MAGIC_LOGIN_TOKEN_NAMESPACE = "neyvix:magic-login:v1:";
const DEFAULT_PUBLIC_ORIGIN = "https://neyvix.vercel.app";

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function hashMagicLoginToken(token: string) {
  return createHash("sha256").update(`${MAGIC_LOGIN_TOKEN_NAMESPACE}${token}`).digest("hex");
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

function secureRedirect(path: string) {
  const response = NextResponse.redirect(new URL(path, trustedPublicOrigin()), 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();

    if (!validEmail(email) || email.length > 254) {
      return secureRedirect("/login?magic=invalid");
    }

    // Rate-limit both the target account and the request origin independently.
    // A combined email+IP bucket can be bypassed by rotating either dimension.
    const address = clientAddress(request);
    const accountBucket = rateLimitBucket(`magic-login|account|${email}`);
    const originBucket = rateLimitBucket(`magic-login|origin|${address}`);
    const [accountLimited, originLimited] = await Promise.all([
      isRateLimited(
        "magic_login_request_account",
        accountBucket,
        MAGIC_LOGIN_ACCOUNT_LIMIT,
        MAGIC_LOGIN_RATE_WINDOW_MINUTES,
      ),
      isRateLimited(
        "magic_login_request_origin",
        originBucket,
        MAGIC_LOGIN_ORIGIN_LIMIT,
        MAGIC_LOGIN_RATE_WINDOW_MINUTES,
      ),
    ]);

    if (accountLimited || originLimited) {
      return secureRedirect("/login?magic=rate_limit");
    }

    const sql = getSql();
    const transport = getMailTransportStatus();
    if (!sql || !transport.ready) {
      return secureRedirect("/login?magic=unavailable");
    }

    // Record both dimensions before account lookup so unknown addresses and
    // known accounts have the same public throttling behavior.
    await Promise.all([
      recordRateLimitEvent("magic_login_request_account", accountBucket),
      recordRateLimitEvent("magic_login_request_origin", originBucket),
    ]);

    const users = await sql`
      SELECT id, email, COALESCE(NULLIF(name, ''), split_part(email, '@', 1)) AS name
      FROM public.users
      WHERE lower(email) = ${email} AND is_active = true
      LIMIT 1
    ` as Array<{ id: string; email: string; name: string }>;

    const user = users[0];
    if (!user) {
      // Keep the public response indistinguishable for unknown accounts.
      return secureRedirect("/login?magic=sent");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashMagicLoginToken(token);

    // password_reset_tokens is currently shared with password recovery. Do not
    // bulk-invalidate rows here: doing so would revoke a valid password-reset
    // token merely because the same user requested a magic-login link.
    // Magic-login tokens remain single-use because the consumer atomically
    // marks only the matching namespaced hash as used.
    await sql`
      INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, now() + (${MAGIC_LOGIN_TTL_MINUTES} || ' minutes')::interval)
    `;

    // Never derive an emailed authentication link from the inbound Host header.
    // A canonical HTTPS origin prevents host-header poisoning from sending a
    // valid one-time token to an attacker-controlled origin.
    const magicUrl = new URL("/api/auth/magic-login", trustedPublicOrigin());
    magicUrl.searchParams.set("token", token);

    const delivered = await deliverMail({
      from: "no-reply@neyvix.com",
      to: user.email,
      subject: "Seu acesso mágico ao NEYVIX",
      text: `Use este link para entrar no NEYVIX. Ele expira em ${MAGIC_LOGIN_TTL_MINUTES} minutos e só pode ser usado uma vez:\n\n${magicUrl.toString()}\n\nSe você não solicitou este acesso, ignore esta mensagem.`,
    });

    if (!delivered.ok) {
      await sql`
        UPDATE public.password_reset_tokens
        SET used_at = now()
        WHERE token_hash = ${tokenHash} AND used_at IS NULL
      `;
      console.warn("NEYVIX magic-login delivery failed", delivered.reason);
      // Once the transport is globally ready, never reveal whether a specific
      // address exists or whether provider delivery failed for that address.
      // The token is burned above, so returning the generic public success state
      // cannot create a usable authentication path.
      return secureRedirect("/login?magic=sent");
    }

    return secureRedirect("/login?magic=sent");
  } catch (error) {
    console.error("Falha ao solicitar magic login do NEYVIX ID", error);
    return secureRedirect("/login?magic=unavailable");
  }
}
