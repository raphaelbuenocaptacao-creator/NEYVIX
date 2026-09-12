import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "lib/deploy-provider-readiness.ts",
  "app/api/health/deploy/provider/route.ts",
];
const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`NEYVIX Deploy provider readiness contract failed: missing ${missing.join(", ")}`);
  process.exit(1);
}

const provider = readFileSync("lib/deploy-provider-readiness.ts", "utf8");
for (const contract of [
  "export type DeployProviderReadiness",
  "export function getDeployProviderReadiness",
  "NEYVIX_DEPLOY_VERCEL_TOKEN",
  "NEYVIX_DEPLOY_VERCEL_PROJECT_ID",
  "NEYVIX_DEPLOY_VERCEL_TEAM_ID",
  "NEYVIX_DEPLOY_EXECUTION_ENABLED",
  "configured",
  "executionEnabled",
  "missing",
]) {
  if (!provider.includes(contract)) {
    console.error(`NEYVIX Deploy provider readiness contract failed: provider contract missing: ${contract}`);
    process.exit(1);
  }
}
if (/token\s*:\s*process\.env/i.test(provider)) {
  console.error("NEYVIX Deploy provider readiness contract failed: readiness must never return the provider token");
  process.exit(1);
}

const route = readFileSync("app/api/health/deploy/provider/route.ts", "utf8");
for (const contract of [
  "getDeployProviderReadiness",
  '"Cache-Control": "no-store"',
  '"X-Content-Type-Options": "nosniff"',
]) {
  if (!route.includes(contract)) {
    console.error(`NEYVIX Deploy provider readiness contract failed: health route contract missing: ${contract}`);
    process.exit(1);
  }
}

console.log("NEYVIX Deploy provider readiness contract PASS");
