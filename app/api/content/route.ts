import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { listContentItems, saveContentItem } from "@/lib/db";
import { getProductAccess, upgradeRequiredPayload } from "@/lib/product-access";

const MAX_KIND_LENGTH = 80;
const MAX_PROMPT_LENGTH = 8_000;
const MAX_CONTENT_LENGTH = 80_000;

async function getSession() {
  const store = await cookies();
  return readActiveSession(store.get(SESSION_COOKIE)?.value);
}

async function ensureContentAccess(email: string) {
  const access = await getProductAccess(email, "content");
  return access.allowed ? null : NextResponse.json(
    upgradeRequiredPayload("content", "Start"),
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const denied = await ensureContentAccess(session.email);
  if (denied) return denied;

  try {
    const items = await listContentItems(session.email, 10);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar conteúdos do NEYVIX Content", error);
    return NextResponse.json({ error: "Não foi possível carregar seus conteúdos agora" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const denied = await ensureContentAccess(session.email);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { kind?: unknown; prompt?: unknown; content?: unknown } | null;
  const kind = typeof body?.kind === "string" ? body.kind.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!kind || !prompt || !content) {
    return NextResponse.json({ error: "Formato, briefing e conteúdo são obrigatórios" }, { status: 400 });
  }
  if (kind.length > MAX_KIND_LENGTH || prompt.length > MAX_PROMPT_LENGTH || content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "O conteúdo excede o limite permitido" }, { status: 413 });
  }

  try {
    const item = await saveContentItem(session.email, kind, prompt, content);
    if (!item) return NextResponse.json({ error: "Não foi possível salvar o conteúdo" }, { status: 503 });
    return NextResponse.json({ item }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao salvar item no NEYVIX Content", error);
    return NextResponse.json({ error: "Não foi possível salvar o conteúdo agora" }, { status: 503 });
  }
}
