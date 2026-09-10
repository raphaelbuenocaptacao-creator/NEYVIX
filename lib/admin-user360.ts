import { neon } from "@neondatabase/serverless";

export type AdminActivityItem = {
  source: string;
  kind: string;
  summary: string;
  createdAt: string;
};

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  superadmin: boolean;
  createdAt: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  aiMessages: number;
  studioProjects: number;
  contentItems: number;
};

export type AdminUserDetail = AdminUserSummary & {
  recentAi: { role: string; content: string; createdAt: string }[];
  recentActivity: AdminActivityItem[];
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function mapSummary(row: Record<string, unknown>): AdminUserSummary {
  return {
    id: String(row.id),
    name: String(row.name ?? "Usuário NEYVIX"),
    email: String(row.email),
    active: Boolean(row.is_active),
    superadmin: Boolean(row.is_superadmin),
    createdAt: String(row.created_at),
    subscriptionStatus: row.subscription_status ? String(row.subscription_status) : null,
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
    aiMessages: Number(row.ai_messages ?? 0),
    studioProjects: Number(row.studio_projects ?? 0),
    contentItems: Number(row.content_items ?? 0),
  };
}

export async function getAdminUserDirectory(limit = 24): Promise<AdminUserSummary[]> {
  const sql = getSql();
  if (!sql) return [];

  const rows = await sql`
    SELECT
      u.id,
      COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)) AS name,
      u.email,
      u.is_active,
      u.is_superadmin,
      u.created_at,
      s.status AS subscription_status,
      s.trial_ends_at,
      (SELECT count(*)::int FROM public.neyvix_ai_messages m WHERE m.user_id = u.id) AS ai_messages,
      (SELECT count(*)::int FROM public.neyvix_studio_projects p WHERE p.user_id = u.id) AS studio_projects,
      (SELECT count(*)::int FROM public.neyvix_content_items c WHERE c.user_id = u.id) AS content_items
    FROM public.users u
    LEFT JOIN public.subscriptions s
      ON s.user_id = u.id
     AND s.project_id = (SELECT id FROM public.projects WHERE slug = 'neyvix' LIMIT 1)
    ORDER BY u.created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  `;

  return rows.map((row) => mapSummary(row as Record<string, unknown>));
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    SELECT
      u.id,
      COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)) AS name,
      u.email,
      u.is_active,
      u.is_superadmin,
      u.created_at,
      s.status AS subscription_status,
      s.trial_ends_at,
      (SELECT count(*)::int FROM public.neyvix_ai_messages m WHERE m.user_id = u.id) AS ai_messages,
      (SELECT count(*)::int FROM public.neyvix_studio_projects p WHERE p.user_id = u.id) AS studio_projects,
      (SELECT count(*)::int FROM public.neyvix_content_items c WHERE c.user_id = u.id) AS content_items
    FROM public.users u
    LEFT JOIN public.subscriptions s
      ON s.user_id = u.id
     AND s.project_id = (SELECT id FROM public.projects WHERE slug = 'neyvix' LIMIT 1)
    WHERE u.id = ${userId}
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const [recent, activity] = await Promise.all([
    sql`
      SELECT role, content, created_at
      FROM public.neyvix_ai_messages
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 8
    `,
    sql`
      SELECT * FROM (
        SELECT 'ai'::text AS source, role::text AS kind, left(content, 160) AS summary, created_at
        FROM public.neyvix_ai_messages WHERE user_id = ${userId}
        UNION ALL
        SELECT 'studio'::text AS source, status::text AS kind, title AS summary, updated_at AS created_at
        FROM public.neyvix_studio_projects WHERE user_id = ${userId}
        UNION ALL
        SELECT 'content'::text AS source, kind::text AS kind, left(content, 160) AS summary, created_at
        FROM public.neyvix_content_items WHERE user_id = ${userId}
        UNION ALL
        SELECT 'estate'::text AS source, status::text AS kind, brand || ' · ' || city AS summary, updated_at AS created_at
        FROM public.neyvix_estate_sites WHERE user_id = ${userId}
        UNION ALL
        SELECT 'automation'::text AS source, status::text AS kind, name AS summary, updated_at AS created_at
        FROM public.neyvix_automations WHERE user_id = ${userId}
        UNION ALL
        SELECT 'approval'::text AS source, status::text AS kind, title AS summary, COALESCE(decided_at, created_at) AS created_at
        FROM public.neyvix_approval_requests WHERE requested_by = ${userId}
      ) timeline
      ORDER BY created_at DESC
      LIMIT 12
    `,
  ]);

  return {
    ...mapSummary(row),
    recentAi: recent.map((item) => ({
      role: String(item.role),
      content: String(item.content),
      createdAt: String(item.created_at),
    })),
    recentActivity: activity.map((item) => ({
      source: String(item.source),
      kind: String(item.kind),
      summary: String(item.summary),
      createdAt: String(item.created_at),
    })),
  };
}
