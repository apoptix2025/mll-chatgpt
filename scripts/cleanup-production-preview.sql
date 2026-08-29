-- ============================================================
-- PREVIEW ONLY — DO NOT EXECUTE ON PRODUCTION
-- ============================================================
-- File: scripts/cleanup-production-preview.sql
--
-- THIS SCRIPT IS A REVIEW ARTIFACT.
-- It must not be run as part of cutover until explicitly approved.
--
-- Classification (see docs/PRODUCTION_DATA_INVENTORY.md):
--   KEEP            — 11 owner-linked businesses; 11 non-seed users
--   ARCHIVE         — none (all businesses are active)
--   DELETE_CANDIDATE — seed auth user / seed profile only
--   NEEDS_REVIEW    — 21 businesses owned by the seed UUID
--
-- SAFETY:
-- - No cascading deletes.
-- - SELECT previews first.
-- - Wrapped in a transaction that ROLLBACKs by default.
-- - Change ROLLBACK to COMMIT only after a manual, reviewed edit.
-- - Never target mll-dev (bjtfrmkhishoadjtpzgg).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- KEEP (preview only — do not delete)
-- Owner-linked businesses (not the seed UUID)
-- ------------------------------------------------------------
SELECT 'KEEP_BUSINESSES' AS bucket, count(*) AS n
FROM public.businesses
WHERE owner_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001';

SELECT 'KEEP_USERS' AS bucket, count(*) AS n
FROM auth.users
WHERE email IS DISTINCT FROM 'seed@mylatinolist.io'
  AND id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001';

-- ------------------------------------------------------------
-- ARCHIVE candidates (preview)
-- None expected: production dump had status=active for all 32.
-- ------------------------------------------------------------
SELECT 'ARCHIVE_INACTIVE_BUSINESSES' AS bucket, count(*) AS n
FROM public.businesses
WHERE status IN ('inactive', 'pending', 'suspended', 'expired');

-- ------------------------------------------------------------
-- NEEDS_REVIEW (preview only — do not delete)
-- Seed-owned listings. Treat as KEEP until reassignment is approved.
-- ------------------------------------------------------------
SELECT 'NEEDS_REVIEW_SEED_OWNED_BUSINESSES' AS bucket, count(*) AS n
FROM public.businesses
WHERE owner_id = '00000000-0000-0000-0000-000000000001';

SELECT 'NEEDS_REVIEW_DEPENDENT_JOBS' AS bucket, count(*) AS n
FROM public.jobs j
JOIN public.businesses b ON b.id = j.business_id
WHERE b.owner_id = '00000000-0000-0000-0000-000000000001';

SELECT 'NEEDS_REVIEW_DEPENDENT_PRODUCTS' AS bucket, count(*) AS n
FROM public.products p
JOIN public.businesses b ON b.id = p.business_id
WHERE b.owner_id = '00000000-0000-0000-0000-000000000001';

-- ------------------------------------------------------------
-- DELETE_CANDIDATE (preview only)
-- Seed identity only. Do NOT delete businesses here.
-- Do NOT run the DELETE below unless KEEP/NEEDS_REVIEW is resolved.
-- ------------------------------------------------------------
SELECT 'DELETE_CANDIDATE_SEED_USERS' AS bucket, count(*) AS n
FROM auth.users
WHERE id = '00000000-0000-0000-0000-000000000001'
   OR email ILIKE 'seed@%';

SELECT 'DELETE_CANDIDATE_SEED_PROFILES' AS bucket, count(*) AS n
FROM public.profiles
WHERE id = '00000000-0000-0000-0000-000000000001'
   OR email ILIKE 'seed@%';

-- Intentionally omitted:
-- DELETE FROM public.businesses ...
-- DELETE FROM auth.users ...
-- Those statements are not included because the 21 seed-owned
-- listings are NEEDS_REVIEW, not approved deletes.

-- Example guarded delete (still rolled back). Leave commented.
-- DELETE FROM public.profiles
-- WHERE id = '00000000-0000-0000-0000-000000000001'
--   AND NOT EXISTS (
--     SELECT 1 FROM public.businesses
--     WHERE owner_id = '00000000-0000-0000-0000-000000000001'
--   );

ROLLBACK;
-- COMMIT;  -- replace ROLLBACK with COMMIT only after manual approval
