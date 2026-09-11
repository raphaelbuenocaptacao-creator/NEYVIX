import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements, canUse } from "@/lib/entitlements";
import {
  createDeployProject,
  DeploySchemaNotReadyError,
  listDeployProjects,
} from "@/lib/deploy-db";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const REPOSITORY_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH_RE = /^(?!.*\.\.)(?!\/)[A-Za-z0-9._/-]+(?<!\/)$/;

async function requireDeployAccess() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return { response: NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS }) } as const;

  const entitlements = await getEntitlements(session.email);
  if (!canUse(entitlements, "deploy")) {
    return { response: NextResponse.json({ error: "Seu plano não inclui NEYVIX Deploy", code: "DEPLOY_NOT_ENTITLED" }, { status: 403, headers: PRIVATE_HEADERS }) } as const;
  }

  return { session } as const;
}

function unavailable(error: unknown) {
  if (!(error instanceof DeploySchemaNotReadyError)) {
    console.error("Falha operacional no NEYVIX Deploy", error);
  }
  return NextResponse.json({
    error: "NEYVIX Deploy está temporariamente indisponível enquanto a persistência é preparada",
    code: "SCHEMA_NOT_READY",
    module: "deploy",
  }, { status: 503, headers: { ...PRIVATE_HEADERS, "Retry-After": "60" } });
}

export async function GET() {
  const access = await requireDeployAccess();
  if ("response" in access) return access.response;

  try {
    const projects = await listDeployProjects(access.session.email);
    return NextResponse.json({ projects }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request) {
  const access = await requireDeployAccess();
  if ("response" in access) return access.response;

  const body = await request.json().catch(() => null) as {
    name?: unknown;
    repository?: unknown;
    productionBranch?: unknown;
    framework?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const repository = typeof body?.repository === "string" ? body.repository.trim() : "";
  const productionBranch = typeof body?.productionBranch === "string" && body.productionBranch.trim()
    ? body.productionBranch.trim()
    : "main";
  const framework = typeof body?.framework === "string" && body.framework.trim()
    ? body.framework.trim()
    : null;

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Nome de projeto inválido" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (!REPOSITORY_RE.test(repository) || repository.length > 240) {
    return NextResponse.json({ error: "Repositório GitHub inválido. Use owner/repository." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (!BRANCH_RE.test(productionBranch) || productionBranch.length > 240) {
    return NextResponse.json({ error: "Branch de produção inválida" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (framework && framework.length > 80) {
    return NextResponse.json({ error: "Framework inválido" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const project = await createDeployProject(access.session.email, {
      name,
      gitRepository: repository,
      productionBranch,
      framework,
    });
    if (!project) {
      return NextResponse.json({
        error: "Não foi possível registrar o projeto com os dados informados",
        code: "PROJECT_NOT_CREATED",
      }, { status: 409, headers: PRIVATE_HEADERS });
    }
    return NextResponse.json({ project }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    return unavailable(error);
  }
}
