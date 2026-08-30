import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getSessionSecretStatus } from "@/lib/auth";
import { getMailTransportStatus } from "@/lib/mail-transport";

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
  const mailTransport = getMailTransportStatus();

  if (!databaseUrl) {
    return response({
      ok: false,
      service: "neyvix-id",
      database: "not_configured",
      schema: "unknown",
      signup: { ready: false, canonicalPlan: false },
      session,
      magicLogin: {
        tokenStore: false,
        request: true,
        consumer: true,
        pipelineReady: false,
        delivery: mailTransport.ready,
        deliveryConfigured: mailTransport.configured,
        deliveryValid: mailTransport.valid,
        audience: "active_users",
        status: "unavailable",
      },
      consistency: { activeNonAdminWithoutSubscription: null },
    }, 503);
  }

  try {
    const sql = neon(databaseUrl);
    const catalogRows = await sql`
      SELECT
        to_regclass('public.projects') IS NOT NULL AS projects_ready,
        to_regclass('public.users') IS NOT NULL AS users_ready,
        to_regclass('public.subscriptions') IS NOT NULL AS subscriptions_ready,
        to_regclass('public.plans') IS NOT NULL AS plans_ready,
        to_regclass('public.password_reset_tokens') IS NOT NULL AS token_store_ready
    `;

    const catalog = catalogRows[0] ?? {};
    const projectsReady = Boolean(catalog.projects_ready);
    const usersReady = Boolean(catalog.users_ready);
    const subscriptionsReady = Boolean(catalog.subscriptions_ready);
    const plansReady = Boolean(catalog.plans_ready);
    const tokenStore = Boolean(catalog.token_store_ready);

    let projectReady = false;
    let canonicalPlanReady = false;
    let activeNonAdminWithoutSubscription: number | null = null;

    if (projectsReady) {
      const projectRows = await sql`
        SELECT EXISTS (
          SELECT 1 FROM public.projects
          WHERE slug = 'neyvix' AND is_active = true
        ) AS project_ready
      `;
      projectReady = Boolean(projectRows[0]?.project_ready);
    }

    // Public registration defaults to start-monthly. Readiness must prove that
    // this plan exists instead of claiming signup is healthy from tables alone.
    if (projectsReady && plansReady && projectReady) {
      const planRows = await sql`
        SELECT EXISTS (
          SELECT 1
          FROM public.plans pl
          JOIN public.projects p ON p.id = pl.project_id
          WHERE p.slug = 'neyvix'
            AND p.is_active = true
            AND pl.code = 'start-monthly'
            AND pl.is_active = true
        ) AS canonical_plan_ready
      `;
      canonicalPlanReady = Boolean(planRows[0]?.canonical_plan_ready);
    }

    if (projectsReady && usersReady && subscriptionsReady && projectReady) {
      const consistencyRows = await sql`
        SELECT count(*)::int AS active_nonadmin_without_subscription
        FROM public.users u
        LEFT JOIN public.subscriptions s
          ON s.user_id = u.id
         AND s.project_id = (
           SELECT id FROM public.projects
           WHERE slug = 'neyvix'
           LIMIT 1
         )
        WHERE u.is_active = true
          AND COALESCE(u.is_superadmin, false) = false
          AND s.user_id IS NULL
      `;
      activeNonAdminWithoutSubscription = Number(
        consistencyRows[0]?.active_nonadmin_without_subscription ?? 0,
      );
    }

    const schemaReady = projectsReady && usersReady && subscriptionsReady && plansReady && tokenStore;
    const signupReady = projectReady && usersReady && subscriptionsReady && plansReady && canonicalPlanReady && session.ready;
    const magicPipelineReady = tokenStore && usersReady && session.ready;
    const magicStatus = magicPipelineReady && mailTransport.ready
      ? "ready"
      : magicPipelineReady
        ? "partial"
        : "unavailable";

    return response({
      ok: signupReady,
      service: "neyvix-id",
      database: "connected",
      schema: schemaReady ? "ready" : "partial",
      signup: {
        ready: signupReady,
        project: projectReady,
        canonicalPlan: canonicalPlanReady,
        projectsTable: projectsReady,
        usersTable: usersReady,
        subscriptionsTable: subscriptionsReady,
        plansTable: plansReady,
      },
      session,
      magicLogin: {
        tokenStore,
        request: true,
        consumer: true,
        pipelineReady: magicPipelineReady,
        delivery: mailTransport.ready,
        deliveryConfigured: mailTransport.configured,
        deliveryValid: mailTransport.valid,
        audience: "active_users",
        status: magicStatus,
      },
      consistency: {
        activeNonAdminWithoutSubscription,
      },
    }, signupReady ? 200 : 503);
  } catch (error) {
    console.error("NEYVIX ID readiness check failed", error);
    return response({
      ok: false,
      service: "neyvix-id",
      database: "error",
      schema: "unknown",
      signup: { ready: false, canonicalPlan: false },
      session,
      magicLogin: {
        tokenStore: false,
        request: true,
        consumer: true,
        pipelineReady: false,
        delivery: mailTransport.ready,
        deliveryConfigured: mailTransport.configured,
        deliveryValid: mailTransport.valid,
        audience: "active_users",
        status: "unavailable",
      },
      consistency: { activeNonAdminWithoutSubscription: null },
    }, 503);
  }
}
