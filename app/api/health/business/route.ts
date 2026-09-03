import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { canUse, resolveEntitlementRecord } from "@/lib/entitlements";
import { getMailTransportStatus } from "@/lib/mail-transport";

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

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const mailTransport = getMailTransportStatus();

  if (!databaseUrl) {
    return json({
      ok: false,
      service: "neyvix-business",
      status: "unavailable",
      database: "not_configured",
      plan: { business: false },
      authorization: { business: false, approvals: false, mail: false },
      approvals: { store: false },
      mail: { store: false, transport: mailTransport.ready, provider: mailTransport.provider },
    }, 503);
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT
        (
          SELECT pl.code
          FROM public.plans pl
          JOIN public.projects p ON p.id = pl.project_id
          WHERE p.slug = 'neyvix'
            AND p.is_active = true
            AND pl.code = 'business-monthly'
            AND pl.is_active = true
          LIMIT 1
        ) AS business_plan_code,
        (
          SELECT pl.features
          FROM public.plans pl
          JOIN public.projects p ON p.id = pl.project_id
          WHERE p.slug = 'neyvix'
            AND p.is_active = true
            AND pl.code = 'business-monthly'
            AND pl.is_active = true
          LIMIT 1
        ) AS business_plan_features,
        to_regclass('public.neyvix_approval_requests') IS NOT NULL AS approvals_store,
        to_regclass('public.mailboxes') IS NOT NULL AS mailboxes_store,
        to_regclass('public.messages') IS NOT NULL AS messages_store
    `;

    const row = rows[0] ?? {};
    const businessPlanCode = typeof row.business_plan_code === "string" ? row.business_plan_code : null;
    const businessEntitlements = businessPlanCode
      ? resolveEntitlementRecord(
          { status: "active", plan_code: businessPlanCode, features: row.business_plan_features },
          true,
        )
      : null;
    const businessPlan = businessEntitlements?.plan === "business";
    const approvalsAuthorized = Boolean(businessEntitlements && canUse(businessEntitlements, "approvals"));
    const mailAuthorized = Boolean(businessEntitlements && canUse(businessEntitlements, "mail"));
    const approvalsStore = Boolean(row.approvals_store);
    const mailStore = Boolean(row.mailboxes_store) && Boolean(row.messages_store);
    const authorizationReady = businessPlan && approvalsAuthorized && mailAuthorized;
    const coreReady = authorizationReady && approvalsStore && mailStore;
    const status = coreReady && mailTransport.ready ? "ready" : coreReady ? "partial" : "unavailable";

    return json({
      ok: coreReady,
      service: "neyvix-business",
      status,
      database: "connected",
      plan: { business: businessPlan },
      authorization: {
        business: authorizationReady,
        approvals: approvalsAuthorized,
        mail: mailAuthorized,
      },
      approvals: { store: approvalsStore },
      mail: {
        store: mailStore,
        transport: mailTransport.ready,
        provider: mailTransport.provider,
        reason: mailTransport.reason,
      },
    }, coreReady ? 200 : 503);
  } catch (error) {
    console.error("NEYVIX Business readiness check failed", error);
    return json({
      ok: false,
      service: "neyvix-business",
      status: "unavailable",
      database: "error",
      plan: { business: false },
      authorization: { business: false, approvals: false, mail: false },
      approvals: { store: false },
      mail: { store: false, transport: mailTransport.ready, provider: mailTransport.provider },
    }, 503);
  }
}
