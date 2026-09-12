import { existsSync, readFileSync } from "node:fs";

const workflowPath = ".github/workflows/deploy-persistence-e2e-smoke.yml";
if (!existsSync(workflowPath)) {
  console.error(`Deploy production E2E contract missing workflow: ${workflowPath}`);
  process.exit(1);
}

const workflow = readFileSync(workflowPath, "utf8");
const requiredSignals = [
  "NEYVIX Deploy Persistence E2E Smoke",
  "https://neyvix.vercel.app",
  "VERCEL_AUTOMATION_BYPASS_SECRET",
  "x-vercel-trusted-oidc-idp-token",
  "/api/health/deploy",
  "/api/auth/register",
  "plan=pro",
  "/api/auth/me",
  "/api/deploy",
  "/api/deploy/requests",
  '"production"',
  '"preview"',
  "providerExecution",
  "-X DELETE",
  "/api/auth/smoke-cleanup",
  "github.event.deployment.environment == 'Production'",
];

for (const signal of requiredSignals) {
  if (!workflow.includes(signal)) {
    console.error(`Deploy production E2E contract missing signal: ${signal}`);
    process.exit(1);
  }
}

console.log("Deploy production E2E contract PASS: authenticated persistence, classification, isolation, cleanup, and production-only deployment-status triggering are wired.");
