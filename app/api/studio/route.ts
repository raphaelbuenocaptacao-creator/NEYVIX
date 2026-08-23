import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { listStudioProjects, saveStudioProject } from "@/lib/db";

async function getSession() {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
  const items = await listStudioProjects(session.email, 10);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });

  const body = await request.json().catch(() => null) as { prompt?: unknown; blueprint?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const blueprint = typeof body?.blueprint === "string" ? body.blueprint.trim() : "";
  if (!prompt || !blueprint) return NextResponse.json({ error: "Prompt e blueprint são obrigatórios" }, { status: 400 });

  const item = await saveStudioProject(session.email, prompt, blueprint);
  if (!item) return NextResponse.json({ error: "Não foi possível salvar o projeto" }, { status: 503 });
  return NextResponse.json({ item }, { status: 201 });
}
