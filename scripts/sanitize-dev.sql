-- ============================================================
-- MYLATINOLIST — sanitize production-derived data in mll-dev
-- Run ONLY on mll-dev (bjtfrmkhishoadjtpzgg) AFTER a clone restore.
-- Do NOT run against production (jhjdhmjkcnjtbojocjam).
--
-- Preserves:
--   primary keys, foreign keys, owner_id, auth user UUIDs,
--   schema, RLS, policies, business names/slugs/categories,
--   city/state (directory geography for QA)
--
-- Does NOT:
--   delete auth.users
--   UPDATE auth.users (use scripts/sanitize-dev-auth.mjs)
--   weaken RLS
--   print original PII
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.businesses') IS NULL THEN
    RAISE EXCEPTION 'Required tables missing. Aborting sanitize.';
  END IF;
  RAISE NOTICE 'sanitize-dev.sql: rewriting sensitive columns. Original values are not logged.';
END $$;

CREATE OR REPLACE FUNCTION public.mll_dev_short_id(u uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT left(replace(u::text, '-', ''), 8);
$$;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
UPDATE public.profiles
SET
  email = 'dev+' || public.mll_dev_short_id(id) || '@example.test',
  first_name = 'Test',
  last_name = 'User',
  avatar_url = NULL;

-- ------------------------------------------------------------
-- businesses (keep name/slug/category/city/state for directory QA)
-- ------------------------------------------------------------
UPDATE public.businesses
SET
  phone = '555-010-' || lpad((abs(hashtext(id::text)) % 10000)::text, 4, '0'),
  email = 'dev+biz-' || public.mll_dev_short_id(id) || '@example.test',
  website = 'https://example.test/biz/' || slug,
  stripe_customer_id = NULL,
  social_links = '{}'::jsonb,
  address = CASE
    WHEN address IS NULL OR btrim(address) = '' THEN address
    ELSE '100 Test Ave'
  END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'logo_url'
  ) THEN
    UPDATE public.businesses
    SET logo_url = NULL
    WHERE logo_url ILIKE '%media.mylatinolist.io%'
       OR logo_url ILIKE '%supabase.co/storage%';
  END IF;
END $$;

-- ------------------------------------------------------------
-- reviews
-- ------------------------------------------------------------
UPDATE public.reviews
SET
  reviewer_name = 'Test Reviewer',
  reviewer_email = CASE
    WHEN reviewer_email IS NULL THEN NULL
    ELSE 'dev+review-' || public.mll_dev_short_id(id) || '@example.test'
  END,
  body = CASE
    WHEN body IS NULL OR btrim(body) = '' THEN body
    ELSE 'Test review comment.'
  END;

-- ------------------------------------------------------------
-- leads
-- ------------------------------------------------------------
UPDATE public.leads
SET
  name = 'Test Lead',
  email = CASE
    WHEN email IS NULL THEN NULL
    ELSE 'dev+lead-' || public.mll_dev_short_id(id) || '@example.test'
  END,
  phone = CASE
    WHEN phone IS NULL OR btrim(phone) = '' THEN phone
    ELSE '555-011-' || lpad((abs(hashtext(id::text)) % 10000)::text, 4, '0')
  END,
  message = CASE
    WHEN message IS NULL OR btrim(message) = '' THEN message
    ELSE 'Test inquiry message.'
  END;

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
UPDATE public.orders
SET
  buyer_name = 'Test Buyer',
  buyer_email = 'dev+buyer-' || public.mll_dev_short_id(id) || '@example.test',
  shipping_address = CASE
    WHEN shipping_address IS NULL THEN NULL
    ELSE jsonb_build_object(
      'line1', '100 Test Ave',
      'city', 'Test City',
      'state', 'MD',
      'postal_code', '00000',
      'country', 'US'
    )
  END,
  stripe_payment_id = NULL,
  notes = CASE
    WHEN notes IS NULL OR btrim(notes) = '' THEN notes
    ELSE 'Test order notes.'
  END;

-- ------------------------------------------------------------
-- job_applications
-- ------------------------------------------------------------
UPDATE public.job_applications
SET
  applicant_name = 'Test Applicant',
  applicant_email = 'dev+apply-' || public.mll_dev_short_id(id) || '@example.test',
  applicant_phone = CASE
    WHEN applicant_phone IS NULL OR btrim(applicant_phone) = '' THEN applicant_phone
    ELSE '555-012-' || lpad((abs(hashtext(id::text)) % 10000)::text, 4, '0')
  END,
  resume_url = NULL,
  cover_letter = CASE
    WHEN cover_letter IS NULL OR btrim(cover_letter) = '' THEN cover_letter
    ELSE 'Test cover letter.'
  END;

-- ------------------------------------------------------------
-- subscriptions / Stripe isolation
-- ------------------------------------------------------------
UPDATE public.subscriptions
SET
  stripe_subscription_id = NULL,
  stripe_customer_id = NULL;

-- ------------------------------------------------------------
-- products: drop hosted media URLs that point at production
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'images'
  ) THEN
    UPDATE public.products
    SET images = ARRAY[]::text[]
    WHERE images IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(images) AS img
        WHERE img ILIKE '%media.mylatinolist.io%'
           OR img ILIKE '%supabase.co/storage%'
      );
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.mll_dev_short_id(uuid);

DO $$
BEGIN
  RAISE NOTICE 'sanitize-dev.sql complete. Next: node scripts/sanitize-dev-auth.mjs then scripts/validate-clone.sql';
END $$;
