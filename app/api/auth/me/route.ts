import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: { email: session.email, name: session.name },
      expiresAt: new Date(session.exp * 1000).toISOString(),
    });
  } catch (error) {
    console.error("NEYVIX ID session check failed", error);
    return NextResponse.json({ authenticated: false, error: "auth_not_configured" }, { status: 503 });
  }
}
