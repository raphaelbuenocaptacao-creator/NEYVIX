import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { listMemories, listMemoryEvents, upsertMemory } from "@/lib/memory-db";

export async function GET() {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Autenticação necessária" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const [memories, events] = await Promise.all([
      listMemories(session.email, 100),
      listMemoryEvents(session.email, 20),
    ]);
    return NextResponse.json({ memories, count: memories.length, events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("Unable to load NEYVIX Memory", error);
    return NextResponse.json({ error: "Não foi possível carregar a NEYVIX Memory" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login?next=/memory", request.url), 303);

  const form = await request.formData();
  const key = String(form.get("key") ?? "").trim();
  const category = String(form.get("category") ?? "general").trim();
  const value = String(form.get("value") ?? "").trim();
  const shareWithAi = form.get("shareWithAi") === "on";
  if (!key || !value || key.length > 120 || category.length > 60 || value.length > 4000) {
    return NextResponse.redirect(new URL("/memory?error=invalid", request.url), 303);
  }

  const id = await upsertMemory({ email: session.email, key, category, value, isPrivate: !shareWithAi, source: "user" });
  if (!id) return NextResponse.redirect(new URL("/memory?error=unavailable", request.url), 303);
  return NextResponse.redirect(new URL(`/memory?saved=1&shared=${shareWithAi ? "1" : "0"}`, request.url), 303);
}
