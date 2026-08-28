import { neon } from "@neondatabase/serverless";

export type AiHistoryMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

export async function listAiHistory(email: string, limit = 40): Promise<AiHistoryMessage[]> {
  const sql = getSql();
  if (!sql) return [];

  const normalizedEmail = email.trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(limit, 80));
  const rows = await sql`
    SELECT m.role, m.content, m.created_at
    FROM public.neyvix_ai_messages m
    JOIN public.users u ON u.id = m.user_id
    WHERE u.email = ${normalizedEmail}
      AND m.role IN ('user', 'assistant', 'system')
    ORDER BY m.created_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.reverse().map((row) => ({
    role: String(row.role) as AiHistoryMessage["role"],
    content: String(row.content ?? ""),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));
}
