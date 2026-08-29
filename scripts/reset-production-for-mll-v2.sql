-- ============================================================
-- PRODUCTION RESET — MLL 2.0 clean application-data reset
-- File: scripts/reset-production-for-mll-v2.sql
--
-- DO NOT EXECUTE until the relaunch STOP GATE is approved.
-- DO NOT run against mll-dev (bjtfrmkhishoadjtpzgg).
-- Target: production project jhjdhmjkcnjtbojocjam only.
--
-- This resets MOCK / PLACEHOLDER application content.
-- It does NOT drop schema, Auth config, RLS policies, or infrastructure.
--
-- PRESERVED:
--   - auth.users + auth.identities for info@apoptix.io (production admin)
--   - all table definitions, constraints, triggers, extensions
--
-- REMOVED (application rows):
--   reviews, leads, orders, subscriptions, job_applications, jobs,
--   products, affiliate_enrollments, businesses, non-admin profiles,
--   resources, affiliate_programs, non-admin auth users/identities
--
-- Admin listing and launch catalog are recreated by:
--   scripts/seed-production-mll-v2.sql
--
-- SAFETY:
--   BEGIN;
--   validation SELECTs first
--   ROLLBACK by default
--   Change ROLLBACK to COMMIT only after manual review
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Target guard (fails the transaction if not production)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF current_database() ILIKE '%bjtfrmkhishoadjtpzgg%' THEN
    RAISE EXCEPTION 'REFUSED: this reset must not run on mll-dev';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. Validation SELECTs (review counts before any DELETE)
-- ------------------------------------------------------------
SELECT 'auth.users' AS entity, count(*) AS n FROM auth.users
UNION ALL SELECT 'auth.identities', count(*) FROM auth.identities
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'businesses', count(*) FROM public.businesses
UNION ALL SELECT 'products', count(*) FROM public.products
UNION ALL SELECT 'jobs', count(*) FROM public.jobs
UNION ALL SELECT 'reviews', count(*) FROM public.reviews
UNION ALL SELECT 'leads', count(*) FROM public.leads
UNION ALL SELECT 'orders', count(*) FROM public.orders
UNION ALL SELECT 'subscriptions', count(*) FROM public.subscriptions
UNION ALL SELECT 'job_applications', count(*) FROM public.job_applications
UNION ALL SELECT 'affiliate_enrollments', count(*) FROM public.affiliate_enrollments
UNION ALL SELECT 'affiliate_programs', count(*) FROM public.affiliate_programs
UNION ALL SELECT 'resources', count(*) FROM public.resources;

SELECT 'admin_users_preserved' AS check_name, id, email
FROM auth.users
WHERE lower(email) = 'info@apoptix.io';

SELECT 'non_admin_users_to_remove' AS check_name, count(*) AS n
FROM auth.users
WHERE lower(coalesce(email, '')) IS DISTINCT FROM 'info@apoptix.io';

-- ------------------------------------------------------------
-- 2. Child application tables
-- ------------------------------------------------------------
DELETE FROM public.reviews;
DELETE FROM public.leads;
DELETE FROM public.orders;
DELETE FROM public.subscriptions;
DELETE FROM public.job_applications;
DELETE FROM public.jobs;
DELETE FROM public.products;
DELETE FROM public.affiliate_enrollments;

-- ------------------------------------------------------------
-- 3. Businesses (including seed/showcase listings)
-- Admin listing is recreated by the launch seed.
-- ------------------------------------------------------------
DELETE FROM public.businesses;

-- ------------------------------------------------------------
-- 4. Reference catalog (reseeded next)
-- ------------------------------------------------------------
DELETE FROM public.resources;
DELETE FROM public.affiliate_programs;

-- ------------------------------------------------------------
-- 5. Non-admin profiles
-- Keep the admin profile row so login still has a public.profiles record.
-- ------------------------------------------------------------
DELETE FROM public.profiles
WHERE id NOT IN (
  SELECT id FROM auth.users WHERE lower(email) = 'info@apoptix.io'
);

-- ------------------------------------------------------------
-- 6. Non-admin Auth identities, then users
-- Only after public.profiles / businesses FKs are gone.
-- Do not delete info@apoptix.io.
-- Direct auth.users deletes can desync GoTrue; review counts first.
-- Prefer Dashboard Auth delete for leftovers if this step errors.
-- ------------------------------------------------------------
DELETE FROM auth.identities
WHERE user_id NOT IN (
  SELECT id FROM auth.users WHERE lower(email) = 'info@apoptix.io'
);

DELETE FROM auth.users
WHERE lower(coalesce(email, '')) IS DISTINCT FROM 'info@apoptix.io';

-- ------------------------------------------------------------
-- 7. Post-delete validation
-- ------------------------------------------------------------
SELECT 'remaining_auth_users' AS entity, count(*) AS n FROM auth.users
UNION ALL SELECT 'remaining_identities', count(*) FROM auth.identities
UNION ALL SELECT 'remaining_profiles', count(*) FROM public.profiles
UNION ALL SELECT 'remaining_businesses', count(*) FROM public.businesses
UNION ALL SELECT 'remaining_jobs', count(*) FROM public.jobs
UNION ALL SELECT 'remaining_products', count(*) FROM public.products;

SELECT 'admin_still_present' AS check_name, id, email
FROM auth.users
WHERE lower(email) = 'info@apoptix.io';

ROLLBACK;
-- COMMIT;  -- replace ROLLBACK with COMMIT only after written approval
