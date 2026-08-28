import { getHealthStatus } from "@/lib/health";

const modules = {
  id: "beta",
  mail: "beta-send-ready",
  admin: "beta",
  automation: "beta",
  estate: "beta-persistence-ready",
  pwa: "installable-ready",
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
  plans: "commercial-surface-ready",
  pay: "webhook-ready",
  cloud: "architecture-only",
} as const;

export const dynamic = "force-dynamic";

function toHttpsUrl(host?: string) {
  const value = host?.trim();
  if (!value) return null;
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  return `https://${value}`;
}

export async function GET() {
  const health = await getHealthStatus();
  const production = process.env.NODE_ENV === "production";
  const sessionSecretConfigured = Boolean(process.env.NEYVIX_SESSION_SECRET?.trim());
  const aiGatewayConfigured = Boolean(process.env.NEYVIX_AI_GATEWAY_URL?.trim());
  const mailDomainConfigured = Boolean(process.env.MAIL_FROM_DOMAIN?.trim());
  const mailTransportConfigured = Boolean(process.env.NEYVIX_MAIL_TRANSPORT_URL?.trim());
  const paymentProviderConfigured = Boolean(process.env.NEYVIX_PAYMENT_PROVIDER?.trim());
  const billingWebhookConfigured = Boolean(process.env.NEYVIX_BILLING_WEBHOOK_SECRET?.trim());
  const storageConfigured = Boolean(process.env.NEYVIX_STORAGE_UPLOAD_URL?.trim());
  const runningOnVercel = Boolean(process.env.VERCEL);

  const productionUrl = toHttpsUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const deploymentUrl = toHttpsUrl(process.env.VERCEL_URL);
  const canonicalUrl = productionUrl ?? deploymentUrl;

  const ok = health.ok && (!production || sessionSecretConfigured);
  const commercialReady = ok && paymentProviderConfigured && billingWebhookConfigured;

  return Response.json({
    ok,
    service: "NEYVIX",
    version: "0.1.0",
    environment: production ? "production" : "development",
    access: {
      canonicalUrl,
      deploymentUrl,
      loginUrl: canonicalUrl ? `${canonicalUrl}/login` : null,
      dashboardUrl: canonicalUrl ? `${canonicalUrl}/dashboard` : null,
      healthUrl: canonicalUrl ? `${canonicalUrl}/api/health` : null,
      statusUrl: canonicalUrl ? `${canonicalUrl}/api/status` : null,
    },
    readiness: {
      application: true,
      ciConfigured: true,
      databaseConfigured: health.database !== "not_configured",
      databaseConnected: health.database === "connected",
      neyvixProjectReady: health.project === "ready",
      billingDatabaseReady: health.billing === "ready",
      mailDatabaseReady: health.mail === "ready",
      estateDatabaseReady: health.estate === "ready",
      sessionSecretConfigured,
      aiGatewayConfigured,
      mailDomainConfigured,
      mailTransportConfigured,
      paymentProviderConfigured,
      billingWebhookConfigured,
      storageConfigured,
      commercialReady,
      runningOnVercel,
      productionUrlResolved: Boolean(productionUrl),
      deploymentUrlResolved: Boolean(deploymentUrl),
      pwaManifestReady: true,
      serviceWorkerReady: true,
    },
    modules,
    timestamp: new Date().toISOString(),
  }, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
