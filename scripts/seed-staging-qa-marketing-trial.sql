-- ============================================================
-- STAGING seed — Marketing trial for QA business
-- STAGING / mll-dev ONLY. Do NOT run against production.
-- Requires migration 008_marketing_trials.sql on staging first.
--
-- business_id: f38ce2e6-9dd0-462c-a4fb-fd14a3875648
-- Uses current database time (NOW()) for staging validation.
--
-- Preferred after migration: let activateMarketingTrial() create
-- this row on first authorized summary GET. This seed is a
-- one-shot fallback and will not restart an existing trial.
-- ============================================================

INSERT INTO public.marketing_trials (business_id, started_at, ends_at, status)
VALUES (
  'f38ce2e6-9dd0-462c-a4fb-fd14a3875648',
  NOW(),
  NOW() + INTERVAL '30 days',
  'active'
)
ON CONFLICT (business_id) DO NOTHING;
