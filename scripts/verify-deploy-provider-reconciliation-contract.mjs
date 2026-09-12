import { readFileSync } from "node:fs";

function read(path) {
  try {
    return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  } catch (error) {
    throw new Error(`missing required reconciliation source: ${path}`);
  }
}

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

const statusSource = read("lib/deploy-vercel-status.ts");
const dbSource = read("lib/deploy-db.ts");
const routeSource = read("app/api/deploy/requests/reconcile/route.ts");
const uiSource = read("app/deploy/deploy-request-controls.tsx");

requireMatch(statusSource, /getDeployProviderReadiness/, "provider status reader must reuse fail-closed readiness");
requireMatch(statusSource, /readVercelDeploymentStatus/, "provider status reader export is missing");
requireMatch(statusSource, /https:\/\/api\.vercel\.com\/v13\/deployments\//, "provider status reader must use Vercel deployment status API");
requireMatch(statusSource, /method:\s*["']GET["']/, "provider status reader must be read-only GET");
requireMatch(statusSource, /Authorization:\s*`Bearer \$\{token\}`/, "provider status reader must authenticate server-side");
requireMatch(statusSource, /AbortSignal\.timeout\(/, "provider status reader must have a bounded timeout");
requireMatch(statusSource, /READY/, "provider status reader must map READY");
requireMatch(statusSource, /ERROR/, "provider status reader must map ERROR");
requireMatch(statusSource, /CANCELED/, "provider status reader must map CANCELED");
requireMatch(statusSource, /BUILDING/, "provider status reader must map BUILDING");

requireMatch(dbSource, /export async function getDeploymentRequest\(/, "owned deployment lookup is missing");
requireMatch(dbSource, /status:\s*["']building["']\s*\|\s*["']ready["']\s*\|\s*["']failed["']/, "provider result persistence must support ready terminal state");

requireMatch(routeSource, /readActiveSession/, "reconciliation route must require an active session");
requireMatch(routeSource, /canUse\([^)]*["']deploy["']\)/, "reconciliation route must enforce deploy entitlement");
requireMatch(routeSource, /getDeploymentRequest/, "reconciliation route must scope lookup to owned deployment");
requireMatch(routeSource, /readVercelDeploymentStatus/, "reconciliation route must query provider status through the adapter");
requireMatch(routeSource, /updateDeploymentProviderResult/, "reconciliation route must persist provider status");
requireMatch(routeSource, /providerDeploymentId/, "reconciliation route must rely on persisted provider deployment id");
requireMatch(routeSource, /status\s*!==\s*["']building["']/, "reconciliation route must avoid reprocessing terminal requests");

requireMatch(uiSource, /fetch\(["']\/api\/deploy\/requests\/reconcile["']/, "deploy UI must call the owned reconciliation endpoint");
requireMatch(uiSource, /Atualizar status/, "deploy UI must expose an explicit status refresh for building deployments");
requireMatch(uiSource, /providerAccepted/, "deploy UI must handle an accepted provider execution response");
if (/payload\.providerExecution\s*!==\s*false/.test(uiSource)) {
  throw new Error("deploy UI must not reject legitimate provider execution responses");
}

for (const source of [statusSource, routeSource, uiSource]) {
  if (/NEYVIX_DEPLOY_VERCEL_TOKEN[^\n]*(NextResponse|JSON\.stringify|console\.)/.test(source)) {
    throw new Error("provider token must never be exposed in response or logs");
  }
}

console.log("Deploy provider reconciliation contract: PASS");
