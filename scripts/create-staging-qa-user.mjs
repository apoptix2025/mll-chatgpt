#!/usr/bin/env node
/**
 * DEV ONLY — create or reuse the staging QA owner in mll-dev.
 *
 * Never runs against production. Never prints passwords or keys.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   QA_DEMO_PASSWORD
 */

const PROD_REF = 'jhjdhmjkcnjtbojocjam';
const STAGING_REF = 'bjtfrmkhishoadjtpzgg';
const SPECIAL_OWNER_ID = '00000000-0000-0000-0000-000000000001';
const QA_EMAIL = 'qa.owner@demo.mylatinolist.io';
const QA_SLUG = 'mll-qa-test-business';
const QA_BIZ_NAME = 'MLL QA Test Business';

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
const qaPassword = process.env.QA_DEMO_PASSWORD || '';

function fail(msg) {
  console.error(`\nBLOCKED: ${msg}\n`);
  process.exit(1);
}

if (!url) fail('Set SUPABASE_URL to the mll-dev project URL.');
if (!serviceKey) fail('Set SUPABASE_SERVICE_KEY for mll-dev. Do not paste it into source.');
if (!qaPassword) fail('Set QA_DEMO_PASSWORD. Do not put the password in source.');
if (url.includes(PROD_REF)) fail('Refuses to run against production Supabase.');
if (!url.includes(STAGING_REF)) {
  fail(`SUPABASE_URL is not mll-dev. Expected project ref ${STAGING_REF}.`);
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
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message || json?.error_description || json?.error || json?.msg || text || res.statusText;
    const err = new Error(`${options.method || 'GET'} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
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

async function listUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const json = await api(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`);
    const batch = json?.users || json || [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

async function ensureQaUser() {
  const users = await listUsers();
  const existing = users.find((u) => String(u.email || '').toLowerCase() === QA_EMAIL);
  if (existing?.id) {
    if (existing.id === SPECIAL_OWNER_ID) {
      fail('QA email is attached to the protected special owner UUID. Refusing to modify it.');
    }
    await api(`/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        password: qaPassword,
        email_confirm: true,
        user_metadata: { first_name: 'QA', last_name: 'Owner', role: 'owner' },
      }),
    });
    console.log('  QA user: reused (password rotated in Auth, original secrets not printed)');
    return existing.id;
  }

  const created = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: QA_EMAIL,
      password: qaPassword,
      email_confirm: true,
      user_metadata: { first_name: 'QA', last_name: 'Owner', role: 'owner' },
    }),
  });
  const id = created?.id || created?.user?.id;
  if (!id) fail('Admin API created a user but returned no id.');
  if (id === SPECIAL_OWNER_ID) fail('Created user unexpectedly matched the protected special owner UUID.');
  console.log('  QA user: created');
  return id;
}

async function ensureProfile(userId) {
  await rest('profiles?on_conflict=id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      id: userId,
      email: QA_EMAIL,
      first_name: 'QA',
      last_name: 'Owner',
      language: 'English',
    },
  });
  console.log('  QA profile: upserted');
}

async function ensureBusiness(userId) {
  const rows = await rest(`businesses?slug=eq.${QA_SLUG}&select=id,owner_id,name,slug`);
  const existing = Array.isArray(rows) ? rows[0] : null;
  if (existing?.id) {
    if (existing.owner_id === SPECIAL_OWNER_ID) {
      fail('QA slug is owned by the protected special owner. Refusing to reassign.');
    }
    if (existing.owner_id && existing.owner_id !== userId) {
      fail('QA slug already exists with a different owner. Refusing to reassign cloned ownership.');
    }
    await rest(`businesses?id=eq.${existing.id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: {
        owner_id: userId,
        name: QA_BIZ_NAME,
        status: 'active',
        plan: 'free',
        modules: ['directory', 'marketplace', 'jobs'],
        email: QA_EMAIL,
        phone: '555-010-0000',
        website: 'https://example.test/biz/mll-qa-test-business',
      },
    });
    await rest(`profiles?id=eq.${userId}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: { business_id: existing.id },
    });
    console.log('  QA business: reused');
    return existing.id;
  }

  const inserted = await rest('businesses?select=id', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      owner_id: userId,
      name: QA_BIZ_NAME,
      slug: QA_SLUG,
      category: 'Professional Services',
      phone: '555-010-0000',
      email: QA_EMAIL,
      website: 'https://example.test/biz/mll-qa-test-business',
      description: 'Synthetic staging-only business for authenticated QA. Not production data.',
      address: '100 Test Ave',
      city: 'Silver Spring',
      state: 'MD',
      zip: '20910',
      country: 'US',
      emoji: '🧪',
      tags: ['qa', 'demo', 'test'],
      plan: 'free',
      modules: ['directory', 'marketplace', 'jobs'],
      status: 'active',
      is_featured: false,
      stripe_customer_id: null,
    },
  });
  const biz = Array.isArray(inserted) ? inserted[0] : inserted;
  if (!biz?.id) fail('QA business insert did not return an id.');
  await rest(`profiles?id=eq.${userId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { business_id: biz.id },
  });
  console.log('  QA business: created');
  return biz.id;
}

async function main() {
  console.log('create-staging-qa-user.mjs');
  console.log('  target: mll-dev');
  console.log('  email:  ' + QA_EMAIL);
  console.log('  passwords and keys are never printed');

  const userId = await ensureQaUser();
  await ensureProfile(userId);
  const bizId = await ensureBusiness(userId);

  console.log('  QA user id: set (not printed)');
  console.log('  QA business slug: ' + QA_SLUG);
  console.log('  QA business id present: ' + Boolean(bizId));
  console.log('  special owner UUID was not modified');
}

main().catch((err) => {
  console.error('\nBLOCKED: ' + (err.message || err) + '\n');
  process.exit(1);
});
