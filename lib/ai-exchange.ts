import { neon } from "@neondatabase/serverless";

export type PersistedAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export async function saveAiExchange(email: string, userContent: string, assistantContent: string): Promise<PersistedAiMessage[] | false> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return false;

  const sql = neon(url);
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await sql`
    WITH target_user AS (
      SELECT id
      FROM public.users
      WHERE email = ${normalizedEmail}
        AND is_active = true
      LIMIT 1
    ), exchange(ordinal, role, content) AS (
      VALUES
        (0, 'user'::text, ${userContent}),
        (1, 'assistant'::text, ${assistantContent})
    )
    INSERT INTO public.neyvix_ai_messages (user_id, role, content, created_at)
    SELECT
      target_user.id,
      exchange.role,
      exchange.content,
      statement_timestamp() + (exchange.ordinal * interval '1 microsecond')
    FROM target_user
    CROSS JOIN exchange
    ORDER BY exchange.ordinal
    RETURNING id, role, content, created_at
  `;

  if (rows.length !== 2) {
    throw new Error("NEYVIX AI exchange persistence did not write both turns");
  }

  const persistedRoles = rows.map((row) => String(row.role)).sort();
  if (persistedRoles[0] !== "assistant" || persistedRoles[1] !== "user") {
    throw new Error("NEYVIX AI exchange persistence wrote an invalid role set");
  }

  return rows
    .map((row) => ({
      id: String(row.id),
      role: String(row.role) as "user" | "assistant",
      content: String(row.content),
      createdAt: new Date(String(row.created_at)).toISOString(),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
