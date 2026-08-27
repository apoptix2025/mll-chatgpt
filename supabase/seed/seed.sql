-- ============================================================
-- MYLATINOLIST — SEED DATA
-- Run AFTER 001_initial_schema.sql
-- Paste into Supabase SQL Editor to populate dev data
-- ============================================================

-- ── AFFILIATE PROGRAMS ────────────────────────────────────────
INSERT INTO affiliate_programs (name, category, emoji, bg_color, badge_bg, badge_color, description, commission_text, commission_rate, commission_type, sort_order) VALUES
('Banco Latino Business',    'Finance partner',    '🏦', '#E6F1FB', '#E6F1FB', '#0C447C', 'Small business checking, SBA-preferred lender, bilingual advisors in 12+ cities.', 'Up to $200 per referral', 200.00, 'flat', 1),
('ShipLatino Express',       'Logistics partner',  '📦', '#EAF3DE', '#EAF3DE', '#27500A', 'Discounted shipping for Latino-owned sellers across the US, Mexico & Latin America.', '$15 per active shipper', 15.00, 'flat', 2),
('Verizon Business Español', 'Tech partner',       '📱', '#FAEEDA', '#FAEEDA', '#633806', 'Business plans with dedicated Spanish-language support and exclusive member discounts.', '$75 per activation', 75.00, 'flat', 3),
('Chubb Business Insurance', 'Insurance partner',  '🛡️', '#FAECE7', '#FAECE7', '#712B13', 'Tailored business insurance for Latino SMBs. Bilingual agents, fast claims processing.', '$150 per policy', 150.00, 'flat', 4),
('QuickBooks Latino',        'Software partner',   '📊', '#EAF3DE', '#EAF3DE', '#27500A', 'Accounting software with Spanish UI and bilingual onboarding support.', '$40 per subscription', 40.00, 'flat', 5),
('Google Workspace Negocios','Tech partner',       '🔵', '#E6F1FB', '#E6F1FB', '#0C447C', 'Gmail, Docs & Drive for business. Special pricing for mylatinolist members.', '$25 per workspace', 25.00, 'flat', 6);

-- ── LA VOZ LATINO RESOURCES ───────────────────────────────────
INSERT INTO resources (title, description, category, icon, bg_color, tag, tag_bg, tag_color, is_bilingual, sort_order) VALUES
('SBA loan programs',             'Small Business Administration loans for Latino-owned businesses. Check eligibility and apply with bilingual support.',        'finance',    '💰', '#E1F5EE', 'Finance',   '#E1F5EE', '#085041', true, 1),
('DACA business resources',       'Guidance for DACA recipients starting or running a business, including EIN registration and licensing.',                     'immigration','🛂', '#EEEDFE', 'Legal',     '#EEEDFE', '#3C3489', true, 2),
('Tax credits for small business','Bilingual checklist of federal and state tax credits available to Latino-owned small businesses.',                           'tax',        '🧾', '#FAEEDA', 'Tax',       '#FAEEDA', '#633806', true, 3),
('Business licensing guide',      'State-by-state guide to getting your business license, permits, and certifications — in English and Spanish.',              'licensing',  '📋', '#E6F1FB', 'Operations','#E6F1FB', '#0C447C', true, 4),
('Minority business grants',      'Curated list of grants specifically for Latino and minority-owned businesses, updated monthly.',                             'grants',     '🤝', '#EAF3DE', 'Grants',    '#EAF3DE', '#27500A', true, 5),
('Free legal aid directory',      'Connect with bilingual lawyers and legal aid organizations offering free or low-cost services for small businesses.',        'legal',      '⚖️', '#FAECE7', 'Legal',     '#FAECE7', '#712B13', true, 6),
('Bilingual tax preparation',     'Find IRS-certified VITA volunteers who offer free tax prep in Spanish for qualifying small businesses and individuals.',     'tax',        '📄', '#FAEEDA', 'Tax',       '#FAEEDA', '#633806', true, 7),
('Women-owned business grants',   'Grants and programs specifically for Latina entrepreneurs and women-owned businesses.',                                      'grants',     '🌟', '#EAF3DE', 'Grants',    '#EAF3DE', '#27500A', true, 8),
('Business credit building guide','Step-by-step guide to building business credit separate from personal credit — bilingual.',                                  'finance',    '💳', '#E1F5EE', 'Finance',   '#E1F5EE', '#085041', true, 9),
('Workers comp & payroll guide',  'Understanding payroll taxes, workers compensation requirements, and HR basics for Latino business owners.',                  'legal',      '👷', '#FAECE7', 'HR',        '#FAECE7', '#712B13', true, 10);

-- ── SAMPLE BUSINESSES ─────────────────────────────────────────
-- Note: In production these are created through enrollment.
-- owner_id values are placeholder UUIDs for dev/testing only.
-- Replace with real auth.users UUIDs after creating test accounts.

INSERT INTO businesses (name, slug, category, phone, email, website, description, city, state, zip, emoji, bg_color, tags, plan, is_featured, rating, review_count, profile_completion, status) VALUES
('La Cocina de Maria',     'la-cocina-de-maria',     'Food & Dining',    '(305) 555-0142', 'info@lacocina.com',   'https://lacocina.com',   'Authentic Mexican cuisine, family-owned since 2010. Dine-in, takeout & catering available. Bilingual staff.',                    'Miami',       'FL', '33101', '🍽️', '#FAECE7', '{"Authentic","Catering","Bilingual"}', 'featured', true,  4.9, 214, 95, 'active'),
('Ramos Law Group',        'ramos-law-group',        'Legal Services',   '(713) 555-0198', 'info@ramoslaw.com',   'https://ramoslaw.com',   'Immigration, family & business law. Fully bilingual team. Free consultations available.',                                        'Houston',     'TX', '77001', '⚖️', '#E1F5EE', '{"Immigration","Family Law","Español"}', 'pro',      true,  4.8,  97, 90, 'active'),
('Casa Flores Salon',      'casa-flores-salon',      'Beauty & Salon',   '(323) 555-0177', 'info@casaflores.com', 'https://casaflores.com', 'Award-winning hair salon specializing in color treatments and quinceañera styling.',                                             'Los Angeles', 'CA', '90001', '💇', '#EEEDFE', '{"Color","Quinceañera","Keratin"}',       'pro',      true,  5.0, 183, 88, 'active'),
('Ortega Auto Repair',     'ortega-auto-repair',     'Auto & Repair',    '(312) 555-0155', 'info@ortegaauto.com', null,                     'Full-service auto repair shop. ASE certified mechanics. Same-day service available.',                                           'Chicago',     'IL', '60601', '🚗', '#E6F1FB', '{"ASE Certified","Same-day","Fleet"}',    'pro',      false, 4.7, 124, 72, 'active'),
('Vargas Financial',       'vargas-financial',       'Finance',          '(210) 555-0133', 'info@vargasfin.com',  null,                     'Tax preparation, bookkeeping, and small business consulting for Latino entrepreneurs.',                                          'San Antonio', 'TX', '78201', '💰', '#EAF3DE', '{"Tax Prep","Bookkeeping","SBA Loans"}',  'pro',      false, 4.9,  67, 80, 'active'),
('Construcciones Rivera',  'construcciones-rivera',  'Construction',     '(602) 555-0166', 'info@crivera.com',    null,                     'General contracting, remodeling, and commercial build-outs. Licensed & insured.',                                               'Phoenix',     'AZ', '85001', '🏗️', '#FAEEDA', '{"Licensed","Remodeling","Commercial"}',  'free',     false, 4.6,  88, 60, 'active');

-- ── SAMPLE PRODUCTS ───────────────────────────────────────────
-- Uses subquery to get business IDs by slug
INSERT INTO products (business_id, seller_name, name, description, price, category, emoji, bg_color, rating, sales_count, status) VALUES
((SELECT id FROM businesses WHERE slug='la-cocina-de-maria'), 'La Cocina de Maria', 'Tamale catering pack (12)',    'Hand-made tamales, 12 pieces. Choice of pork, chicken, or cheese.',       48.00, 'Food',     '🫔', '#FAECE7', 4.9, 18, 'active'),
((SELECT id FROM businesses WHERE slug='la-cocina-de-maria'), 'La Cocina de Maria', 'House mole sauce jar',        'Our signature dark mole, 16oz jar. Ships nationwide.',                     16.00, 'Food',     '🥫', '#FAECE7', 4.8,  9, 'active'),
((SELECT id FROM businesses WHERE slug='la-cocina-de-maria'), 'La Cocina de Maria', 'Horchata concentrate',        'Authentic horchata concentrate, makes 1 gallon. 32oz bottle.',             12.00, 'Food',     '🍷', '#FAECE7', 4.7,  5, 'active'),
((SELECT id FROM businesses WHERE slug='casa-flores-salon'),  'Casa Flores Salon',  'Keratin treatment kit',       'Professional-grade at-home keratin treatment. Formaldehyde-free.',        65.00, 'Beauty',   '💆', '#EEEDFE', 4.8,  7, 'active');

-- ── SAMPLE JOBS ───────────────────────────────────────────────
INSERT INTO jobs (business_id, company_name, title, description, city, state, salary_range, job_type, bilingual_required, emoji, emoji_bg, type_bg, type_color, status) VALUES
((SELECT id FROM businesses WHERE slug='la-cocina-de-maria'), 'La Cocina de Maria',    'Restaurant manager — bilingual preferred', 'Manage daily operations, staff scheduling, and customer experience for a busy family restaurant.', 'Miami',       'FL', '$55K–$65K/yr', 'Full-time',  true,  '🍽️', '#FAECE7', '#E1F5EE', '#085041', 'active'),
((SELECT id FROM businesses WHERE slug='ramos-law-group'),    'Ramos Law Group',        'Immigration paralegal — Spanish required',  'Assist attorneys with immigration cases, client communication, and document preparation.',          'Houston',     'TX', '$42K–$52K/yr', 'Full-time',  true,  '⚖️', '#E1F5EE', '#E6F1FB', '#0C447C', 'active'),
((SELECT id FROM businesses WHERE slug='casa-flores-salon'),  'Casa Flores Salon',      'Senior hair stylist',                       'Experienced stylist for color, cuts, and special occasion styling. Quinceañera experience a plus.', 'Los Angeles', 'CA', '$55K–$70K/yr', 'Full-time',  false, '💇', '#EEEDFE', '#EEEDFE', '#3C3489', 'active'),
((SELECT id FROM businesses WHERE slug='ortega-auto-repair'), 'Ortega Auto Repair',     'ASE auto technician',                       'ASE certified mechanic for full-service auto repair. Experience with domestic and import vehicles.',  'Chicago',     'IL', '$28–$38/hr',   'Full-time',  false, '🚗', '#E6F1FB', '#E6F1FB', '#0C447C', 'active'),
((SELECT id FROM businesses WHERE slug='vargas-financial'),   'Vargas Financial',       'Bilingual tax associate (seasonal)',        'Assist clients with tax preparation during tax season. CPA or EA certification preferred.',           'San Antonio', 'TX', '$22–$28/hr',   'Contract',   true,  '💰', '#EAF3DE', '#FAEEDA', '#633806', 'active');
