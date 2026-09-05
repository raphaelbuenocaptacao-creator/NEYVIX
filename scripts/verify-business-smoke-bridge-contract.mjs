import fs from "node:fs";

const routePath = "app/api/billing/smoke-business/route.ts";
const workflowPath = ".github/workflows/business-positive-e2e-smoke.yml";
const billingDbPath = "lib/billing-db.ts";
const oidcPath = "lib/github-actions-oidc.ts";

const route = fs.readFileSync(routePath, "utf8");
const workflow = fs.readFileSync(workflowPath, "utf8");
const billingDb = fs.readFileSync(billingDbPath, "utf8");
const oidc = fs.readFileSync(oidcPath, "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Business smoke bridge contract failed: ${label}`);
  }
}

// Legacy secret fallback remains fail-closed and timing-safe.
requireText(route, "configured.length < 32", "legacy dedicated E2E secret must still require at least 32 characters");
requireText(route, "timingSafeEqual", "legacy secret comparison must remain timing-safe");

// Primary path uses short-lived GitHub Actions OIDC, verified by the app.
requireText(route, "hasValidGitHubActionsOidc", "Business elevation must support cryptographically verified GitHub Actions OIDC");
requireText(oidc, 'const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com"', "OIDC issuer must be pinned to GitHub Actions");
requireText(oidc, 'const EXPECTED_REPOSITORY = "raphaelbuenocaptacao-creator/NEYVIX"', "OIDC repository claim must be pinned to NEYVIX");
requireText(oidc, 'const EXPECTED_REF = "refs/heads/main"', "OIDC ref claim must be pinned to main");
requireText(oidc, "business-positive-e2e-smoke.yml@${EXPECTED_REF}", "OIDC workflow_ref must be pinned to the positive Business workflow");
requireText(oidc, 'const EXPECTED_AUDIENCE = "vercel"', "OIDC audience must be pinned");
requireText(oidc, 'claims.event_name !== "deployment_status"', "OIDC event must be restricted to deployment_status");
requireText(oidc, 'header.alg !== "RS256"', "OIDC verifier must reject algorithms other than RS256");
requireText(oidc, "GITHUB_OIDC_JWKS", "OIDC signature must resolve keys from GitHub issuer JWKS");
requireText(oidc, "crypto.subtle.verify", "OIDC signature must be cryptographically verified");
requireText(oidc, "MAX_TOKEN_AGE_SECONDS", "OIDC token freshness must be bounded");
requireText(oidc, "claims.exp", "OIDC expiration must be checked");
requireText(oidc, "claims.iat", "OIDC issued-at time must be checked");

// Product authorization remains layered after transport identity.
requireText(route, "readActiveSession", "Business elevation must require an authenticated NEYVIX session");
requireText(route, 'email.startsWith("business-positive-")', "Business elevation must stay inside the disposable business-positive namespace");
requireText(route, 'provider: "neyvix-smoke"', "synthetic billing events must use the isolated smoke provider");
requireText(route, 'type: "subscription.active"', "positive E2E must exercise the active-subscription resolver path");
requireText(route, 'plan: "business"', "positive E2E must resolve the Business plan");
requireText(route, "externalPayment: false", "synthetic E2E must explicitly declare that no external payment occurred");
requireText(route, 'return response({ error: "Não encontrado" }, 404)', "missing/invalid E2E credentials must fail closed without advertising the bridge");
requireText(route, 'billing.features.includes("mail")', "Business convergence must require Mail entitlement");
requireText(route, 'billing.features.includes("approvals")', "Business convergence must require Approvals entitlement");
requireText(route, 'const eventId = `smoke-business-${nonce}`', "synthetic grants must derive a stable provider event id from the validated nonce");

// Replay safety is a production invariant, not just a workflow convention.
requireText(billingDb, "ON CONFLICT (provider, provider_event_id) DO NOTHING", "provider events must remain idempotent under replay");
requireText(billingDb, "event_insert", "subscription mutation must stay coupled to the newly inserted provider event");
requireText(billingDb, "event_insert.subscription_id = s.id", "subscription update must require the newly inserted event");
requireText(billingDb, "duplicate: true, updated: false", "duplicate provider events must report no second mutation");

// Workflow must request OIDC and forward the same verified token both through
// Vercel deployment protection and to the NEYVIX application-level verifier.
requireText(workflow, "id-token: write", "workflow must have GitHub OIDC permission");
requireText(workflow, "audience=vercel", "workflow must request the pinned OIDC audience");
requireText(workflow, "x-vercel-trusted-oidc-idp-token", "workflow must authenticate through Vercel trusted OIDC source");
requireText(workflow, "x-neyvix-github-oidc", "workflow must provide the token to the NEYVIX verifier");
requireText(workflow, "initial-trial-boundary", "workflow must prove trial cannot access Business-only features before elevation");
requireText(workflow, "/api/mail/drafts", "workflow must exercise Mail draft persistence");
requireText(workflow, "/api/automation/approvals", "workflow must exercise Approvals persistence");
requireText(workflow, "/api/auth/smoke-cleanup", "workflow must clean up its disposable account");
requireText(workflow, "No checkout, real payment", "workflow summary must preserve the no-payment safety boundary");

console.log("PASS: Business synthetic E2E bridge remains fail-closed, OIDC-authenticated, session-scoped, replay-safe, no-payment, and end-to-end scoped.");
