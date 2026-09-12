import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "lib/deploy-vercel-executor.ts",
  "app/api/deploy/requests/route.ts",
  "lib/deploy-db.ts",
];
const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`NEYVIX Deploy provider executor contract failed: missing ${missing.join(", ")}`);
  process.exit(1);
}

const executor = readFileSync("lib/deploy-vercel-executor.ts", "utf8");
for (const contract of [
  "getDeployProviderReadiness",
  "executionEnabled",
  "https://api.vercel.com/v13/deployments",
  "Authorization",
  "Bearer",
  "gitSource",
  "target",
  "attempted",
  "accepted",
  "AbortSignal.timeout",
]) {
  if (!executor.includes(contract)) {
    console.error(`NEYVIX Deploy provider executor contract failed: executor contract missing: ${contract}`);
    process.exit(1);
  }
}
if (!executor.includes("if (!readiness.executionEnabled)")) {
  console.error("NEYVIX Deploy provider executor contract failed: executor must fail closed before any provider call");
  process.exit(1);
}
if (/console\.(log|error|warn)\([^\n]*(TOKEN|token)/.test(executor)) {
  console.error("NEYVIX Deploy provider executor contract failed: executor must never log provider tokens");
  process.exit(1);
}

const route = readFileSync("app/api/deploy/requests/route.ts", "utf8");
for (const contract of [
  "executeVercelDeployment",
  "getDeployProject",
  "updateDeploymentProviderResult",
  "providerExecution: execution.attempted",
]) {
  if (!route.includes(contract)) {
    console.error(`NEYVIX Deploy provider executor contract failed: request route missing: ${contract}`);
    process.exit(1);
  }
}

const db = readFileSync("lib/deploy-db.ts", "utf8");
for (const contract of [
  "export async function getDeployProject",
  "export async function updateDeploymentProviderResult",
  "provider_deployment_id",
  "deployment_url",
]) {
  if (!db.includes(contract)) {
    console.error(`NEYVIX Deploy provider executor contract failed: persistence contract missing: ${contract}`);
    process.exit(1);
  }
}

console.log("NEYVIX Deploy provider executor contract PASS");
