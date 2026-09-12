import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements, canUse } from "@/lib/entitlements";
import {
  createDeploymentRequest,
  DeploySchemaNotReadyError,
  getDeployProject,
  listDeploymentRequests,
  updateDeploymentProviderResult,
} from "@/lib/deploy-db";
import { executeVercelDeployment } from "@/lib/deploy-vercel-executor";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BRANCH_RE = /^(?!.*\.\.)(?!\/)[A-Za-z0-9._/-]+(?<!\/)$/;
const COMMIT_RE = /^[0-9a-f]{7,64}$/i;

async function requireDeployAccess() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return { response: NextResponse.json(
      { error: "Autenticação necessária ou conta inativa" },
      { status: 401, headers: PRIVATE_HEADERS },
    ) } as const;
  }

  const entitlements = await getEntitlements(session.email);
  if (!canUse(entitlements, "deploy")) {
    return { response: NextResponse.json(
      { error: "Seu plano não inclui NEYVIX Deploy", code: "DEPLOY_NOT_ENTITLED" },
      { status: 403, headers: PRIVATE_HEADERS },
    ) } as const;
  }

  return { session } as const;
}

function unavailable(error: unknown) {
  const schemaNotReady = error instanceof DeploySchemaNotReadyError;
  if (!schemaNotReady) {
    console.error("Falha operacional na fila interna do NEYVIX Deploy", error);
  }
  return NextResponse.json({
    error: schemaNotReady
      ? "NEYVIX Deploy está temporariamente indisponível enquanto a persistência é preparada"
      : "NEYVIX Deploy está temporariamente indisponível por uma falha operacional",
    code: schemaNotReady ? "SCHEMA_NOT_READY" : "DEPLOY_UNAVAILABLE",
    module: "deploy",
  }, { status: 503, headers: { ...PRIVATE_HEADERS, "Retry-After": "60" } });
}

export async function GET(request: Request) {
  const access = await requireDeployAccess();
  if ("response" in access) return access.response;

  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: "Projeto inválido" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const requests = await listDeploymentRequests(access.session.email, projectId);
    return NextResponse.json({ requests, providerExecution: false }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request) {
  const access = await requireDeployAccess();
  if ("response" in access) return access.response;

  const body = await request.json().catch(() => null) as {
    projectId?: unknown;
    branch?: unknown;
    commitSha?: unknown;
  } | null;

  const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const branch = typeof body?.branch === "string" && body.branch.trim() ? body.branch.trim() : "";
  const commitSha = typeof body?.commitSha === "string" && body.commitSha.trim()
    ? body.commitSha.trim().toLowerCase()
    : null;

  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: "Projeto inválido" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (!BRANCH_RE.test(branch) || branch.length > 240) {
    return NextResponse.json({ error: "Branch inválida" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (commitSha && !COMMIT_RE.test(commitSha)) {
    return NextResponse.json({ error: "Commit SHA inválido" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const project = await getDeployProject(access.session.email, projectId);
    if (!project) {
      return NextResponse.json({
        error: "Projeto não encontrado ou não pertence ao usuário autenticado",
        code: "PROJECT_NOT_FOUND",
      }, { status: 404, headers: PRIVATE_HEADERS });
    }

    const deploymentRequest = await createDeploymentRequest(access.session.email, {
      projectId,
      branch,
      commitSha,
    });
    if (!deploymentRequest) {
      return NextResponse.json({
        error: "Projeto não encontrado ou não pertence ao usuário autenticado",
        code: "PROJECT_NOT_FOUND",
      }, { status: 404, headers: PRIVATE_HEADERS });
    }

    const execution = await executeVercelDeployment({
      gitRepository: project.gitRepository,
      branch,
      commitSha,
      environment: deploymentRequest.environment,
    });

    let persistedRequest = deploymentRequest;
    if (execution.attempted) {
      persistedRequest = await updateDeploymentProviderResult(access.session.email, {
        deploymentId: deploymentRequest.id,
        status: execution.accepted ? "building" : "failed",
        provider: "vercel",
        providerDeploymentId: execution.providerDeploymentId,
        deploymentUrl: execution.deploymentUrl,
        finished: !execution.accepted,
      }) ?? deploymentRequest;
    }

    const executionNote = execution.accepted
      ? "Solicitação aceita pelo provider externo e persistida como building."
      : execution.attempted
        ? "Solicitação externa tentada, mas o provider não aceitou o deployment."
        : "Solicitação registrada na fila interna; executor externo permanece fail-closed até configuração e opt-in explícitos.";

    return NextResponse.json({
      request: persistedRequest,
      status: persistedRequest.status,
      providerExecution: execution.attempted,
      providerAccepted: execution.accepted,
      provider: execution.provider,
      providerReason: execution.reason,
      executionNote,
    }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    return unavailable(error);
  }
}
