-- ============================================================
-- MYLATINOLIST — 004 Worker schema alignment
-- DEV / STAGING (mll-dev) ONLY
--
-- The Worker already reads/writes these columns. They were not
-- in 001–003. Apply this to mll-dev before seeding or enrollment.
-- Do NOT run against production.
-- ============================================================

-- Free-plan listing expiry (enroll.ts, cron.ts, auth.ts)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS expired_notified_75 BOOLEAN DEFAULT FALSE;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS expired_notified_82 BOOLEAN DEFAULT FALSE;

-- cron.ts sets status = 'expired' for lapsed free listings
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_status_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_status_check
  CHECK (status IN ('active', 'pending', 'suspended', 'inactive', 'expired'));

-- Align subscriptions with the expanded plan set from 002
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'basic', 'pro', 'featured', 'agency', 'admin'));

CREATE INDEX IF NOT EXISTS idx_businesses_expires_at
  ON businesses (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews (business_id);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources (category);
CREATE INDEX IF NOT EXISTS idx_affiliate_programs_status ON affiliate_programs (status);
