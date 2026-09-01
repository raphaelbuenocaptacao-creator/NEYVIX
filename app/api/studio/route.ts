import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { listStudioProjects, saveStudioProject } from "@/lib/db";
import { deleteStudioProject } from "@/lib/product-records";
import { getProductAccess, upgradeRequiredPayload } from "@/lib/product-access";

const MAX_PROMPT_LENGTH = 8_000;
const MAX_BLUEPRINT_LENGTH = 80_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

async function getSession() {
  const store = await cookies();
  return readActiveSession(store.get(SESSION_COOKIE)?.value);
}

async function ensureStudioAccess(email: string) {
  const access = await getProductAccess(email, "studio");
  return access.allowed ? null : NextResponse.json(
    upgradeRequiredPayload("studio", "Start"),
    { status: 403, headers: PRIVATE_HEADERS },
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });

  const denied = await ensureStudioAccess(session.email);
  if (denied) return denied;

  try {
    const items = await listStudioProjects(session.email, 10);
    return NextResponse.json({ items }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao carregar projetos do NEYVIX Studio", error);
    return NextResponse.json({ error: "Não foi possível carregar seus projetos agora" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });

  const denied = await ensureStudioAccess(session.email);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { prompt?: unknown; blueprint?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const blueprint = typeof body?.blueprint === "string" ? body.blueprint.trim() : "";

  if (!prompt || !blueprint) {
    return NextResponse.json({ error: "Prompt e blueprint são obrigatórios" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (prompt.length > MAX_PROMPT_LENGTH || blueprint.length > MAX_BLUEPRINT_LENGTH) {
    return NextResponse.json({ error: "O projeto excede o limite permitido" }, { status: 413, headers: PRIVATE_HEADERS });
  }

  try {
    const item = await saveStudioProject(session.email, prompt, blueprint);
    if (!item) return NextResponse.json({ error: "Não foi possível salvar o projeto" }, { status: 503, headers: PRIVATE_HEADERS });
    return NextResponse.json({ item }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao salvar projeto no NEYVIX Studio", error);
    return NextResponse.json({ error: "Não foi possível salvar o projeto agora" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });

  const denied = await ensureStudioAccess(session.email);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Projeto inválido" }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const deleted = await deleteStudioProject(session.email, id);
    return deleted
      ? NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS })
      : NextResponse.json({ error: "Projeto não encontrado" }, { status: 404, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao excluir projeto do NEYVIX Studio", error);
    return NextResponse.json({ error: "Não foi possível excluir o projeto agora" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
