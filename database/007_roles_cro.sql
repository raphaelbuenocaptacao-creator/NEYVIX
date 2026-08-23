-- NEYVIX roles / CRO authorization
-- Additive and idempotent. Does not store or expose passwords.

alter table public.users
  add column if not exists role text not null default 'member';

alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('member', 'cro', 'admin', 'superadmin'));

update public.users
set role = 'cro',
    is_active = true
where lower(email) = lower('Raphaelbueno.captacao@gmail.com');

create index if not exists idx_users_role_active
  on public.users(role, is_active);
