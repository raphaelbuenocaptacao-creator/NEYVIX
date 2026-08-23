-- NEYVIX Estate — additive/idempotent persistence layer.
create extension if not exists pgcrypto;

create table if not exists public.neyvix_estate_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  brand text not null,
  slug text not null unique,
  city text not null,
  whatsapp text,
  creci text,
  headline text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  custom_domain text,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.neyvix_estate_properties (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.neyvix_estate_sites(id) on delete cascade,
  title text not null,
  price text,
  property_type text,
  location text,
  description text,
  image_urls jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_estate_sites_user_updated on public.neyvix_estate_sites(user_id, updated_at desc);
create index if not exists idx_estate_properties_site_updated on public.neyvix_estate_properties(site_id, updated_at desc);
