-- NEYVIX canonical commercial plans
-- Uses the shared public.plans table already referenced by public.subscriptions.plan_id.

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

-- neyvix_plans is retained temporarily for migration compatibility only.
-- Runtime entitlements use public.plans, which is the FK target of subscriptions.plan_id.
