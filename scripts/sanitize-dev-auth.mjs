#!/usr/bin/env node
/**
 * DEV ONLY — rewrite Auth emails on mll-dev after a production-derived clone.
 *
 * Preserves user UUIDs so auth.users → profiles → businesses stay valid.
 * Does NOT delete users. Does NOT run against production.
 *
 * Direct SQL against auth.users is unsafe (identities, tokens, GoTrue cache).
 * This script uses the supported Admin API: PUT /auth/v1/admin/users/:id
 *
 * Required env:
 *   SUPABASE_URL          https://bjtfrmkhishoadjtpzgg.supabase.co
 *   SUPABASE_SERVICE_KEY  mll-dev service role (never commit)
 *
 * After the list pass, also sanitizes the cloned owner UUID
 * 00000000-0000-0000-0000-000000000001 by Admin GET/PUT by id.
 * Does not delete that user, change its UUID, or create an identity.
 */

const PROD_REF = 'jhjdhmjkcnjtbojocjam';
const STAGING_REF = 'bjtfrmkhishoadjtpzgg';
const SPECIAL_OWNER_ID = '00000000-0000-0000-0000-000000000001';
const SPECIAL_OWNER_EMAIL = 'dev+owner-00000001@example.test';

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
const limitRaw = process.env.AUTH_SANITIZE_LIMIT;
const limit = limitRaw ? Number(limitRaw) : Infinity;

function fail(msg) {
  console.error(`\nBLOCKED: ${msg}\n`);
  process.exit(1);
}

if (!url) fail('Set SUPABASE_URL to the mll-dev project URL.');
if (!serviceKey) fail('Set SUPABASE_SERVICE_KEY for mll-dev. Do not paste it into source.');
if (url.includes(PROD_REF)) fail('Refuses to run against production Supabase.');
if (!url.includes(STAGING_REF)) {
  fail(`SUPABASE_URL is not mll-dev. Expected project ref ${STAGING_REF}.`);
}

function shortId(id) {
  return String(id || '').replace(/-/g, '').slice(0, 8);
}

function syntheticEmail(id) {
  return `dev+${shortId(id)}@example.test`;
}

function alreadySynthetic(email) {
  const e = String(email || '').toLowerCase();
  return e.endsWith('@example.test') || e.endsWith('@demo.mylatinolist.io');
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function api(path, options = {}) {
  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message || json?.error_description || json?.msg || text || res.statusText;
    throw new Error(`${options.method || 'GET'} ${path} → ${res.status}: ${msg}`);
  }
  return json;
}

async function getUserById(id) {
  try {
    const json = await api(`/auth/v1/admin/users/${id}`);
    return json?.user || json || null;
  } catch (err) {
    const msg = String(err.message || '');
    if (msg.includes(' → 404:') || msg.includes(' → 404 ')) return null;
    throw err;
  }
}

async function updateUserEmail(id, email) {
  await api(`/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      email,
      email_confirm: true,
    }),
  });
}

async function sanitizeSpecialOwner() {
  const user = await getUserById(SPECIAL_OWNER_ID);
  if (!user?.id) {
    console.log('  special owner: not found via Admin API by id');
    return 'missing';
  }
  if (String(user.email || '').toLowerCase() === SPECIAL_OWNER_EMAIL) {
    console.log('  special owner: already synthetic (uuid preserved)');
    return 'skipped';
  }
  await updateUserEmail(SPECIAL_OWNER_ID, SPECIAL_OWNER_EMAIL);
  console.log('  special owner: email sanitized (uuid preserved, original email not printed)');
  return 'updated';
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

async function main() {
  console.log('sanitize-dev-auth.mjs');
  console.log('  target: mll-dev');
  console.log('  source emails are never printed');

  const users = await listUsers();
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (updated >= limit) break;
    if (!user?.id) {
      skipped += 1;
      continue;
    }
    if (user.id === SPECIAL_OWNER_ID) {
      skipped += 1;
      continue;
    }
    if (alreadySynthetic(user.email)) {
      skipped += 1;
      continue;
    }
    const email = syntheticEmail(user.id);
    try {
      await updateUserEmail(user.id, email);
      updated += 1;
    } catch (err) {
      failed += 1;
      console.error(`  failed user ${shortId(user.id)}: ${err.message}`);
    }
  }

  console.log(`  users scanned: ${users.length}`);
  console.log(`  emails updated: ${updated}`);
  console.log(`  already synthetic / skipped: ${skipped}`);
  console.log(`  failed: ${failed}`);

  let specialStatus = 'error';
  try {
    specialStatus = await sanitizeSpecialOwner();
  } catch (err) {
    failed += 1;
    console.error(`  special owner failed: ${err.message}`);
  }

  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
