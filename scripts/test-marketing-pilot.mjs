#!/usr/bin/env node
/**
 * Marketing & AI Growth pilot authorization guards.
 * Does not call production. Does not print secrets.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0

function assert(label, cond) {
  if (cond) console.log('PASS  ' + label)
  else {
    failed += 1
    console.error('FAIL  ' + label)
  }
}

const lib = readFileSync(join(root, 'workers/src/lib/marketing-pilot.ts'), 'utf8')
const api = readFileSync(join(root, 'workers/src/api/marketing-pilot.ts'), 'utf8')
const auth = readFileSync(join(root, 'workers/src/api/auth.ts'), 'utf8')
const indexTs = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')
const wrangler = readFileSync(join(root, 'workers/wrangler.toml'), 'utf8')
const helper = readFileSync(join(root, 'frontend/js/current-business.js'), 'utf8')
const dash = readFileSync(join(root, 'frontend/pages/dashboard.html'), 'utf8')
const listing = readFileSync(join(root, 'frontend/pages/listing.html'), 'utf8')
const page = readFileSync(join(root, 'frontend/pages/marketing-growth.html'), 'utf8')
const bizPage = readFileSync(join(root, 'frontend/pages/business.html'), 'utf8')
const adminMkt = readFileSync(join(root, 'workers/src/api/marketing.ts'), 'utf8')

function parsePilotBusinessIds(raw) {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const ids = new Set()
  for (const part of String(raw || '').split(',')) {
    const id = part.trim().toLowerCase()
    if (UUID_RE.test(id)) ids.add(id)
  }
  return ids
}

const TEST_ID = '7e735f46-9dc1-4ecf-936b-7342e566978a'
assert('slug is not treated as a pilot id', parsePilotBusinessIds('test-business').size === 0)
assert('UUID flag is accepted', parsePilotBusinessIds(TEST_ID).has(TEST_ID))
assert('mixed slug+uuid keeps only uuid', parsePilotBusinessIds('test-business,' + TEST_ID).has(TEST_ID) && parsePilotBusinessIds('test-business,' + TEST_ID).size === 1)
assert('parser source ignores non-uuid tokens', /UUID_RE/.test(lib) && /Slugs are ignored/.test(lib))
assert('authorization uses assigned business_id and owner_id', /profileRow\?\.business_id/.test(lib) && /\.eq\('owner_id', userId\)/.test(lib))
assert('authorization never reads slug or searchParams', !/searchParams/.test(lib) && !/slug ===/.test(lib) && !/test-business/.test(lib))
assert('pilot API ignores query auth', !/searchParams/.test(api) && !/test-business/.test(api) && /authorizeMarketingPilot/.test(api))
assert('pilot routes require Worker auth first', /path\.startsWith\('\/api\/marketing\/pilot'\)/.test(indexTs) && /withAuth/.test(indexTs))
assert('unauthenticated users cannot reach pilot handler without withAuth', /else if \(path\.startsWith\('\/api\/marketing\/pilot'\)\)/.test(indexTs))
assert('auth/me exposes marketing_pilot.enabled from helper', /marketing_pilot/.test(auth) && /authorizeMarketingPilot/.test(auth) && !/slug === 'test-business'/.test(auth))
assert('production flag is the Test Business UUID not slug', /\[env\.production\.vars\][\s\S]*MLL_MARKETING_PILOT_BUSINESS_IDS = "7e735f46-9dc1-4ecf-936b-7342e566978a"/.test(wrangler) && !/MLL_MARKETING_PILOT_BUSINESS_IDS = "test-business"/.test(wrangler))
assert('staging flag stays empty', /\[env\.staging\.vars\][\s\S]*MLL_MARKETING_PILOT_BUSINESS_IDS = ""/.test(wrangler))
assert('owner nav is injected only when server enabled flag is true', /injectMarketingPilotLink/.test(helper) && /isMarketingPilotEnabled/.test(helper) && /Marketing & AI Growth/.test(helper) && /marketing-growth\.html/.test(helper))
assert('dashboard and listing use server flag not slug', /injectMarketingPilotLink/.test(dash) && /injectMarketingPilotLink/.test(listing) && !/slug === 'test-business'/.test(dash) && !/slug === 'test-business'/.test(listing))
assert('owner page re-checks summary API', /\/api\/marketing\/pilot\/summary/.test(page) && /Marketing &amp; AI Growth/.test(page))
assert('public listing page still loads by slug query', /slug/.test(bizPage) && /api\/businesses/.test(bizPage))
assert('admin command center stays admin-only', /requireAdmin/.test(adminMkt) && /isAdmin\(auth\.email\)/.test(adminMkt))
assert('pilot summary is scoped to authorized business only', /business: \{ id: access\.business\.id, name: access\.business\.name \}/.test(api) && !/from\('businesses'\)[\s\S]*slug/.test(api))

if (failed) {
  console.error('marketing pilot tests FAIL ' + failed)
  process.exit(1)
}
console.log('marketing pilot tests PASS')
