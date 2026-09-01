import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { listContentItems, saveContentItem } from "@/lib/db";
import { deleteContentItem, updateContentItem } from "@/lib/product-records";
import { getProductAccess, upgradeRequiredPayload } from "@/lib/product-access";

const MAX_KIND_LENGTH = 80;
const MAX_PROMPT_LENGTH = 8_000;
const MAX_CONTENT_LENGTH = 80_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

async function getSession() {
  const store = await cookies();
  return readActiveSession(store.get(SESSION_COOKIE)?.value);
}

async function ensureContentAccess(email: string) {
  const access = await getProductAccess(email, "content");
  return access.allowed ? null : NextResponse.json(
    upgradeRequiredPayload("content", "Start"),
    { status: 403, headers: PRIVATE_HEADERS },
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });

  const denied = await ensureContentAccess(session.email);
  if (denied) return denied;

  try {
    const items = await listContentItems(session.email, 10);
    return NextResponse.json({ items }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao carregar conteúdos do NEYVIX Content", error);
    return NextResponse.json({ error: "Não foi possível carregar seus conteúdos agora" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });

  const denied = await ensureContentAccess(session.email);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { kind?: unknown; prompt?: unknown; content?: unknown } | null;
  const kind = typeof body?.kind === "string" ? body.kind.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!kind || !prompt || !content) {
    return NextResponse.json({ error: "Formato, briefing e conteúdo são obrigatórios" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (kind.length > MAX_KIND_LENGTH || prompt.length > MAX_PROMPT_LENGTH || content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "O conteúdo excede o limite permitido" }, { status: 413, headers: PRIVATE_HEADERS });
  }

  try {
    const item = await saveContentItem(session.email, kind, prompt, content);
    if (!item) return NextResponse.json({ error: "Não foi possível salvar o conteúdo" }, { status: 503, headers: PRIVATE_HEADERS });
    return NextResponse.json({ item }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao salvar item no NEYVIX Content", error);
    return NextResponse.json({ error: "Não foi possível salvar o conteúdo agora" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });

  const denied = await ensureContentAccess(session.email);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { id?: unknown; content?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Conteúdo inválido" }, { status: 400, headers: PRIVATE_HEADERS });
  if (!content) return NextResponse.json({ error: "O conteúdo não pode ficar vazio" }, { status: 400, headers: PRIVATE_HEADERS });
  if (content.length > MAX_CONTENT_LENGTH) return NextResponse.json({ error: "O conteúdo excede o limite permitido" }, { status: 413, headers: PRIVATE_HEADERS });

  try {
    const item = await updateContentItem(session.email, id, content);
    return item
      ? NextResponse.json({ item }, { headers: PRIVATE_HEADERS })
      : NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao editar item do NEYVIX Content", error);
    return NextResponse.json({ error: "Não foi possível editar o conteúdo agora" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: PRIVATE_HEADERS });

  const denied = await ensureContentAccess(session.email);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Conteúdo inválido" }, { status: 400, headers: PRIVATE_HEADERS });

  try {
    const deleted = await deleteContentItem(session.email, id);
    return deleted
      ? NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS })
      : NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao excluir item do NEYVIX Content", error);
    return NextResponse.json({ error: "Não foi possível excluir o conteúdo agora" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
