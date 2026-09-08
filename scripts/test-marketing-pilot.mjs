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
const defaultVars = wrangler.split('[env.production.vars]')[0]
const prodVars = (wrangler.split('[env.production.vars]')[1] || '').split('[env.staging')[0]
const stagingVars = wrangler.split('[env.staging.vars]')[1] || ''
const defaultFlag = (defaultVars.match(/MLL_MARKETING_PILOT_BUSINESS_IDS = "([^"]*)"/) || [])[1]
const prodFlag = (prodVars.match(/MLL_MARKETING_PILOT_BUSINESS_IDS = "([^"]*)"/) || [])[1]
const stagingFlag = (stagingVars.match(/MLL_MARKETING_PILOT_BUSINESS_IDS = "([^"]*)"/) || [])[1]
assert('default application flag is empty', defaultFlag === '')
assert('staging flag is the staging QA business UUID', stagingFlag === 'f38ce2e6-9dd0-462c-a4fb-fd14a3875648')
assert('staging flag is not the production Test Business UUID', stagingFlag !== TEST_ID)
assert('production flag is not the staging QA UUID', prodFlag === TEST_ID && !prodVars.includes('f38ce2e6-9dd0-462c-a4fb-fd14a3875648'))
assert('app source does not hardcode environment business UUIDs', !/f38ce2e6-9dd0-462c-a4fb-fd14a3875648/.test(lib + api + auth + indexTs + helper + page) && !/7e735f46-9dc1-4ecf-936b-7342e566978a/.test(lib + api + auth + indexTs + helper + page))
assert('authorization reads MLL_MARKETING_PILOT_BUSINESS_IDS from env', /env\.MLL_MARKETING_PILOT_BUSINESS_IDS/.test(api) && /env\.MLL_MARKETING_PILOT_BUSINESS_IDS/.test(auth) && /MLL_MARKETING_PILOT_BUSINESS_IDS\?:/.test(indexTs))
assert('owner nav is injected only when server enabled flag is true', /injectMarketingPilotLink/.test(helper) && /isMarketingPilotEnabled/.test(helper) && /Marketing & AI Growth/.test(helper) && /marketing-growth\.html/.test(helper))
assert('dashboard and listing use server flag not slug', /injectMarketingPilotLink/.test(dash) && /injectMarketingPilotLink/.test(listing) && !/slug === 'test-business'/.test(dash) && !/slug === 'test-business'/.test(listing))
assert('owner page re-checks summary API', /\/api\/marketing\/pilot\/summary/.test(page) && /Marketing &amp; AI Growth/.test(page))
assert('owner page renders V1 trial score opportunities progress upgrade', /30-Day Free Growth Trial/.test(page) && /Digital Footprint Score/.test(page) && /Growth Opportunities/.test(page) && /30-Day Growth Progress/.test(page) && /Keep Growing After Your Free Trial/.test(page) && /View Plans/.test(page) && /Powered by MLL \+ AP Optix/.test(page))
assert('owner page has no admin pack generator or global MCC metrics', !/Generate weekly pack/.test(page) && !/Business Signups/.test(page) && !/AI Search Activity/.test(page) && !/Marketing Command Center/.test(page))
assert('public listing page still loads by slug query', /slug/.test(bizPage) && /api\/businesses/.test(bizPage))
assert('admin command center stays admin-only', /requireAdmin/.test(adminMkt) && /isAdmin\(auth\.email\)/.test(adminMkt))
assert('pilot summary is scoped to authorized business only', /buildCustomerPilotSummary/.test(api) && /eq\('business_id', access\.business\.id\)/.test(api) && /business: \{ id: biz\.id, name: biz\.name \}/.test(lib))
assert('pilot API ignores query auth', !/searchParams/.test(api))

if (failed) {
  console.error('marketing pilot tests FAIL ' + failed)
  process.exit(1)
}
console.log('marketing pilot tests PASS')
