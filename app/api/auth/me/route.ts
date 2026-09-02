import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getDatabaseUserByEmail, getTrialStatus } from "@/lib/db";
import { getEntitlements } from "@/lib/entitlements";
import { getUserRole } from "@/lib/user-role";

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

export async function GET(request: NextRequest) {
  try {
    const session = await readActiveSession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json(
        { authenticated: false, error: "unauthorized" },
        { status: 401, headers: PRIVATE_RESPONSE_HEADERS },
      );
    }

    let account = null;
    let trial = null;
    let entitlements = null;
    let role: "member" | "cro" | "admin" | "superadmin" = "member";
    try {
      [account, trial, entitlements, role] = await Promise.all([
        getDatabaseUserByEmail(session.email),
        getTrialStatus(session.email),
        getEntitlements(session.email),
        getUserRole(session.email),
      ]);
    } catch (error) {
      console.warn("NEYVIX ID metadata is temporarily unavailable", error);
    }

    if (role === "member" && (session.isSuperadmin || account?.is_superadmin)) role = "superadmin";

    return NextResponse.json({
      authenticated: true,
      user: {
        email: session.email,
        name: session.name,
        active: true,
        role,
      },
      subscription: trial ? {
        status: trial.status ?? null,
        trialStartsAt: trial.trial_started_at ?? null,
        trialEndsAt: trial.trial_ends_at ?? null,
        project: trial.project_slug ?? "neyvix",
      } : null,
      access: entitlements ? {
        plan: entitlements.plan,
        status: entitlements.status,
        features: entitlements.features,
        enforcementEnabled: entitlements.enforcementEnabled,
        source: entitlements.source,
      } : null,
      expiresAt: new Date(session.exp * 1000).toISOString(),
    }, { headers: PRIVATE_RESPONSE_HEADERS });
  } catch (error) {
    console.error("NEYVIX ID session check failed", error);
    return NextResponse.json(
      { authenticated: false, error: "auth_not_configured" },
      { status: 503, headers: PRIVATE_RESPONSE_HEADERS },
    );
  }
}
