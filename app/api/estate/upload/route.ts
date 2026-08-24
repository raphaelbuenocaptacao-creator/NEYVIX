import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements, canUse } from "@/lib/entitlements";
import { uploadImage, validateImage } from "@/lib/storage";

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const entitlements = await getEntitlements(session.email);
  if (!canUse(entitlements, "estate")) {
    return NextResponse.json({ ok: false, error: "upgrade_required" }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });

    const validation = validateImage(file);
    if (!validation.ok) return NextResponse.json({ ok: false, error: validation.reason }, { status: 400 });

    const result = await uploadImage(file, session.email);
    if (!result.ok) {
      const status = result.reason === "storage_not_configured" ? 503 : 502;
      return NextResponse.json({ ok: false, error: result.reason }, { status });
    }

    return NextResponse.json({ ok: true, url: result.asset.url, providerId: result.asset.providerId ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NEYVIX Estate upload failed", error);
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
  }
}
