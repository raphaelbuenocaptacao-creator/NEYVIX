import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authCookieOptions, readSession } from "@/lib/auth";
import { revokeSessionsIssuedThrough } from "@/lib/account-state";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = readSession(token);

  if (session) {
    const issuedAtMs = session.iatMs ?? session.iat * 1000;
    try {
      await revokeSessionsIssuedThrough(session.email, issuedAtMs);
    } catch (error) {
      console.error("NEYVIX logout revocation failed", error);
    }
  }

  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
