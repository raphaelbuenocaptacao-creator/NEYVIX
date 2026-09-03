import { neon } from "@neondatabase/serverless";

export type NeyvixMemory = {
  id: string;
  key: string;
  category: string;
  value: string;
  source: string;
  confidence: number;
  isPrivate: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NeyvixMemoryEvent = {
  id: string;
  memoryId: string | null;
  action: string;
  source: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

async function schemaReady(sql: NonNullable<ReturnType<typeof getSql>>) {
  const rows = await sql`SELECT to_regclass('public.neyvix_memories')::text AS memories, to_regclass('public.neyvix_memory_events')::text AS events` as Array<{ memories: string | null; events: string | null }>;
  return Boolean(rows[0]?.memories && rows[0]?.events);
}

export async function listMemories(email: string, limit = 50): Promise<NeyvixMemory[]> {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return [];
  const rows = await sql`
    SELECT m.id, m.memory_key, m.category, m.value, m.source, m.confidence,
           m.is_private, m.last_used_at, m.expires_at, m.created_at, m.updated_at
    FROM public.neyvix_memories m
    JOIN public.users u ON u.id = m.user_id
    WHERE lower(u.email) = ${email.trim().toLowerCase()}
      AND (m.expires_at IS NULL OR m.expires_at > now())
    ORDER BY m.updated_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  ` as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id), key: String(row.memory_key), category: String(row.category), value: String(row.value),
    source: String(row.source), confidence: Number(row.confidence ?? 1), isPrivate: Boolean(row.is_private),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
}

export async function listMemoryEvents(email: string, limit = 20): Promise<NeyvixMemoryEvent[]> {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return [];
  const rows = await sql`
    SELECT e.id, e.memory_id, e.action, e.source, e.metadata, e.created_at
    FROM public.neyvix_memory_events e
    JOIN public.users u ON u.id = e.user_id
    WHERE lower(u.email) = ${email.trim().toLowerCase()}
    ORDER BY e.created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 50))}
  ` as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    memoryId: row.memory_id ? String(row.memory_id) : null,
    action: String(row.action),
    source: String(row.source),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {},
    createdAt: String(row.created_at),
  }));
}

export async function upsertMemory(input: { email: string; key: string; category?: string; value: string; isPrivate?: boolean; source?: string }) {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return null;
  const key = input.key.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 120);
  const value = input.value.trim().slice(0, 4000);
  const category = (input.category?.trim().toLowerCase() || "general").slice(0, 60);
  if (!key || !value) return null;
  const rows = await sql`
    WITH target_user AS (
      SELECT id FROM public.users WHERE lower(email) = ${input.email.trim().toLowerCase()} AND is_active = true LIMIT 1
    ), saved AS (
      INSERT INTO public.neyvix_memories (user_id, memory_key, category, value, source, is_private)
      SELECT id, ${key}, ${category}, ${value}, ${(input.source || "user").slice(0, 40)}, ${input.isPrivate ?? true}
      FROM target_user
      ON CONFLICT (user_id, memory_key) DO UPDATE SET
        category = EXCLUDED.category,
        value = EXCLUDED.value,
        source = EXCLUDED.source,
        is_private = EXCLUDED.is_private,
        updated_at = now()
      RETURNING id, user_id
    )
    INSERT INTO public.neyvix_memory_events (user_id, memory_id, action, source, metadata)
    SELECT user_id, id, 'upsert', ${(input.source || "user").slice(0, 40)},
      jsonb_build_object(
        'key', ${key}::text,
        'category', ${category}::text,
        'shared_with_ai', ${!(input.isPrivate ?? true)}::boolean
      )
    FROM saved
    RETURNING memory_id
  ` as Array<{ memory_id: string }>;
  return rows[0]?.memory_id ? String(rows[0].memory_id) : null;
}

export async function deleteMemory(email: string, id: string) {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return false;
  const rows = await sql`
    WITH target AS (
      SELECT m.id, m.user_id, m.memory_key
      FROM public.neyvix_memories m
      JOIN public.users u ON u.id = m.user_id
      WHERE m.id = ${id}::uuid AND lower(u.email) = ${email.trim().toLowerCase()}
      LIMIT 1
    ), logged AS (
      INSERT INTO public.neyvix_memory_events (user_id, memory_id, action, source, metadata)
      SELECT user_id, id, 'delete', 'user', jsonb_build_object('key', memory_key::text) FROM target
      RETURNING memory_id
    )
    DELETE FROM public.neyvix_memories m
    USING target t
    WHERE m.id = t.id
    RETURNING m.id
  ` as Array<{ id: string }>;
  return rows.length === 1;
}

export async function setMemoryPrivacy(email: string, id: string, isPrivate: boolean) {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return false;
  const rows = await sql`
    WITH target AS (
      SELECT m.id, m.user_id, m.memory_key
      FROM public.neyvix_memories m
      JOIN public.users u ON u.id = m.user_id
      WHERE m.id = ${id}::uuid
        AND lower(u.email) = ${email.trim().toLowerCase()}
        AND u.is_active = true
      LIMIT 1
    ), changed AS (
      UPDATE public.neyvix_memories m
      SET is_private = ${isPrivate}, updated_at = now()
      FROM target t
      WHERE m.id = t.id
      RETURNING m.id, m.user_id, m.memory_key
    )
    INSERT INTO public.neyvix_memory_events (user_id, memory_id, action, source, metadata)
    SELECT user_id, id, 'privacy', 'user',
      jsonb_build_object('key', memory_key::text, 'shared_with_ai', ${!isPrivate}::boolean)
    FROM changed
    RETURNING memory_id
  ` as Array<{ memory_id: string }>;
  return rows.length === 1;
}

export async function getMemoryContext(email: string, limit = 12) {
  const sql = getSql();
  if (!sql || !(await schemaReady(sql))) return [];

  const rows = await sql`
    SELECT m.id, m.user_id, m.memory_key, m.category, m.value
    FROM public.neyvix_memories m
    JOIN public.users u ON u.id = m.user_id
    WHERE lower(u.email) = ${email.trim().toLowerCase()}
      AND u.is_active = true
      AND m.is_private = false
      AND (m.expires_at IS NULL OR m.expires_at > now())
    ORDER BY m.updated_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 50))}
  ` as Array<{ id: string; user_id: string; memory_key: string; category: string; value: string }>;

  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  try {
    await sql`
      WITH touched AS (
        UPDATE public.neyvix_memories
        SET last_used_at = now()
        WHERE id = ANY(${ids}::uuid[])
        RETURNING id, user_id, memory_key, category
      )
      INSERT INTO public.neyvix_memory_events (user_id, memory_id, action, source, metadata)
      SELECT user_id, id, 'recall', 'neyvix-ai',
        jsonb_build_object('key', memory_key::text, 'category', category::text)
      FROM touched
    `;
  } catch (error) {
    console.warn("Unable to audit NEYVIX Memory recall", error);
    // Memory context should never break the calling product.
  }

  return rows.map((row) => ({ key: String(row.memory_key), category: String(row.category), value: String(row.value) }));
}
