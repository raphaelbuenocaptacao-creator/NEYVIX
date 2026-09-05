import { readFileSync } from "node:fs";

const billingDb = readFileSync(new URL("../lib/billing-db.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../app/api/billing/webhook/route.ts", import.meta.url), "utf8");
const entitlements = readFileSync(new URL("../lib/entitlements.ts", import.meta.url), "utf8");

const checks = [
  ["webhook secret is required", webhook.includes("NEYVIX_BILLING_WEBHOOK_SECRET") && webhook.includes("!configuredSecret || !providedSecret")],
  ["missing server secret fails closed", webhook.includes('error: "unauthorized"') && webhook.includes("status: 401") && !webhook.includes('error: "webhook_not_configured"')],
  ["webhook uses timing-safe comparison", webhook.includes("timingSafeEqual") && webhook.includes("safeEqual(configuredSecret, providedSecret)")],
  ["unauthorized webhook is rejected", webhook.includes('error: "unauthorized"') && webhook.includes("status: 401")],
  ["billing payload is validated", webhook.includes('error: "invalid_payload"') && webhook.includes("status: 400")],
  ["legacy subscription is healed before provider mutation", billingDb.includes("ensureNeyvixSubscription(userId)") && billingDb.indexOf("ensureNeyvixSubscription(userId)") < billingDb.indexOf("WITH target AS")],
  ["event processing is idempotent", billingDb.includes("ON CONFLICT (provider, provider_event_id) DO NOTHING")],
  ["duplicate events do not update subscription twice", billingDb.includes("event_count") && billingDb.includes("duplicate: true, updated: false")],
  ["billing events are scoped to active NEYVIX project", billingDb.includes("p.slug = 'neyvix'") && billingDb.includes("p.is_active = true")],
  ["only active users can be healed", billingDb.includes("u.is_active = true")],
  ["plan must resolve inside NEYVIX project", billingDb.includes("pl.project_id = p.id") && billingDb.includes("pl.is_active = true")],
  ["trial grants PRO feature set only", entitlements.includes('plan: "trial"') && entitlements.includes("features: PRO")],
  ["trial requires a finite future expiry", entitlements.includes("Number.isFinite(trialEndMs)") && entitlements.includes("trialEndMs > nowMs") && !entitlements.includes("!trialEndsAt ||")],
  ["legacy fallback remains compatibility-scoped", entitlements.includes('plan: "legacy"') && entitlements.includes("features: BUSINESS")],
  ["authorization always respects resolved feature list", entitlements.includes("return entitlements.features.includes(feature);") && !entitlements.includes("return !entitlements.enforcementEnabled || entitlements.features.includes(feature);")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);

if (failed.length) {
  console.error(`Billing contract failed: ${failed.map(([name]) => name).join(", ")}`);
  process.exit(1);
}

console.log(`Billing contract PASS (${checks.length}/${checks.length})`);
