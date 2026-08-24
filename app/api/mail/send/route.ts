import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getEntitlements, canUse } from "@/lib/entitlements";
import { deliverMail } from "@/lib/mail-transport";
import { saveSentMessage } from "@/lib/mail-db";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login?next=/mail", request.url), 303);

  const entitlements = await getEntitlements(session.email);
  if (!canUse(entitlements, "mail")) {
    return NextResponse.redirect(new URL("/plans", request.url), 303);
  }

  const form = await request.formData();
  const to = String(form.get("to") ?? "").trim().toLowerCase();
  const subject = String(form.get("subject") ?? "").trim();
  const text = String(form.get("text") ?? "").trim();
  if (!validEmail(to) || subject.length < 1 || subject.length > 240 || text.length < 1 || text.length > 20000) {
    return NextResponse.redirect(new URL("/mail?error=invalid_message", request.url), 303);
  }

  const result = await deliverMail({ from: session.email, to, subject, text });
  if (!result.ok) {
    const reason = result.reason === "transport_not_configured" ? "transport_unavailable" : "send_failed";
    return NextResponse.redirect(new URL(`/mail?error=${reason}`, request.url), 303);
  }

  await saveSentMessage({
    email: session.email,
    displayName: session.name,
    to,
    subject,
    text,
    providerMessageId: result.providerMessageId,
  });

  return NextResponse.redirect(new URL("/mail?sent=1", request.url), 303);
}
