create extension if not exists pgcrypto;

create table if not exists neyvix_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  trigger_type text not null default 'manual',
  action_type text not null default 'workflow',
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists neyvix_approval_requests (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references neyvix_automations(id) on delete set null,
  run_id uuid references neyvix_automation_runs(id) on delete set null,
  requested_by uuid not null references public.users(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  decided_by uuid references public.users(id) on delete set null,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_neyvix_automations_user_updated
  on neyvix_automations(user_id, updated_at desc);

create index if not exists idx_neyvix_approval_requests_assignee_status_created
  on neyvix_approval_requests(assigned_to, status, created_at desc);

create index if not exists idx_neyvix_approval_requests_requester_created
  on neyvix_approval_requests(requested_by, created_at desc);
