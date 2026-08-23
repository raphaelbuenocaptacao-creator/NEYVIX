import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { listStudioProjects, saveStudioProject } from "@/lib/db";

const MAX_PROMPT_LENGTH = 8_000;
const MAX_BLUEPRINT_LENGTH = 80_000;

async function getSession() {
  try {
    const store = await cookies();
    return readSession(store.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });

  try {
    const items = await listStudioProjects(session.email, 10);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar projetos do NEYVIX Studio", error);
    return NextResponse.json({ error: "Não foi possível carregar seus projetos agora" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });

  const body = await request.json().catch(() => null) as { prompt?: unknown; blueprint?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const blueprint = typeof body?.blueprint === "string" ? body.blueprint.trim() : "";

  if (!prompt || !blueprint) {
    return NextResponse.json({ error: "Prompt e blueprint são obrigatórios" }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH || blueprint.length > MAX_BLUEPRINT_LENGTH) {
    return NextResponse.json({ error: "O projeto excede o limite permitido" }, { status: 413 });
  }

  try {
    const item = await saveStudioProject(session.email, prompt, blueprint);
    if (!item) return NextResponse.json({ error: "Não foi possível salvar o projeto" }, { status: 503 });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Falha ao salvar projeto no NEYVIX Studio", error);
    return NextResponse.json({ error: "Não foi possível salvar o projeto agora" }, { status: 503 });
  }
}
