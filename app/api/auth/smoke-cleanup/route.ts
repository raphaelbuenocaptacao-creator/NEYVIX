import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { deleteEphemeralSmokeUser, isSmokeAccountEmail } from "@/lib/smoke-user-db";

const PRIVATE_HEADERS = { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer" };

export async function DELETE() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401, headers: PRIVATE_HEADERS });
  }

  if (!isSmokeAccountEmail(session.email)) {
    return NextResponse.json({ error: "Endpoint restrito a contas efêmeras de smoke" }, { status: 403, headers: PRIVATE_HEADERS });
  }

  try {
    const deleted = await deleteEphemeralSmokeUser(session.email);
    if (!deleted) {
      return NextResponse.json({ error: "Conta de smoke não pôde ser removida" }, { status: 409, headers: PRIVATE_HEADERS });
    }

    const response = NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS });
    response.cookies.delete(SESSION_COOKIE);
    response.cookies.delete(ACCOUNT_COOKIE);
    return response;
  } catch (error) {
    console.error("NEYVIX smoke cleanup failed", error);
    return NextResponse.json({ error: "Falha ao limpar conta de smoke" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
