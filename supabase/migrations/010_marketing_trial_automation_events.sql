-- ============================================================
-- MYLATINOLIST — 010 Marketing trial automation events
-- PROPOSAL ONLY — DO NOT APPLY until reviewed
--
-- Durable per-trial milestone execution log for the
-- 30-Day Marketing Trial Automation engine.
-- Authoritative clock remains marketing_trials.started_at.
--
-- Apply staging (mll-dev) first after approval.
-- Do NOT run against production until a separate approval.
-- This file does not insert any rows.
-- This file does not contain environment business UUIDs.
-- This file does not enable customer auto-enrollment.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_trial_automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  trial_started_at TIMESTAMPTZ NOT NULL,
  milestone TEXT NOT NULL
    CHECK (milestone IN (
      'DAY_0_BASELINE',
      'DAY_1_ANALYSIS',
      'DAY_2_MARKETING_PACK',
      'DAY_7_RECOMMENDATIONS',
      'DAY_14_MID_TRIAL_REPORT',
      'DAY_21_RECOMMENDATIONS',
      'DAY_25_UPGRADE_RECOMMENDATION',
      'DAY_28_ENDING_REMINDER',
      'DAY_30_FINAL_REPORT'
    )),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_trial_automation_events_unique_milestone
    UNIQUE (business_id, trial_started_at, milestone)
);

CREATE INDEX IF NOT EXISTS idx_mkt_trial_auto_events_business
  ON public.marketing_trial_automation_events (business_id);

CREATE INDEX IF NOT EXISTS idx_mkt_trial_auto_events_trial_started
  ON public.marketing_trial_automation_events (trial_started_at);

CREATE INDEX IF NOT EXISTS idx_mkt_trial_auto_events_status
  ON public.marketing_trial_automation_events (status);

CREATE INDEX IF NOT EXISTS idx_mkt_trial_auto_events_scheduled
  ON public.marketing_trial_automation_events (scheduled_for);

COMMENT ON TABLE public.marketing_trial_automation_events IS
  'Idempotent Marketing Trial Automation milestone runs. One row per business/trial_started_at/milestone. Worker/service-role writes only.';
COMMENT ON COLUMN public.marketing_trial_automation_events.trial_started_at IS
  'Copy of marketing_trials.started_at for this trial. Preserves history if a later trial clock is ever introduced.';
COMMENT ON COLUMN public.marketing_trial_automation_events.milestone IS
  'DAY_0_BASELINE … DAY_30_FINAL_REPORT. Server-defined only.';
COMMENT ON COLUMN public.marketing_trial_automation_events.status IS
  'pending | processing | completed | failed | skipped';
COMMENT ON COLUMN public.marketing_trial_automation_events.result IS
  'Deterministic milestone payload. No secrets. V1 uses result_version: 1.';

ALTER TABLE public.marketing_trial_automation_events ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies. Anon/authenticated PostgREST cannot read or write
-- automation rows. The Worker uses the service role, which bypasses RLS.
