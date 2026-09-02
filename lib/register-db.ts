import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function encodePassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `${salt}.${hash}`;
}

type RegisteredUserRow = {
  id: string;
  email: string;
  name: string | null;
  updated_at: string;
};

export async function createRegisteredUser(
  name: string,
  email: string,
  password: string,
  planCode?: string | null,
) {
  const sql = getSql();
  if (!sql) return null;

  const id = randomUUID();
  const passwordHash = encodePassword(password);
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name.trim().slice(0, 80);
  const handle = normalizedEmail.split("@", 1)[0];
  const selectedPlanCode = planCode?.trim().toLowerCase() || "start-monthly";

  const readinessRows = await sql`
    SELECT
      EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.slug = 'neyvix' AND p.is_active = true
      ) AS project_ready,
      EXISTS (
        SELECT 1
        FROM public.plans pl
        JOIN public.projects p ON p.id = pl.project_id
        WHERE p.slug = 'neyvix'
          AND p.is_active = true
          AND pl.code = ${selectedPlanCode}
          AND pl.is_active = true
      ) AS plan_ready
  `;
  const projectReady = Boolean(readinessRows[0]?.project_ready);
  const planReady = Boolean(readinessRows[0]?.plan_ready);

  if (!projectReady) {
    throw new Error("NEYVIX signup configuration missing active project");
  }
  if (!planReady) {
    throw new Error("NEYVIX signup configuration missing active plan");
  }

  const compatibilityRows = await sql`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'handle'
      ) AS has_handle,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'display_name'
      ) AS has_display_name
  `;
  const hasHandle = Boolean(compatibilityRows[0]?.has_handle);
  const hasDisplayName = Boolean(compatibilityRows[0]?.has_display_name);

  if (hasHandle !== hasDisplayName) {
    throw new Error("NEYVIX users schema is partially migrated");
  }

  let rows: unknown[];

  if (hasHandle && hasDisplayName) {
    rows = await sql`
      WITH active_project AS (
        SELECT id, trial_days
        FROM public.projects
        WHERE slug = 'neyvix' AND is_active = true
        LIMIT 1
      ), selected_plan AS (
        SELECT pl.id
        FROM public.plans pl
        JOIN active_project ap ON ap.id = pl.project_id
        WHERE pl.code = ${selectedPlanCode}
          AND pl.is_active = true
        LIMIT 1
      ), new_user AS (
        INSERT INTO public.users (
          id, email, handle, display_name, password_hash, name, is_active, is_superadmin
        )
        SELECT
          ${id}, ${normalizedEmail}, ${handle}, ${cleanName}, ${passwordHash}, ${cleanName}, true, false
        FROM active_project
        WHERE EXISTS (SELECT 1 FROM selected_plan)
        ON CONFLICT DO NOTHING
        RETURNING id, email, name, updated_at
      ), new_subscription AS (
        INSERT INTO public.subscriptions (
          project_id,
          user_id,
          plan_id,
          status,
          trial_started_at,
          trial_ends_at,
          metadata
        )
        SELECT
          ap.id,
          nu.id,
          sp.id,
          'trialing',
          now(),
          now() + (ap.trial_days || ' days')::interval,
          jsonb_build_object('source', 'neyvix-id', 'plan_code', ${selectedPlanCode}::text)
        FROM new_user nu
        JOIN active_project ap ON true
        JOIN selected_plan sp ON true
        RETURNING user_id
      )
      SELECT nu.id, nu.email, nu.name, nu.updated_at
      FROM new_user nu
      JOIN new_subscription ns ON ns.user_id = nu.id
    `;
  } else {
    rows = await sql`
      WITH active_project AS (
        SELECT id, trial_days
        FROM public.projects
        WHERE slug = 'neyvix' AND is_active = true
        LIMIT 1
      ), selected_plan AS (
        SELECT pl.id
        FROM public.plans pl
        JOIN active_project ap ON ap.id = pl.project_id
        WHERE pl.code = ${selectedPlanCode}
          AND pl.is_active = true
        LIMIT 1
      ), new_user AS (
        INSERT INTO public.users (id, email, password_hash, name, is_active, is_superadmin)
        SELECT ${id}, ${normalizedEmail}, ${passwordHash}, ${cleanName}, true, false
        FROM active_project
        WHERE EXISTS (SELECT 1 FROM selected_plan)
        ON CONFLICT DO NOTHING
        RETURNING id, email, name, updated_at
      ), new_subscription AS (
        INSERT INTO public.subscriptions (
          project_id,
          user_id,
          plan_id,
          status,
          trial_started_at,
          trial_ends_at,
          metadata
        )
        SELECT
          ap.id,
          nu.id,
          sp.id,
          'trialing',
          now(),
          now() + (ap.trial_days || ' days')::interval,
          jsonb_build_object('source', 'neyvix-id', 'plan_code', ${selectedPlanCode}::text)
        FROM new_user nu
        JOIN active_project ap ON true
        JOIN selected_plan sp ON true
        RETURNING user_id
      )
      SELECT nu.id, nu.email, nu.name, nu.updated_at
      FROM new_user nu
      JOIN new_subscription ns ON ns.user_id = nu.id
    `;
  }

  const user = rows[0] as RegisteredUserRow | undefined;
  if (!user) return null;

  const securityEpochMs = new Date(user.updated_at).getTime();
  if (!Number.isFinite(securityEpochMs)) {
    throw new Error("NEYVIX signup returned an invalid account security epoch");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name || cleanName,
    securityEpochMs,
  };
}
