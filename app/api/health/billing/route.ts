import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function isSafeCheckoutUrl(value: string | undefined) {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const webhookConfigured = Boolean(process.env.NEYVIX_BILLING_WEBHOOK_SECRET?.trim());
  const checkout = {
    start: isSafeCheckoutUrl(process.env.NEYVIX_CHECKOUT_START_URL),
    pro: isSafeCheckoutUrl(process.env.NEYVIX_CHECKOUT_PRO_URL),
    business: isSafeCheckoutUrl(process.env.NEYVIX_CHECKOUT_BUSINESS_URL),
  };
  const checkoutReady = checkout.start && checkout.pro && checkout.business;

  if (!databaseUrl) {
    return json({
      ok: false,
      service: "neyvix-billing",
      status: "unavailable",
      database: "not_configured",
      schema: { subscriptions: false, events: false },
      plans: { start: false, pro: false, business: false },
      provider: { webhook: webhookConfigured, checkout, checkoutReady },
    }, 503);
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT
        to_regclass('public.subscriptions') IS NOT NULL AS subscriptions_store,
        to_regclass('public.neyvix_billing_events') IS NOT NULL AS events_store,
        EXISTS (
          SELECT 1 FROM public.plans pl
          JOIN public.projects p ON p.id = pl.project_id
          WHERE p.slug = 'neyvix' AND p.is_active = true
            AND pl.code = 'start-monthly' AND pl.is_active = true
        ) AS start_plan,
        EXISTS (
          SELECT 1 FROM public.plans pl
          JOIN public.projects p ON p.id = pl.project_id
          WHERE p.slug = 'neyvix' AND p.is_active = true
            AND pl.code = 'pro-monthly' AND pl.is_active = true
        ) AS pro_plan,
        EXISTS (
          SELECT 1 FROM public.plans pl
          JOIN public.projects p ON p.id = pl.project_id
          WHERE p.slug = 'neyvix' AND p.is_active = true
            AND pl.code = 'business-monthly' AND pl.is_active = true
        ) AS business_plan
    `;

    const row = rows[0] ?? {};
    const subscriptionsStore = Boolean(row.subscriptions_store);
    const eventsStore = Boolean(row.events_store);
    const plans = {
      start: Boolean(row.start_plan),
      pro: Boolean(row.pro_plan),
      business: Boolean(row.business_plan),
    };
    const plansReady = plans.start && plans.pro && plans.business;
    const coreReady = subscriptionsStore && eventsStore && plansReady;
    const providerReady = webhookConfigured && checkoutReady;
    const status = coreReady && providerReady ? "ready" : coreReady ? "partial" : "unavailable";

    return json({
      ok: coreReady,
      service: "neyvix-billing",
      status,
      database: "connected",
      schema: { subscriptions: subscriptionsStore, events: eventsStore },
      plans,
      provider: { webhook: webhookConfigured, checkout, checkoutReady },
    }, coreReady ? 200 : 503);
  } catch (error) {
    console.error("NEYVIX Billing readiness check failed", error);
    return json({
      ok: false,
      service: "neyvix-billing",
      status: "unavailable",
      database: "error",
      schema: { subscriptions: false, events: false },
      plans: { start: false, pro: false, business: false },
      provider: { webhook: webhookConfigured, checkout, checkoutReady },
    }, 503);
  }
}
