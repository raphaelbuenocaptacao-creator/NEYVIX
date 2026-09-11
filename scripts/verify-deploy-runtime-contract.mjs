import { existsSync, readFileSync } from "node:fs";

const requiredFiles = ["lib/deploy-db.ts", "app/api/deploy/route.ts", "app/deploy/page.tsx", "database/002_ecosystem.sql"];
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
  "getEcosystemModuleReadiness",
  'readiness.deploy !== "ready"',
  "JOIN public.users u ON u.id = p.owner_user_id",
  "lower(u.email) = ${normalizedEmail}",
  "u.is_active = true",
  "INSERT INTO public.deploy_projects",
  "DELETE FROM public.deploy_projects p",
  "owner_user_id",
  "ON CONFLICT (owner_user_id, git_provider, git_repository) DO NOTHING",
]) {
  if (!deployDb.includes(contract)) {
    console.error(`NEYVIX Deploy runtime contract failed: persistence contract missing: ${contract}`);
    process.exit(1);
  }
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
  '"Cache-Control": "no-store"',
  '"Referrer-Policy": "no-referrer"',
  '"X-Content-Type-Options": "nosniff"',
  "Retry-After",
]) {
  if (!route.includes(contract)) {
    console.error(`NEYVIX Deploy runtime contract failed: API safety contract missing: ${contract}`);
    process.exit(1);
  }
}

const page = readFileSync("app/deploy/page.tsx", "utf8");
for (const contract of [
  "listDeployProjects",
  "DeploySchemaNotReadyError",
  "session.email",
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

for (const forbidden of ["createDeployment(", "fetch(\"https://api.vercel.com", "VERCEL_TOKEN", "GITHUB_TOKEN"]) {
  if (route.includes(forbidden) || deployDb.includes(forbidden)) {
    console.error(`NEYVIX Deploy runtime contract failed: provider execution is not allowed in foundation runtime: ${forbidden}`);
    process.exit(1);
  }
}

console.log("NEYVIX Deploy runtime contract PASS");
