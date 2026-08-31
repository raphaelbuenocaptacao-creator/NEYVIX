import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, SESSION_COOKIE, authCookieOptions, createAccount, createSession } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { clientAddress, isRateLimited, rateLimitBucket, recordRateLimitEvent } from "@/lib/rate-limit";
import { createRegisteredUser } from "@/lib/register-db";

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

function hardenedRedirect(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function errorUrl(code: "invalid" | "taken" | "config" | "rate_limit") {
  const url = trustedUrl("/register");
  url.searchParams.set("error", code);
  return url;
}

function safeFailureCode(error: unknown) {
  if (!error || typeof error !== "object") return "runtime";
  const code = "code" in error ? String(error.code ?? "") : "";
  return /^[0-9A-Z]{5}$/.test(code) ? `db-${code}` : "runtime";
}

const planCodes: Record<string, string> = {
  start: "start-monthly",
  pro: "pro-monthly",
  business: "business-monthly",
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const name = String(form.get("name") ?? "");
    const handle = String(form.get("handle") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const selectedPlan = String(form.get("plan") ?? "").trim().toLowerCase();
    const safeHandle = /^[a-z0-9][a-z0-9._-]{2,31}$/.test(handle);
    const safePlan = selectedPlan === "" || Boolean(planCodes[selectedPlan]);
    const email = `${handle}@neyvix.com`;
    const bucket = rateLimitBucket(clientAddress(request));

    if (await isRateLimited("register", bucket, 8, 30)) {
      return hardenedRedirect(NextResponse.redirect(errorUrl("rate_limit"), 303));
    }

    if (name.trim().length < 2 || !safeHandle || password.length < 8 || !safePlan) {
      await recordRateLimitEvent("register", bucket);
      return hardenedRedirect(NextResponse.redirect(errorUrl("invalid"), 303));
    }

    await recordRateLimitEvent("register", bucket);

    if (hasDatabase()) {
      const user = await createRegisteredUser(name, email, password, selectedPlan ? planCodes[selectedPlan] : null);
      if (!user) {
        return hardenedRedirect(NextResponse.redirect(errorUrl("taken"), 303));
      }

      const response = NextResponse.redirect(trustedUrl("/dashboard"), 303);
      response.cookies.set(SESSION_COOKIE, createSession(user, user.securityEpochMs), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
      response.cookies.delete(ACCOUNT_COOKIE);
      return hardenedRedirect(response);
    }

    if (process.env.NODE_ENV === "production") {
      console.error("NEYVIX ID registration blocked: DATABASE_URL is not configured in production");
      return hardenedRedirect(NextResponse.redirect(errorUrl("config"), 303));
    }

    // Preview-only fallback for non-production environments without DATABASE_URL.
    const { account, token } = createAccount(name, email, password);
    const response = NextResponse.redirect(trustedUrl("/dashboard"), 303);
    response.cookies.set(ACCOUNT_COOKIE, token, { ...authCookieOptions, maxAge: 60 * 60 * 24 * 365 });
    response.cookies.set(SESSION_COOKIE, createSession(account), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
    return hardenedRedirect(response);
  } catch (error) {
    const failureCode = safeFailureCode(error);
    console.error("NEYVIX ID registration failed", failureCode);
    const response = NextResponse.redirect(errorUrl("config"), 303);
    response.headers.set("X-Neyvix-Auth-Failure", failureCode);
    return hardenedRedirect(response);
  }
}
