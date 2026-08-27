-- ============================================================
-- MYLATINOLIST 2.0 — DEV DATABASE VALIDATION
-- Read-only. Run in the mll-dev SQL editor.
-- Do NOT run against production.
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

-- 2) businesses.owner_id remains NOT NULL + FK to auth.users
SELECT
  'owner_id_not_null' AS check_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
  AND column_name = 'owner_id';

SELECT
  'owner_id_fk' AS check_name,
  tc.constraint_name,
  ccu.table_schema AS foreign_schema,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'businesses'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'owner_id';

-- 3) Expected indexes
SELECT 'indexes' AS check_name, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_businesses_status',
    'idx_businesses_category',
    'idx_businesses_city',
    'idx_businesses_owner',
    'idx_businesses_slug',
    'idx_businesses_featured',
    'idx_businesses_name_trgm',
    'idx_products_business',
    'idx_products_status',
    'idx_products_category',
    'idx_jobs_business',
    'idx_jobs_status_posted',
    'idx_leads_business',
    'idx_leads_created',
    'idx_orders_business',
    'idx_orders_status',
    'idx_aff_enrollments_biz',
    'idx_businesses_expires_at',
    'idx_reviews_business',
    'idx_resources_category',
    'idx_affiliate_programs_status'
  )
ORDER BY indexname;

-- 4) RLS enabled on public tables
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

-- 5) Key RLS policies
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

-- 6) Worker-required columns
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

-- 7) Seeded data counts
SELECT 'count_businesses' AS check_name, count(*) AS n FROM businesses WHERE status = 'active';
SELECT 'count_products' AS check_name, count(*) AS n FROM products WHERE status = 'active';
SELECT 'count_jobs' AS check_name, count(*) AS n FROM jobs WHERE status = 'active';
SELECT 'count_resources' AS check_name, count(*) AS n FROM resources WHERE status = 'active';
SELECT 'count_affiliate_programs' AS check_name, count(*) AS n FROM affiliate_programs WHERE status = 'active';
SELECT 'count_reviews' AS check_name, count(*) AS n FROM reviews WHERE status = 'published';
SELECT 'count_leads' AS check_name, count(*) AS n FROM leads;
SELECT 'count_demo_owners' AS check_name, count(*) AS n
FROM auth.users
WHERE email LIKE '%@demo.mylatinolist.io';

-- 8) Every business still has an owner
SELECT 'businesses_missing_owner' AS check_name, count(*) AS n
FROM businesses b
LEFT JOIN auth.users u ON u.id = b.owner_id
WHERE u.id IS NULL;

-- 9) Plan / status constraints still present
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
