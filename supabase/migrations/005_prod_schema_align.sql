-- ============================================================
-- MYLATINOLIST — 005 Production schema alignment
-- DEV / STAGING ONLY
--
-- Align mll-dev public schema with production so production
-- data-only dumps can restore cleanly into staging.
-- ============================================================

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;