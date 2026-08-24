import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements, canUse } from "@/lib/entitlements";
import { listMailMessages, type MailFolder } from "@/lib/mail-db";

export async function GET(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);

  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const entitlements = await getEntitlements(session.email);
  if (!canUse(entitlements, "mail")) {
    return NextResponse.json({
      error: "NEYVIX Mail requer o plano Business",
      reason: "upgrade_required",
      plan: entitlements.plan,
      upgradeUrl: "/plans",
    }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(Math.trunc(requestedLimit), 100)) : 30;
  const folder: MailFolder = url.searchParams.get("folder") === "sent" ? "sent" : "inbox";

  try {
    const messages = await listMailMessages(session.email, limit, folder);
    return NextResponse.json({ messages, count: messages.length, folder, entitlement: { plan: entitlements.plan } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar pasta do NEYVIX Mail", error);
    return NextResponse.json({ error: "Não foi possível carregar esta pasta agora" }, { status: 503 });
  }
}
