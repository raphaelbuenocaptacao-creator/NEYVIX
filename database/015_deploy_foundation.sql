-- NEYVIX Deploy production foundation
-- Minimal, additive-only schema for owner-scoped Deploy persistence.
-- Intentionally excludes provider secrets, external deployment execution, and unrelated ecosystem modules.

create extension if not exists pgcrypto;

create table if not exists deploy_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references users(id) on delete set null,
  name text not null,
  git_provider text not null default 'github',
  git_repository text not null,
  production_branch text not null default 'main',
  framework text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, git_provider, git_repository)
);

create table if not exists deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references deploy_projects(id) on delete cascade,
  commit_sha text,
  branch text not null default 'main',
  environment text not null default 'preview',
  status text not null default 'queued',
  provider text,
  provider_deployment_id text,
  deployment_url text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_deployments_project_created
  on deployments(project_id, created_at desc);
