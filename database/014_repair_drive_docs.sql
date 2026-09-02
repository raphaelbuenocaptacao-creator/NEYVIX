-- NEYVIX targeted schema repair: Drive + Docs
-- Additive and idempotent. This file intentionally contains no DROP/ALTER/TRUNCATE/DML.
-- It repairs the production drift where Drive/Docs application code exists but the
-- corresponding persistence tables are absent.

create extension if not exists pgcrypto;

create table if not exists drive_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  parent_id uuid references drive_items(id) on delete cascade,
  kind text not null default 'file',
  name text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  storage_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  drive_item_id uuid unique references drive_items(id) on delete set null,
  title text not null default 'Untitled',
  content jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_drive_items_owner_parent
  on drive_items(owner_user_id, parent_id);
