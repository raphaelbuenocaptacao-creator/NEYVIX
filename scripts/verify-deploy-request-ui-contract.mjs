import { existsSync, readFileSync } from "node:fs";

const controlsPath = "app/deploy/deploy-request-controls.tsx";
if (!existsSync(controlsPath)) {
  console.error(`NEYVIX Deploy request UI contract failed: missing ${controlsPath}`);
  process.exit(1);
}

const controls = readFileSync(controlsPath, "utf8");
for (const contract of [
  '"use client"',
  'fetch(`/api/deploy/requests?projectId=${encodeURIComponent(projectId)}`',
  'fetch("/api/deploy/requests"',
  'fetch("/api/deploy/requests/reconcile"',
  'method: "POST"',
  "providerExecution",
  "providerAccepted",
  "executionNote",
  "aria-live=\"polite\"",
  "Solicitar deploy",
  "Atualizar status",
  "Histórico de solicitações",
]) {
  if (!controls.includes(contract)) {
    console.error(`NEYVIX Deploy request UI contract failed: missing ${contract}`);
    process.exit(1);
  }
}

for (const forbidden of ["VERCEL_TOKEN", "GITHUB_TOKEN", "https://api.vercel.com", "createDeployment("]) {
  if (controls.includes(forbidden)) {
    console.error(`NEYVIX Deploy request UI contract failed: provider execution forbidden in UI: ${forbidden}`);
    process.exit(1);
  }
}

const page = readFileSync("app/deploy/page.tsx", "utf8");
for (const contract of ["DeployRequestControls", "project.productionBranch"]) {
  if (!page.includes(contract)) {
    console.error(`NEYVIX Deploy request UI contract failed: live page missing ${contract}`);
    process.exit(1);
  }
}

console.log("NEYVIX Deploy request UI contract PASS");
