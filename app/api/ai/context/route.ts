import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getProductAccess, upgradeRequiredPayload } from "@/lib/product-access";
import { isAiMemoryContextEnabled, loadAiMemoryContext } from "@/lib/ai-memory-context";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return privateJson({ error: "Autenticação necessária ou conta inativa" }, 401);

  const access = await getProductAccess(session.email, "ai");
  if (!access.allowed) return privateJson(upgradeRequiredPayload("ai", "Start"), 403);

  try {
    const memory = await loadAiMemoryContext(session.email, true, 8);
    return privateJson({
      ok: true,
      memoryContextEnabled: isAiMemoryContextEnabled(),
      memoryUsed: memory.length,
      contextAvailable: memory.length > 0,
    });
  } catch (error) {
    console.warn("Unable to probe NEYVIX AI Memory context", error);
    return privateJson({ error: "Não foi possível validar o contexto privado da NEYVIX AI" }, 503);
  }
}
