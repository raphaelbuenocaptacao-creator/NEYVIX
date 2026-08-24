-- NEYVIX commercial foundation
-- Additive/idempotent. Uses the shared public.plans table already referenced by subscriptions.plan_id.

-- Canonical NEYVIX plans.
insert into public.plans (project_id, code, name, price_cents, currency, interval, is_active, features)
select p.id, 'start-monthly', 'NEYVIX Start', 4900, 'BRL', 'month', true,
  '{"ai":true,"content":true,"studio":true,"pwa":true,"history":true}'::jsonb
from public.projects p
where p.slug = 'neyvix'
  and not exists (
    select 1 from public.plans x where x.project_id = p.id and x.code = 'start-monthly'
  );

insert into public.plans (project_id, code, name, price_cents, currency, interval, is_active, features)
select p.id, 'pro-monthly', 'NEYVIX Pro', 9900, 'BRL', 'month', true,
  '{"ai":true,"content":true,"studio":true,"pwa":true,"history":true,"automation":true,"estate":true,"deploy":true}'::jsonb
from public.projects p
where p.slug = 'neyvix'
  and not exists (
    select 1 from public.plans x where x.project_id = p.id and x.code = 'pro-monthly'
  );

insert into public.plans (project_id, code, name, price_cents, currency, interval, is_active, features)
select p.id, 'business-monthly', 'NEYVIX Business', 24900, 'BRL', 'month', true,
  '{"ai":true,"content":true,"studio":true,"pwa":true,"history":true,"automation":true,"estate":true,"deploy":true,"admin":true,"approvals":true,"mail":true,"team":true}'::jsonb
from public.projects p
where p.slug = 'neyvix'
  and not exists (
    select 1 from public.plans x where x.project_id = p.id and x.code = 'business-monthly'
  );

-- Subscription provider metadata. plan_id already targets public.plans in the canonical schema.
alter table public.subscriptions add column if not exists provider text;
alter table public.subscriptions add column if not exists provider_customer_id text;
alter table public.subscriptions add column if not exists provider_subscription_id text;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;

create unique index if not exists idx_subscriptions_provider_subscription
  on public.subscriptions(provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;

create table if not exists public.neyvix_billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create index if not exists idx_neyvix_billing_events_created
  on public.neyvix_billing_events(created_at desc);

-- database/009_canonical_plans.sql remains as a compatibility migration for environments
-- that had already applied the earlier parallel neyvix_plans experiment.
