import { neon } from "@neondatabase/serverless";

export type AdminSystemSummary = {
  usersTotal: number;
  activeUsers: number;
  neyvixSubscriptions: number;
  activeWithoutSubscription: number;
  aiMessages: number;
  memories: number;
  studioProjects: number;
  contentItems: number;
  gatewayConfigured: boolean;
  gatewaySecretConfigured: boolean;
  memoryAiContextEnabled: boolean;
};

export async function getAdminSystemSummary(): Promise<AdminSystemSummary | null> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  const sql = neon(databaseUrl);
  const rows = await sql`
    SELECT
      (SELECT count(*)::int FROM public.users) AS users_total,
      (SELECT count(*)::int FROM public.users WHERE is_active = true) AS active_users,
      (
        SELECT count(*)::int
        FROM public.subscriptions s
        JOIN public.projects p ON p.id = s.project_id
        WHERE p.slug = 'neyvix'
      ) AS neyvix_subscriptions,
      (
        SELECT count(*)::int
        FROM public.users u
        WHERE u.is_active = true
          AND COALESCE(u.is_superadmin, false) = false
          AND NOT EXISTS (
            SELECT 1
            FROM public.subscriptions s
            JOIN public.projects p ON p.id = s.project_id
            WHERE s.user_id = u.id AND p.slug = 'neyvix'
          )
      ) AS active_without_subscription,
      (SELECT count(*)::int FROM public.neyvix_ai_messages) AS ai_messages,
      (SELECT count(*)::int FROM public.neyvix_memories) AS memories,
      (SELECT count(*)::int FROM public.neyvix_studio_projects) AS studio_projects,
      (SELECT count(*)::int FROM public.neyvix_content_items) AS content_items
  `;

  const row = rows[0] ?? {};
  return {
    usersTotal: Number(row.users_total ?? 0),
    activeUsers: Number(row.active_users ?? 0),
    neyvixSubscriptions: Number(row.neyvix_subscriptions ?? 0),
    activeWithoutSubscription: Number(row.active_without_subscription ?? 0),
    aiMessages: Number(row.ai_messages ?? 0),
    memories: Number(row.memories ?? 0),
    studioProjects: Number(row.studio_projects ?? 0),
    contentItems: Number(row.content_items ?? 0),
    gatewayConfigured: Boolean(process.env.NEYVIX_AI_GATEWAY_URL?.trim()),
    gatewaySecretConfigured: Boolean(process.env.NEYVIX_AI_GATEWAY_SECRET?.trim()),
    memoryAiContextEnabled: process.env.NEYVIX_MEMORY_AI_CONTEXT === "true",
  };
}
