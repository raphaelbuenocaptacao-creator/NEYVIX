import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthStatus();

  return NextResponse.json(
    {
      service: "NEYVIX",
      status: health.ok ? "operacional" : "degradado",
      checks: {
        database: health.database,
        project: health.project,
        billing: health.billing,
        mail: health.mail,
        estate: health.estate,
        integrations: {
          aiGateway: health.integrations.aiGateway ? "configured" : "not_configured",
          billingWebhook: health.integrations.billingWebhook ? "configured" : "not_configured",
          mailTransport: health.integrations.mailTransport ? "configured" : "not_configured",
          storage: health.integrations.storage ? "configured" : "not_configured",
        },
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: health.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
