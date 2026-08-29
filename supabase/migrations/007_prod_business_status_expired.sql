-- ============================================================
-- MYLATINOLIST — 007 Production business status alignment
-- PRODUCTION-SAFE (also valid on mll-dev)
--
-- cron.ts sets businesses.status = 'expired' for lapsed free listings.
-- Production CHECK currently allows only:
--   active, pending, suspended, inactive
--
-- This migration does NOT change rows. It only widens the CHECK.
-- Do NOT run until the relaunch STOP GATE for migrations is approved.
-- ============================================================

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_status_check;

ALTER TABLE public.businesses ADD CONSTRAINT businesses_status_check
  CHECK (status IN ('active', 'pending', 'inactive', 'expired', 'suspended'));
