import { NextResponse } from "next/server";
import { getSessionSecretStatus } from "@/lib/auth";
import { getHealthStatus } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthStatus();
  const sessionKey = getSessionSecretStatus();
  const production = process.env.NODE_ENV === "production";
  const sessionKeyDedicated = sessionKey.source === "configured";
  const authSchemaReady = health.auth.schema === "ready";
  const authReady = health.database === "connected" && sessionKey.ready && authSchemaReady;
  const accessReady = authReady && health.project === "ready";
  const ecosystemReady = health.launchReady
    && authReady
    && (!production || sessionKeyDedicated);
  const releaseSha = process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.GITHUB_SHA
    ?? "unknown";
  const releaseEnvironment = process.env.VERCEL_ENV
    ?? (production ? "production" : "development");

  const blockers = [
    health.database !== "connected" ? `database:${health.database}` : null,
    health.project !== "ready" ? `project:${health.project}` : null,
    !authSchemaReady ? `auth_schema:${health.auth.schema}` : null,
    !sessionKey.ready ? "auth_session_secret:not_configured" : null,
    production && !sessionKeyDedicated ? "auth_session_secret:dedicated_required" : null,
    health.schema.automation !== "ready" ? `schema:automation:${health.schema.automation}` : null,
    health.schema.memory !== "ready" ? `schema:memory:${health.schema.memory}` : null,
    health.schema.productRecords !== "ready" ? `schema:product_records:${health.schema.productRecords}` : null,
    health.schema.drive !== "ready" ? `schema:drive:${health.schema.drive}` : null,
    health.schema.docs !== "ready" ? `schema:docs:${health.schema.docs}` : null,
    health.schema.ecosystem !== "ready" ? `schema:ecosystem:${health.schema.ecosystem}` : null,
    ...health.schema.repairRequired.map((table) => `schema_repair:${table}`),
    !health.integrations.aiGateway ? "integration:ai_gateway" : null,
    !health.integrations.billingWebhook ? "integration:billing_webhook" : null,
    !health.integrations.checkout ? "integration:checkout" : null,
    !health.integrations.planEnforcement ? "integration:plan_enforcement" : null,
    !health.integrations.mailTransport ? "integration:mail_transport" : null,
    !health.integrations.mailInbound ? "integration:mail_inbound" : null,
    !health.integrations.storage ? "integration:storage" : null,
  ].filter((value): value is string => Boolean(value));

  return NextResponse.json(
    {
      service: "NEYVIX",
      release: {
        sha: releaseSha,
        environment: releaseEnvironment,
      },
      status: ecosystemReady ? "operacional" : "degradado",
      readiness: {
        access: accessReady,
        ecosystem: ecosystemReady,
      },
      blockers,
      checks: {
        database: health.database,
        project: health.project,
        auth: authReady ? "ready" : "degraded",
        authSchema: health.auth.schema,
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
      // Keep the endpoint usable as a liveness/access probe while the broader
      // ecosystem is degraded. Consumers must use status/readiness.ecosystem,
      // blockers, or launchReady for launch readiness.
      status: accessReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
