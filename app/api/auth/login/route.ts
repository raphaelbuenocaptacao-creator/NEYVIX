import { NextRequest, NextResponse } from "next/server";
import { ACCOUNT_COOKIE, SESSION_COOKIE, authCookieOptions, createSession, passwordMatches, readAccount } from "@/lib/auth";
import { authenticateDatabaseUser, hasDatabase } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    if (hasDatabase()) {
      const user = await authenticateDatabaseUser(email, password);
      if (!user) {
        return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
      }

      const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
      response.cookies.set(SESSION_COOKIE, createSession(user), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
      response.cookies.set(ACCOUNT_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
      return response;
    }

    const account = readAccount(request.cookies.get(ACCOUNT_COOKIE)?.value);
    if (!account || account.email !== email || !passwordMatches(account, password)) {
      return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
    }

    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    response.cookies.set(SESSION_COOKIE, createSession(account), { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    console.error("Falha no login do NEYVIX ID", error);
    return NextResponse.redirect(new URL("/login?error=config", request.url), 303);
  }
}
