CREATE TABLE IF NOT EXISTS public.neyvix_rate_limit_events (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  bucket_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_neyvix_rate_limit_bucket_created
  ON public.neyvix_rate_limit_events (action, bucket_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_neyvix_rate_limit_created
  ON public.neyvix_rate_limit_events (created_at);
