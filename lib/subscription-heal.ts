import { neon } from "@neondatabase/serverless";

export async function ensureNeyvixSubscription(userId: string) {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return false;

  const sql = neon(url);
  const rows = await sql`
    WITH active_project AS (
      SELECT id, trial_days
      FROM public.projects
      WHERE slug = 'neyvix' AND is_active = true
      LIMIT 1
    ), start_plan AS (
      SELECT pl.id
      FROM public.plans pl
      JOIN active_project ap ON ap.id = pl.project_id
      WHERE pl.code = 'start-monthly' AND pl.is_active = true
      LIMIT 1
    ), inserted AS (
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
        ${userId},
        sp.id,
        'trialing',
        now(),
        now() + (ap.trial_days || ' days')::interval,
        jsonb_build_object('source', 'neyvix-id', 'repaired', true)
      FROM active_project ap
      JOIN start_plan sp ON true
      ON CONFLICT (project_id, user_id) DO NOTHING
      RETURNING user_id
    )
    SELECT EXISTS (
      SELECT 1
      FROM public.subscriptions s
      JOIN active_project ap ON ap.id = s.project_id
      WHERE s.user_id = ${userId}
    ) AS ready
  `;

  return Boolean(rows[0]?.ready);
}
