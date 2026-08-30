import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { suggestMemoriesFromText } from "@/lib/memory-intelligence";
import { listMemories } from "@/lib/memory-db";
import { getProductAccess } from "@/lib/product-access";

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const access = await getProductAccess(session.email, "ai");
  if (!access.allowed) {
    return NextResponse.json(
      { error: "A NEYVIX Memory não está incluída no seu plano atual.", code: "upgrade_required", requiredPlan: "Start", plansUrl: "/plans" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  const text = typeof body === "object" && body !== null && "text" in body ? String((body as { text?: unknown }).text ?? "").trim() : "";
  if (!text) return NextResponse.json({ suggestions: [] }, { headers: { "Cache-Control": "no-store" } });
  if (text.length > 4000) return NextResponse.json({ error: "Texto muito longo" }, { status: 413, headers: { "Cache-Control": "no-store" } });

  const existing = await listMemories(session.email, 100);
  const byKey = new Map(existing.map((memory) => [memory.key, memory.value.trim().toLowerCase()]));
  const suggestions = suggestMemoriesFromText(text).map((suggestion) => ({
    ...suggestion,
    alreadyKnown: byKey.get(suggestion.key) === suggestion.value.trim().toLowerCase(),
    requiresApproval: true,
  })).filter((suggestion) => !suggestion.alreadyKnown);

  return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "no-store" } });
}
