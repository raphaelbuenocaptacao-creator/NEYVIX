import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, SESSION_COOKIE, authCookieOptions, createAccount, createSession } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { clientAddress, isRateLimited, rateLimitBucket, recordRateLimitEvent } from "@/lib/rate-limit";
import { createRegisteredUser } from "@/lib/register-db";

function hardenedRedirect(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function errorUrl(request: Request, code: "invalid" | "taken" | "config" | "rate_limit") {
  const url = new URL("/register", request.url);
  url.searchParams.set("error", code);
  return url;
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
      return hardenedRedirect(NextResponse.redirect(errorUrl(request, "rate_limit"), 303));
    }

    if (name.trim().length < 2 || !safeHandle || password.length < 8 || !safePlan) {
      await recordRateLimitEvent("register", bucket);
      return hardenedRedirect(NextResponse.redirect(errorUrl(request, "invalid"), 303));
    }

    await recordRateLimitEvent("register", bucket);

    if (hasDatabase()) {
      const user = await createRegisteredUser(name, email, password, selectedPlan ? planCodes[selectedPlan] : null);
      if (!user) {
        return hardenedRedirect(NextResponse.redirect(errorUrl(request, "taken"), 303));
      }

      const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
      response.cookies.set(SESSION_COOKIE, createSession(user, user.securityEpochMs), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
      response.cookies.delete(ACCOUNT_COOKIE);
      return hardenedRedirect(response);
    }

    if (process.env.NODE_ENV === "production") {
      console.error("NEYVIX ID registration blocked: DATABASE_URL is not configured in production");
      return hardenedRedirect(NextResponse.redirect(errorUrl(request, "config"), 303));
    }

    // Preview-only fallback for non-production environments without DATABASE_URL.
    const { account, token } = createAccount(name, email, password);
    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    response.cookies.set(ACCOUNT_COOKIE, token, { ...authCookieOptions, maxAge: 60 * 60 * 24 * 365 });
    response.cookies.set(SESSION_COOKIE, createSession(account), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
    return hardenedRedirect(response);
  } catch (error) {
    console.error("NEYVIX ID registration failed", error);
    return hardenedRedirect(NextResponse.redirect(errorUrl(request, "config"), 303));
  }
}
