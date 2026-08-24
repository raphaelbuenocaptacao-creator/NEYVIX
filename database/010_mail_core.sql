-- NEYVIX Mail core persistence
-- Additive/idempotent.

CREATE TABLE IF NOT EXISTS public.mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (address)
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_user_id ON public.mailboxes(user_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  provider_message_id text,
  sender_address text NOT NULL,
  recipient_address text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  body_html text,
  folder text NOT NULL DEFAULT 'inbox',
  status text NOT NULL DEFAULT 'stored',
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_mailbox_folder_time
  ON public.messages(mailbox_id, folder, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_message_id
  ON public.messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
