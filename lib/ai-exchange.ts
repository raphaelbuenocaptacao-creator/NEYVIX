import { neon } from "@neondatabase/serverless";

export async function saveAiExchange(email: string, userContent: string, assistantContent: string) {
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
    RETURNING role
  `;

  if (rows.length !== 2) {
    throw new Error("NEYVIX AI exchange persistence did not write both turns");
  }

  return true;
}
