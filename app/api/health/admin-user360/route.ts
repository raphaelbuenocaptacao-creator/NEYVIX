import { NextResponse } from "next/server";
import { getAdminUser360Health } from "@/lib/admin-user360-health";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  const health = await getAdminUser360Health();
  return json({
    ok: health.ready,
    service: "neyvix-admin-user360",
    status: health.ready ? "ready" : "unavailable",
    database: health.database,
    checks: health.checks,
  }, health.ready ? 200 : 503);
}
