import { neon } from "@neondatabase/serverless";

export type MailOutboxStatus = {
  id: string;
  status: string;
  occurredAt: string;
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  return neon(url);
}

export async function getOwnedMailOutboxStatus(email: string, messageId: string): Promise<MailOutboxStatus | null> {
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    SELECT
      m.id,
      m.status,
      COALESCE(m.sent_at, m.updated_at, m.created_at) AS occurred_at
    FROM public.messages m
    JOIN public.mailboxes mb ON mb.id = m.mailbox_id
    JOIN public.users u ON u.id = mb.user_id
    WHERE m.id = ${messageId}::uuid
      AND m.folder = 'sent'
      AND lower(u.email) = ${email.trim().toLowerCase()}
      AND u.is_active = true
    LIMIT 1
  ` as Array<{ id: string; status: string | null; occurred_at: string }>;

  const row = rows[0];
  if (!row?.id) return null;
  return {
    id: String(row.id),
    status: String(row.status || "pending"),
    occurredAt: String(row.occurred_at),
  };
}
