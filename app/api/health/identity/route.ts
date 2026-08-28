import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getSessionSecretStatus } from "@/lib/auth";

export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
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
  const session = getSessionSecretStatus();
  const mailTransport = Boolean(
    process.env.MAIL_TRANSPORT_URL?.trim() && process.env.MAIL_TRANSPORT_SECRET?.trim(),
  );

  if (!databaseUrl) {
    return response({
      ok: false,
      service: "neyvix-id",
      database: "not_configured",
      signup: { ready: false },
      session,
      magicLogin: { tokenStore: false, request: true, consumer: true, delivery: false, audience: "active_users", status: "unavailable" },
      consistency: { activeNonAdminWithoutSubscription: null },
    }, 503);
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT
        EXISTS (
          SELECT 1 FROM public.projects
          WHERE slug = 'neyvix' AND is_active = true
        ) AS project_ready,
        to_regclass('public.users') IS NOT NULL AS users_ready,
        to_regclass('public.subscriptions') IS NOT NULL AS subscriptions_ready,
        to_regclass('public.password_reset_tokens') IS NOT NULL AS token_store_ready,
        CASE
          WHEN to_regclass('public.users') IS NOT NULL
           AND to_regclass('public.subscriptions') IS NOT NULL
           AND EXISTS (SELECT 1 FROM public.projects WHERE slug = 'neyvix')
          THEN (
            SELECT count(*)::int
            FROM public.users u
            LEFT JOIN public.subscriptions s
              ON s.user_id = u.id
             AND s.project_id = (SELECT id FROM public.projects WHERE slug = 'neyvix' LIMIT 1)
            WHERE u.is_active = true
              AND COALESCE(u.is_superadmin, false) = false
              AND s.user_id IS NULL
          )
          ELSE NULL
        END AS active_nonadmin_without_subscription
    `;

    const row = rows[0] ?? {};
    const projectReady = Boolean(row.project_ready);
    const usersReady = Boolean(row.users_ready);
    const subscriptionsReady = Boolean(row.subscriptions_ready);
    const tokenStore = Boolean(row.token_store_ready);
    const signupReady = projectReady && usersReady && subscriptionsReady && session.ready;
    const magicPipelineReady = tokenStore && usersReady && session.ready;
    const magicStatus = magicPipelineReady && mailTransport
      ? "ready"
      : magicPipelineReady
        ? "partial"
        : "unavailable";

    return response({
      ok: signupReady,
      service: "neyvix-id",
      database: "connected",
      signup: {
        ready: signupReady,
        project: projectReady,
        usersTable: usersReady,
        subscriptionsTable: subscriptionsReady,
      },
      session,
      magicLogin: {
        tokenStore,
        request: true,
        consumer: true,
        delivery: mailTransport,
        audience: "active_users",
        status: magicStatus,
      },
      consistency: {
        activeNonAdminWithoutSubscription:
          row.active_nonadmin_without_subscription == null
            ? null
            : Number(row.active_nonadmin_without_subscription),
      },
    }, signupReady ? 200 : 503);
  } catch (error) {
    console.error("NEYVIX ID readiness check failed", error);
    return response({
      ok: false,
      service: "neyvix-id",
      database: "error",
      signup: { ready: false },
      session,
      magicLogin: { tokenStore: false, request: true, consumer: true, delivery: mailTransport, audience: "active_users", status: "unavailable" },
      consistency: { activeNonAdminWithoutSubscription: null },
    }, 503);
  }
}
