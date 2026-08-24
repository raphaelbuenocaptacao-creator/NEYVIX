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

type MailSql = NonNullable<ReturnType<typeof getSql>>;

async function mailSchemaReady(sql: MailSql) {
  const registry = await sql`
    SELECT
      to_regclass('public.mailboxes')::text AS mailboxes_table,
      to_regclass('public.messages')::text AS messages_table
  ` as Array<{ mailboxes_table: string | null; messages_table: string | null }>;
  return Boolean(registry[0]?.mailboxes_table && registry[0]?.messages_table);
}

export async function ensureMailbox(email: string, displayName?: string) {
  const sql = getSql();
  if (!sql || !(await mailSchemaReady(sql))) return null;
  const normalized = email.trim().toLowerCase();
  const rows = await sql`
    INSERT INTO public.mailboxes (user_id, address, display_name)
    SELECT u.id, ${normalized}, ${displayName?.trim().slice(0, 120) || null}
    FROM public.users u
    WHERE lower(u.email) = ${normalized}
    ON CONFLICT (address) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, public.mailboxes.display_name),
      updated_at = now()
    RETURNING id, address
  ` as Array<{ id: string; address: string }>;
  return rows[0] ?? null;
}

export async function saveSentMessage(input: { email: string; displayName?: string; to: string; subject: string; text: string; providerMessageId?: string | null }) {
  const sql = getSql();
  if (!sql || !(await mailSchemaReady(sql))) return null;
  const mailbox = await ensureMailbox(input.email, input.displayName);
  if (!mailbox) return null;
  const rows = await sql`
    INSERT INTO public.messages (
      mailbox_id, provider_message_id, sender_address, recipient_address,
      subject, body_text, folder, status, is_read, sent_at
    ) VALUES (
      ${String(mailbox.id)}, ${input.providerMessageId ?? null}, ${input.email.trim().toLowerCase()},
      ${input.to.trim().toLowerCase()}, ${input.subject.trim().slice(0, 240)}, ${input.text.trim()},
      'sent', 'sent', true, now()
    )
    RETURNING id, created_at
  ` as Array<{ id: string; created_at: string }>;
  return rows[0] ?? null;
}

export async function listMailMessages(email: string, limit = 30): Promise<MailListItem[]> {
  const sql = getSql();
  if (!sql || !(await mailSchemaReady(sql))) return [];

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
  ` as Array<{
    id: string;
    sender_address: string;
    subject: string | null;
    preview: string | null;
    folder: string | null;
    is_read: boolean;
    is_starred: boolean;
    occurred_at: string;
  }>;

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
