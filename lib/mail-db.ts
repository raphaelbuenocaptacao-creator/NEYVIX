import { neon } from "@neondatabase/serverless";

export type MailListItem = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  folder: string;
  isRead: boolean;
  isStarred: boolean;
  occurredAt: string;
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  return neon(url);
}

export async function listMailMessages(email: string, limit = 30): Promise<MailListItem[]> {
  const sql = getSql();
  if (!sql) return [];

  const registry = await sql`
    SELECT
      to_regclass('public.mailboxes')::text AS mailboxes_table,
      to_regclass('public.messages')::text AS messages_table
  `;

  if (!registry[0]?.mailboxes_table || !registry[0]?.messages_table) return [];

  const rows = await sql`
    SELECT
      m.id,
      m.sender_address,
      m.subject,
      left(COALESCE(NULLIF(m.body_text, ''), '[Mensagem sem prévia]'), 180) AS preview,
      m.folder,
      m.is_read,
      m.is_starred,
      COALESCE(m.received_at, m.sent_at, m.created_at) AS occurred_at
    FROM public.messages m
    JOIN public.mailboxes mb ON mb.id = m.mailbox_id
    JOIN public.users u ON u.id = mb.user_id
    WHERE lower(u.email) = ${email.trim().toLowerCase()}
      AND m.folder = 'inbox'
    ORDER BY COALESCE(m.received_at, m.sent_at, m.created_at) DESC
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  `;

  return rows.map((row) => ({
    id: String(row.id),
    sender: String(row.sender_address),
    subject: String(row.subject || "(Sem assunto)"),
    preview: String(row.preview || ""),
    folder: String(row.folder || "inbox"),
    isRead: Boolean(row.is_read),
    isStarred: Boolean(row.is_starred),
    occurredAt: String(row.occurred_at),
  }));
}
