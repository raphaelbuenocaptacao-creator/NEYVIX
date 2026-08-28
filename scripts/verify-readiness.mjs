import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "app/api/health/route.ts",
  "app/api/status/route.ts",
  "app/api/auth/login/route.ts",
  "app/api/auth/magic-login/route.ts",
  "app/api/ai/route.ts",
  "app/api/billing/checkout/route.ts",
  "app/api/billing/webhook/route.ts",
  "app/api/mail/send/route.ts",
  "app/api/mail/inbound/route.ts",
  "app/api/estate/upload/route.ts",
  "app/api/memory/route.ts",
  "app/api/memory/delete/route.ts",
  "app/memory/page.tsx",
  "app/manifest.ts",
  "components/pwa-register.tsx",
  "public/sw.js",
  "lib/session.ts",
  "lib/entitlements.ts",
  "lib/health.ts",
  "lib/memory-db.ts",
  "proxy.ts",
  "database/008_password_reset.sql",
  "database/010_mail_core.sql",
  "database/012_memory.sql",
];

const missingFiles = requiredFiles.filter((file) => !existsSync(file));
if (missingFiles.length) {
  console.error("NEYVIX readiness failed: required files are missing:", missingFiles.join(", "));
  process.exit(1);
}

const envExample = readFileSync(".env.example", "utf8");
const requiredEnvKeys = [
  "DATABASE_URL",
  "NEYVIX_SESSION_SECRET",
  "NEYVIX_ENFORCE_PLANS",
  "NEYVIX_CHECKOUT_START_URL",
  "NEYVIX_CHECKOUT_PRO_URL",
  "NEYVIX_CHECKOUT_BUSINESS_URL",
  "NEYVIX_BILLING_WEBHOOK_SECRET",
  "NEYVIX_AI_GATEWAY_URL",
  "NEYVIX_AI_GATEWAY_SECRET",
  "NEYVIX_MEMORY_AI_CONTEXT",
  "MAIL_TRANSPORT_URL",
  "MAIL_TRANSPORT_SECRET",
  "MAIL_WEBHOOK_SECRET",
  "STORAGE_UPLOAD_URL",
];

const missingEnvKeys = requiredEnvKeys.filter((key) => !new RegExp(`^${key}=`, "m").test(envExample));
if (missingEnvKeys.length) {
  console.error("NEYVIX readiness failed: .env.example is missing keys:", missingEnvKeys.join(", "));
  process.exit(1);
}

const serviceWorker = readFileSync("public/sw.js", "utf8");
if (!serviceWorker.includes("request.method !== \"GET\"") || !serviceWorker.includes("request.mode === \"navigate\"")) {
  console.error("NEYVIX readiness failed: service worker safety rules changed unexpectedly.");
  process.exit(1);
}

const proxy = readFileSync("proxy.ts", "utf8");
for (const route of ["/dashboard/:path*", "/ai/:path*", "/memory/:path*", "/studio/:path*", "/content/:path*", "/automation/:path*", "/mail/:path*", "/billing/:path*", "/admin/:path*"]) {
  if (!proxy.includes(route)) {
    console.error(`NEYVIX readiness failed: protected route missing from proxy: ${route}`);
    process.exit(1);
  }
}

const passwordLogin = readFileSync("app/api/auth/login/route.ts", "utf8");
for (const contract of [
  "safeNext",
  "isRateLimited",
  "response.cookies.set(SESSION_COOKIE",
  'response.headers.set("Cache-Control", "no-store, max-age=0")',
  'response.headers.set("Referrer-Policy", "no-referrer")',
]) {
  if (!passwordLogin.includes(contract)) {
    console.error(`NEYVIX readiness failed: password login safety contract missing: ${contract}`);
    process.exit(1);
  }
}

const magicLogin = readFileSync("app/api/auth/magic-login/route.ts", "utf8");
for (const contract of [
  "prt.used_at IS NULL",
  "prt.expires_at > now()",
  "SET used_at = now()",
  "FOR UPDATE",
  "response.cookies.set(SESSION_COOKIE",
  'response.headers.set("Cache-Control", "no-store, max-age=0")',
  'response.headers.set("Referrer-Policy", "no-referrer")',
]) {
  if (!magicLogin.includes(contract)) {
    console.error(`NEYVIX readiness failed: magic login safety contract missing: ${contract}`);
    process.exit(1);
  }
}

const health = readFileSync("lib/health.ts", "utf8");
for (const signal of ["billingWebhook", "checkout", "mailTransport", "mailInbound", "storage", "launchReady"]) {
  if (!health.includes(signal)) {
    console.error(`NEYVIX readiness failed: health signal missing: ${signal}`);
    process.exit(1);
  }
}

const healthRoute = readFileSync("app/api/health/route.ts", "utf8");
for (const signal of ["accessReady", "readiness", "ecosystem"]) {
  if (!healthRoute.includes(signal)) {
    console.error(`NEYVIX readiness failed: health route signal missing: ${signal}`);
    process.exit(1);
  }
}

const statusRoute = readFileSync("app/api/status/route.ts", "utf8");
for (const contract of [
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
  "canonicalUrl",
  "loginUrl",
  "dashboardUrl",
  "healthUrl",
  "statusUrl",
  "productionUrlResolved",
  "deploymentUrlResolved",
  '"Cache-Control": "no-store"',
  '"Referrer-Policy": "no-referrer"',
]) {
  if (!statusRoute.includes(contract)) {
    console.error(`NEYVIX readiness failed: production access contract missing: ${contract}`);
    process.exit(1);
  }
}

const aiRoute = readFileSync("app/api/ai/route.ts", "utf8");
if (!aiRoute.includes("NEYVIX_MEMORY_AI_CONTEXT") || !aiRoute.includes("getMemoryContext")) {
  console.error("NEYVIX readiness failed: AI/Memory integration contract is missing.");
  process.exit(1);
}

console.log(`NEYVIX readiness PASS: ${requiredFiles.length} critical files and ${requiredEnvKeys.length} configuration keys verified.`);
