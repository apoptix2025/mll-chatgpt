import fs from 'node:fs';

const toml = fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
const prodSupabase = (toml.match(/\[env\.production\][\s\S]*?SUPABASE_URL\s*=\s*\"([^\"]+)\"/) || [])[1];
const stagingSupabase = (toml.match(/\[env\.staging\][\s\S]*?SUPABASE_URL\s*=\s*\"([^\"]+)\"/) || [])[1];
const prodKv = (toml.match(/\[\[env\.production\.kv_namespaces\]\][\s\S]*?id\s*=\s*\"([^\"]+)\"/) || [])[1];
const stagingKv = (toml.match(/\[\[env\.staging\.kv_namespaces\]\][\s\S]*?id\s*=\s*\"([^\"]+)\"/) || [])[1];

const problems = [];
if (!stagingSupabase || stagingSupabase === prodSupabase) problems.push('Staging SUPABASE_URL is missing or still equals production.');
if (!stagingKv || stagingKv === prodKv) problems.push('Staging KV namespace is missing or still equals production.');
if (!toml.includes('bucket_name = "mll-media-dev"')) problems.push('Staging R2 bucket mll-media-dev is not configured.');

if (problems.length) {
  console.error('\
BLOCKED: staging is not isolated from production.\
');
  for (const p of problems) console.error(' - ' + p);
  console.error('\
Follow DEV_SETUP.md before deploying staging.\
');
  process.exit(1);
}
console.log('Staging safety check passed.');
