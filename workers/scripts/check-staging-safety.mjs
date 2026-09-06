import fs from 'node:fs';

const toml = fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
const prodSupabase = (toml.match(/\[env\.production\.vars\][\s\S]*?SUPABASE_URL\s*=\s*\"([^\"]+)\"/) || [])[1];
const stagingSupabase = (toml.match(/\[env\.staging\.vars\][\s\S]*?SUPABASE_URL\s*=\s*\"([^\"]+)\"/) || [])[1];
const prodKv = (toml.match(/\[\[env\.production\.kv_namespaces\]\][\s\S]*?id\s*=\s*\"([^\"]+)\"/) || [])[1];
const stagingKv = (toml.match(/\[\[env\.staging\.kv_namespaces\]\][\s\S]*?id\s*=\s*\"([^\"]+)\"/) || [])[1];
const stagingEnv = (toml.match(/\[env\.staging\.vars\][\s\S]*?ENVIRONMENT\s*=\s*\"([^\"]+)\"/) || [])[1];
const stagingFrontend = (toml.match(/\[env\.staging\.vars\][\s\S]*?FRONTEND_URL\s*=\s*\"([^\"]+)\"/) || [])[1];
const stagingBlock = toml.split('[env.staging]')[1] || '';

const PRODUCTION_SUPABASE = 'https://jhjdhmjkcnjtbojocjam.supabase.co';
const PRODUCTION_KV = '8934635b28204b7eb3b58566bd97af43';
const STAGING_KV = '878fc40235fe4681a940a82a72042481';
const STAGING_R2 = 'mll-media-dev';
const STAGING_FRONTEND = 'https://staging.mylatinolist.pages.dev';

const problems = [];

if (!stagingSupabase) problems.push('Staging SUPABASE_URL is missing.');
if (stagingSupabase === prodSupabase) problems.push('Staging SUPABASE_URL still equals production.');
if (stagingSupabase === PRODUCTION_SUPABASE || (stagingSupabase || '').includes('jhjdhmjkcnjtbojocjam')) {
  problems.push('Staging SUPABASE_URL points at the production Supabase project. STOP.');
}
if (!stagingSupabase || stagingSupabase.includes('...') || stagingSupabase.includes('YOUR-DEV')) {
  problems.push('Staging SUPABASE_URL is still a placeholder.');
}
if (stagingSupabase && !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(stagingSupabase)) {
  problems.push('Staging SUPABASE_URL is not a valid https://<ref>.supabase.co URL.');
}
if (!stagingKv || stagingKv === prodKv || stagingKv === PRODUCTION_KV) {
  problems.push('Staging KV namespace is missing or still equals production.');
}
if (stagingKv && stagingKv !== STAGING_KV) {
  problems.push('Staging KV id is not the dedicated staging namespace.');
}
if (!stagingBlock.includes(`bucket_name = "${STAGING_R2}"`)) {
  problems.push('Staging R2 bucket mll-media-dev is not configured.');
}
if (stagingEnv !== 'staging') problems.push('Staging ENVIRONMENT is not "staging".');
if (stagingFrontend !== STAGING_FRONTEND) {
  problems.push('Staging FRONTEND_URL is not https://staging.mylatinolist.pages.dev.');
}
if (!/(?:^|\n)\[env\.staging\.ai\]/.test(toml)) {
  problems.push('Staging Workers AI binding is missing.');
}
if (!stagingBlock.includes('878fc40235fe4681a940a82a72042481')) {
  problems.push('Staging AI quota KV must remain the dedicated staging namespace.');
}

if (problems.length) {
  console.error('\nBLOCKED: staging is not isolated from production.\n');
  for (const p of problems) console.error(' - ' + p);
  console.error('\nFollow DEV_SETUP.md before deploying staging.\n');
  process.exit(1);
}

console.log('Staging safety check passed.');
console.log('  ENVIRONMENT:  ' + stagingEnv);
console.log('  FRONTEND_URL: ' + stagingFrontend);
console.log('  SESSION_CACHE:' + stagingKv);
console.log('  MEDIA:        ' + STAGING_R2);
console.log('  SUPABASE_URL: ' + stagingSupabase);
