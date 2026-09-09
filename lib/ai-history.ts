import { neon } from "@neondatabase/serverless";

export type AiHistoryMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type AiHistoryPage = {
  messages: AiHistoryMessage[];
  nextCursor: string | null;
  hasMore: boolean;
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

function normalizeTimestamp(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseCursor(value?: string | null) {
  const cursor = value?.trim();
  if (!cursor) return { createdAt: null as string | null, id: null as string | null };

  const split = cursor.lastIndexOf("|");
  if (split > 0) {
    const createdAt = normalizeTimestamp(cursor.slice(0, split));
    const id = cursor.slice(split + 1).trim();
    if (createdAt && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return { createdAt, id };
    }
  }

  return { createdAt: normalizeTimestamp(cursor), id: null as string | null };
}

export async function listAiHistoryPage(
  email: string,
  options?: { limit?: number; before?: string | null },
): Promise<AiHistoryPage> {
  const sql = getSql();
  if (!sql) throw new Error("NEYVIX AI history database is unavailable");

  const normalizedEmail = email.trim().toLowerCase();
  const limit = Math.max(1, Math.min(80, Math.trunc(options?.limit ?? 40)));
  const before = parseCursor(options?.before);
  const fetchLimit = limit + 1;

  const rows = await sql`
    SELECT m.id::text AS id, m.role, m.content, m.created_at
    FROM public.neyvix_ai_messages m
    JOIN public.users u ON u.id = m.user_id
    WHERE u.email = ${normalizedEmail}
      AND u.is_active = true
      AND m.role IN ('user', 'assistant', 'system')
      AND (
        ${before.createdAt}::timestamptz IS NULL
        OR m.created_at < ${before.createdAt}::timestamptz
        OR (
          ${before.id}::uuid IS NOT NULL
          AND m.created_at = ${before.createdAt}::timestamptz
          AND m.id < ${before.id}::uuid
        )
      )
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ${fetchLimit}
  `;

  const hasMore = rows.length > limit;
  const selected = rows.slice(0, limit);
  const last = selected[selected.length - 1];
  const cursorTimestamp = last ? normalizeTimestamp(last.created_at) : null;
  const nextCursor = hasMore && last && cursorTimestamp
    ? `${cursorTimestamp}|${String(last.id)}`
    : null;

  return {
    messages: selected.reverse().map((row) => ({
      id: String(row.id),
      role: String(row.role) as AiHistoryMessage["role"],
      content: String(row.content ?? ""),
      createdAt: normalizeTimestamp(row.created_at) ?? String(row.created_at),
    })),
    nextCursor,
    hasMore,
  };
}

export async function listAiHistory(email: string, limit = 40): Promise<AiHistoryMessage[]> {
  const page = await listAiHistoryPage(email, { limit });
  return page.messages;
}
