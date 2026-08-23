import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { getDatabaseUserByEmail, getTrialStatus } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    let account = null;
    let trial = null;
    try {
      [account, trial] = await Promise.all([
        getDatabaseUserByEmail(session.email),
        getTrialStatus(session.email),
      ]);
    } catch (error) {
      console.warn("NEYVIX ID metadata is temporarily unavailable", error);
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        email: session.email,
        name: session.name,
        active: account?.is_active ?? true,
        role: account?.is_superadmin ? "superadmin" : "member",
      },
      subscription: trial ? {
        status: trial.status ?? null,
        trialStartsAt: trial.trial_started_at ?? null,
        trialEndsAt: trial.trial_ends_at ?? null,
        project: trial.project_slug ?? "neyvix",
      } : null,
      expiresAt: new Date(session.exp * 1000).toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NEYVIX ID session check failed", error);
    return NextResponse.json({ authenticated: false, error: "auth_not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
