import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { listContentItems, saveContentItem } from "@/lib/db";

async function getSession() {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
  const items = await listContentItems(session.email, 10);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });

  const body = await request.json().catch(() => null) as { kind?: unknown; prompt?: unknown; content?: unknown } | null;
  const kind = typeof body?.kind === "string" ? body.kind.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!kind || !prompt || !content) return NextResponse.json({ error: "Formato, briefing e conteúdo são obrigatórios" }, { status: 400 });

  const item = await saveContentItem(session.email, kind, prompt, content);
  if (!item) return NextResponse.json({ error: "Não foi possível salvar o conteúdo" }, { status: 503 });
  return NextResponse.json({ item }, { status: 201 });
}
