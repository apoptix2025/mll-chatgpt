-- ============================================================
-- MYLATINOLIST — read-only clone validation
-- Run in the mll-dev SQL editor AFTER sanitize.
-- Do NOT run against production.
-- Does not modify data.
-- ============================================================

-- 1) Required tables exist
SELECT 'tables' AS check_name, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles','businesses','reviews','leads','products','orders','jobs',
    'job_applications','affiliate_programs','affiliate_enrollments',
    'resources','subscriptions'
  )
ORDER BY table_name;

-- 2) Row counts
SELECT 'count_auth_users' AS check_name, count(*)::bigint AS n FROM auth.users;
SELECT 'count_profiles' AS check_name, count(*)::bigint AS n FROM public.profiles;
SELECT 'count_businesses' AS check_name, count(*)::bigint AS n FROM public.businesses;
SELECT 'count_products' AS check_name, count(*)::bigint AS n FROM public.products;
SELECT 'count_jobs' AS check_name, count(*)::bigint AS n FROM public.jobs;
SELECT 'count_reviews' AS check_name, count(*)::bigint AS n FROM public.reviews;
SELECT 'count_leads' AS check_name, count(*)::bigint AS n FROM public.leads;
SELECT 'count_subscriptions' AS check_name, count(*)::bigint AS n FROM public.subscriptions;
SELECT 'count_orders' AS check_name, count(*)::bigint AS n FROM public.orders;
SELECT 'count_job_applications' AS check_name, count(*)::bigint AS n FROM public.job_applications;
SELECT 'count_resources' AS check_name, count(*)::bigint AS n FROM public.resources;
SELECT 'count_affiliate_programs' AS check_name, count(*)::bigint AS n FROM public.affiliate_programs;

-- 3) Orphans / ownership
SELECT 'orphaned_profiles' AS check_name, count(*)::bigint AS n
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.id IS NULL;

SELECT 'businesses_without_owners' AS check_name, count(*)::bigint AS n
FROM public.businesses b
LEFT JOIN auth.users u ON u.id = b.owner_id
WHERE u.id IS NULL;

SELECT 'orphaned_products' AS check_name, count(*)::bigint AS n
FROM public.products p
LEFT JOIN public.businesses b ON b.id = p.business_id
WHERE b.id IS NULL;

SELECT 'orphaned_jobs' AS check_name, count(*)::bigint AS n
FROM public.jobs j
LEFT JOIN public.businesses b ON b.id = j.business_id
WHERE b.id IS NULL;

SELECT 'orphaned_reviews' AS check_name, count(*)::bigint AS n
FROM public.reviews r
LEFT JOIN public.businesses b ON b.id = r.business_id
WHERE b.id IS NULL;

SELECT 'orphaned_subscriptions' AS check_name, count(*)::bigint AS n
FROM public.subscriptions s
LEFT JOIN public.businesses b ON b.id = s.business_id
WHERE b.id IS NULL;

SELECT 'orphaned_leads' AS check_name, count(*)::bigint AS n
FROM public.leads l
LEFT JOIN public.businesses b ON b.id = l.business_id
WHERE b.id IS NULL;

SELECT 'profiles_missing_matching_email_shape' AS check_name, count(*)::bigint AS n
FROM public.profiles
WHERE email IS NULL OR email NOT LIKE '%@example.test';

-- 4) Stripe IDs must be cleared in staging data
SELECT 'businesses_with_stripe_customer' AS check_name, count(*)::bigint AS n
FROM public.businesses
WHERE stripe_customer_id IS NOT NULL AND btrim(stripe_customer_id) <> '';

SELECT 'subscriptions_with_stripe_ids' AS check_name, count(*)::bigint AS n
FROM public.subscriptions
WHERE (stripe_subscription_id IS NOT NULL AND btrim(stripe_subscription_id) <> '')
   OR (stripe_customer_id IS NOT NULL AND btrim(stripe_customer_id) <> '');

SELECT 'orders_with_stripe_payment' AS check_name, count(*)::bigint AS n
FROM public.orders
WHERE stripe_payment_id IS NOT NULL AND btrim(stripe_payment_id) <> '';

-- 5) Residual real-looking emails in public tables (expect 0 after sanitize)
SELECT 'residual_profile_emails' AS check_name, count(*)::bigint AS n
FROM public.profiles
WHERE email !~* '@(example\.test|demo\.mylatinolist\.io)$';

SELECT 'residual_business_emails' AS check_name, count(*)::bigint AS n
FROM public.businesses
WHERE email IS NOT NULL AND email !~* '@(example\.test|demo\.mylatinolist\.io)$';

SELECT 'residual_lead_emails' AS check_name, count(*)::bigint AS n
FROM public.leads
WHERE email IS NOT NULL AND email !~* '@example\.test$';

SELECT 'residual_review_emails' AS check_name, count(*)::bigint AS n
FROM public.reviews
WHERE reviewer_email IS NOT NULL AND reviewer_email !~* '@example\.test$';

SELECT 'residual_auth_emails' AS check_name, count(*)::bigint AS n
FROM auth.users
WHERE email IS NULL OR email !~* '@(example\.test|demo\.mylatinolist\.io)$';

-- 6) RLS enabled
SELECT
  'rls_enabled' AS check_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'profiles','businesses','reviews','leads','products','orders','jobs',
    'job_applications','affiliate_programs','affiliate_enrollments',
    'resources','subscriptions'
  )
ORDER BY c.relname;

-- 7) Expected policies
SELECT
  'rls_policies' AS check_name,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'profiles_select_own',
    'businesses_public_read',
    'businesses_owner_all',
    'reviews_public_read',
    'reviews_auth_insert',
    'leads_owner_read',
    'leads_public_insert',
    'products_public_read',
    'products_owner_all',
    'jobs_public_read',
    'jobs_owner_all',
    'affiliate_programs_public_read',
    'resources_public_read',
    'subscriptions_owner_read'
  )
ORDER BY tablename, policyname;

-- 8) Worker-required columns
SELECT
  'worker_columns' AS check_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
  AND column_name IN (
    'owner_id','slug','plan','status','logo_url','referral_code','referred_by',
    'referral_credits','notified_day3','notified_day7','notified_day14',
    'notified_day30','expires_at','expired_notified_75','expired_notified_82',
    'stripe_customer_id','modules'
  )
ORDER BY column_name;

-- 9) Plan / status constraints
SELECT
  'plan_check' AS check_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.businesses'::regclass
  AND conname = 'businesses_plan_check';

SELECT
  'status_check' AS check_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.businesses'::regclass
  AND conname = 'businesses_status_check';

SELECT
  'subscriptions_plan_check' AS check_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.subscriptions'::regclass
  AND conname = 'subscriptions_plan_check';

-- 10) owner_id still NOT NULL + FK to auth.users
SELECT
  'owner_id_not_null' AS check_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
  AND column_name = 'owner_id';
