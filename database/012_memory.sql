-- NEYVIX Memory v1
-- Additive and idempotent. Stores user-controlled long-term memories and audit events.

CREATE TABLE IF NOT EXISTS public.neyvix_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  memory_key text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  value text NOT NULL,
  source text NOT NULL DEFAULT 'user',
  confidence numeric(4,3) NOT NULL DEFAULT 1.000,
  is_private boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_neyvix_memories_user_updated
  ON public.neyvix_memories(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_neyvix_memories_user_category
  ON public.neyvix_memories(user_id, category, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.neyvix_memory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  memory_id uuid REFERENCES public.neyvix_memories(id) ON DELETE SET NULL,
  action text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_neyvix_memory_events_user_created
  ON public.neyvix_memory_events(user_id, created_at DESC);
