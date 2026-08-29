-- ============================================================
-- PRODUCTION LAUNCH SEED — MLL 2.0
-- File: scripts/seed-production-mll-v2.sql
--
-- DO NOT EXECUTE until reset SQL has been reviewed and the
-- seed STOP GATE is approved.
-- DO NOT run against mll-dev unless intentionally testing the SQL.
--
-- Seeds launch catalog only:
--   - admin profile + AP Optix operator listing
--   - La Voz Latino resources
--   - affiliate program catalog
--   - a small set of official showcase directory listings
--     owned by the admin account, tagged mll-launch-showcase
--
-- Does NOT seed:
--   QA users, @example.test, @demo.mylatinolist.io, qa.*, test.*
--   fake customer Auth accounts
--
-- Requires: production admin Auth user info@apoptix.io already exists
-- (preserved by reset-production-for-mll-v2.sql).
--
-- BEGIN / ROLLBACK by default. Manual COMMIT after review.
-- ============================================================

BEGIN;

DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id
  FROM auth.users
  WHERE lower(email) = 'info@apoptix.io'
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin auth user info@apoptix.io is missing. Recreate Auth first (see docs/PRODUCTION_ADMIN_RECOVERY.md).';
  END IF;

  INSERT INTO public.profiles (id, email, first_name, last_name, language, business_id)
  VALUES (admin_id, 'info@apoptix.io', 'Alex', 'Pena', 'English', NULL)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name;

  INSERT INTO public.businesses (
    owner_id, name, slug, category, phone, website, description,
    city, state, zip, country, emoji, plan, modules, status, is_featured,
    tags
  )
  SELECT
    admin_id,
    'AP Optix LLC',
    'ap-optix-llc',
    'Tech',
    '202-812-1108',
    'https://apoptix.io',
    'Official My Latino List operator listing. Not a customer account.',
    'Silver Spring',
    'Maryland',
    '20906',
    'US',
    '🏢',
    'admin',
    ARRAY['directory', 'marketplace', 'jobs', 'voz', 'affiliate'],
    'active',
    false,
    ARRAY['mll-operator']
  WHERE NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = 'ap-optix-llc');

  UPDATE public.profiles p
  SET business_id = b.id
  FROM public.businesses b
  WHERE p.id = admin_id
    AND b.slug = 'ap-optix-llc'
    AND b.owner_id = admin_id;

  -- Official launch showcases (admin-owned, clearly tagged)
  INSERT INTO public.businesses (
    owner_id, name, slug, category, description, city, state, zip, country,
    emoji, plan, modules, status, is_featured, tags
  )
  SELECT admin_id, v.name, v.slug, v.category, v.description, v.city, v.state, v.zip, 'US',
         v.emoji, 'featured', ARRAY['directory'], 'active', true,
         ARRAY['mll-launch-showcase']
  FROM (VALUES
    ('La Cocina de Maria', 'la-cocina-de-maria', 'Food & Dining',
     'Official MLL 2.0 launch showcase. Authentic family restaurant listing for directory QA — not a customer account.',
     'Miami', 'FL', '33101', '🍽️'),
    ('Ramos Law Group', 'ramos-law-group', 'Legal Services',
     'Official MLL 2.0 launch showcase. Bilingual legal services listing for directory QA — not a customer account.',
     'Houston', 'TX', '77001', '⚖️'),
    ('Casa Flores Salon', 'casa-flores-salon', 'Beauty & Salon',
     'Official MLL 2.0 launch showcase. Salon listing for directory QA — not a customer account.',
     'Los Angeles', 'CA', '90001', '💇')
  ) AS v(name, slug, category, description, city, state, zip, emoji)
  WHERE NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.slug = v.slug);
END $$;

INSERT INTO public.resources (
  title, description, category, icon, bg_color, tag, tag_bg, tag_color,
  is_bilingual, states, status, sort_order
)
SELECT * FROM (VALUES
  ('SBA loan programs', 'SBA loans for Latino-owned businesses. Check eligibility with bilingual support.', 'finance', '💰', '#E1F5EE', 'Finance', '#E1F5EE', '#085041', true, '{}'::text[], 'active', 1),
  ('DACA business resources', 'Guidance for DACA recipients starting or running a business.', 'immigration', '🛂', '#EEEDFE', 'Legal', '#EEEDFE', '#3C3489', true, '{}'::text[], 'active', 2),
  ('Tax credits for small business', 'Bilingual checklist of federal and state tax credits for Latino-owned small businesses.', 'tax', '🧾', '#FAEEDA', 'Tax', '#FAEEDA', '#633806', true, '{}'::text[], 'active', 3),
  ('Business licensing guide', 'State-by-state guide to business licenses and permits in English and Spanish.', 'licensing', '📋', '#E6F1FB', 'Operations', '#E6F1FB', '#0C447C', true, '{}'::text[], 'active', 4),
  ('Minority business grants', 'Curated grants for Latino and minority-owned businesses, updated monthly.', 'grants', '🤝', '#EAF3DE', 'Grants', '#EAF3DE', '#27500A', true, '{}'::text[], 'active', 5),
  ('Free legal aid directory', 'Bilingual lawyers and legal aid orgs offering free or low-cost services.', 'legal', '⚖️', '#FAECE7', 'Legal', '#FAECE7', '#712B13', true, '{}'::text[], 'active', 6)
) AS r(title, description, category, icon, bg_color, tag, tag_bg, tag_color, is_bilingual, states, status, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.resources LIMIT 1);

INSERT INTO public.affiliate_programs (
  name, category, emoji, bg_color, badge_bg, badge_color, description,
  commission_text, commission_rate, commission_type, status, sort_order
)
SELECT * FROM (VALUES
  ('Banco Latino Business', 'Finance partner', '🏦', '#E6F1FB', '#E6F1FB', '#0C447C', 'Small business checking, SBA-preferred lender, bilingual advisors in 12+ cities.', 'Up to $200 per referral', 200.00, 'flat', 'active', 1),
  ('ShipLatino Express', 'Logistics partner', '📦', '#EAF3DE', '#EAF3DE', '#27500A', 'Discounted shipping for Latino-owned sellers across the US, Mexico & Latin America.', '$15 per active shipper', 15.00, 'flat', 'active', 2),
  ('Verizon Business Español', 'Tech partner', '📱', '#FAEEDA', '#FAEEDA', '#633806', 'Business plans with dedicated Spanish-language support and exclusive member discounts.', '$75 per activation', 75.00, 'flat', 'active', 3),
  ('Chubb Business Insurance', 'Insurance partner', '🛡️', '#FAECE7', '#FAECE7', '#712B13', 'Tailored business insurance for Latino SMBs. Bilingual agents, fast claims processing.', '$150 per policy', 150.00, 'flat', 'active', 4),
  ('QuickBooks Latino', 'Software partner', '📊', '#EAF3DE', '#EAF3DE', '#27500A', 'Accounting software with Spanish UI and bilingual onboarding support.', '$40 per subscription', 40.00, 'flat', 'active', 5),
  ('Google Workspace Negocios', 'Tech partner', '🔵', '#E6F1FB', '#E6F1FB', '#0C447C', 'Gmail, Docs & Drive for business. Special pricing for mylatinolist members.', '$25 per workspace', 25.00, 'flat', 'active', 6)
) AS a(name, category, emoji, bg_color, badge_bg, badge_color, description, commission_text, commission_rate, commission_type, status, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_programs LIMIT 1);

SELECT 'seed_profiles' AS entity, count(*) AS n FROM public.profiles
UNION ALL SELECT 'seed_businesses', count(*) FROM public.businesses
UNION ALL SELECT 'seed_resources', count(*) FROM public.resources
UNION ALL SELECT 'seed_affiliates', count(*) FROM public.affiliate_programs
UNION ALL SELECT 'seed_showcase', count(*) FROM public.businesses WHERE 'mll-launch-showcase' = ANY (tags);

ROLLBACK;
-- COMMIT;  -- replace ROLLBACK with COMMIT only after written approval
