import { neon } from "@neondatabase/serverless";

export type MailFolder = "inbox" | "sent" | "draft";

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
    WHERE lower(u.email) = ${normalized} AND u.is_active = true
    ON CONFLICT (address) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, public.mailboxes.display_name),
      updated_at = now()
    RETURNING id, address
  ` as Array<{ id: string; address: string }>;
  return rows[0] ?? null;
}

export async function saveInboundMessage(input: {
  providerMessageId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  receivedAt?: string;
}) {
  const sql = getSql();
  if (!sql || !(await mailSchemaReady(sql))) return { ok: false as const, reason: "database_unavailable" };

  const mailbox = await ensureMailbox(input.to);
  if (!mailbox) return { ok: false as const, reason: "recipient_not_found" };

  const receivedAt = input.receivedAt && !Number.isNaN(Date.parse(input.receivedAt)) ? input.receivedAt : null;
  const rows = await sql`
    WITH existing AS (
      SELECT id FROM public.messages WHERE provider_message_id = ${input.providerMessageId} LIMIT 1
    ), inserted AS (
      INSERT INTO public.messages (
        mailbox_id, provider_message_id, sender_address, recipient_address,
        subject, body_text, body_html, folder, status, is_read, received_at
      )
      SELECT
        ${String(mailbox.id)}, ${input.providerMessageId}, ${input.from}, ${input.to},
        ${input.subject.slice(0, 240)}, ${input.text}, ${input.html?.trim() || null},
        'inbox', 'received', false, COALESCE(${receivedAt}::timestamptz, now())
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING id
    )
    SELECT
      COALESCE((SELECT id FROM inserted), (SELECT id FROM existing)) AS id,
      EXISTS (SELECT 1 FROM existing) AS duplicate
  ` as Array<{ id: string | null; duplicate: boolean }>;

  const row = rows[0];
  if (!row?.id) return { ok: false as const, reason: "persist_failed" };
  return { ok: true as const, duplicate: Boolean(row.duplicate), messageId: String(row.id) };
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

export async function saveMailDraft(input: { email: string; displayName?: string; to?: string; subject?: string; text?: string }) {
  const sql = getSql();
  if (!sql || !(await mailSchemaReady(sql))) return null;
  const mailbox = await ensureMailbox(input.email, input.displayName);
  if (!mailbox) return null;

  const sender = input.email.trim().toLowerCase();
  const recipient = input.to?.trim().toLowerCase().slice(0, 320) || sender;
  const rows = await sql`
    INSERT INTO public.messages (
      mailbox_id, sender_address, recipient_address, subject, body_text,
      folder, status, is_read
    ) VALUES (
      ${String(mailbox.id)}, ${sender}, ${recipient}, ${input.subject?.trim().slice(0, 240) || ""},
      ${input.text?.slice(0, 20000) || ""}, 'draft', 'draft', true
    )
    RETURNING id, created_at
  ` as Array<{ id: string; created_at: string }>;
  return rows[0] ?? null;
}

export async function deleteMailDraft(email: string, draftId: string) {
  const sql = getSql();
  if (!sql || !(await mailSchemaReady(sql))) return false;
  const rows = await sql`
    DELETE FROM public.messages m
    USING public.mailboxes mb, public.users u
    WHERE m.id = ${draftId}::uuid
      AND m.folder = 'draft'
      AND m.status = 'draft'
      AND m.mailbox_id = mb.id
      AND mb.user_id = u.id
      AND u.is_active = true
      AND lower(u.email) = ${email.trim().toLowerCase()}
    RETURNING m.id
  ` as Array<{ id: string }>;
  return rows.length === 1;
}

export async function listMailMessages(email: string, limit = 30, folder: MailFolder = "inbox"): Promise<MailListItem[]> {
  const sql = getSql();
  if (!sql || !(await mailSchemaReady(sql))) return [];
  const safeFolder: MailFolder = folder === "sent" ? "sent" : folder === "draft" ? "draft" : "inbox";

  const rows = await sql`
    SELECT
      m.id,
      CASE WHEN m.folder IN ('sent', 'draft') THEN m.recipient_address ELSE m.sender_address END AS correspondent,
      m.subject,
      left(COALESCE(NULLIF(m.body_text, ''), '[Mensagem sem prévia]'), 180) AS preview,
      m.folder,
      m.is_read,
      m.is_starred,
      COALESCE(m.received_at, m.sent_at, m.updated_at, m.created_at) AS occurred_at
    FROM public.messages m
    JOIN public.mailboxes mb ON mb.id = m.mailbox_id
    JOIN public.users u ON u.id = mb.user_id
    WHERE lower(u.email) = ${email.trim().toLowerCase()}
      AND u.is_active = true
      AND m.folder = ${safeFolder}
    ORDER BY COALESCE(m.received_at, m.sent_at, m.updated_at, m.created_at) DESC
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  ` as Array<{
    id: string;
    correspondent: string;
    subject: string | null;
    preview: string | null;
    folder: string | null;
    is_read: boolean;
    is_starred: boolean;
    occurred_at: string;
  }>;

  return rows.map((row) => ({
    id: String(row.id),
    sender: String(row.correspondent),
    subject: String(row.subject || "(Sem assunto)"),
    preview: String(row.preview || ""),
    folder: String(row.folder || safeFolder),
    isRead: Boolean(row.is_read),
    isStarred: Boolean(row.is_starred),
    occurredAt: String(row.occurred_at),
  }));
}
