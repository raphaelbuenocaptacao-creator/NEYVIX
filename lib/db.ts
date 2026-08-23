import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  return neon(url);
}

function encodePassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `${salt}.${hash}`;
}

function verifyPassword(encoded: string, password: string) {
  const [salt, expectedHash] = encoded.split(".");
  if (!salt || !expectedHash) return false;
  const provided = Buffer.from(scryptSync(password, salt, 64).toString("base64url"));
  const expected = Buffer.from(expectedHash);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function createDatabaseUser(name: string, email: string, password: string) {
  const sql = getSql();
  if (!sql) return null;

  const id = randomUUID();
  const passwordHash = encodePassword(password);
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = name.trim().slice(0, 80);

  const users = await sql`
    INSERT INTO public.users (id, email, password_hash, name, is_active, is_superadmin)
    VALUES (${id}, ${normalizedEmail}, ${passwordHash}, ${cleanName}, true, false)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, name, is_active, is_superadmin, created_at
  `;

  const user = users[0] as { id: string; email: string; name: string | null } | undefined;
  if (!user) return null;

  await sql`
    INSERT INTO public.subscriptions (project_id, user_id, status, trial_started_at, trial_ends_at, metadata)
    SELECT p.id, ${user.id}, 'trialing', now(), now() + (p.trial_days || ' days')::interval, '{"source":"neyvix-id"}'::jsonb
    FROM public.projects p
    WHERE p.slug = 'neyvix' AND p.is_active = true
    ON CONFLICT (project_id, user_id) DO NOTHING
  `;

  return { id: user.id, email: user.email, name: user.name || cleanName };
}

export async function authenticateDatabaseUser(email: string, password: string) {
  const sql = getSql();
  if (!sql) return null;

  const normalizedEmail = email.trim().toLowerCase();
  const rows = await sql`
    SELECT id, email, name, password_hash, is_active
    FROM public.users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `;

  const user = rows[0] as { id: string; email: string; name: string | null; password_hash: string; is_active: boolean } | undefined;
  if (!user || !user.is_active || !verifyPassword(user.password_hash, password)) return null;
  return { id: user.id, email: user.email, name: user.name || user.email.split("@")[0] };
}

export async function getDatabaseUserByEmail(email: string) {
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`SELECT id, email, name, is_active, is_superadmin, created_at FROM public.users WHERE email = ${email.trim().toLowerCase()} LIMIT 1`;
  return (rows[0] as { id: string; email: string; name: string | null; is_active: boolean; is_superadmin: boolean; created_at: string } | undefined) ?? null;
}

export async function saveAiMessage(email: string, role: "user" | "assistant" | "system", content: string) {
  const sql = getSql();
  if (!sql) return;
  await sql`
    INSERT INTO public.neyvix_ai_messages (user_id, role, content)
    SELECT id, ${role}, ${content}
    FROM public.users
    WHERE email = ${email.trim().toLowerCase()}
  `;
}

export async function saveStudioProject(email: string, prompt: string, blueprintText: string) {
  const sql = getSql();
  if (!sql) return null;
  const cleanPrompt = prompt.trim();
  const title = cleanPrompt.slice(0, 80) || "Projeto NEYVIX Studio";
  const rows = await sql`
    INSERT INTO public.neyvix_studio_projects (user_id, title, prompt, blueprint, status)
    SELECT id, ${title}, ${cleanPrompt}, jsonb_build_object('text', ${blueprintText}), 'generated'
    FROM public.users
    WHERE email = ${email.trim().toLowerCase()}
    RETURNING id, title, status, created_at, updated_at
  `;
  return rows[0] ?? null;
}

export async function listStudioProjects(email: string, limit = 8) {
  const sql = getSql();
  if (!sql) return [];
  return sql`
    SELECT p.id, p.title, p.prompt, p.blueprint, p.status, p.created_at, p.updated_at
    FROM public.neyvix_studio_projects p
    JOIN public.users u ON u.id = p.user_id
    WHERE u.email = ${email.trim().toLowerCase()}
    ORDER BY p.updated_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 20))}
  `;
}

export async function saveContentItem(email: string, kind: string, prompt: string, content: string) {
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`
    INSERT INTO public.neyvix_content_items (user_id, kind, prompt, content)
    SELECT id, ${kind.trim().slice(0, 80)}, ${prompt.trim()}, ${content}
    FROM public.users
    WHERE email = ${email.trim().toLowerCase()}
    RETURNING id, kind, created_at
  `;
  return rows[0] ?? null;
}

export async function listContentItems(email: string, limit = 8) {
  const sql = getSql();
  if (!sql) return [];
  return sql`
    SELECT c.id, c.kind, c.prompt, c.content, c.created_at
    FROM public.neyvix_content_items c
    JOIN public.users u ON u.id = c.user_id
    WHERE u.email = ${email.trim().toLowerCase()}
    ORDER BY c.created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 20))}
  `;
}

export async function getRecentActivity(email: string, limit = 12) {
  const sql = getSql();
  if (!sql) return [];
  return sql`
    SELECT * FROM (
      SELECT 'ai'::text AS source, role::text AS kind, left(content, 180) AS summary, created_at
      FROM public.neyvix_ai_messages m JOIN public.users u ON u.id = m.user_id
      WHERE u.email = ${email.trim().toLowerCase()}
      UNION ALL
      SELECT 'studio'::text AS source, status::text AS kind, title AS summary, updated_at AS created_at
      FROM public.neyvix_studio_projects p JOIN public.users u ON u.id = p.user_id
      WHERE u.email = ${email.trim().toLowerCase()}
      UNION ALL
      SELECT 'content'::text AS source, kind::text AS kind, left(content, 180) AS summary, created_at
      FROM public.neyvix_content_items c JOIN public.users u ON u.id = c.user_id
      WHERE u.email = ${email.trim().toLowerCase()}
    ) activity
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 30))}
  `;
}

export async function getTrialStatus(email: string) {
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`
    SELECT s.status, s.trial_started_at, s.trial_ends_at, p.slug AS project_slug
    FROM public.subscriptions s
    JOIN public.users u ON u.id = s.user_id
    JOIN public.projects p ON p.id = s.project_id
    WHERE u.email = ${email.trim().toLowerCase()} AND p.slug = 'neyvix'
    LIMIT 1
  `;
  return rows[0] ?? null;
}

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
  recentAi: { role: string; content: string; createdAt: string }[];
  recentActivity: AdminActivityItem[];
};

export async function getAdminUserSummaries(limit = 24): Promise<AdminUserSummary[]> {
  const sql = getSql();
  if (!sql) return [];

  const users = await sql`
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

  return Promise.all(users.map(async (row) => {
    const recent = await sql`
      SELECT role, content, created_at
      FROM public.neyvix_ai_messages
      WHERE user_id = ${String(row.id)}
      ORDER BY created_at DESC
      LIMIT 8
    `;

    const activity = await sql`
      SELECT * FROM (
        SELECT 'ai'::text AS source, role::text AS kind, left(content, 160) AS summary, created_at
        FROM public.neyvix_ai_messages WHERE user_id = ${String(row.id)}
        UNION ALL
        SELECT 'studio'::text AS source, status::text AS kind, title AS summary, updated_at AS created_at
        FROM public.neyvix_studio_projects WHERE user_id = ${String(row.id)}
        UNION ALL
        SELECT 'content'::text AS source, kind::text AS kind, left(content, 160) AS summary, created_at
        FROM public.neyvix_content_items WHERE user_id = ${String(row.id)}
      ) timeline
      ORDER BY created_at DESC
      LIMIT 12
    `;

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
    } satisfies AdminUserSummary;
  }));
}
