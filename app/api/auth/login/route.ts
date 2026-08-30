import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, SESSION_COOKIE, authCookieOptions, createSession, passwordMatches, readAccount } from "@/lib/auth";
import { authenticateDatabaseUser, hasDatabase } from "@/lib/db";
import { getAccountSecurityState } from "@/lib/account-state";
import { clientAddress, clearRateLimitBucket, isRateLimited, rateLimitBucket, recordRateLimitEvent } from "@/lib/rate-limit";

const DEFAULT_PUBLIC_ORIGIN = "https://neyvix.vercel.app";

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

function trustedUrl(path: string) {
  return new URL(path, trustedPublicOrigin());
}

function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "/dashboard");
  const base = "https://neyvix.local";

  try {
    const parsed = new URL(next, base);
    if (parsed.origin !== base) return "/dashboard";
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function normalizeIdentity(value: FormDataEntryValue | null) {
  const identity = String(value ?? "").trim().toLowerCase();
  if (!identity) return "";
  if (identity.includes("@")) return identity;
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(identity)) return identity;
  return `${identity}@neyvix.com`;
}

function hardenedRedirect(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function loginErrorUrl(error: "invalid" | "config" | "rate_limit", next: string) {
  const url = trustedUrl("/login");
  url.searchParams.set("error", error);
  if (next !== "/dashboard") url.searchParams.set("next", next);
  return url;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = normalizeIdentity(form.get("email"));
    const password = String(form.get("password") ?? "");
    const next = safeNext(form.get("next"));
    const bucket = rateLimitBucket(`${email}|${clientAddress(request)}`);

    if (await isRateLimited("login", bucket, 5, 15)) {
      return hardenedRedirect(NextResponse.redirect(loginErrorUrl("rate_limit", next), 303));
    }

    if (hasDatabase()) {
      const user = await authenticateDatabaseUser(email, password);
      if (!user) {
        await recordRateLimitEvent("login", bucket);
        return hardenedRedirect(NextResponse.redirect(loginErrorUrl("invalid", next), 303));
      }

      const accountState = await getAccountSecurityState(user.email);
      const securityEpochMs = accountState ? new Date(accountState.updatedAt).getTime() : Number.NaN;
      if (!accountState?.isActive || !Number.isFinite(securityEpochMs)) {
        return hardenedRedirect(NextResponse.redirect(loginErrorUrl("config", next), 303));
      }

      await clearRateLimitBucket("login", bucket);
      const response = NextResponse.redirect(trustedUrl(next), 303);
      response.cookies.set(SESSION_COOKIE, createSession(user, securityEpochMs), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
      response.cookies.set(ACCOUNT_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
      return hardenedRedirect(response);
    }

    if (process.env.NODE_ENV === "production") {
      console.error("NEYVIX ID login blocked: DATABASE_URL is not configured in production");
      return hardenedRedirect(NextResponse.redirect(loginErrorUrl("config", next), 303));
    }

    const store = await cookies();
    const account = readAccount(store.get(ACCOUNT_COOKIE)?.value);
    if (!account || account.email !== email || !passwordMatches(account, password)) {
      await recordRateLimitEvent("login", bucket);
      return hardenedRedirect(NextResponse.redirect(loginErrorUrl("invalid", next), 303));
    }

    await clearRateLimitBucket("login", bucket);
    const response = NextResponse.redirect(trustedUrl(next), 303);
    response.cookies.set(SESSION_COOKIE, createSession(account), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
    return hardenedRedirect(response);
  } catch (error) {
    console.error("Falha no login do NEYVIX ID", error);
    return hardenedRedirect(NextResponse.redirect(trustedUrl("/login?error=config"), 303));
  }
}
