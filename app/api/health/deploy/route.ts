import { NextResponse } from "next/server";
import { getEcosystemModuleReadiness } from "@/lib/ecosystem-health";

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
  const readiness = await getEcosystemModuleReadiness();
  const ready = readiness.database === "connected" && readiness.deploy === "ready";

  return json({
    ok: ready,
    service: "neyvix-deploy",
    status: ready ? "ready" : "unavailable",
    database: readiness.database,
    schema: readiness.deploy,
  }, ready ? 200 : 503);
}
