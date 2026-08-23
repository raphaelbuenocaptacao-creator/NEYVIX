import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, SESSION_COOKIE, authCookieOptions, createAccount, createSession } from "@/lib/auth";
import { createDatabaseUser, hasDatabase } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const name = String(form.get("name") ?? "");
    const handle = String(form.get("handle") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const safeHandle = /^[a-z0-9][a-z0-9._-]{2,31}$/.test(handle);
    const email = `${handle}@neyvix.com`;

    if (name.trim().length < 2 || !safeHandle || password.length < 8) {
      return NextResponse.redirect(new URL("/register?error=invalid", request.url), 303);
    }

    if (hasDatabase()) {
      const user = await createDatabaseUser(name, email, password);
      if (!user) {
        return NextResponse.redirect(new URL("/register?error=taken", request.url), 303);
      }

      const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
      response.cookies.set(SESSION_COOKIE, createSession(user), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
      response.cookies.delete(ACCOUNT_COOKIE);
      return response;
    }

    if (process.env.NODE_ENV === "production") {
      console.error("NEYVIX ID registration blocked: DATABASE_URL is not configured in production");
      return NextResponse.redirect(new URL("/register?error=config", request.url), 303);
    }

    // Preview-only fallback for non-production environments without DATABASE_URL.
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
