-- ============================================================
-- PRODUCTION seed — Marketing trial for Test Business
-- DO NOT RUN until separately approved after staging QA.
-- Requires migration 008_marketing_trials.sql to be applied first.
--
-- business_id: 7e735f46-9dc1-4ecf-936b-7342e566978a
-- Trial start: 2026-09-08 (activation date, not listing created_at)
-- Trial end:   2026-10-08 (started_at + 30 days)
--
-- ON CONFLICT DO NOTHING — will not restart an existing trial.
-- ============================================================

INSERT INTO public.marketing_trials (business_id, started_at, ends_at, status)
VALUES (
  '7e735f46-9dc1-4ecf-936b-7342e566978a',
  TIMESTAMPTZ '2026-09-08 00:00:00+00',
  TIMESTAMPTZ '2026-09-08 00:00:00+00' + INTERVAL '30 days',
  'active'
)
ON CONFLICT (business_id) DO NOTHING;
