-- NEYVIX bootstrap schema.
-- Keep this file aligned with the current runtime shape. Existing databases must
-- continue to use the numbered additive/idempotent migrations; this bootstrap is
-- for fresh environments and must not be applied destructively to production.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text,
  is_active boolean not null default true,
  is_superadmin boolean not null default false,
  role text not null default 'member' check (role in ('member', 'cro', 'admin', 'superadmin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip_address inet,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists mailboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  address text not null unique,
  storage_used_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  mailbox_id uuid not null references mailboxes(id) on delete cascade,
  subject text not null default '',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  mailbox_id uuid not null references mailboxes(id) on delete cascade,
  internet_message_id text unique,
  sender_address text not null,
  recipient_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  subject text not null default '',
  body_text text,
  body_html text,
  folder text not null default 'inbox',
  is_read boolean not null default false,
  is_starred boolean not null default false,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  storage_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique(owner_user_id, email)
);

create table if not exists security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  event_type text not null,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_role_active on users(role, is_active);
create index if not exists idx_messages_mailbox_folder_created on messages(mailbox_id, folder, created_at desc);
create index if not exists idx_messages_thread on messages(thread_id, created_at asc);
create index if not exists idx_threads_mailbox_last_message on threads(mailbox_id, last_message_at desc);
create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_security_events_user_created on security_events(user_id, created_at desc);
