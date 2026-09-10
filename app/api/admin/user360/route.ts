import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { canInspectUser360, getUserRole } from "@/lib/user-role";
import { getAdminUserDetail } from "@/lib/admin-user360";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Cookie",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireUser360Access() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const role = await getUserRole(session.email);
  return canInspectUser360(role) ? session : null;
}

export async function GET(request: Request) {
  const session = await requireUser360Access();
  if (!session) {
    return NextResponse.json({ error: "Acesso restrito ao User 360" }, { status: 403, headers: PRIVATE_HEADERS });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Identificador de usuário inválido" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    const user = await getAdminUserDetail(id);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404, headers: PRIVATE_HEADERS });
    }
    return NextResponse.json({ user }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Falha ao carregar detalhe do User 360", error);
    return NextResponse.json({ error: "User 360 temporariamente indisponível" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
