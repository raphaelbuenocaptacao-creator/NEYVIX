import { readFileSync } from "node:fs";

const health = readFileSync("lib/health.ts", "utf8");
const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");

for (const required of [
  'deploy: "ready" | "partial" | "missing" | "unknown"',
  'DEPLOY_PROJECT_REQUIRED_COLUMNS',
  'DEPLOYMENT_REQUIRED_COLUMNS',
  'deploy_projects',
  'deployments',
]) {
  if (!health.includes(required)) {
    console.error(`Deploy health contract failed: missing ${required}`);
    process.exit(1);
  }
}

if (!dashboard.includes('case "Deploy": return shape(health.schema.deploy, "Deploy")')) {
  console.error("Deploy health contract failed: dashboard must derive Deploy readiness from health.schema.deploy.");
  process.exit(1);
}

if (dashboard.includes('O health ainda não possui um contrato específico para NEYVIX Deploy.')) {
  console.error("Deploy health contract failed: stale unverified Deploy fallback remains in dashboard.");
  process.exit(1);
}

console.log("Deploy health contract PASS: schema readiness is wired into the Command Center.");
