-- NEYVIX ID password reset tokens
-- Additive and idempotent. Tokens are stored only as hashes and are single-use.

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user_created
  on public.password_reset_tokens(user_id, created_at desc);

create index if not exists idx_password_reset_tokens_active
  on public.password_reset_tokens(expires_at)
  where used_at is null;
