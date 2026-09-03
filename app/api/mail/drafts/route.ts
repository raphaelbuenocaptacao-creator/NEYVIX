import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements, canUse } from "@/lib/entitlements";
import { deleteMailDraft, listMailMessages, saveMailDraft } from "@/lib/mail-db";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function requireMailSession() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return { error: noStore({ error: "Autenticação necessária ou conta inativa" }, 401) } as const;

  const entitlements = await getEntitlements(session.email);
  if (!canUse(entitlements, "mail")) {
    return { error: noStore({ error: "NEYVIX Mail requer o plano Business", reason: "upgrade_required", plan: entitlements.plan }, 403) } as const;
  }

  return { session, entitlements } as const;
}

export async function GET() {
  const auth = await requireMailSession();
  if ("error" in auth) return auth.error;

  try {
    const drafts = await listMailMessages(auth.session.email, 50, "draft");
    return noStore({ drafts, count: drafts.length, folder: "draft", entitlement: { plan: auth.entitlements.plan } });
  } catch (error) {
    console.error("Falha ao carregar rascunhos do NEYVIX Mail", error);
    return noStore({ error: "Não foi possível carregar os rascunhos agora" }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await requireMailSession();
  if ("error" in auth) return auth.error;

  let body: { to?: unknown; subject?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "JSON inválido" }, 400);
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";
  if (to.length > 320 || subject.length > 240 || text.length > 20000) {
    return noStore({ error: "Rascunho excede os limites permitidos" }, 400);
  }

  try {
    const draft = await saveMailDraft({
      email: auth.session.email,
      displayName: auth.session.name,
      to,
      subject,
      text,
    });
    if (!draft) return noStore({ error: "Persistência de Mail indisponível" }, 503);
    return noStore({ ok: true, draft: { id: draft.id, createdAt: draft.created_at } }, 201);
  } catch (error) {
    console.error("Falha ao salvar rascunho do NEYVIX Mail", error);
    return noStore({ error: "Não foi possível salvar o rascunho agora" }, 503);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireMailSession();
  if ("error" in auth) return auth.error;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return noStore({ error: "ID de rascunho inválido" }, 400);
  }

  try {
    const deleted = await deleteMailDraft(auth.session.email, id);
    if (!deleted) return noStore({ error: "Rascunho não encontrado" }, 404);
    return noStore({ ok: true, deletedId: id });
  } catch (error) {
    console.error("Falha ao excluir rascunho do NEYVIX Mail", error);
    return noStore({ error: "Não foi possível excluir o rascunho agora" }, 503);
  }
}
