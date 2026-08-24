import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { saveInboundMessage } from "@/lib/mail-db";

const MAX_SUBJECT = 240;
const MAX_TEXT = 50_000;
const MAX_HTML = 120_000;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const secret = process.env.MAIL_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, error: "webhook_not_configured" }, { status: 503 });

  const provided = request.headers.get("x-neyvix-mail-secret")?.trim() ?? "";
  if (!provided || !safeEqual(secret, provided)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const providerMessageId = String(data.providerMessageId ?? data.messageId ?? data.id ?? "").trim().slice(0, 300);
  const from = String(data.from ?? data.sender ?? "").trim().toLowerCase();
  const to = String(data.to ?? data.recipient ?? "").trim().toLowerCase();
  const subject = String(data.subject ?? "").trim();
  const text = String(data.text ?? data.bodyText ?? "").trim();
  const html = String(data.html ?? data.bodyHtml ?? "").trim();
  const receivedAt = String(data.receivedAt ?? data.timestamp ?? "").trim();

  if (!providerMessageId || !validEmail(from) || !validEmail(to)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT || text.length > MAX_TEXT || html.length > MAX_HTML) {
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  const result = await saveInboundMessage({ providerMessageId, from, to, subject, text, html, receivedAt });
  if (!result.ok) {
    const status = result.reason === "recipient_not_found" ? 404 : result.reason === "database_unavailable" ? 503 : 500;
    return NextResponse.json({ ok: false, error: result.reason }, { status });
  }

  return NextResponse.json({ ok: true, duplicate: result.duplicate, messageId: result.messageId ?? null }, { headers: { "Cache-Control": "no-store" } });
}
