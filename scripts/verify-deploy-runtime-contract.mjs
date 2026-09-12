import { existsSync, readFileSync } from "node:fs";

const requiredFiles = ["lib/deploy-db.ts", "lib/deploy-health.ts", "app/api/deploy/route.ts", "app/api/deploy/requests/route.ts", "app/api/health/deploy/route.ts", "app/deploy/page.tsx", "app/deploy/deploy-project-controls.tsx", "database/002_ecosystem.sql"];
const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`NEYVIX Deploy runtime contract failed: missing ${missing.join(", ")}`);
  process.exit(1);
}

const deployDb = readFileSync("lib/deploy-db.ts", "utf8");
for (const contract of [
  "export async function listDeployProjects",
  "export async function createDeployProject",
  "export async function deleteDeployProject",
  "export async function listDeploymentRequests",
  "export async function createDeploymentRequest",
  "getDeployHealth",
  "!health.ready",
  "JOIN public.users u ON u.id = p.owner_user_id",
  "lower(u.email) = ${normalizedEmail}",
  "u.is_active = true",
  "INSERT INTO public.deploy_projects",
  "INSERT INTO public.deployments",
  "DELETE FROM public.deploy_projects p",
  "owner_user_id",
  "ON CONFLICT (owner_user_id, git_provider, git_repository) DO NOTHING",
  "finished_at",
  "SELECT p.id, p.production_branch",
  "CASE WHEN ${input.branch} = p.production_branch THEN 'production' ELSE 'preview' END",
]) {
  if (!deployDb.includes(contract)) {
    console.error(`NEYVIX Deploy runtime contract failed: persistence contract missing: ${contract}`);
    process.exit(1);
  }
}
if (deployDb.includes("getEcosystemModuleReadiness")) {
  console.error("NEYVIX Deploy runtime contract failed: persistence must use the semantic deploy health gate");
  process.exit(1);
}
if (deployDb.includes("completed_at")) {
  console.error("NEYVIX Deploy runtime contract failed: deployments schema uses finished_at, not completed_at");
  process.exit(1);
}

const ecosystemSql = readFileSync("database/002_ecosystem.sql", "utf8");
if (!ecosystemSql.includes("unique(owner_user_id, git_provider, git_repository)")) {
  console.error("NEYVIX Deploy runtime contract failed: repository uniqueness must be scoped to owner_user_id");
  process.exit(1);
}
if (ecosystemSql.includes("unique(git_provider, git_repository)")) {
  console.error("NEYVIX Deploy runtime contract failed: global repository uniqueness is not multi-user safe");
  process.exit(1);
}

const route = readFileSync("app/api/deploy/route.ts", "utf8");
for (const contract of [
  "readActiveSession",
  "getEntitlements",
  'canUse(entitlements, "deploy")',
  "listDeployProjects",
  "createDeployProject",
  "deleteDeployProject",
  "export async function DELETE",
  "SCHEMA_NOT_READY",
  "DEPLOY_UNAVAILABLE",
  '"Cache-Control": "no-store"',
  '"Referrer-Policy": "no-referrer"',
  '"X-Content-Type-Options": "nosniff"',
  "Retry-After",
  "repository.trim().toLowerCase()",
]) {
  if (!route.includes(contract)) {
    console.error(`NEYVIX Deploy runtime contract failed: API safety contract missing: ${contract}`);
    process.exit(1);
  }
}
if (/const productionBranch[\s\S]{0,220}:\s*"main";/.test(route)) {
  console.error("NEYVIX Deploy runtime contract failed: API must not silently invent main as the production branch");
  process.exit(1);
}

const requestsRoute = readFileSync("app/api/deploy/requests/route.ts", "utf8");
for (const contract of [
  "readActiveSession",
  "getEntitlements",
  'canUse(entitlements, "deploy")',
  "listDeploymentRequests",
  "createDeploymentRequest",
  "providerExecution: false",
  'status: "queued"',
  '"Cache-Control": "no-store"',
  "SCHEMA_NOT_READY",
  "DEPLOY_UNAVAILABLE",
]) {
  if (!requestsRoute.includes(contract)) {
    console.error(`NEYVIX Deploy runtime contract failed: internal deployment request contract missing: ${contract}`);
    process.exit(1);
  }
}

const deployHealth = readFileSync("lib/deploy-health.ts", "utf8");
for (const contract of [
  "export async function getDeployHealth",
  "deploy_projects_owner_user_id_git_provider_git_repository_key",
  "deploy_projects_owner_user_id_fkey",
  "idx_deployments_project_created",
  "deployments_project_id_fkey",
  "information_schema.columns",
  "pg_constraint",
  "pg_indexes",
  "pg_get_constraintdef",
  "UNIQUE (owner_user_id, git_provider, git_repository)",
  "FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL",
  "FOREIGN KEY (project_id) REFERENCES deploy_projects(id) ON DELETE CASCADE",
]) {
  if (!deployHealth.includes(contract)) {
    console.error(`NEYVIX Deploy runtime contract failed: exact health contract missing: ${contract}`);
    process.exit(1);
  }
}

const healthRoute = readFileSync("app/api/health/deploy/route.ts", "utf8");
for (const contract of [
  "getDeployHealth",
  "health.ready",
  "health.checks",
]) {
  if (!healthRoute.includes(contract)) {
    console.error(`NEYVIX Deploy runtime contract failed: deploy health endpoint contract missing: ${contract}`);
    process.exit(1);
  }
}

const page = readFileSync("app/deploy/page.tsx", "utf8");
for (const contract of [
  "listDeployProjects",
  "DeploySchemaNotReadyError",
  "session.email",
  "DeployProjectControls",
]) {
  if (!page.includes(contract)) {
    console.error(`NEYVIX Deploy runtime contract failed: live page contract missing: ${contract}`);
    process.exit(1);
  }
}
for (const forbidden of [
  "const projects = [",
  "neyvix-web",
  "mail.neyvix.app",
]) {
  if (page.includes(forbidden)) {
    console.error(`NEYVIX Deploy runtime contract failed: static/fabricated project data forbidden: ${forbidden}`);
    process.exit(1);
  }
}

const controls = readFileSync("app/deploy/deploy-project-controls.tsx", "utf8");
for (const contract of [
  '"use client"',
  'fetch("/api/deploy"',
  'method: "POST"',
  'method: "DELETE"',
  "router.refresh()",
  "aria-live=\"polite\"",
  "SCHEMA_NOT_READY",
]) {
  if (!controls.includes(contract)) {
    console.error(`NEYVIX Deploy runtime contract failed: project controls contract missing: ${contract}`);
    process.exit(1);
  }
}
if (controls.includes('String(data.get("productionBranch") || "main")')) {
  console.error("NEYVIX Deploy runtime contract failed: project controls must send the branch value explicitly");
  process.exit(1);
}

for (const forbidden of ["createDeployment(", "fetch(\"https://api.vercel.com", "VERCEL_TOKEN", "GITHUB_TOKEN"]) {
  if (route.includes(forbidden) || requestsRoute.includes(forbidden) || deployDb.includes(forbidden) || controls.includes(forbidden)) {
    console.error(`NEYVIX Deploy runtime contract failed: provider execution is not allowed in foundation runtime: ${forbidden}`);
    process.exit(1);
  }
}

console.log("NEYVIX Deploy runtime contract PASS");
