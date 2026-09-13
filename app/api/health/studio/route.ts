import { NextResponse } from "next/server";
import { getStudioHealth } from "@/lib/studio-health";

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
  const health = await getStudioHealth();
  return json({
    ok: health.ready,
    service: "neyvix-studio",
    status: health.ready ? "ready" : "unavailable",
    database: health.database,
    checks: health.checks,
  }, health.ready ? 200 : 503);
}
