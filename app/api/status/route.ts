import { getHealthStatus } from "@/lib/health";

const modules = {
  id: "beta",
  mail: "beta-read",
  admin: "beta",
  automation: "schema-ready",
  deploy: "mvp",
  chat: "schema-ready",
  meet: "schema-ready",
  social: "schema-ready",
  ai: "gateway-ready",
  studio: "beta",
  content: "beta",
  drive: "schema-ready",
  docs: "schema-ready",
  business: "schema-ready",
  pay: "architecture-only",
  cloud: "architecture-only",
} as const;

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealthStatus();
  const production = process.env.NODE_ENV === "production";
  const sessionSecretConfigured = Boolean(process.env.NEYVIX_SESSION_SECRET?.trim());
  const aiGatewayConfigured = Boolean(process.env.NEYVIX_AI_GATEWAY_URL?.trim());
  const mailDomainConfigured = Boolean(process.env.MAIL_FROM_DOMAIN?.trim());

  return Response.json({
    ok: health.ok && (!production || sessionSecretConfigured),
    service: "NEYVIX",
    version: "0.1.0",
    environment: production ? "production" : "development",
    readiness: {
      application: true,
      ciConfigured: true,
      databaseConfigured: health.database !== "not_configured",
      databaseConnected: health.database === "connected",
      neyvixProjectReady: health.project === "ready",
      sessionSecretConfigured,
      aiGatewayConfigured,
      mailDomainConfigured,
      vercelProjectVerified: false,
    },
    modules,
    timestamp: new Date().toISOString(),
  }, {
    status: health.ok && (!production || sessionSecretConfigured) ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
