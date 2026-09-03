import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
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
      approvals: { store: false },
      mail: { store: false, transport: mailTransport.ready, provider: mailTransport.provider },
    }, 503);
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT
        EXISTS (
          SELECT 1
          FROM public.plans pl
          JOIN public.projects p ON p.id = pl.project_id
          WHERE p.slug = 'neyvix'
            AND p.is_active = true
            AND pl.code = 'business-monthly'
            AND pl.is_active = true
            AND COALESCE((pl.features ->> 'approvals')::boolean, false) = true
            AND COALESCE((pl.features ->> 'mail')::boolean, false) = true
        ) AS business_plan,
        to_regclass('public.neyvix_approval_requests') IS NOT NULL AS approvals_store,
        to_regclass('public.mailboxes') IS NOT NULL AS mailboxes_store,
        to_regclass('public.messages') IS NOT NULL AS messages_store
    `;

    const row = rows[0] ?? {};
    const businessPlan = Boolean(row.business_plan);
    const approvalsStore = Boolean(row.approvals_store);
    const mailStore = Boolean(row.mailboxes_store) && Boolean(row.messages_store);
    const coreReady = businessPlan && approvalsStore && mailStore;
    const status = coreReady && mailTransport.ready ? "ready" : coreReady ? "partial" : "unavailable";

    return json({
      ok: coreReady,
      service: "neyvix-business",
      status,
      database: "connected",
      plan: { business: businessPlan },
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
      approvals: { store: false },
      mail: { store: false, transport: mailTransport.ready, provider: mailTransport.provider },
    }, 503);
  }
}
