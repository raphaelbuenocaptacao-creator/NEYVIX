import { readFileSync } from "node:fs";

const ecosystemHealth = readFileSync("lib/ecosystem-health.ts", "utf8");
const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");

for (const required of [
  'deploy_projects',
  'deployments',
  'deploy: moduleState(CONTRACTS.deploy, columnsByTable)',
]) {
  if (!ecosystemHealth.includes(required)) {
    console.error(`Deploy health contract failed: canonical ecosystem health is missing ${required}`);
    process.exit(1);
  }
}

for (const required of [
  'getEcosystemModuleReadiness',
  'ecosystemModules.deploy',
  'case "Deploy": return shape(ecosystemModules.deploy, "Deploy")',
]) {
  if (!dashboard.includes(required)) {
    console.error(`Deploy health contract failed: Command Center is missing ${required}`);
    process.exit(1);
  }
}

if (dashboard.includes('O health ainda não possui um contrato específico para NEYVIX Deploy.')) {
  console.error("Deploy health contract failed: stale unverified Deploy fallback remains in dashboard.");
  process.exit(1);
}

console.log("Deploy health contract PASS: canonical Deploy readiness is wired into the Command Center.");
