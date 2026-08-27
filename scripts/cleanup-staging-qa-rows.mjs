#!/usr/bin/env node
/**
 * DEV ONLY — delete synthetic QA CRUD rows from mll-dev.
 * Does not delete the QA business or cloned production-derived rows.
 */

const PROD_REF = 'jhjdhmjkcnjtbojocjam';
const STAGING_REF = 'bjtfrmkhishoadjtpzgg';
const QA_SLUG = 'mll-qa-test-business';

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';

function fail(msg) {
  console.error(`\nBLOCKED: ${msg}\n`);
  process.exit(1);
}

if (!url) fail('Set SUPABASE_URL to mll-dev.');
if (!serviceKey) fail('Set SUPABASE_SERVICE_KEY for mll-dev.');
if (url.includes(PROD_REF)) fail('Refuses to run against production.');
if (!url.includes(STAGING_REF)) fail('SUPABASE_URL is not mll-dev.');

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  Prefer: 'return=minimal',
};

async function del(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { method: 'DELETE', headers });
  if (!res.ok && res.status !== 204) {
    throw new Error(`DELETE ${path} → ${res.status}`);
  }
}

async function getBizId() {
  const res = await fetch(`${url}/rest/v1/businesses?slug=eq.${QA_SLUG}&select=id`, { headers });
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].id : null;
}

async function main() {
  const bizId = await getBizId();
  await del('products?name=eq.' + encodeURIComponent('QA Test Product'));
  await del('jobs?title=eq.' + encodeURIComponent('QA Test Job'));
  if (bizId) {
    await del(`leads?business_id=eq.${bizId}&email=eq.${encodeURIComponent('qa.lead@example.test')}`);
    await del(`reviews?business_id=eq.${bizId}&reviewer_email=eq.${encodeURIComponent('qa.review@example.test')}`);
    await del(`affiliate_enrollments?business_id=eq.${bizId}`);
  }
  console.log('  cleanup: synthetic product/job/lead/review rows removed (QA business kept)');
}

main().catch((err) => {
  console.error('\nBLOCKED: ' + (err.message || err) + '\n');
  process.exit(1);
});
