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
