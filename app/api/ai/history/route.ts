import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { listAiHistoryPage } from "@/lib/ai-history";
import { getProductAccess, upgradeRequiredPayload } from "@/lib/product-access";

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validCursor(value: string) {
  const split = value.lastIndexOf("|");
  if (split > 0) {
    return !Number.isNaN(Date.parse(value.slice(0, split))) && UUID.test(value.slice(split + 1));
  }
  return !Number.isNaN(Date.parse(value));
}

export async function GET(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária ou conta inativa" }, { status: 401, headers: HEADERS });
  }

  const access = await getProductAccess(session.email, "ai");
  if (!access.allowed) {
    return NextResponse.json(upgradeRequiredPayload("ai", "Start"), { status: 403, headers: HEADERS });
  }

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "40");
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(80, Math.trunc(rawLimit))) : 40;
  const before = url.searchParams.get("before");

  if (before && !validCursor(before)) {
    return NextResponse.json({ error: "Cursor de histórico inválido" }, { status: 400, headers: HEADERS });
  }

  try {
    const page = await listAiHistoryPage(session.email, { limit, before });
    return NextResponse.json(
      {
        ...page,
        count: page.messages.length,
        pageSize: limit,
      },
      { headers: HEADERS },
    );
  } catch (error) {
    console.warn("Unable to load paginated NEYVIX AI history", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o histórico da NEYVIX AI" },
      { status: 503, headers: { ...HEADERS, "Retry-After": "30" } },
    );
  }
}
