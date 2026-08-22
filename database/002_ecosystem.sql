-- NEYVIX ecosystem expansion
-- Additive, database-ready schema for communication, social, files, collaboration,
-- deployment orchestration, business and wallet ledger architecture.

create extension if not exists pgcrypto;

-- Shared product memberships / entitlements
create table if not exists product_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product text not null,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(user_id, product)
);

-- NEYVIX Chat / Meet foundation
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct',
  title text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key(conversation_id, user_id)
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_user_id uuid references users(id) on delete set null,
  body text not null default '',
  kind text not null default 'text',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  title text not null,
  room_code text not null unique,
  status text not null default 'scheduled',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- NEYVIX Social foundation
create table if not exists social_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  bio text,
  avatar_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references users(id) on delete cascade,
  body text not null default '',
  visibility text not null default 'public',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_follows (
  follower_user_id uuid not null references users(id) on delete cascade,
  following_user_id uuid not null references users(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key(follower_user_id, following_user_id),
  check (follower_user_id <> following_user_id)
);

-- NEYVIX Drive / Docs foundation
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

-- NEYVIX Deploy / Cloud foundation
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
  unique(git_provider, git_repository)
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

create table if not exists cloud_resources (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references users(id) on delete set null,
  project_id uuid references deploy_projects(id) on delete cascade,
  resource_type text not null,
  provider text not null,
  provider_resource_id text,
  region text,
  status text not null default 'provisioning',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NEYVIX Business foundation
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key(organization_id, user_id)
);

-- NEYVIX Pay architecture: internal ledger model only.
-- No bank account creation, card acquiring or regulated money movement is implemented here.
create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references users(id) on delete restrict,
  organization_id uuid references organizations(id) on delete restrict,
  currency char(3) not null default 'BRL',
  status text not null default 'inactive',
  created_at timestamptz not null default now(),
  check ((owner_user_id is not null) <> (organization_id is not null))
);

create table if not exists ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets(id) on delete restrict,
  account_type text not null,
  created_at timestamptz not null default now(),
  unique(wallet_id, account_type)
);

create table if not exists ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references ledger_transactions(id) on delete restrict,
  account_id uuid not null references ledger_accounts(id) on delete restrict,
  direction text not null check (direction in ('debit','credit')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'BRL',
  created_at timestamptz not null default now()
);

-- AI integration audit/scaffolding
create table if not exists ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  product text not null,
  provider text,
  model text,
  request_id text,
  input_metadata jsonb not null default '{}'::jsonb,
  output_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_conversation_created on chat_messages(conversation_id, created_at asc);
create index if not exists idx_social_posts_author_created on social_posts(author_user_id, created_at desc);
create index if not exists idx_drive_items_owner_parent on drive_items(owner_user_id, parent_id);
create index if not exists idx_deployments_project_created on deployments(project_id, created_at desc);
create index if not exists idx_cloud_resources_project on cloud_resources(project_id);
create index if not exists idx_org_members_user on organization_members(user_id);
create index if not exists idx_ledger_entries_transaction on ledger_entries(transaction_id);
create index if not exists idx_ai_interactions_user_created on ai_interactions(user_id, created_at desc);
