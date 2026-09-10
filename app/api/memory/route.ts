import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { deleteMemory, listMemories, listMemoryEvents, setMemoryPrivacy, upsertMemory } from "@/lib/memory-db";
import { getProductAccess } from "@/lib/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function memoryUpgradeResponse() {
  return NextResponse.json(
    {
      error: "A NEYVIX Memory não está incluída no seu plano atual.",
      code: "upgrade_required",
      requiredPlan: "Start",
      plansUrl: "/plans",
    },
    { status: 403, headers: PRIVATE_HEADERS },
  );
}

async function getMemorySession() {
  const store = await cookies();
  return readActiveSession(store.get(SESSION_COOKIE)?.value);
}

async function ensureMemoryAccess(email: string) {
  const access = await getProductAccess(email, "ai");
  return access.allowed ? null : memoryUpgradeResponse();
}

export async function GET() {
  const session = await getMemorySession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401, headers: PRIVATE_HEADERS });

  const denied = await ensureMemoryAccess(session.email);
  if (denied) return denied;

  try {
    const [memories, events] = await Promise.all([
      listMemories(session.email, 100),
      listMemoryEvents(session.email, 20),
    ]);
    return NextResponse.json({ memories, count: memories.length, events }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.warn("Unable to load NEYVIX Memory", error);
    return NextResponse.json({ error: "Não foi possível carregar a NEYVIX Memory" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request) {
  const session = await getMemorySession();
  if (!session) return NextResponse.redirect(new URL("/login?next=/memory", request.url), 303);

  const denied = await ensureMemoryAccess(session.email);
  if (denied) return denied;

  const form = await request.formData();
  const key = String(form.get("key") ?? "").trim();
  const category = String(form.get("category") ?? "general").trim();
  const value = String(form.get("value") ?? "").trim();
  const shareWithAi = form.get("shareWithAi") === "on";
  if (!key || !value || key.length > 120 || category.length > 60 || value.length > 4000) {
    return NextResponse.redirect(new URL("/memory?error=invalid", request.url), 303);
  }

  try {
    const id = await upsertMemory({ email: session.email, key, category, value, isPrivate: !shareWithAi, source: "user" });
    if (!id) return NextResponse.redirect(new URL("/memory?error=unavailable", request.url), 303);
    return NextResponse.redirect(new URL(`/memory?saved=1&shared=${shareWithAi ? "1" : "0"}`, request.url), 303);
  } catch (error) {
    console.warn("Unable to save NEYVIX Memory", error);
    return NextResponse.redirect(new URL("/memory?error=unavailable", request.url), 303);
  }
}

export async function PATCH(request: Request) {
  const session = await getMemorySession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401, headers: PRIVATE_HEADERS });

  const denied = await ensureMemoryAccess(session.email);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { id?: unknown; shareWithAi?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id) || typeof body?.shareWithAi !== "boolean") {
    return NextResponse.json({ error: "Memória ou configuração de privacidade inválida" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const updated = await setMemoryPrivacy(session.email, id, !body.shareWithAi);
    return updated
      ? NextResponse.json({ ok: true, id, shareWithAi: body.shareWithAi }, { headers: PRIVATE_HEADERS })
      : NextResponse.json({ error: "Memória não encontrada" }, { status: 404, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.warn("Unable to update NEYVIX Memory privacy", error);
    return NextResponse.json({ error: "Não foi possível alterar a privacidade da memória" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function DELETE(request: Request) {
  const session = await getMemorySession();
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401, headers: PRIVATE_HEADERS });

  const denied = await ensureMemoryAccess(session.email);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Memória inválida" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const deleted = await deleteMemory(session.email, id);
    return deleted
      ? NextResponse.json({ ok: true, id }, { headers: PRIVATE_HEADERS })
      : NextResponse.json({ error: "Memória não encontrada" }, { status: 404, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.warn("Unable to delete NEYVIX Memory", error);
    return NextResponse.json({ error: "Não foi possível excluir a memória" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
