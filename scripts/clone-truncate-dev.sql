-- ============================================================
-- MYLATINOLIST — truncate mll-dev before a production-data restore
-- Destination: mll-dev (bjtfrmkhishoadjtpzgg) ONLY
--
-- Called by scripts/clone-prod-to-dev.ps1 after confirmation.
-- Do NOT run this against production (jhjdhmjkcnjtbojocjam).
-- Does not drop schema, RLS, or policies.
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'clone-truncate-dev.sql: clearing public + auth.users on THIS database only.';
END $$;

TRUNCATE TABLE
  public.job_applications,
  public.orders,
  public.leads,
  public.reviews,
  public.products,
  public.jobs,
  public.affiliate_enrollments,
  public.subscriptions,
  public.resources,
  public.affiliate_programs,
  public.businesses,
  public.profiles
RESTART IDENTITY CASCADE;

-- Keep GoTrue schema; drop users/sessions so production UUIDs can be restored.
-- CASCADE clears identities, refresh tokens, and sessions. Staging users must sign in again.
TRUNCATE TABLE auth.users CASCADE;
