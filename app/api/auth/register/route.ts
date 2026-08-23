import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, SESSION_COOKIE, authCookieOptions, createAccount, createSession } from "@/lib/auth";
import { createDatabaseUser, hasDatabase } from "@/lib/db";

const validPlans = new Set(["start", "pro", "business"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const name = String(form.get("name") ?? "");
    const handle = String(form.get("handle") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const requestedPlan = String(form.get("plan") ?? "").trim().toLowerCase();
    const plan = validPlans.has(requestedPlan) ? requestedPlan : "";
    const safeHandle = /^[a-z0-9][a-z0-9._-]{2,31}$/.test(handle);
    const email = `${handle}@neyvix.com`;

    if (name.trim().length < 2 || !safeHandle || password.length < 8) {
      const suffix = plan ? `&plan=${plan}` : "";
      return NextResponse.redirect(new URL(`/register?error=invalid${suffix}`, request.url), 303);
    }

    if (hasDatabase()) {
      const user = await createDatabaseUser(name, email, password, plan || undefined);
      if (!user) {
        const suffix = plan ? `&plan=${plan}` : "";
        return NextResponse.redirect(new URL(`/register?error=taken${suffix}`, request.url), 303);
      }

      const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
      response.cookies.set(SESSION_COOKIE, createSession(user), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
      response.cookies.delete(ACCOUNT_COOKIE);
      return response;
    }

    if (process.env.NODE_ENV === "production") {
      console.error("NEYVIX ID registration blocked: DATABASE_URL is not configured in production");
      const suffix = plan ? `&plan=${plan}` : "";
      return NextResponse.redirect(new URL(`/register?error=config${suffix}`, request.url), 303);
    }

    const { account, token } = createAccount(name, email, password);
    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    response.cookies.set(ACCOUNT_COOKIE, token, { ...authCookieOptions, maxAge: 60 * 60 * 24 * 365 });
    response.cookies.set(SESSION_COOKIE, createSession(account), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    console.error("NEYVIX ID registration failed", error);
    return NextResponse.redirect(new URL("/register?error=config", request.url), 303);
  }
}
