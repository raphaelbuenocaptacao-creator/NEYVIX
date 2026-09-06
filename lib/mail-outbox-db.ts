import { neon } from "@neondatabase/serverless";

export type MailOutboxStatus = {
  id: string;
  status: string;
  occurredAt: string;
};

export type MailOutboxRetryDraft = {
  id: string;
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
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

export async function getOwnedFailedMailRetryDraft(email: string, messageId: string): Promise<MailOutboxRetryDraft | null> {
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    SELECT
      m.id,
      m.recipient_address,
      m.subject,
      m.body_text,
      m.provider_message_id
    FROM public.messages m
    JOIN public.mailboxes mb ON mb.id = m.mailbox_id
    JOIN public.users u ON u.id = mb.user_id
    WHERE m.id = ${messageId}::uuid
      AND m.folder = 'sent'
      AND m.status = 'failed'
      AND m.provider_message_id LIKE 'neyvix-outbox:%'
      AND lower(u.email) = ${email.trim().toLowerCase()}
      AND u.is_active = true
    LIMIT 1
  ` as Array<{
    id: string;
    recipient_address: string;
    subject: string | null;
    body_text: string | null;
    provider_message_id: string;
  }>;

  const row = rows[0];
  const marker = row?.provider_message_id ?? "";
  const idempotencyKey = marker.startsWith("neyvix-outbox:") ? marker.slice("neyvix-outbox:".length) : "";
  if (!row?.id || !idempotencyKey) return null;

  return {
    id: String(row.id),
    to: String(row.recipient_address || ""),
    subject: String(row.subject || ""),
    text: String(row.body_text || ""),
    idempotencyKey,
  };
}
