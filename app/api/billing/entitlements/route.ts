import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { readActiveSession } from "@/lib/session";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function GET() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return privateJson({ ok: false, error: "unauthorized" }, 401);
  }

  const entitlements = await getEntitlements(session.email);

  return privateJson({
    ok: true,
    scope: "self",
    billing: {
      plan: entitlements.plan,
      status: entitlements.status,
      trialEndsAt: entitlements.trialEndsAt,
      enforcementEnabled: entitlements.enforcementEnabled,
      source: entitlements.source,
    },
    entitlements: entitlements.features,
  });
}
