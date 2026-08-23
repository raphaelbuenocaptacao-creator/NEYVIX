-- NEYVIX commercial foundation
-- Additive/idempotent. Stores plans, subscription plan selection and provider references.

create table if not exists public.neyvix_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL',
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.neyvix_plans (slug, name, price_cents, features, sort_order)
values
  ('start', 'Start', 4900, '["ai","content","studio","pwa","history"]'::jsonb, 10),
  ('pro', 'Pro', 9900, '["ai","content","studio","pwa","history","automation","estate","deploy"]'::jsonb, 20),
  ('business', 'Business', 24900, '["ai","content","studio","pwa","history","automation","estate","deploy","admin","approvals","mail","team"]'::jsonb, 30)
on conflict (slug) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  features = excluded.features,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

alter table public.subscriptions add column if not exists plan_id uuid references public.neyvix_plans(id) on delete set null;
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

create index if not exists idx_neyvix_plans_active_sort on public.neyvix_plans(is_active, sort_order);
create index if not exists idx_neyvix_billing_events_created on public.neyvix_billing_events(created_at desc);
