import { neon } from "@neondatabase/serverless";
import { getAiMessagesByIds } from "@/lib/ai-history";

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

  const insertedIds = rows.map((row) => String(row.id));
  if (!insertedIds[0] || !insertedIds[1] || insertedIds[0] === insertedIds[1]) {
    throw new Error("NEYVIX AI exchange persistence returned invalid message identities");
  }

  const reread = await getAiMessagesByIds(normalizedEmail, [insertedIds[0], insertedIds[1]]);
  if (reread.length !== 2) {
    throw new Error("NEYVIX AI exchange persistence could not be verified by authoritative reread");
  }

  const persisted = reread.map((message) => ({
    id: message.id,
    role: message.role as "user" | "assistant",
    content: message.content,
    createdAt: message.createdAt,
  }));

  const byRole = new Map(persisted.map((message) => [message.role, message]));
  const persistedUser = byRole.get("user");
  const persistedAssistant = byRole.get("assistant");

  if (!persistedUser || !persistedAssistant || byRole.size !== 2) {
    throw new Error("NEYVIX AI exchange persistence wrote an invalid role set");
  }
  if (persistedUser.content !== userContent || persistedAssistant.content !== assistantContent) {
    throw new Error("NEYVIX AI exchange persistence returned content that does not match the generated exchange");
  }
  if (!persistedUser.id || !persistedAssistant.id || persistedUser.id === persistedAssistant.id) {
    throw new Error("NEYVIX AI exchange persistence returned invalid message identities");
  }
  if (!Number.isFinite(Date.parse(persistedUser.createdAt)) || !Number.isFinite(Date.parse(persistedAssistant.createdAt))) {
    throw new Error("NEYVIX AI exchange persistence returned invalid timestamps");
  }

  return persisted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
