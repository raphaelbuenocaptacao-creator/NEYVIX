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
  // A public signup must always receive a real entitlement-bearing plan.
  // Previously an empty selection produced a subscription with plan_id = null,
  // which could fail on stricter schemas or create an account unable to use products.
  const selectedPlanCode = planCode?.trim().toLowerCase() || "start-monthly";

  const rows = await sql`
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
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, name
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
        jsonb_build_object('source', 'neyvix-id', 'plan_code', ${selectedPlanCode})
      FROM new_user nu
      JOIN active_project ap ON true
      JOIN selected_plan sp ON true
      RETURNING user_id
    )
    SELECT nu.id, nu.email, nu.name
    FROM new_user nu
    JOIN new_subscription ns ON ns.user_id = nu.id
  `;

  const user = rows[0] as { id: string; email: string; name: string | null } | undefined;
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name || cleanName };
}
