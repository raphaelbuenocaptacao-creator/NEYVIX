import fs from "node:fs";

const routePath = "app/api/billing/smoke-business/route.ts";
const workflowPath = ".github/workflows/business-positive-e2e-smoke.yml";

const route = fs.readFileSync(routePath, "utf8");
const workflow = fs.readFileSync(workflowPath, "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Business smoke bridge contract failed: ${label}`);
  }
}

requireText(route, "configured.length < 32", "dedicated E2E secret must require at least 32 characters");
requireText(route, "timingSafeEqual", "secret comparison must remain timing-safe");
requireText(route, "readActiveSession", "Business elevation must require an authenticated session");
requireText(route, 'email.startsWith("business-positive-")', "Business elevation must stay inside the disposable business-positive namespace");
requireText(route, 'provider: "neyvix-smoke"', "synthetic billing events must use the isolated smoke provider");
requireText(route, 'type: "subscription.active"', "positive E2E must exercise the active-subscription resolver path");
requireText(route, 'plan: "business"', "positive E2E must resolve the Business plan");
requireText(route, "externalPayment: false", "synthetic E2E must explicitly declare that no external payment occurred");
requireText(route, 'return response({ error: "Não encontrado" }, 404)', "missing/invalid E2E credentials must fail closed without advertising the bridge");
requireText(route, 'billing.features.includes("mail")', "Business convergence must require Mail entitlement");
requireText(route, 'billing.features.includes("approvals")', "Business convergence must require Approvals entitlement");

requireText(workflow, "NEYVIX_BUSINESS_E2E_SECRET", "production E2E workflow must consume only the dedicated Business credential");
requireText(workflow, "dedicated-e2e-secret-missing", "workflow must fail explicitly when the dedicated credential is absent");
requireText(workflow, "initial-trial-boundary", "workflow must prove trial cannot access Business-only features before elevation");
requireText(workflow, "/api/mail/drafts", "workflow must exercise Mail draft persistence");
requireText(workflow, "/api/automation/approvals", "workflow must exercise Approvals persistence");
requireText(workflow, "/api/auth/smoke-cleanup", "workflow must clean up its disposable account");
requireText(workflow, "No checkout, real payment", "workflow summary must preserve the no-payment safety boundary");

console.log("PASS: Business synthetic E2E bridge remains fail-closed, isolated, no-payment, and end-to-end scoped.");
