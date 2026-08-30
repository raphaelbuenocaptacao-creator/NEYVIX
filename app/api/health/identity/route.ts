import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getSessionSecretStatus } from "@/lib/auth";
import { getMailTransportStatus } from "@/lib/mail-transport";

export const dynamic = "force-dynamic";

type ColumnContractRow = {
  table_name: string;
  column_name: string;
  is_nullable: string;
  column_default: string | null;
  is_identity: string;
  is_generated: string;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function signupContract(rows: ColumnContractRow[]) {
  const byTable = (table: string) => rows.filter((row) => row.table_name === table);
  const names = (table: string) => new Set(byTable(table).map((row) => row.column_name));
  const userNames = names("users");
  const subscriptionNames = names("subscriptions");
  const projectNames = names("projects");
  const planNames = names("plans");
  const legacyPair = userNames.has("handle") === userNames.has("display_name");

  const required = {
    users: ["id", "email", "password_hash", "name", "is_active", "is_superadmin", "updated_at"],
    subscriptions: ["project_id", "user_id", "plan_id", "status", "trial_started_at", "trial_ends_at", "metadata"],
    projects: ["id", "slug", "trial_days", "is_active"],
    plans: ["id", "project_id", "code", "is_active"],
  };

  const missing = {
    users: required.users.filter((column) => !userNames.has(column)),
    subscriptions: required.subscriptions.filter((column) => !subscriptionNames.has(column)),
    projects: required.projects.filter((column) => !projectNames.has(column)),
    plans: required.plans.filter((column) => !planNames.has(column)),
  };

  const suppliedUsers = new Set([
    "id", "email", "password_hash", "name", "is_active", "is_superadmin",
    ...(userNames.has("handle") && userNames.has("display_name") ? ["handle", "display_name"] : []),
  ]);
  const suppliedSubscriptions = new Set([
    "project_id", "user_id", "plan_id", "status", "trial_started_at", "trial_ends_at", "metadata",
  ]);

  const blocking = (table: string, supplied: Set<string>) => byTable(table)
    .filter((column) =>
      column.is_nullable === "NO" &&
      column.column_default == null &&
      column.is_identity !== "YES" &&
      column.is_generated === "NEVER" &&
      !supplied.has(column.column_name),
    )
    .map((column) => column.column_name)
    .sort();

  const blockers = {
    users: blocking("users", suppliedUsers),
    subscriptions: blocking("subscriptions", suppliedSubscriptions),
  };

  const ready = legacyPair &&
    Object.values(missing).every((columns) => columns.length === 0) &&
    Object.values(blockers).every((columns) => columns.length === 0);

  return {
    ready,
    legacyIdentityPair: legacyPair,
    missing,
    blockers,
  };
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
      signup: { ready: false, canonicalPlan: false, contract: { ready: false } },
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
    let contract = {
      ready: false,
      legacyIdentityPair: true,
      missing: { users: [] as string[], subscriptions: [] as string[], projects: [] as string[], plans: [] as string[] },
      blockers: { users: [] as string[], subscriptions: [] as string[] },
    };

    if (projectsReady && usersReady && subscriptionsReady && plansReady) {
      const contractRows = await sql`
        SELECT table_name, column_name, is_nullable, column_default, is_identity, is_generated
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('users', 'subscriptions', 'projects', 'plans')
        ORDER BY table_name, ordinal_position
      `;
      contract = signupContract(contractRows as ColumnContractRow[]);
    }

    if (projectsReady) {
      const projectRows = await sql`
        SELECT EXISTS (
          SELECT 1 FROM public.projects
          WHERE slug = 'neyvix' AND is_active = true
        ) AS project_ready
      `;
      projectReady = Boolean(projectRows[0]?.project_ready);
    }

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

    const schemaReady = projectsReady && usersReady && subscriptionsReady && plansReady && tokenStore && contract.ready;
    const signupReady = projectReady && usersReady && subscriptionsReady && plansReady && canonicalPlanReady && contract.ready && session.ready;
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
        contract,
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
      signup: { ready: false, canonicalPlan: false, contract: { ready: false } },
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
