import { NextResponse } from "next/server";
import { SESSION_COOKIE, authCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
  return response;
}
