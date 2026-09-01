import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { setMemoryPrivacy } from "@/lib/memory-db";
import { getProductAccess } from "@/lib/product-access";

const PRIVATE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login?next=/memory", request.url), 303);

  const access = await getProductAccess(session.email, "ai");
  if (!access.allowed) {
    return NextResponse.json(
      { error: "A NEYVIX Memory não está incluída no seu plano atual.", code: "upgrade_required", requiredPlan: "Start", plansUrl: "/plans" },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }

  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const mode = String(form.get("mode") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !["private", "shared"].includes(mode)) {
    return NextResponse.redirect(new URL("/memory?error=invalid", request.url), 303);
  }

  const changed = await setMemoryPrivacy(session.email, id, mode === "private");
  if (!changed) return NextResponse.redirect(new URL("/memory?error=not_found", request.url), 303);
  return NextResponse.redirect(new URL(`/memory?privacy=${mode}`, request.url), 303);
}
