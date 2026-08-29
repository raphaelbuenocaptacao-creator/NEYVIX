import { NextResponse } from "next/server";
import { getSessionSecretStatus } from "@/lib/auth";
import { getHealthStatus } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthStatus();
  const sessionKey = getSessionSecretStatus();
  const production = process.env.NODE_ENV === "production";
  const sessionKeyDedicated = sessionKey.source === "configured";
  const authReady = health.database === "connected" && sessionKey.ready;
  const accessReady = authReady && health.project === "ready";
  const ecosystemReady = health.launchReady
    && authReady
    && (!production || sessionKeyDedicated);

  return NextResponse.json(
    {
      service: "NEYVIX",
      status: accessReady ? "operacional" : "degradado",
      readiness: {
        access: accessReady,
        ecosystem: ecosystemReady,
      },
      checks: {
        database: health.database,
        project: health.project,
        auth: authReady ? "ready" : "degraded",
        authSessionSecurity: !production || sessionKeyDedicated
          ? "ready"
          : "dedicated_secret_required",
        billing: health.billing,
        mail: health.mail,
        estate: health.estate,
        schema: health.schema,
        integrations: {
          sessionSecret: sessionKey.ready ? sessionKey.source : "not_configured",
          sessionSecretDedicated: sessionKeyDedicated,
          aiGateway: health.integrations.aiGateway ? "configured" : "not_configured",
          billingWebhook: health.integrations.billingWebhook ? "configured" : "not_configured",
          mailTransport: health.integrations.mailTransport ? "configured" : "not_configured",
          storage: health.integrations.storage ? "configured" : "not_configured",
        },
      },
      launchReady: ecosystemReady,
      timestamp: new Date().toISOString(),
    },
    {
      status: accessReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
