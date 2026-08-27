-- ============================================================
-- MYLATINOLIST 2.0 — DEVELOPMENT SEED (mll-dev ONLY)
--
-- SAFE TO RE-RUN (idempotent where practical).
-- Does NOT create auth.users. Supabase Auth owns that table.
--
-- Prerequisite:
--   1. Apply migrations 001–004 to mll-dev.
--   2. Create demo owners first, either:
--        node supabase/seed/seed-dev.mjs
--      or Dashboard → Authentication → Add user (emails below).
--
-- Demo owner emails (fictional — not real people):
--   maria.soto@demo.mylatinolist.io
--   diego.mendez@demo.mylatinolist.io
--   lucia.flores@demo.mylatinolist.io
--   andres.vega@demo.mylatinolist.io
--   sofia.herrera@demo.mylatinolist.io
--   miguel.ortega@demo.mylatinolist.io
--   ana.vargas@demo.mylatinolist.io
--   carmen.reyes@demo.mylatinolist.io
--
-- Do NOT run against production.
-- ============================================================

DO $$
DECLARE
  missing text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'anon' THEN
    RAISE EXCEPTION 'Refusing to seed as anon. Use the SQL editor (postgres/service role) on mll-dev.';
  END IF;

  SELECT string_agg(e, ', ' ORDER BY e) INTO missing
  FROM (VALUES
    ('maria.soto@demo.mylatinolist.io'),
    ('diego.mendez@demo.mylatinolist.io'),
    ('lucia.flores@demo.mylatinolist.io'),
    ('andres.vega@demo.mylatinolist.io'),
    ('sofia.herrera@demo.mylatinolist.io'),
    ('miguel.ortega@demo.mylatinolist.io'),
    ('ana.vargas@demo.mylatinolist.io'),
    ('carmen.reyes@demo.mylatinolist.io')
  ) AS t(e)
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = t.e
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'Demo auth users are missing (%). Create them with: node supabase/seed/seed-dev.mjs',
      missing;
  END IF;
END $$;

-- ── PROFILES ────────────────────────────────────────────────
INSERT INTO profiles (id, email, first_name, last_name, language)
SELECT u.id, u.email, v.first_name, v.last_name, 'English'
FROM (VALUES
  ('maria.soto@demo.mylatinolist.io',   'Maria',  'Soto'),
  ('diego.mendez@demo.mylatinolist.io', 'Diego',  'Mendez'),
  ('lucia.flores@demo.mylatinolist.io', 'Lucia',  'Flores'),
  ('andres.vega@demo.mylatinolist.io',  'Andres', 'Vega'),
  ('sofia.herrera@demo.mylatinolist.io','Sofia',  'Herrera'),
  ('miguel.ortega@demo.mylatinolist.io','Miguel', 'Ortega'),
  ('ana.vargas@demo.mylatinolist.io',   'Ana',    'Vargas'),
  ('carmen.reyes@demo.mylatinolist.io', 'Carmen', 'Reyes')
) AS v(email, first_name, last_name)
JOIN auth.users u ON lower(u.email) = v.email
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      updated_at = NOW();

-- ── BUSINESSES ──────────────────────────────────────────────
INSERT INTO businesses (
  owner_id, name, slug, category, phone, email, website, description,
  address, city, state, zip, emoji, bg_color, tags, plan, modules,
  is_featured, rating, review_count, profile_completion, status,
  referral_code, expires_at
)
SELECT
  u.id, v.name, v.slug, v.category, v.phone, v.email, v.website, v.description,
  v.address, v.city, v.state, v.zip, v.emoji, v.bg_color, v.tags, v.plan, v.modules,
  v.is_featured, 0.0, 0, v.profile_completion, 'active',
  v.referral_code, NOW() + INTERVAL '90 days'
FROM (VALUES
  ('maria.soto@demo.mylatinolist.io',
   'La Cocina de Maryland', 'la-cocina-de-maryland', 'Food & Dining',
   '(301) 555-0142', 'hola@lacocinamd.demo', 'https://lacocinamd.demo',
   'Family-owned Salvadoran and Mexican kitchen in Silver Spring. Pupusas, tamales, weekend brunch, and catering for quinceañeras.',
   '8600 Colesville Rd', 'Silver Spring', 'MD', '20910',
   '🍽️', '#EBF2FF', ARRAY['Pupusas','Catering','Bilingual']::text[],
   'featured', ARRAY['directory','marketplace']::text[], true, 94, 'COCINA8M'),
  ('diego.mendez@demo.mylatinolist.io',
   'Mendez Remodeling Co.', 'mendez-remodeling-co', 'Construction',
   '(703) 555-0198', 'hello@mendezremodel.demo', 'https://mendezremodel.demo',
   'Licensed Arlington contractor for kitchens, baths, additions, and bilingual project management across Northern Virginia.',
   '1200 N Glebe Rd', 'Arlington', 'VA', '22201',
   '🏗️', '#FAEEDA', ARRAY['Licensed','Kitchens','Bilingual']::text[],
   'pro', ARRAY['directory','jobs']::text[], true, 88, 'MENDEZ7R'),
  ('lucia.flores@demo.mylatinolist.io',
   'Flores Beauty Studio', 'flores-beauty-studio', 'Beauty & Salon',
   '(202) 555-0177', 'hola@floresbeauty.demo', 'https://floresbeauty.demo',
   'Columbia Heights salon specializing in color, keratin, and quinceañera styling. Walk-ins welcome, Spanish spoken.',
   '3200 14th St NW', 'Washington', 'DC', '20010',
   '💇', '#EEEDFE', ARRAY['Color','Quinceañera','Keratin']::text[],
   'pro', ARRAY['directory','marketplace']::text[], true, 90, 'FLORES6B'),
  ('andres.vega@demo.mylatinolist.io',
   'Vega Immigration Law', 'vega-immigration-law', 'Legal Services',
   '(240) 555-0133', 'info@legalvega.demo', 'https://legalvega.demo',
   'Bethesda immigration, family, and small-business law. Free consults. Fully bilingual attorneys and paralegals.',
   '7101 Wisconsin Ave', 'Bethesda', 'MD', '20814',
   '⚖️', '#E1F5EE', ARRAY['Immigration','Family Law','Español']::text[],
   'featured', ARRAY['directory','jobs']::text[], true, 92, 'VEGA5LAW'),
  ('sofia.herrera@demo.mylatinolist.io',
   'Herrera Homes Realty', 'herrera-homes-realty', 'Real Estate',
   '(571) 555-0312', 'sofia@herrerahomes.demo', 'https://herrerahomes.demo',
   'Alexandria bilingual real estate team for first-time buyers, condos, and investment properties across DMV.',
   '1750 King St', 'Alexandria', 'VA', '22314',
   '🏠', '#FFF3E0', ARRAY['First-time Buyers','DMV','Bilingual']::text[],
   'pro', ARRAY['directory']::text[], false, 86, 'HERRERA4'),
  ('miguel.ortega@demo.mylatinolist.io',
   'Ortega Auto Care', 'ortega-auto-care', 'Auto & Repair',
   '(301) 555-0155', 'service@ortegaauto.demo', NULL,
   'ASE-certified shop in Hyattsville. Brakes, diagnostics, and same-day service. Honest estimates in English and Spanish.',
   '4100 Rhode Island Ave', 'Hyattsville', 'MD', '20781',
   '🚗', '#E6F1FB', ARRAY['ASE Certified','Same-day','Fleet']::text[],
   'basic', ARRAY['directory']::text[], false, 78, 'ORTEGA3A'),
  ('ana.vargas@demo.mylatinolist.io',
   'Vargas Tax & Accounting', 'vargas-tax-accounting', 'Finance',
   '(240) 555-0166', 'ana@vargastax.demo', 'https://vargastax.demo',
   'Year-round tax prep, bookkeeping, and SBA-ready books for Latino-owned small businesses in Montgomery County.',
   '20 Maryland Ave', 'Rockville', 'MD', '20850',
   '💰', '#EAF3DE', ARRAY['Tax Prep','Bookkeeping','SBA']::text[],
   'pro', ARRAY['directory','marketplace']::text[], false, 84, 'VARGAS2T'),
  ('carmen.reyes@demo.mylatinolist.io',
   'Salud Latina Wellness', 'salud-latina-wellness', 'Health & Wellness',
   '(410) 555-0201', 'hola@saludlatina.demo', 'https://saludlatina.demo',
   'Bilingual family wellness clinic in Columbia. Preventive care, nutrition coaching, and community health workshops.',
   '10840 Little Patuxent Pkwy', 'Columbia', 'MD', '21044',
   '🌿', '#E8F8F1', ARRAY['Bilingual','Wellness','Walk-ins']::text[],
   'free', ARRAY['directory']::text[], false, 70, 'SALUD1W')
) AS v(owner_email, name, slug, category, phone, email, website, description,
       address, city, state, zip, emoji, bg_color, tags, plan, modules,
       is_featured, profile_completion, referral_code)
JOIN auth.users u ON lower(u.email) = v.owner_email
ON CONFLICT (slug) DO UPDATE
  SET owner_id = EXCLUDED.owner_id,
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      website = EXCLUDED.website,
      description = EXCLUDED.description,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip = EXCLUDED.zip,
      emoji = EXCLUDED.emoji,
      bg_color = EXCLUDED.bg_color,
      tags = EXCLUDED.tags,
      plan = EXCLUDED.plan,
      modules = EXCLUDED.modules,
      is_featured = EXCLUDED.is_featured,
      profile_completion = EXCLUDED.profile_completion,
      status = 'active',
      referral_code = EXCLUDED.referral_code,
      updated_at = NOW();

-- Link profiles back to their business
UPDATE profiles p
SET business_id = b.id
FROM businesses b
WHERE b.owner_id = p.id
  AND b.slug IN (
    'la-cocina-de-maryland','mendez-remodeling-co','flores-beauty-studio',
    'vega-immigration-law','herrera-homes-realty','ortega-auto-care',
    'vargas-tax-accounting','salud-latina-wellness'
  );

-- ── REVIEWS ─────────────────────────────────────────────────
INSERT INTO reviews (business_id, reviewer_name, reviewer_email, rating, body, status)
SELECT b.id, v.reviewer_name, v.reviewer_email, v.rating, v.body, 'published'
FROM (VALUES
  ('la-cocina-de-maryland', 'Elena P.', 'elena.p@example.com', 5, 'Best pupusas in Silver Spring. The salsa is incredible and the staff made my parents feel at home.'),
  ('la-cocina-de-maryland', 'James K.', 'james.k@example.com', 5, 'Catered our office lunch. Tamales arrived hot and the horchata was a hit.'),
  ('la-cocina-de-maryland', 'Rosa M.', 'rosa.m@example.com', 4, 'Weekend brunch line is worth it. Friendly bilingual service.'),
  ('mendez-remodeling-co', 'Priya S.', 'priya.s@example.com', 5, 'Kitchen remodel finished on schedule. Diego explained every change in plain language.'),
  ('mendez-remodeling-co', 'Tom H.', 'tom.h@example.com', 4, 'Quality work on our bathroom. Clean job site every day.'),
  ('flores-beauty-studio', 'Camila R.', 'camila.r@example.com', 5, 'Lucia did my sister''s quinceañera hair and makeup. Photos came out stunning.'),
  ('flores-beauty-studio', 'Maya L.', 'maya.l@example.com', 5, 'Color specialist who actually listens. Booking was easy.'),
  ('vega-immigration-law', 'Daniel O.', 'daniel.o@example.com', 5, 'Clear process for our family petition. Always answered in Spanish when we needed it.'),
  ('vega-immigration-law', 'Heather W.', 'heather.w@example.com', 5, 'Professional, calm, and prepared. Highly recommend for small-business filings too.'),
  ('herrera-homes-realty', 'Luis A.', 'luis.a@example.com', 5, 'Helped us buy our first condo in Alexandria. Patient with every question.'),
  ('ortega-auto-care', 'Nina B.', 'nina.b@example.com', 4, 'Honest quote on brakes. Same-day turnaround as promised.'),
  ('vargas-tax-accounting', 'Chris D.', 'chris.d@example.com', 5, 'Ana cleaned up two years of books and got us ready for an SBA conversation.'),
  ('salud-latina-wellness', 'Gabriela T.', 'gabriela.t@example.com', 5, 'Warm clinic. Nutrition workshop in Spanish was excellent.')
) AS v(slug, reviewer_name, reviewer_email, rating, body)
JOIN businesses b ON b.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM reviews r
  WHERE r.business_id = b.id AND r.reviewer_email = v.reviewer_email
);

-- ── LEADS ───────────────────────────────────────────────────
INSERT INTO leads (business_id, name, email, phone, action, message, source)
SELECT b.id, v.name, v.email, v.phone, v.action, v.message, 'directory'
FROM (VALUES
  ('la-cocina-de-maryland', 'Sandra Q.', 'sandra.q@example.com', '(202) 555-1001', 'inquiry', 'Need catering for 40 people next Saturday.'),
  ('la-cocina-de-maryland', NULL, NULL, NULL, 'call', NULL),
  ('mendez-remodeling-co', 'Owen F.', 'owen.f@example.com', '(703) 555-1002', 'inquiry', 'Looking for a kitchen estimate in Arlington.'),
  ('vega-immigration-law', 'Isabel N.', 'isabel.n@example.com', NULL, 'email', 'Requesting a consult for a family petition.'),
  ('flores-beauty-studio', NULL, NULL, NULL, 'website', NULL),
  ('herrera-homes-realty', 'Mark T.', 'mark.t@example.com', '(571) 555-1003', 'inquiry', 'First-time buyer, budget around Old Town.'),
  ('ortega-auto-care', NULL, NULL, NULL, 'call', NULL),
  ('vargas-tax-accounting', 'Lina C.', 'lina.c@example.com', '(240) 555-1004', 'inquiry', 'Need quarterly bookkeeping for a food truck.')
) AS v(slug, name, email, phone, action, message)
JOIN businesses b ON b.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM leads l
  WHERE l.business_id = b.id
    AND l.action = v.action
    AND COALESCE(l.email, '') = COALESCE(v.email, '')
);

-- ── PRODUCTS ────────────────────────────────────────────────
INSERT INTO products (business_id, seller_name, name, description, price, category, emoji, bg_color, rating, sales_count, status)
SELECT b.id, b.name, v.name, v.description, v.price, v.category, v.emoji, v.bg_color, v.rating, v.sales_count, 'active'
FROM (VALUES
  ('la-cocina-de-maryland', 'Pupusa catering pack (12)', 'House-made pupusas, dozen. Revuelta, bean & cheese, or loroco.', 42.00, 'Food', '🫓', '#EBF2FF', 4.9, 21),
  ('la-cocina-de-maryland', 'Horchata concentrate', 'Authentic horchata concentrate, makes 1 gallon. 32oz bottle.', 12.00, 'Food', '🥛', '#EBF2FF', 4.7, 9),
  ('flores-beauty-studio', 'Keratin treatment kit', 'At-home keratin kit. Formaldehyde-free. Includes instructions in EN/ES.', 65.00, 'Beauty', '💆', '#EEEDFE', 4.8, 6),
  ('vargas-tax-accounting', 'Small-business bookkeeping starter', 'One-time setup: chart of accounts, monthly checklist, and bilingual onboarding call.', 249.00, 'Finance', '📊', '#EAF3DE', 5.0, 4)
) AS v(slug, name, description, price, category, emoji, bg_color, rating, sales_count)
JOIN businesses b ON b.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE p.business_id = b.id AND p.name = v.name
);

-- ── JOBS ────────────────────────────────────────────────────
INSERT INTO jobs (
  business_id, company_name, title, description, city, state, salary_range,
  job_type, bilingual_required, emoji, emoji_bg, type_bg, type_color, status
)
SELECT
  b.id, b.name, v.title, v.description, b.city, b.state, v.salary_range,
  v.job_type, v.bilingual_required, v.emoji, v.emoji_bg, v.type_bg, v.type_color, 'active'
FROM (VALUES
  ('la-cocina-de-maryland', 'Line cook — weekend brunch', 'Prep and grill for a busy Saturday/Sunday brunch. Food-handler card required.', '$18–$22/hr', 'Part-time', true, '🍽️', '#EBF2FF', '#E1F5EE', '#085041'),
  ('mendez-remodeling-co', 'Carpenter / finish apprentice', 'Assist on kitchen and bath remodels in Arlington and Alexandria. Own basic tools a plus.', '$22–$28/hr', 'Full-time', false, '🏗️', '#FAEEDA', '#E6F1FB', '#0C447C'),
  ('vega-immigration-law', 'Immigration paralegal — Spanish required', 'Client intake, document prep, and bilingual communication with families.', '$48K–$58K/yr', 'Full-time', true, '⚖️', '#E1F5EE', '#E6F1FB', '#0C447C'),
  ('herrera-homes-realty', 'Bilingual real estate assistant', 'Coordinate showings, translate listing copy, and support first-time buyers.', '$20–$24/hr', 'Part-time', true, '🏠', '#FFF3E0', '#FAEEDA', '#633806'),
  ('salud-latina-wellness', 'Front desk coordinator — bilingual', 'Scheduling, insurance verification, and warm in-person welcome.', '$18–$21/hr', 'Full-time', true, '🌿', '#E8F8F1', '#E1F5EE', '#085041')
) AS v(slug, title, description, salary_range, job_type, bilingual_required, emoji, emoji_bg, type_bg, type_color)
JOIN businesses b ON b.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM jobs j WHERE j.business_id = b.id AND j.title = v.title
);

-- ── AFFILIATE PROGRAMS ──────────────────────────────────────
INSERT INTO affiliate_programs (name, category, emoji, bg_color, badge_bg, badge_color, description, commission_text, commission_rate, commission_type, sort_order)
SELECT v.*
FROM (VALUES
  ('Banco Latino Business', 'Finance partner', '🏦', '#E6F1FB', '#E6F1FB', '#0C447C', 'Small business checking and bilingual advisors for DMV owners.', 'Up to $200 per referral', 200.00, 'flat', 1),
  ('ShipLatino Express', 'Logistics partner', '📦', '#EAF3DE', '#EAF3DE', '#27500A', 'Discounted shipping for Latino-owned sellers across the US and Latin America.', '$15 per active shipper', 15.00, 'flat', 2),
  ('Verizon Business Español', 'Tech partner', '📱', '#FAEEDA', '#FAEEDA', '#633806', 'Business plans with Spanish-language support and member discounts.', '$75 per activation', 75.00, 'flat', 3),
  ('Chubb Business Insurance', 'Insurance partner', '🛡️', '#FAECE7', '#FAECE7', '#712B13', 'Tailored coverage for Latino SMBs with bilingual agents.', '$150 per policy', 150.00, 'flat', 4),
  ('QuickBooks Latino', 'Software partner', '📊', '#EAF3DE', '#EAF3DE', '#27500A', 'Accounting software with Spanish UI and bilingual onboarding.', '$40 per subscription', 40.00, 'flat', 5),
  ('Google Workspace Negocios', 'Tech partner', '🔵', '#E6F1FB', '#E6F1FB', '#0C447C', 'Gmail, Docs & Drive for business. Special pricing for members.', '$25 per workspace', 25.00, 'flat', 6)
) AS v(name, category, emoji, bg_color, badge_bg, badge_color, description, commission_text, commission_rate, commission_type, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM affiliate_programs a WHERE a.name = v.name
);

-- ── AFFILIATE ENROLLMENTS ───────────────────────────────────
INSERT INTO affiliate_enrollments (business_id, program_id, clicks, conversions, total_earned, status)
SELECT b.id, p.id, v.clicks, v.conversions, v.total_earned, 'active'
FROM (VALUES
  ('la-cocina-de-maryland', 'ShipLatino Express', 42, 3, 45.00),
  ('vargas-tax-accounting', 'QuickBooks Latino', 18, 2, 80.00),
  ('mendez-remodeling-co', 'Chubb Business Insurance', 9, 1, 150.00)
) AS v(slug, program_name, clicks, conversions, total_earned)
JOIN businesses b ON b.slug = v.slug
JOIN affiliate_programs p ON p.name = v.program_name
WHERE NOT EXISTS (
  SELECT 1 FROM affiliate_enrollments e
  WHERE e.business_id = b.id AND e.program_id = p.id
);

-- ── RESOURCES (La Voz Latino) ───────────────────────────────
INSERT INTO resources (title, description, category, icon, bg_color, tag, tag_bg, tag_color, is_bilingual, states, sort_order)
SELECT v.title, v.description, v.category, v.icon, v.bg_color, v.tag, v.tag_bg, v.tag_color, true, v.states, v.sort_order
FROM (VALUES
  ('SBA loan programs', 'SBA loans for Latino-owned businesses. Check eligibility with bilingual support.', 'finance', '💰', '#E1F5EE', 'Finance', '#E1F5EE', '#085041', ARRAY[]::text[], 1),
  ('Maryland small-business licensing', 'State and county licensing, permits, and certifications for Maryland businesses — EN/ES.', 'licensing', '📋', '#E6F1FB', 'Operations', '#E6F1FB', '#0C447C', ARRAY['MD']::text[], 2),
  ('DC bilingual legal aid', 'Connect with DC legal aid and immigration clinics offering low-cost services.', 'legal', '⚖️', '#FAECE7', 'Legal', '#FAECE7', '#712B13', ARRAY['DC']::text[], 3),
  ('Virginia minority business grants', 'Curated grants for Latino and minority-owned businesses in Virginia.', 'grants', '🤝', '#EAF3DE', 'Grants', '#EAF3DE', '#27500A', ARRAY['VA']::text[], 4),
  ('Tax credits for small business', 'Bilingual checklist of federal and MD/DC/VA credits for small businesses.', 'tax', '🧾', '#FAEEDA', 'Tax', '#FAEEDA', '#633806', ARRAY['MD','DC','VA']::text[], 5),
  ('DACA business resources', 'Guidance for DACA recipients starting a business, including EIN and licensing.', 'immigration', '🛂', '#EEEDFE', 'Legal', '#EEEDFE', '#3C3489', ARRAY[]::text[], 6),
  ('Women-owned business grants', 'Grants and programs for Latina entrepreneurs in the DMV.', 'grants', '🌟', '#EAF3DE', 'Grants', '#EAF3DE', '#27500A', ARRAY['MD','DC','VA']::text[], 7),
  ('Workers comp & payroll guide', 'Payroll taxes, workers compensation, and HR basics for Latino business owners.', 'legal', '👷', '#FAECE7', 'HR', '#FAECE7', '#712B13', ARRAY[]::text[], 8)
) AS v(title, description, category, icon, bg_color, tag, tag_bg, tag_color, states, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM resources r WHERE r.title = v.title
);

-- ── SUBSCRIPTIONS (no Stripe live IDs) ──────────────────────
INSERT INTO subscriptions (business_id, plan, status, current_period_start, current_period_end)
SELECT b.id, b.plan, 'active', NOW() - INTERVAL '12 days', NOW() + INTERVAL '18 days'
FROM businesses b
WHERE b.slug IN (
  'la-cocina-de-maryland','mendez-remodeling-co','flores-beauty-studio',
  'vega-immigration-law','herrera-homes-realty','vargas-tax-accounting'
)
AND NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.business_id = b.id
);

SELECT
  (SELECT count(*) FROM businesses WHERE slug LIKE '%maryland%' OR city IN ('Silver Spring','Arlington','Washington','Bethesda','Alexandria','Hyattsville','Rockville','Columbia')) AS seeded_businesses,
  (SELECT count(*) FROM products) AS products,
  (SELECT count(*) FROM jobs) AS jobs,
  (SELECT count(*) FROM resources) AS resources,
  (SELECT count(*) FROM affiliate_programs) AS affiliate_programs;
