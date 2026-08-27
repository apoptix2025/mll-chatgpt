#!/usr/bin/env node
/**
 * DEV ONLY — My Latino List 2.0 staging seed
 *
 * Creates demo Supabase Auth users (via Admin API) then upserts
 * application rows on mll-dev. Never hard-codes secrets.
 *
 * Required env:
 *   SUPABASE_URL          mll-dev project URL
 *   SUPABASE_SERVICE_KEY  service role / secret key (Wrangler staging secret)
 *
 * Optional:
 *   DEMO_PASSWORD         password for all demo owners (default in README)
 *
 * Refuse to run against production. Do not commit secrets.
 */

const PROD_REF = 'jhjdhmjkcnjtbojocjam';
const STAGING_REF = 'bjtfrmkhishoadjtpzgg';

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
const demoPassword = process.env.DEMO_PASSWORD || 'MLL-Demo-2026!';

function fail(msg) {
  console.error(`\nBLOCKED: ${msg}\n`);
  process.exit(1);
}

if (!url) fail('Set SUPABASE_URL to the mll-dev project URL.');
if (!serviceKey) fail('Set SUPABASE_SERVICE_KEY. Use the staging secret name, not a value in source.');
if (url.includes(PROD_REF) || url.includes('jhjdhmjkcnjtbojocjam.supabase.co')) {
  fail('This script refuses to run against production Supabase.');
}
if (!url.includes('.supabase.co')) fail('SUPABASE_URL does not look like a Supabase project.');
if (url.includes('...') || url.includes('YOUR-DEV')) fail('SUPABASE_URL is still a placeholder.');
if (!url.includes(STAGING_REF)) {
  fail(`SUPABASE_URL is not the dedicated mll-dev project. Expected project ref ${STAGING_REF}.`);
}

const authHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function api(path, options = {}) {
  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...authHeaders, ...(options.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.message || json?.error_description || json?.error || json?.msg || text || res.statusText;
    const err = new Error(`${options.method || 'GET'} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = { ...authHeaders };
  if (prefer) headers.Prefer = prefer;
  return api(`/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const OWNERS = [
  { email: 'maria.soto@demo.mylatinolist.io', first_name: 'Maria', last_name: 'Soto' },
  { email: 'diego.mendez@demo.mylatinolist.io', first_name: 'Diego', last_name: 'Mendez' },
  { email: 'lucia.flores@demo.mylatinolist.io', first_name: 'Lucia', last_name: 'Flores' },
  { email: 'andres.vega@demo.mylatinolist.io', first_name: 'Andres', last_name: 'Vega' },
  { email: 'sofia.herrera@demo.mylatinolist.io', first_name: 'Sofia', last_name: 'Herrera' },
  { email: 'miguel.ortega@demo.mylatinolist.io', first_name: 'Miguel', last_name: 'Ortega' },
  { email: 'ana.vargas@demo.mylatinolist.io', first_name: 'Ana', last_name: 'Vargas' },
  { email: 'carmen.reyes@demo.mylatinolist.io', first_name: 'Carmen', last_name: 'Reyes' },
];

const BUSINESSES = [
  {
    owner_email: 'maria.soto@demo.mylatinolist.io',
    name: 'La Cocina de Maryland', slug: 'la-cocina-de-maryland', category: 'Food & Dining',
    phone: '(301) 555-0142', email: 'hola@lacocinamd.demo', website: 'https://lacocinamd.demo',
    description: 'Family-owned Salvadoran and Mexican kitchen in Silver Spring. Pupusas, tamales, weekend brunch, and catering for quinceañeras.',
    address: '8600 Colesville Rd', city: 'Silver Spring', state: 'MD', zip: '20910',
    emoji: '🍽️', bg_color: '#EBF2FF', tags: ['Pupusas', 'Catering', 'Bilingual'],
    plan: 'featured', modules: ['directory', 'marketplace'], is_featured: true,
    profile_completion: 94, referral_code: 'COCINA8M',
  },
  {
    owner_email: 'diego.mendez@demo.mylatinolist.io',
    name: 'Mendez Remodeling Co.', slug: 'mendez-remodeling-co', category: 'Construction',
    phone: '(703) 555-0198', email: 'hello@mendezremodel.demo', website: 'https://mendezremodel.demo',
    description: 'Licensed Arlington contractor for kitchens, baths, additions, and bilingual project management across Northern Virginia.',
    address: '1200 N Glebe Rd', city: 'Arlington', state: 'VA', zip: '22201',
    emoji: '🏗️', bg_color: '#FAEEDA', tags: ['Licensed', 'Kitchens', 'Bilingual'],
    plan: 'pro', modules: ['directory', 'jobs'], is_featured: true,
    profile_completion: 88, referral_code: 'MENDEZ7R',
  },
  {
    owner_email: 'lucia.flores@demo.mylatinolist.io',
    name: 'Flores Beauty Studio', slug: 'flores-beauty-studio', category: 'Beauty & Salon',
    phone: '(202) 555-0177', email: 'hola@floresbeauty.demo', website: 'https://floresbeauty.demo',
    description: 'Columbia Heights salon specializing in color, keratin, and quinceañera styling. Walk-ins welcome, Spanish spoken.',
    address: '3200 14th St NW', city: 'Washington', state: 'DC', zip: '20010',
    emoji: '💇', bg_color: '#EEEDFE', tags: ['Color', 'Quinceañera', 'Keratin'],
    plan: 'pro', modules: ['directory', 'marketplace'], is_featured: true,
    profile_completion: 90, referral_code: 'FLORES6B',
  },
  {
    owner_email: 'andres.vega@demo.mylatinolist.io',
    name: 'Vega Immigration Law', slug: 'vega-immigration-law', category: 'Legal Services',
    phone: '(240) 555-0133', email: 'info@legalvega.demo', website: 'https://legalvega.demo',
    description: 'Bethesda immigration, family, and small-business law. Free consults. Fully bilingual attorneys and paralegals.',
    address: '7101 Wisconsin Ave', city: 'Bethesda', state: 'MD', zip: '20814',
    emoji: '⚖️', bg_color: '#E1F5EE', tags: ['Immigration', 'Family Law', 'Español'],
    plan: 'featured', modules: ['directory', 'jobs'], is_featured: true,
    profile_completion: 92, referral_code: 'VEGA5LAW',
  },
  {
    owner_email: 'sofia.herrera@demo.mylatinolist.io',
    name: 'Herrera Homes Realty', slug: 'herrera-homes-realty', category: 'Real Estate',
    phone: '(571) 555-0312', email: 'sofia@herrerahomes.demo', website: 'https://herrerahomes.demo',
    description: 'Alexandria bilingual real estate team for first-time buyers, condos, and investment properties across DMV.',
    address: '1750 King St', city: 'Alexandria', state: 'VA', zip: '22314',
    emoji: '🏠', bg_color: '#FFF3E0', tags: ['First-time Buyers', 'DMV', 'Bilingual'],
    plan: 'pro', modules: ['directory'], is_featured: false,
    profile_completion: 86, referral_code: 'HERRERA4',
  },
  {
    owner_email: 'miguel.ortega@demo.mylatinolist.io',
    name: 'Ortega Auto Care', slug: 'ortega-auto-care', category: 'Auto & Repair',
    phone: '(301) 555-0155', email: 'service@ortegaauto.demo', website: null,
    description: 'ASE-certified shop in Hyattsville. Brakes, diagnostics, and same-day service. Honest estimates in English and Spanish.',
    address: '4100 Rhode Island Ave', city: 'Hyattsville', state: 'MD', zip: '20781',
    emoji: '🚗', bg_color: '#E6F1FB', tags: ['ASE Certified', 'Same-day', 'Fleet'],
    plan: 'basic', modules: ['directory'], is_featured: false,
    profile_completion: 78, referral_code: 'ORTEGA3A',
  },
  {
    owner_email: 'ana.vargas@demo.mylatinolist.io',
    name: 'Vargas Tax & Accounting', slug: 'vargas-tax-accounting', category: 'Finance',
    phone: '(240) 555-0166', email: 'ana@vargastax.demo', website: 'https://vargastax.demo',
    description: 'Year-round tax prep, bookkeeping, and SBA-ready books for Latino-owned small businesses in Montgomery County.',
    address: '20 Maryland Ave', city: 'Rockville', state: 'MD', zip: '20850',
    emoji: '💰', bg_color: '#EAF3DE', tags: ['Tax Prep', 'Bookkeeping', 'SBA'],
    plan: 'pro', modules: ['directory', 'marketplace'], is_featured: false,
    profile_completion: 84, referral_code: 'VARGAS2T',
  },
  {
    owner_email: 'carmen.reyes@demo.mylatinolist.io',
    name: 'Salud Latina Wellness', slug: 'salud-latina-wellness', category: 'Health & Wellness',
    phone: '(410) 555-0201', email: 'hola@saludlatina.demo', website: 'https://saludlatina.demo',
    description: 'Bilingual family wellness clinic in Columbia. Preventive care, nutrition coaching, and community health workshops.',
    address: '10840 Little Patuxent Pkwy', city: 'Columbia', state: 'MD', zip: '21044',
    emoji: '🌿', bg_color: '#E8F8F1', tags: ['Bilingual', 'Wellness', 'Walk-ins'],
    plan: 'free', modules: ['directory'], is_featured: false,
    profile_completion: 70, referral_code: 'SALUD1W',
  },
];

async function listUsers() {
  const json = await api('/auth/v1/admin/users?page=1&per_page=200');
  return json.users || json || [];
}

async function ensureUser(owner, existing) {
  const found = existing.find((u) => (u.email || '').toLowerCase() === owner.email);
  if (found) {
    console.log(`  owner exists: ${owner.email}`);
    return found.id;
  }
  const created = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: owner.email,
      password: demoPassword,
      email_confirm: true,
      user_metadata: {
        first_name: owner.first_name,
        last_name: owner.last_name,
        language: 'English',
        role: 'owner',
        demo: true,
      },
    }),
  });
  console.log(`  created owner: ${owner.email}`);
  return created.id;
}

async function upsertProfile(id, owner) {
  await rest('profiles?on_conflict=id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      id,
      email: owner.email,
      first_name: owner.first_name,
      last_name: owner.last_name,
      language: 'English',
    },
  });
}

async function upsertBusiness(ownerId, biz) {
  const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const row = {
    owner_id: ownerId,
    name: biz.name,
    slug: biz.slug,
    category: biz.category,
    phone: biz.phone,
    email: biz.email,
    website: biz.website,
    description: biz.description,
    address: biz.address,
    city: biz.city,
    state: biz.state,
    zip: biz.zip,
    emoji: biz.emoji,
    bg_color: biz.bg_color,
    tags: biz.tags,
    plan: biz.plan,
    modules: biz.modules,
    is_featured: biz.is_featured,
    profile_completion: biz.profile_completion,
    status: 'active',
    referral_code: biz.referral_code,
    expires_at: expires,
  };
  try {
    await rest('businesses?on_conflict=slug', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: row,
    });
  } catch (err) {
    if (String(err.message).includes('expires_at')) {
      delete row.expires_at;
      await rest('businesses?on_conflict=slug', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: row,
      });
      console.warn('  warning: expires_at column missing — apply supabase/migrations/004_worker_schema_align.sql');
    } else {
      throw err;
    }
  }
}

async function getBusinessBySlug(slug) {
  const rows = await rest(`businesses?slug=eq.${encodeURIComponent(slug)}&select=id,name,slug,city,state,plan,owner_id`);
  return rows[0];
}

async function exists(table, query) {
  const rows = await rest(`${table}?${query}&select=id`);
  return Array.isArray(rows) && rows.length > 0;
}

async function insertIfMissing(table, query, body) {
  if (await exists(table, query)) return;
  await rest(table, { method: 'POST', prefer: 'return=minimal', body });
}

async function main() {
  console.log('MLL 2.0 DEV seed (mll-dev only)');
  console.log(`Target: ${url}`);

  const existing = await listUsers();
  const ownerIds = {};
  for (const owner of OWNERS) {
    ownerIds[owner.email] = await ensureUser(owner, existing);
    await upsertProfile(ownerIds[owner.email], owner);
  }

  for (const biz of BUSINESSES) {
    await upsertBusiness(ownerIds[biz.owner_email], biz);
    const saved = await getBusinessBySlug(biz.slug);
    if (saved) {
      await rest(`profiles?id=eq.${ownerIds[biz.owner_email]}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { business_id: saved.id },
      });
    }
    console.log(`  business upserted: ${biz.slug}`);
  }

  const reviews = [
    ['la-cocina-de-maryland', 'Elena P.', 'elena.p@example.com', 5, 'Best pupusas in Silver Spring. The salsa is incredible and the staff made my parents feel at home.'],
    ['la-cocina-de-maryland', 'James K.', 'james.k@example.com', 5, 'Catered our office lunch. Tamales arrived hot and the horchata was a hit.'],
    ['la-cocina-de-maryland', 'Rosa M.', 'rosa.m@example.com', 4, 'Weekend brunch line is worth it. Friendly bilingual service.'],
    ['mendez-remodeling-co', 'Priya S.', 'priya.s@example.com', 5, 'Kitchen remodel finished on schedule. Diego explained every change in plain language.'],
    ['mendez-remodeling-co', 'Tom H.', 'tom.h@example.com', 4, 'Quality work on our bathroom. Clean job site every day.'],
    ['flores-beauty-studio', 'Camila R.', 'camila.r@example.com', 5, "Lucia did my sister's quinceañera hair and makeup. Photos came out stunning."],
    ['flores-beauty-studio', 'Maya L.', 'maya.l@example.com', 5, 'Color specialist who actually listens. Booking was easy.'],
    ['vega-immigration-law', 'Daniel O.', 'daniel.o@example.com', 5, 'Clear process for our family petition. Always answered in Spanish when we needed it.'],
    ['vega-immigration-law', 'Heather W.', 'heather.w@example.com', 5, 'Professional, calm, and prepared. Highly recommend for small-business filings too.'],
    ['herrera-homes-realty', 'Luis A.', 'luis.a@example.com', 5, 'Helped us buy our first condo in Alexandria. Patient with every question.'],
    ['ortega-auto-care', 'Nina B.', 'nina.b@example.com', 4, 'Honest quote on brakes. Same-day turnaround as promised.'],
    ['vargas-tax-accounting', 'Chris D.', 'chris.d@example.com', 5, 'Ana cleaned up two years of books and got us ready for an SBA conversation.'],
    ['salud-latina-wellness', 'Gabriela T.', 'gabriela.t@example.com', 5, 'Warm clinic. Nutrition workshop in Spanish was excellent.'],
  ];
  for (const [slug, reviewer_name, reviewer_email, rating, body] of reviews) {
    const biz = await getBusinessBySlug(slug);
    if (!biz) continue;
    await insertIfMissing(
      'reviews',
      `business_id=eq.${biz.id}&reviewer_email=eq.${encodeURIComponent(reviewer_email)}`,
      { business_id: biz.id, reviewer_name, reviewer_email, rating, body, status: 'published' }
    );
  }

  const leads = [
    ['la-cocina-de-maryland', 'Sandra Q.', 'sandra.q@example.com', '(202) 555-1001', 'inquiry', 'Need catering for 40 people next Saturday.'],
    ['mendez-remodeling-co', 'Owen F.', 'owen.f@example.com', '(703) 555-1002', 'inquiry', 'Looking for a kitchen estimate in Arlington.'],
    ['vega-immigration-law', 'Isabel N.', 'isabel.n@example.com', null, 'email', 'Requesting a consult for a family petition.'],
    ['herrera-homes-realty', 'Mark T.', 'mark.t@example.com', '(571) 555-1003', 'inquiry', 'First-time buyer, budget around Old Town.'],
    ['vargas-tax-accounting', 'Lina C.', 'lina.c@example.com', '(240) 555-1004', 'inquiry', 'Need quarterly bookkeeping for a food truck.'],
  ];
  for (const [slug, name, email, phone, action, message] of leads) {
    const biz = await getBusinessBySlug(slug);
    if (!biz) continue;
    await insertIfMissing(
      'leads',
      `business_id=eq.${biz.id}&email=eq.${encodeURIComponent(email)}&action=eq.${action}`,
      { business_id: biz.id, name, email, phone, action, message, source: 'directory' }
    );
  }

  const products = [
    ['la-cocina-de-maryland', 'Pupusa catering pack (12)', 'House-made pupusas, dozen. Revuelta, bean & cheese, or loroco.', 42, 'Food', '🫓', '#EBF2FF', 4.9, 21],
    ['la-cocina-de-maryland', 'Horchata concentrate', 'Authentic horchata concentrate, makes 1 gallon. 32oz bottle.', 12, 'Food', '🥛', '#EBF2FF', 4.7, 9],
    ['flores-beauty-studio', 'Keratin treatment kit', 'At-home keratin kit. Formaldehyde-free. Includes instructions in EN/ES.', 65, 'Beauty', '💆', '#EEEDFE', 4.8, 6],
    ['vargas-tax-accounting', 'Small-business bookkeeping starter', 'One-time setup: chart of accounts, monthly checklist, and bilingual onboarding call.', 249, 'Finance', '📊', '#EAF3DE', 5.0, 4],
  ];
  for (const [slug, name, description, price, category, emoji, bg_color, rating, sales_count] of products) {
    const biz = await getBusinessBySlug(slug);
    if (!biz) continue;
    await insertIfMissing(
      'products',
      `business_id=eq.${biz.id}&name=eq.${encodeURIComponent(name)}`,
      { business_id: biz.id, seller_name: biz.name, name, description, price, category, emoji, bg_color, rating, sales_count, status: 'active' }
    );
  }

  const jobs = [
    ['la-cocina-de-maryland', 'Line cook — weekend brunch', 'Prep and grill for a busy Saturday/Sunday brunch. Food-handler card required.', '$18–$22/hr', 'Part-time', true, '🍽️', '#EBF2FF', '#E1F5EE', '#085041'],
    ['mendez-remodeling-co', 'Carpenter / finish apprentice', 'Assist on kitchen and bath remodels in Arlington and Alexandria. Own basic tools a plus.', '$22–$28/hr', 'Full-time', false, '🏗️', '#FAEEDA', '#E6F1FB', '#0C447C'],
    ['vega-immigration-law', 'Immigration paralegal — Spanish required', 'Client intake, document prep, and bilingual communication with families.', '$48K–$58K/yr', 'Full-time', true, '⚖️', '#E1F5EE', '#E6F1FB', '#0C447C'],
    ['herrera-homes-realty', 'Bilingual real estate assistant', 'Coordinate showings, translate listing copy, and support first-time buyers.', '$20–$24/hr', 'Part-time', true, '🏠', '#FFF3E0', '#FAEEDA', '#633806'],
    ['salud-latina-wellness', 'Front desk coordinator — bilingual', 'Scheduling, insurance verification, and warm in-person welcome.', '$18–$21/hr', 'Full-time', true, '🌿', '#E8F8F1', '#E1F5EE', '#085041'],
  ];
  for (const [slug, title, description, salary_range, job_type, bilingual_required, emoji, emoji_bg, type_bg, type_color] of jobs) {
    const biz = await getBusinessBySlug(slug);
    if (!biz) continue;
    await insertIfMissing(
      'jobs',
      `business_id=eq.${biz.id}&title=eq.${encodeURIComponent(title)}`,
      {
        business_id: biz.id, company_name: biz.name, title, description,
        city: biz.city, state: biz.state, salary_range, job_type, bilingual_required,
        emoji, emoji_bg, type_bg, type_color, status: 'active',
      }
    );
  }

  const programs = [
    ['Banco Latino Business', 'Finance partner', '🏦', '#E6F1FB', '#E6F1FB', '#0C447C', 'Small business checking and bilingual advisors for DMV owners.', 'Up to $200 per referral', 200, 'flat', 1],
    ['ShipLatino Express', 'Logistics partner', '📦', '#EAF3DE', '#EAF3DE', '#27500A', 'Discounted shipping for Latino-owned sellers across the US and Latin America.', '$15 per active shipper', 15, 'flat', 2],
    ['Verizon Business Español', 'Tech partner', '📱', '#FAEEDA', '#FAEEDA', '#633806', 'Business plans with Spanish-language support and member discounts.', '$75 per activation', 75, 'flat', 3],
    ['Chubb Business Insurance', 'Insurance partner', '🛡️', '#FAECE7', '#FAECE7', '#712B13', 'Tailored coverage for Latino SMBs with bilingual agents.', '$150 per policy', 150, 'flat', 4],
    ['QuickBooks Latino', 'Software partner', '📊', '#EAF3DE', '#EAF3DE', '#27500A', 'Accounting software with Spanish UI and bilingual onboarding.', '$40 per subscription', 40, 'flat', 5],
    ['Google Workspace Negocios', 'Tech partner', '🔵', '#E6F1FB', '#E6F1FB', '#0C447C', 'Gmail, Docs & Drive for business. Special pricing for members.', '$25 per workspace', 25, 'flat', 6],
  ];
  for (const [name, category, emoji, bg_color, badge_bg, badge_color, description, commission_text, commission_rate, commission_type, sort_order] of programs) {
    await insertIfMissing(
      'affiliate_programs',
      `name=eq.${encodeURIComponent(name)}`,
      { name, category, emoji, bg_color, badge_bg, badge_color, description, commission_text, commission_rate, commission_type, sort_order, status: 'active' }
    );
  }

  const enrollments = [
    ['la-cocina-de-maryland', 'ShipLatino Express', 42, 3, 45],
    ['vargas-tax-accounting', 'QuickBooks Latino', 18, 2, 80],
    ['mendez-remodeling-co', 'Chubb Business Insurance', 9, 1, 150],
  ];
  for (const [slug, programName, clicks, conversions, total_earned] of enrollments) {
    const biz = await getBusinessBySlug(slug);
    const programsFound = await rest(`affiliate_programs?name=eq.${encodeURIComponent(programName)}&select=id`);
    const program = programsFound[0];
    if (!biz || !program) continue;
    await insertIfMissing(
      'affiliate_enrollments',
      `business_id=eq.${biz.id}&program_id=eq.${program.id}`,
      { business_id: biz.id, program_id: program.id, clicks, conversions, total_earned, status: 'active' }
    );
  }

  const resources = [
    ['SBA loan programs', 'SBA loans for Latino-owned businesses. Check eligibility with bilingual support.', 'finance', '💰', '#E1F5EE', 'Finance', '#E1F5EE', '#085041', [], 1],
    ['Maryland small-business licensing', 'State and county licensing, permits, and certifications for Maryland businesses — EN/ES.', 'licensing', '📋', '#E6F1FB', 'Operations', '#E6F1FB', '#0C447C', ['MD'], 2],
    ['DC bilingual legal aid', 'Connect with DC legal aid and immigration clinics offering low-cost services.', 'legal', '⚖️', '#FAECE7', 'Legal', '#FAECE7', '#712B13', ['DC'], 3],
    ['Virginia minority business grants', 'Curated grants for Latino and minority-owned businesses in Virginia.', 'grants', '🤝', '#EAF3DE', 'Grants', '#EAF3DE', '#27500A', ['VA'], 4],
    ['Tax credits for small business', 'Bilingual checklist of federal and MD/DC/VA credits for small businesses.', 'tax', '🧾', '#FAEEDA', 'Tax', '#FAEEDA', '#633806', ['MD', 'DC', 'VA'], 5],
    ['DACA business resources', 'Guidance for DACA recipients starting a business, including EIN and licensing.', 'immigration', '🛂', '#EEEDFE', 'Legal', '#EEEDFE', '#3C3489', [], 6],
    ['Women-owned business grants', 'Grants and programs for Latina entrepreneurs in the DMV.', 'grants', '🌟', '#EAF3DE', 'Grants', '#EAF3DE', '#27500A', ['MD', 'DC', 'VA'], 7],
    ['Workers comp & payroll guide', 'Payroll taxes, workers compensation, and HR basics for Latino business owners.', 'legal', '👷', '#FAECE7', 'HR', '#FAECE7', '#712B13', [], 8],
  ];
  for (const [title, description, category, icon, bg_color, tag, tag_bg, tag_color, states, sort_order] of resources) {
    await insertIfMissing(
      'resources',
      `title=eq.${encodeURIComponent(title)}`,
      { title, description, category, icon, bg_color, tag, tag_bg, tag_color, is_bilingual: true, states, sort_order, status: 'active' }
    );
  }

  // subscriptions.plan check in 001 is ('free','pro','featured').
  // 004 expands it to include basic/agency. Skip unsupported plans until then.
  const subscriptionPlans = new Set(['pro', 'featured']);
  for (const biz of BUSINESSES) {
    if (!subscriptionPlans.has(biz.plan)) continue;
    const saved = await getBusinessBySlug(biz.slug);
    if (!saved) continue;
    try {
      await insertIfMissing(
        'subscriptions',
        `business_id=eq.${saved.id}`,
        {
          business_id: saved.id,
          plan: biz.plan,
          status: 'active',
          current_period_start: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
          current_period_end: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
        }
      );
    } catch (err) {
      console.warn(`  warning: subscription skip for ${biz.slug}: ${err.message}`);
    }
  }

  const counts = {};
  for (const table of ['businesses', 'products', 'jobs', 'resources', 'affiliate_programs', 'reviews', 'leads']) {
    const rows = await rest(`${table}?select=id`);
    counts[table] = Array.isArray(rows) ? rows.length : 0;
  }
  console.log('\nSeed complete (mll-dev):');
  console.log(counts);
  console.log('\nDemo login emails use the DEMO_PASSWORD env value (or the documented default).');
  console.log('Next: paste supabase/validation/validate_dev.sql into the mll-dev SQL editor.');
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
