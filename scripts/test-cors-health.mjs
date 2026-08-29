#!/usr/bin/env node
/**
 * CORS allowlist + health API contract tests.
 * Does not call production. Does not print secrets.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0

function assert(label, cond) {
  if (cond) console.log('PASS  ' + label)
  else { failed += 1; console.error('FAIL  ' + label) }
}

const EXACT = new Set([
  'https://mylatinolist.io',
  'https://www.mylatinolist.io',
  'https://staging.mylatinolist.pages.dev',
  'https://dev.mylatinolist.pages.dev',
  'https://mylatinolist-staging.pages.dev',
  'http://localhost:3000',
  'http://localhost:8787',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8787',
])

function resolveCorsOrigin(origin) {
  if (!origin) return null
  if (EXACT.has(origin)) return origin
  try {
    const url = new URL(origin)
    if (url.protocol === 'https:' && url.hostname.endsWith('.mylatinolist-staging.pages.dev')) return origin
  } catch { return null }
  return null
}

assert('Apex origin allowed', resolveCorsOrigin('https://mylatinolist.io') === 'https://mylatinolist.io')
assert('WWW origin allowed', resolveCorsOrigin('https://www.mylatinolist.io') === 'https://www.mylatinolist.io')
assert('Unknown origin rejected', resolveCorsOrigin('https://evil.example') === null)
assert('Null origin rejected', resolveCorsOrigin(null) === null)
assert('Staging pages origin allowed', resolveCorsOrigin('https://mll-v2-dev.mylatinolist-staging.pages.dev') === 'https://mll-v2-dev.mylatinolist-staging.pages.dev')
assert('Localhost preserved', resolveCorsOrigin('http://localhost:3000') === 'http://localhost:3000')

function applyCors(origin) {
  const headers = {}
  const allowed = resolveCorsOrigin(origin)
  if (allowed) {
    headers['Access-Control-Allow-Origin'] = allowed
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
  }
  return headers
}

for (const route of ['/api/businesses', '/api/resources', '/api/auth/me', '/api/health']) {
  const apex = applyCors('https://mylatinolist.io')
  const www = applyCors('https://www.mylatinolist.io')
  const evil = applyCors('https://evil.example')
  assert(`${route} apex CORS`, apex['Access-Control-Allow-Origin'] === 'https://mylatinolist.io')
  assert(`${route} www CORS`, www['Access-Control-Allow-Origin'] === 'https://www.mylatinolist.io')
  assert(`${route} unknown origin omitted`, !evil['Access-Control-Allow-Origin'])
  assert(`${route} allows Authorization`, /Authorization/.test(apex['Access-Control-Allow-Headers']))
}

const cors = readFileSync(join(root, 'workers/src/middleware/cors.ts'), 'utf8')
const index = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')
const health = readFileSync(join(root, 'workers/src/api/health.ts'), 'utf8')
const auth = readFileSync(join(root, 'workers/src/api/auth.ts'), 'utf8')
const dash = readFileSync(join(root, 'frontend/pages/health.html'), 'utf8')

assert('CORS echoes only allowlisted Origin', /resolveCorsOrigin/.test(cors) && /EXACT_ORIGINS/.test(cors))
assert('CORS never defaults to apex for unknown origin', !/headers\.set\('Access-Control-Allow-Origin', 'https:\/\/mylatinolist\.io'\)/.test(cors))
assert('CORS never uses wildcard *', !/Access-Control-Allow-Origin',\s*'\*'/.test(cors) && !/requestOrigin \|\| '\*'/.test(cors))
assert('Worker passes Request into withCors', /withCors\([^)]*request\)/.test(index) && !/withCors\([^)]+,\s*env\)/.test(index))
assert('OPTIONS preflight uses request', /method === 'OPTIONS'[\s\S]*withCors\(new Response\(null, \{ status: 204 \}\), request\)/.test(index))

assert('Public health is liveness only', /status: 'healthy'[\s\S]*timestamp:[\s\S]*version: VERSION/.test(health))
assert('Public health has no stats/MRR payload', !/handleHealth[\s\S]{0,400}cost_estimate/.test(health) || /handleHealth[\s\S]*handleDetailedHealth/.test(health))
assert('Detailed health exists', /export async function handleDetailedHealth/.test(health))
assert('MRR not inferred from plan prices', !/planCounts\.pro \* PRICE_PRO/.test(health) && /mrr_available/.test(health) && /mrr: number \| null/.test(health))
assert('Showcase plan counts are not used as MRR', /mrrAvailable = false/.test(health) && /paid_subscriptions/.test(health))

assert('Admin health route wired', /pathname === '\/api\/admin\/health'/.test(auth) && /handleDetailedHealth\(env\)/.test(auth))
assert('Missing token is 401', /if \(!token\) return Response\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\)/.test(auth))
assert('Invalid token is 401', /userError \|\| !user[\s\S]{0,120}status: 401/.test(auth))
assert('Authenticated non-admin is 403', /!isAdmin\(user\.email\)[\s\S]{0,120}status: 403/.test(auth))

assert('Dashboard calls protected endpoint', /\/api\/admin\/health/.test(dash))
assert('Dashboard sends Authorization header', /Authorization: `Bearer \$\{token\}`/.test(dash))
assert('Dashboard does not fetch public /api/health for details', !/fetch\(`\$\{API\}\/api\/health`\)/.test(dash))
assert('Dashboard uses API timestamp', /data\.timestamp/.test(dash) && /toLocaleString\(\)/.test(dash))
assert('Dashboard shows MRR unavailable', /MRR unavailable/.test(dash) && /No verified paid subscriptions/.test(dash))

if (failed) {
  console.error('cors/health tests FAIL ' + failed)
  process.exit(1)
}
console.log('cors/health tests PASS')
