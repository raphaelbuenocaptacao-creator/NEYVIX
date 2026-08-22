import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, SESSION_COOKIE, authCookieOptions, createAccount, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    if (name.trim().length < 2 || !email.includes("@") || password.length < 8) {
      return NextResponse.redirect(new URL("/register?error=invalid", request.url), 303);
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
