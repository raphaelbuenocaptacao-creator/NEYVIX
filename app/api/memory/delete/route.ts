import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { deleteMemory } from "@/lib/memory-db";
import { getProductAccess } from "@/lib/product-access";

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login?next=/memory", request.url), 303);

  const access = await getProductAccess(session.email, "ai");
  if (!access.allowed) {
    return NextResponse.json(
      { error: "A NEYVIX Memory não está incluída no seu plano atual.", code: "upgrade_required", requiredPlan: "Start", plansUrl: "/plans" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(new URL("/memory?error=invalid", request.url), 303);
  const deleted = await deleteMemory(session.email, id);
  return NextResponse.redirect(new URL(deleted ? "/memory?deleted=1" : "/memory?error=not_found", request.url), 303);
}
