-- ============================================================
-- MYLATINOLIST — 008 Marketing trial activation
-- PROPOSAL ONLY — DO NOT APPLY until reviewed
--
-- Durable per-business Marketing & AI Growth trial lifecycle.
-- Do NOT use businesses.created_at, profiles.created_at, or
-- account creation as the trial clock.
--
-- Conceptual fields:
--   marketing_trial_started_at  → marketing_trials.started_at
--   marketing_trial_ends_at     → marketing_trials.ends_at
--   marketing_trial_status      → marketing_trials.status
--
-- Apply staging (mll-dev) first after approval.
-- Do NOT run against production until a separate approval.
-- This file does not insert any rows.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_trials (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled', 'converted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_trials_ends_after_start CHECK (ends_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_marketing_trials_status
  ON public.marketing_trials (status);

CREATE INDEX IF NOT EXISTS idx_marketing_trials_ends_at
  ON public.marketing_trials (ends_at);

COMMENT ON TABLE public.marketing_trials IS
  'Authoritative Marketing & AI Growth trial lifecycle. One row per business. Insert is idempotent on business_id.';
COMMENT ON COLUMN public.marketing_trials.started_at IS
  'marketing_trial_started_at — actual Marketing & AI Growth activation timestamp. Never reset on refresh, login, or deploy.';
COMMENT ON COLUMN public.marketing_trials.ends_at IS
  'marketing_trial_ends_at — 30 days after started_at.';
COMMENT ON COLUMN public.marketing_trials.status IS
  'marketing_trial_status — stored cancelled/converted win; active vs expired is also derived from ends_at at read time.';

ALTER TABLE public.marketing_trials ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies. Anon/authenticated PostgREST cannot read or write
-- trial rows. The Worker uses the service role, which bypasses RLS.
