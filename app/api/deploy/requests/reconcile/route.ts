import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements, canUse } from "@/lib/entitlements";
import {
  DeploySchemaNotReadyError,
  getDeploymentRequest,
  updateDeploymentProviderResult,
} from "@/lib/deploy-db";
import { readVercelDeploymentStatus } from "@/lib/deploy-vercel-status";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    console.error("Falha operacional ao reconciliar deployment do NEYVIX Deploy", error);
  }
  return NextResponse.json({
    error: schemaNotReady
      ? "NEYVIX Deploy está temporariamente indisponível enquanto a persistência é preparada"
      : "Não foi possível atualizar o estado deste deployment agora",
    code: schemaNotReady ? "SCHEMA_NOT_READY" : "DEPLOY_RECONCILIATION_UNAVAILABLE",
    module: "deploy",
  }, { status: 503, headers: { ...PRIVATE_HEADERS, "Retry-After": "60" } });
}

export async function POST(request: Request) {
  const access = await requireDeployAccess();
  if ("response" in access) return access.response;

  const body = await request.json().catch(() => null) as { deploymentId?: unknown } | null;
  const deploymentId = typeof body?.deploymentId === "string" ? body.deploymentId.trim() : "";
  if (!UUID_RE.test(deploymentId)) {
    return NextResponse.json({ error: "Deployment inválido" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const deployment = await getDeploymentRequest(access.session.email, deploymentId);
    if (!deployment) {
      return NextResponse.json({
        error: "Deployment não encontrado ou não pertence ao usuário autenticado",
        code: "DEPLOYMENT_NOT_FOUND",
      }, { status: 404, headers: PRIVATE_HEADERS });
    }

    if (deployment.status !== "building") {
      return NextResponse.json({
        request: deployment,
        status: deployment.status,
        providerChecked: false,
        providerReason: "terminal-or-not-started",
      }, { headers: PRIVATE_HEADERS });
    }

    if (deployment.provider !== "vercel" || !deployment.providerDeploymentId) {
      return NextResponse.json({
        request: deployment,
        status: deployment.status,
        providerChecked: false,
        providerReason: "provider-metadata-missing",
      }, { status: 409, headers: PRIVATE_HEADERS });
    }

    const providerStatus = await readVercelDeploymentStatus(deployment.providerDeploymentId);
    if (!providerStatus.attempted || !providerStatus.found || !providerStatus.state) {
      return NextResponse.json({
        request: deployment,
        status: deployment.status,
        providerChecked: providerStatus.attempted,
        providerState: providerStatus.providerState,
        providerReason: providerStatus.reason,
        providerHttpStatus: providerStatus.httpStatus,
      }, { headers: PRIVATE_HEADERS });
    }

    const persisted = await updateDeploymentProviderResult(access.session.email, {
      deploymentId: deployment.id,
      status: providerStatus.state,
      provider: "vercel",
      providerDeploymentId: deployment.providerDeploymentId,
      deploymentUrl: providerStatus.deploymentUrl ?? deployment.deploymentUrl,
      finished: providerStatus.state === "ready" || providerStatus.state === "failed",
    });

    if (!persisted) {
      return NextResponse.json({
        error: "Deployment não encontrado ou não pertence ao usuário autenticado",
        code: "DEPLOYMENT_NOT_FOUND",
      }, { status: 404, headers: PRIVATE_HEADERS });
    }

    return NextResponse.json({
      request: persisted,
      status: persisted.status,
      providerChecked: true,
      providerState: providerStatus.providerState,
      providerReason: providerStatus.reason,
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return unavailable(error);
  }
}
