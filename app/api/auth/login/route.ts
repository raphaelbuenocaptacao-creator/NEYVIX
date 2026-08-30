import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, SESSION_COOKIE, authCookieOptions, createSession, passwordMatches, readAccount } from "@/lib/auth";
import { authenticateDatabaseUser, hasDatabase } from "@/lib/db";
import { clientAddress, clearRateLimitBucket, isRateLimited, rateLimitBucket, recordRateLimitEvent } from "@/lib/rate-limit";

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

function hardenedRedirect(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function loginErrorUrl(request: Request, error: "invalid" | "config" | "rate_limit", next: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  if (next !== "/dashboard") url.searchParams.set("next", next);
  return url;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const next = safeNext(form.get("next"));
    const bucket = rateLimitBucket(`${email}|${clientAddress(request)}`);

    if (await isRateLimited("login", bucket, 5, 15)) {
      return hardenedRedirect(NextResponse.redirect(loginErrorUrl(request, "rate_limit", next), 303));
    }

    if (hasDatabase()) {
      const user = await authenticateDatabaseUser(email, password);
      if (!user) {
        await recordRateLimitEvent("login", bucket);
        return hardenedRedirect(NextResponse.redirect(loginErrorUrl(request, "invalid", next), 303));
      }

      await clearRateLimitBucket("login", bucket);
      const response = NextResponse.redirect(new URL(next, request.url), 303);
      response.cookies.set(SESSION_COOKIE, createSession(user), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
      response.cookies.set(ACCOUNT_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
      return hardenedRedirect(response);
    }

    if (process.env.NODE_ENV === "production") {
      console.error("NEYVIX ID login blocked: DATABASE_URL is not configured in production");
      return hardenedRedirect(NextResponse.redirect(loginErrorUrl(request, "config", next), 303));
    }

    const store = await cookies();
    const account = readAccount(store.get(ACCOUNT_COOKIE)?.value);
    if (!account || account.email !== email || !passwordMatches(account, password)) {
      await recordRateLimitEvent("login", bucket);
      return hardenedRedirect(NextResponse.redirect(loginErrorUrl(request, "invalid", next), 303));
    }

    await clearRateLimitBucket("login", bucket);
    const response = NextResponse.redirect(new URL(next, request.url), 303);
    response.cookies.set(SESSION_COOKIE, createSession(account), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
    return hardenedRedirect(response);
  } catch (error) {
    console.error("Falha no login do NEYVIX ID", error);
    return hardenedRedirect(NextResponse.redirect(new URL("/login?error=config", request.url), 303));
  }
}
