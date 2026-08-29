-- ============================================================
-- MY LATINO LIST — production inventory (READ ONLY)
-- ============================================================
-- Run against production Postgres only (project ref jhjdhmjkcnjtbojocjam).
-- Do NOT run against mll-dev (bjtfrmkhishoadjtpzgg).
--
-- This file contains SELECT / catalog reads only.
-- No INSERT, UPDATE, DELETE, TRUNCATE, DDL, or migrations.
-- ============================================================

\echo '=== table existence ==='
SELECT c.relname AS table_name,
       CASE WHEN c.oid IS NULL THEN 'MISSING' ELSE 'present' END AS status
FROM (VALUES
  ('profiles'),
  ('businesses'),
  ('products'),
  ('jobs'),
  ('reviews'),
  ('leads'),
  ('orders'),
  ('subscriptions'),
  ('resources'),
  ('affiliate_programs'),
  ('job_applications'),
  ('affiliate_enrollments')
) AS t(relname)
LEFT JOIN pg_class c
  ON c.relname = t.relname
 AND c.relnamespace = 'public'::regnamespace
 AND c.relkind = 'r'
ORDER BY t.relname;

\echo '=== auth counts ==='
SELECT
  (SELECT count(*) FROM auth.users) AS auth_users,
  (SELECT count(*) FROM auth.identities) AS auth_identities;

\echo '=== public table counts ==='
-- Skip any statement whose table was MISSING in the existence query above.
SELECT 'profiles' AS table_name, count(*)::bigint AS n FROM public.profiles
UNION ALL SELECT 'businesses', count(*) FROM public.businesses
UNION ALL SELECT 'products', count(*) FROM public.products
UNION ALL SELECT 'jobs', count(*) FROM public.jobs
UNION ALL SELECT 'reviews', count(*) FROM public.reviews
UNION ALL SELECT 'leads', count(*) FROM public.leads
UNION ALL SELECT 'orders', count(*) FROM public.orders
UNION ALL SELECT 'subscriptions', count(*) FROM public.subscriptions
UNION ALL SELECT 'resources', count(*) FROM public.resources
UNION ALL SELECT 'affiliate_programs', count(*) FROM public.affiliate_programs
UNION ALL SELECT 'job_applications', count(*) FROM public.job_applications
UNION ALL SELECT 'affiliate_enrollments', count(*) FROM public.affiliate_enrollments;

\echo '=== businesses by status ==='
SELECT status, count(*) AS n
FROM public.businesses
GROUP BY status
ORDER BY status;

\echo '=== businesses by plan ==='
SELECT plan, count(*) AS n
FROM public.businesses
GROUP BY plan
ORDER BY plan;

\echo '=== likely test/demo/mock counts (no emails printed) ==='
SELECT
  count(*) FILTER (
    WHERE email ILIKE 'seed@%'
       OR email ILIKE '%@example.test'
       OR email ILIKE '%@demo.mylatinolist.io'
  ) AS users_seed_or_demo_email
FROM auth.users;

SELECT
  count(*) FILTER (
    WHERE coalesce(name, '') ~* '(test|demo|\\bqa\\b|seed)'
       OR coalesce(slug, '') ~* '(test|demo|qa|seed)'
       OR coalesce(email, '') ILIKE 'seed@%'
       OR coalesce(email, '') ILIKE '%@example.test'
       OR coalesce(email, '') ILIKE '%@demo.mylatinolist.io'
       OR coalesce(email, '') ILIKE '%qa.owner@%'
  ) AS businesses_mock_pattern,
  count(*) FILTER (
    WHERE owner_id = '00000000-0000-0000-0000-000000000001'
  ) AS businesses_seed_owner
FROM public.businesses;

SELECT
  count(*) FILTER (
    WHERE email ILIKE 'seed@%'
       OR email ILIKE '%@example.test'
       OR email ILIKE '%@demo.mylatinolist.io'
  ) AS profiles_seed_or_demo_email
FROM public.profiles;

\echo '=== Stripe ID presence (counts only) ==='
SELECT
  count(*) FILTER (WHERE stripe_customer_id IS NOT NULL) AS businesses_stripe_customer_id,
  count(*) FILTER (WHERE stripe_subscription_id IS NOT NULL) AS businesses_stripe_subscription_id
FROM public.businesses;

SELECT
  count(*) FILTER (
    WHERE stripe_subscription_id IS NOT NULL OR stripe_customer_id IS NOT NULL
  ) AS subscriptions_with_stripe_ids
FROM public.subscriptions;

SELECT
  count(*) FILTER (WHERE stripe_payment_id IS NOT NULL) AS orders_with_stripe_payment_id
FROM public.orders;
