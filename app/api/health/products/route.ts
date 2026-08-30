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

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return json({
      ok: false,
      service: "neyvix-products",
      status: "unavailable",
      database: "not_configured",
      persistence: {
        studio: false,
        content: false,
        automations: false,
        approvals: false,
      },
    }, 503);
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT
        to_regclass('public.neyvix_studio_projects') IS NOT NULL AS studio,
        to_regclass('public.neyvix_content_items') IS NOT NULL AS content,
        to_regclass('public.neyvix_automations') IS NOT NULL AS automations,
        to_regclass('public.neyvix_approval_requests') IS NOT NULL AS approvals
    `;
    const row = rows[0] ?? {};
    const persistence = {
      studio: Boolean(row.studio),
      content: Boolean(row.content),
      automations: Boolean(row.automations),
      approvals: Boolean(row.approvals),
    };
    const ready = Object.values(persistence).every(Boolean);

    return json({
      ok: ready,
      service: "neyvix-products",
      status: ready ? "ready" : "partial",
      database: "connected",
      persistence,
    }, ready ? 200 : 503);
  } catch (error) {
    console.error("NEYVIX product persistence readiness check failed", error);
    return json({
      ok: false,
      service: "neyvix-products",
      status: "unavailable",
      database: "error",
      persistence: {
        studio: false,
        content: false,
        automations: false,
        approvals: false,
      },
    }, 503);
  }
}
