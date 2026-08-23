-- Runtime compatibility and product core for the current NEYVIX application.
-- Additive/idempotent: intended to bring an existing NEYVIX database up to the
-- model used by lib/db.ts without dropping data.

create extension if not exists pgcrypto;

alter table public.users add column if not exists name text;
alter table public.users add column if not exists is_active boolean not null default true;
alter table public.users add column if not exists is_superadmin boolean not null default false;

-- Older NEYVIX schema versions required handle/display_name on every insert,
-- while the current NEYVIX ID runtime uses email + name. Preserve the legacy
-- columns and data, but remove their NOT NULL requirement when they exist.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'handle'
  ) then
    execute 'alter table public.users alter column handle drop not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'display_name'
  ) then
    execute 'alter table public.users alter column display_name drop not null';
  end if;
end $$;

update public.users
set name = split_part(email, '@', 1)
where name is null or btrim(name) = '';

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  trial_days integer not null default 7 check (trial_days between 0 and 365),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.projects (slug, name, trial_days, is_active)
values ('neyvix', 'NEYVIX', 7, true)
on conflict (slug) do update
set name = excluded.name,
    trial_days = excluded.trial_days,
    is_active = true,
    updated_at = now();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, user_id)
);

create table if not exists public.neyvix_ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.neyvix_studio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  prompt text not null,
  blueprint jsonb not null default '{}'::jsonb,
  status text not null default 'generated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.neyvix_content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,
  prompt text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_project on public.subscriptions(user_id, project_id);
create index if not exists idx_neyvix_ai_messages_user_created on public.neyvix_ai_messages(user_id, created_at desc);
create index if not exists idx_neyvix_studio_projects_user_updated on public.neyvix_studio_projects(user_id, updated_at desc);
create index if not exists idx_neyvix_content_items_user_created on public.neyvix_content_items(user_id, created_at desc);
