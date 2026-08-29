-- ============================================================
-- PRODUCTION DATA FIX — AP Optix LLC referral_code
-- File: scripts/fix-production-admin-referral-code.sql
--
-- Storage: public.businesses.referral_code (UNIQUE)
-- New enrollments already receive a code from workers/src/api/enroll.ts
--   generateReferralCode() — 8 chars from ABCDEFGHJKLMNPQRSTUVWXYZ23456789
-- Seed/admin insert did not set referral_code. There is no Worker
-- endpoint that generates a code for an existing business.
--
-- Prepared value: APOPTIX
-- Compatible with GET /api/referral/:code and enroll referred_by
-- (both compare uppercase). Operator-assigned; not a second generator.
--
-- BEGIN / ROLLBACK by default. Do not COMMIT in this file.
-- Manual COMMIT only after written approval of a reviewed copy.
-- ============================================================

BEGIN;

-- Read-only verification: current AP Optix LLC referral_code
SELECT
  name,
  slug,
  referral_code AS current_referral_code,
  CASE
    WHEN referral_code IS NULL OR btrim(referral_code) = '' THEN 'blank'
    ELSE 'already_set'
  END AS referral_state
FROM public.businesses
WHERE slug = 'ap-optix-llc'
   OR name = 'AP Optix LLC';

DO $$
DECLARE
  n integer;
  current_code text;
  taken integer;
  updated_n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.businesses
  WHERE slug = 'ap-optix-llc'
    AND name = 'AP Optix LLC';

  IF n <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one AP Optix LLC (slug ap-optix-llc), found %', n;
  END IF;

  SELECT referral_code INTO current_code
  FROM public.businesses
  WHERE slug = 'ap-optix-llc'
    AND name = 'AP Optix LLC';

  IF current_code IS NOT NULL AND btrim(current_code) <> '' THEN
    RAISE EXCEPTION 'referral_code is already set (%); aborting', current_code;
  END IF;

  SELECT count(*) INTO taken
  FROM public.businesses
  WHERE referral_code = 'APOPTIX';

  IF taken > 0 THEN
    RAISE EXCEPTION 'APOPTIX is already assigned; aborting';
  END IF;

  UPDATE public.businesses
  SET referral_code = 'APOPTIX'
  WHERE slug = 'ap-optix-llc'
    AND name = 'AP Optix LLC'
    AND (referral_code IS NULL OR btrim(referral_code) = '');

  GET DIAGNOSTICS updated_n = ROW_COUNT;
  IF updated_n <> 1 THEN
    RAISE EXCEPTION 'Expected to update 1 row, updated %', updated_n;
  END IF;
END $$;

-- Verify the value after the guarded update (still inside the transaction)
SELECT
  name,
  slug,
  referral_code
FROM public.businesses
WHERE slug = 'ap-optix-llc'
  AND name = 'AP Optix LLC';

ROLLBACK;
-- COMMIT;  -- replace ROLLBACK with COMMIT only after written approval
