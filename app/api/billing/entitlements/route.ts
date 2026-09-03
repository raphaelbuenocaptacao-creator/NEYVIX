import { NextResponse } from "next/server";
import { requireActiveSession } from "@/lib/require-active-session";
import { getEntitlements } from "@/lib/entitlements";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const session = await requireActiveSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }

  const entitlements = await getEntitlements(session.email);

  return NextResponse.json(
    {
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
    },
    { headers: PRIVATE_HEADERS },
  );
}
