import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { listMailMessages } from "@/lib/mail-db";

export async function GET(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);

  if (!session) return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(Math.trunc(requestedLimit), 100)) : 30;

  try {
    const messages = await listMailMessages(session.email, limit);
    return NextResponse.json({ messages, count: messages.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar caixa de entrada NEYVIX Mail", error);
    return NextResponse.json({ error: "Não foi possível carregar a caixa de entrada" }, { status: 503 });
  }
}
