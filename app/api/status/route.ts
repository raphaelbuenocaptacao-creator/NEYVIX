import { getSessionSecretStatus } from "@/lib/auth";
import { getHealthStatus } from "@/lib/health";

const modules = {
  id: "beta",
  mail: "beta-send-ready",
  admin: "beta",
  automation: "beta",
  estate: "beta-persistence-ready",
  pwa: "installable-ready",
  deploy: "mvp",
  chat: "partial-persistence-ready",
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

type ModuleStage = "functional" | "partial" | "scaffold" | "planned";

type ModuleMaturity = {
  stage: ModuleStage;
  evidence: string;
};

export const dynamic = "force-dynamic";

function toHttpsUrl(host?: string) {
  const value = host?.trim();
  if (!value) return null;
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  return `https://${value}`;
}

function getRequestOrigin(request: Request) {
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const health = await getHealthStatus();
  const production = process.env.NODE_ENV === "production";
  const sessionKey = getSessionSecretStatus();
  const sessionKeyDedicated = sessionKey.source === "configured";
  const aiGatewayConfigured = Boolean(process.env.NEYVIX_AI_GATEWAY_URL?.trim());
  const mailDomainConfigured = Boolean(process.env.MAIL_FROM_DOMAIN?.trim());
  const mailTransportConfigured = Boolean(process.env.NEYVIX_MAIL_TRANSPORT_URL?.trim());
  const paymentProviderConfigured = Boolean(process.env.NEYVIX_PAYMENT_PROVIDER?.trim());
  const billingWebhookConfigured = Boolean(process.env.NEYVIX_BILLING_WEBHOOK_SECRET?.trim());
  const storageConfigured = Boolean(process.env.NEYVIX_STORAGE_UPLOAD_URL?.trim());
  const runningOnVercel = Boolean(process.env.VERCEL);

  const productionUrl = toHttpsUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const deploymentUrl = toHttpsUrl(process.env.VERCEL_URL);
  const requestOrigin = getRequestOrigin(request);
  const canonicalUrl = productionUrl ?? deploymentUrl ?? requestOrigin;

  const authSchemaReady = health.auth.schema === "ready";
  const hasActiveUsers = Number(health.auth.activeUsers ?? 0) > 0;
  const passwordDataReady = Number(health.auth.usersWithoutPassword ?? 1) === 0;
  const authReady = health.database === "connected"
    && authSchemaReady
    && hasActiveUsers
    && passwordDataReady
    && (!production || sessionKey.ready);
  const accessReady = authReady && health.project === "ready";
  const ecosystemReady = health.launchReady
    && authReady
    && (!production || sessionKeyDedicated);
  const ok = accessReady;
  const commercialReady = accessReady
    && health.billing === "ready"
    && paymentProviderConfigured
    && billingWebhookConfigured;

  const moduleMaturity: Record<string, ModuleMaturity> = {
    id: {
      stage: authReady ? "functional" : "partial",
      evidence: authReady
        ? "PostgreSQL identity schema, password data and signed session prerequisites are ready."
        : "Identity exists, but one or more database/session prerequisites are not currently ready.",
    },
    ai: {
      stage: "partial",
      evidence: aiGatewayConfigured
        ? "Gateway configuration is present, but provider reachability is not live-verified by status."
        : "AI persistence/runtime exists, but no production gateway configuration is detected.",
    },
    memory: {
      stage: "functional",
      evidence: "Authenticated Memory API and persisted AI-context memory foundation are implemented.",
    },
    studio: {
      stage: "partial",
      evidence: "Authenticated persisted Studio workspace exists; broader creation/deployment orchestration remains incomplete.",
    },
    content: {
      stage: "partial",
      evidence: "Authenticated persisted Content workspace exists; external publishing/distribution is not verified.",
    },
    admin: {
      stage: "partial",
      evidence: "Superadmin-protected User 360 foundation exists; complete operational coverage is not claimed.",
    },
    dashboard: {
      stage: "partial",
      evidence: "Authenticated Command Center and activity surfaces exist; not every ecosystem module is operational.",
    },
    automation: {
      stage: "partial",
      evidence: "Authenticated automation persistence and human approve/reject actions exist; external action execution remains bounded.",
    },
    mail: {
      stage: "partial",
      evidence: mailTransportConfigured
        ? "Mail persistence and transport configuration are present; external delivery is not asserted without provider evidence."
        : "Inbox/draft persistence exists, but no external mail transport is configured.",
    },
    billing: {
      stage: commercialReady ? "functional" : "partial",
      evidence: commercialReady
        ? "Billing database plus provider and webhook configuration prerequisites are present."
        : "Trial/entitlement foundation exists; production provider/webhook prerequisites are incomplete or unverified.",
    },
    storage: {
      stage: "functional",
      evidence: "Authenticated private upload/download/delete with bounded payloads and Drive-backed persistence is implemented.",
    },
    drive: {
      stage: "functional",
      evidence: "Authenticated folders plus private file upload/download/delete are implemented.",
    },
    docs: {
      stage: "partial",
      evidence: "Authenticated persisted document foundation exists; full collaborative editing is not claimed.",
    },
    business: {
      stage: "partial",
      evidence: "Authenticated Business foundation and entitlement boundaries exist; broader business workflows remain incomplete.",
    },
    estate: {
      stage: "partial",
      evidence: "Persisted site/property builder and published-site route exist; managed media/domain provisioning remain incomplete.",
    },
    pwa: {
      stage: "functional",
      evidence: "Manifest, service worker, standalone metadata and app shortcuts are implemented.",
    },
    chat: {
      stage: "partial",
      evidence: "Authenticated direct-message UI/API, persisted per-user history and cursor pagination are implemented; realtime delivery remains unverified.",
    },
    social: {
      stage: "scaffold",
      evidence: "Database architecture exists; end-to-end Social product flow is not implemented.",
    },
    meet: {
      stage: "scaffold",
      evidence: "Database architecture exists; realtime meeting/media transport is not implemented.",
    },
    deploy: {
      stage: "scaffold",
      evidence: "Deploy product surface/schema exists; provider-backed deployment orchestration is not implemented.",
    },
    cloud: {
      stage: "scaffold",
      evidence: "Architecture exists; managed cloud runtime/provisioning is not implemented.",
    },
    pay: {
      stage: "scaffold",
      evidence: "Payment/billing architecture exists; no real-money movement or regulated payment execution is implemented.",
    },
  };

  return Response.json({
    ok,
    service: "NEYVIX",
    version: "0.1.0",
    environment: production ? "production" : "development",
    access: {
      canonicalUrl,
      deploymentUrl,
      requestOrigin,
      loginUrl: canonicalUrl ? `${canonicalUrl}/login` : null,
      dashboardUrl: canonicalUrl ? `${canonicalUrl}/dashboard` : null,
      healthUrl: canonicalUrl ? `${canonicalUrl}/api/health` : null,
      statusUrl: canonicalUrl ? `${canonicalUrl}/api/status` : null,
    },
    readiness: {
      access: accessReady,
      ecosystem: ecosystemReady,
      application: true,
      ciConfigured: true,
      databaseConfigured: health.database !== "not_configured",
      databaseConnected: health.database === "connected",
      neyvixProjectReady: health.project === "ready",
      authSchemaReady,
      activeUsers: health.auth.activeUsers,
      usersWithoutPassword: health.auth.usersWithoutPassword,
      hasActiveUsers,
      passwordDataReady,
      billingDatabaseReady: health.billing === "ready",
      mailDatabaseReady: health.mail === "ready",
      estateDatabaseReady: health.estate === "ready",
      sessionKeyReady: sessionKey.ready,
      sessionKeySource: sessionKey.source,
      sessionKeyDedicated,
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
      requestOriginResolved: Boolean(requestOrigin),
      canonicalUrlResolved: Boolean(canonicalUrl),
      pwaManifestReady: true,
      serviceWorkerReady: true,
    },
    modules,
    moduleMaturity,
    moduleStageTaxonomy: ["functional", "partial", "scaffold", "planned"] as const,
    timestamp: new Date().toISOString(),
  }, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
