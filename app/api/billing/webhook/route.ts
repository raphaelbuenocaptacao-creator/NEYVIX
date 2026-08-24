import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processBillingEvent, type BillingEventInput } from "@/lib/billing-db";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const configuredSecret = process.env.NEYVIX_BILLING_WEBHOOK_SECRET?.trim();
  if (!configuredSecret) {
    console.error("NEYVIX billing webhook is not configured");
    return NextResponse.json({ ok: false, error: "webhook_not_configured" }, { status: 503 });
  }

  const providedSecret = request.headers.get("x-neyvix-webhook-secret")?.trim() ?? "";
  if (!providedSecret || !safeEqual(configuredSecret, providedSecret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      provider?: string;
      eventId?: string;
      type?: string;
      email?: string;
      plan?: "start" | "pro" | "business";
      customerId?: string | null;
      subscriptionId?: string | null;
      periodStart?: string | null;
      periodEnd?: string | null;
      cancelAtPeriodEnd?: boolean;
    };

    if (!body.provider || !body.eventId || !body.type || !body.email || !body.plan) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const event: BillingEventInput = {
      provider: body.provider,
      eventId: body.eventId,
      type: body.type,
      email: body.email,
      plan: body.plan,
      customerId: body.customerId ?? null,
      subscriptionId: body.subscriptionId ?? null,
      periodStart: body.periodStart ?? null,
      periodEnd: body.periodEnd ?? null,
      cancelAtPeriodEnd: body.cancelAtPeriodEnd ?? false,
      payload: body,
    };

    const result = await processBillingEvent(event);
    if (!result.ok) {
      const status = result.reason === "account_or_plan_not_found" ? 404 : 400;
      return NextResponse.json({ ok: false, error: result.reason }, { status });
    }

    return NextResponse.json({ ok: true, duplicate: result.duplicate, updated: result.updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NEYVIX billing webhook failed", error);
    return NextResponse.json({ ok: false, error: "webhook_failed" }, { status: 500 });
  }
}
