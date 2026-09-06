import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements, canUse } from "@/lib/entitlements";
import { getOwnedMailOutboxStatus } from "@/lib/mail-outbox-db";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return noStore({ error: "Autenticação necessária ou conta inativa" }, 401);

  const entitlements = await getEntitlements(session.email);
  if (!canUse(entitlements, "mail")) {
    return noStore({ error: "NEYVIX Mail requer o plano Business", reason: "upgrade_required", plan: entitlements.plan }, 403);
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!UUID_RE.test(id)) return noStore({ error: "ID de mensagem inválido" }, 400);

  try {
    const message = await getOwnedMailOutboxStatus(session.email, id);
    if (!message) return noStore({ error: "Mensagem não encontrada" }, 404);

    const status = message.status;
    return noStore({
      ok: true,
      message: {
        id: message.id,
        status,
        deliveryConfirmed: status === "sent",
        retryAllowed: status === "failed",
        deliveryUnknown: status === "pending",
        occurredAt: message.occurredAt,
      },
    });
  } catch (error) {
    console.error("Falha ao reconciliar estado da outbox do NEYVIX Mail", error);
    return noStore({ error: "Não foi possível consultar o estado da mensagem agora" }, 503);
  }
}
