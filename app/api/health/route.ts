import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthStatus();
  const sessionSecretConfigured = Boolean(process.env.NEYVIX_SESSION_SECRET?.trim());
  const authReady = health.database === "connected" && sessionSecretConfigured;
  const overallReady = health.ok && authReady;

  return NextResponse.json(
    {
      service: "NEYVIX",
      status: overallReady ? "operacional" : "degradado",
      checks: {
        database: health.database,
        project: health.project,
        auth: authReady ? "ready" : "degraded",
        billing: health.billing,
        mail: health.mail,
        estate: health.estate,
        schema: health.schema,
        integrations: {
          sessionSecret: sessionSecretConfigured ? "configured" : "not_configured",
          aiGateway: health.integrations.aiGateway ? "configured" : "not_configured",
          billingWebhook: health.integrations.billingWebhook ? "configured" : "not_configured",
          mailTransport: health.integrations.mailTransport ? "configured" : "not_configured",
          storage: health.integrations.storage ? "configured" : "not_configured",
        },
      },
      launchReady: health.launchReady && authReady,
      timestamp: new Date().toISOString(),
    },
    {
      status: overallReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
