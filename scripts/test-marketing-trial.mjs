#!/usr/bin/env node
/**
 * Marketing trial activation: source guards + runtime contract tests.
 * Does not call production. Does not apply migrations. Does not print secrets.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'workers/package.json'))
const ts = require('typescript')

let failed = 0
function assert(label, cond) {
  if (cond) console.log('PASS  ' + label)
  else {
    failed += 1
    console.error('FAIL  ' + label)
  }
}

const trialSrc = readFileSync(join(root, 'workers/src/lib/marketing-trial.ts'), 'utf8')
const lib = readFileSync(join(root, 'workers/src/lib/marketing-pilot.ts'), 'utf8')
const api = readFileSync(join(root, 'workers/src/api/marketing-pilot.ts'), 'utf8')
const auth = readFileSync(join(root, 'workers/src/api/auth.ts'), 'utf8')
const enroll = readFileSync(join(root, 'workers/src/api/enroll.ts'), 'utf8')
const adminMkt = readFileSync(join(root, 'workers/src/api/marketing.ts'), 'utf8')
const ai = readFileSync(join(root, 'workers/src/api/ai-search.ts'), 'utf8')
const page = readFileSync(join(root, 'frontend/pages/marketing-growth.html'), 'utf8')
const migration = readFileSync(join(root, 'supabase/migrations/008_marketing_trials.sql'), 'utf8')
const prodSeed = readFileSync(join(root, 'scripts/seed-production-test-business-marketing-trial.sql'), 'utf8')
const stagingSeed = readFileSync(join(root, 'scripts/seed-staging-qa-marketing-trial.sql'), 'utf8')

assert('trial storage is relational marketing_trials not KV', /from\('marketing_trials'\)/.test(trialSrc) && !/SESSION_CACHE/.test(trialSrc) && !/KVNamespace/.test(trialSrc))
assert('activation is idempotent: load existing before insert', /export async function activateMarketingTrial/.test(trialSrc) && /loadMarketingTrial/.test(trialSrc) && trialSrc.indexOf('loadMarketingTrial') < trialSrc.indexOf('.insert('))
assert('activation never updates or upserts started_at', !/\.update\(/.test(trialSrc) && !/\.upsert\(/.test(trialSrc))
assert('trial clock does not use listing or account created_at', !/buildTrial\(/.test(lib) && !/biz\.created_at/.test(lib) && !/Date\.parse\(createdAt/.test(trialSrc + lib) && !/\.select\([^)]*created_at/.test(trialSrc))
assert('summary uses server trial view not listing age', /activateMarketingTrial/.test(api) && /presentMarketingTrial/.test(api) && /buildCustomerPilotSummary\(/.test(api))
assert('customer summary is GET-only', /request\.method !== 'GET'/.test(api) && !/request\.json/.test(api) && !/started_at =/.test(api))
assert('login does not activate trial', !/activateMarketingTrial/.test(auth))
assert('enroll does not auto-enroll marketing trial', !/activateMarketingTrial/.test(enroll))
assert('admin Command Center stays admin-only', /requireAdmin/.test(adminMkt) && /isAdmin\(auth\.email\)/.test(adminMkt))
assert('public AI quotas unchanged', /VISITOR_LIMIT = 3/.test(ai) && /AUTH_LIMIT = 10/.test(ai))
assert('API returns started_at ends_at days_remaining', /started_at: row\.started_at/.test(trialSrc) && /ends_at: row\.ends_at/.test(trialSrc) && /days_remaining/.test(trialSrc))
assert('days remaining derived from ends_at not hardcoded 30', /daysRemainingFromEnd\(row\.ends_at/.test(trialSrc) && /Math\.ceil\(\(endMs - now\) \/ DAY_MS\)/.test(trialSrc))
assert('UI displays server trial fields', /trial\.started_at/.test(page) && /trial\.ends_at/.test(page) && /trial\.days_remaining/.test(page))
assert('UI does not compute trial from created_at or Date.now', !/created_at/.test(page) && !/Date\.now\(\)/.test(page))
assert('expired UI can show Trial Complete', /Trial Complete/.test(page))
assert('customer cannot submit trial dates', !/<input/.test(page) && !/method:\s*['"]POST['"]/.test(page))
assert('View Plans CTA remains', /View Plans/.test(page))
assert('migration proposes marketing_trials and is marked do not apply', /CREATE TABLE IF NOT EXISTS public\.marketing_trials/.test(migration) && /DO NOT APPLY/.test(migration) && /ENABLE ROW LEVEL SECURITY/.test(migration))
assert('migration does not overload businesses.created_at', !/ALTER TABLE.*businesses/.test(migration) && /started_at/.test(migration) && /ends_at/.test(migration) && /status/.test(migration))
assert('production seed is unapplied and idempotent', /DO NOT RUN/.test(prodSeed) && /ON CONFLICT \(business_id\) DO NOTHING/.test(prodSeed) && /2026-09-08/.test(prodSeed) && /7e735f46-9dc1-4ecf-936b-7342e566978a/.test(prodSeed))
assert('staging seed uses staging UUID and NOW()', /f38ce2e6-9dd0-462c-a4fb-fd14a3875648/.test(stagingSeed) && /NOW\(\)/.test(stagingSeed) && /Do NOT run against production/.test(stagingSeed) && !/7e735f46-9dc1-4ecf-936b-7342e566978a/.test(stagingSeed))
assert('worker source does not hardcode production or staging business UUIDs', !/7e735f46-9dc1-4ecf-936b-7342e566978a/.test(trialSrc + lib + api) && !/f38ce2e6-9dd0-462c-a4fb-fd14a3875648/.test(trialSrc + lib + api))

const emitted = ts.transpileModule(trialSrc, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: 'marketing-trial.ts',
})
const tmp = mkdtempSync(join(tmpdir(), 'mll-trial-'))
const outFile = join(tmp, 'marketing-trial.mjs')
writeFileSync(outFile, emitted.outputText)
const trial = await import(pathToFileURL(outFile).href)

const DAY_MS = 24 * 60 * 60 * 1000
const start = Date.parse('2026-09-08T00:00:00.000Z')
const end = trial.trialEndsAt(start)
assert('30-day end from Sep 8 is Oct 8', new Date(end).toISOString() === '2026-10-08T00:00:00.000Z')
assert('duration constant is 30 days in ms only for writing ends_at', trial.MARKETING_TRIAL_DURATION_MS === 30 * DAY_MS)

const nowSep9 = Date.parse('2026-09-09T12:00:00.000Z')
const view = trial.presentMarketingTrial({
  business_id: '00000000-0000-0000-0000-000000000001',
  started_at: '2026-09-08T00:00:00.000Z',
  ends_at: '2026-10-08T00:00:00.000Z',
  status: 'active',
}, nowSep9)
assert('active trial reports started_at from storage', view.started_at === '2026-09-08T00:00:00.000Z')
assert('active trial reports ends_at from storage', view.ends_at === '2026-10-08T00:00:00.000Z')
assert('days remaining derived from ends_at', view.days_remaining === Math.ceil((Date.parse('2026-10-08T00:00:00.000Z') - nowSep9) / DAY_MS))
assert('days remaining is not hardcoded 30', view.days_remaining !== 30 || nowSep9 === start)

const expired = trial.presentMarketingTrial({
  business_id: '00000000-0000-0000-0000-000000000001',
  started_at: '2026-09-08T00:00:00.000Z',
  ends_at: '2026-10-08T00:00:00.000Z',
  status: 'active',
}, Date.parse('2026-10-08T00:00:00.000Z'))
assert('expired when now >= ends_at', expired.status === 'expired' && expired.days_remaining === 0)

const cancelled = trial.presentMarketingTrial({
  business_id: '00000000-0000-0000-0000-000000000001',
  started_at: '2026-09-08T00:00:00.000Z',
  ends_at: '2026-10-08T00:00:00.000Z',
  status: 'cancelled',
}, nowSep9)
assert('stored cancelled wins over clock', cancelled.status === 'cancelled' && cancelled.days_remaining === 0)

function memoryTrials() {
  const rows = new Map()
  let inserts = 0
  return {
    rows,
    get inserts() { return inserts },
    from(table) {
      if (table !== 'marketing_trials') throw new Error('unexpected table ' + table)
      const ctx = { id: '' }
      return {
        select() { return this },
        eq(_col, value) { ctx.id = value; return this },
        async maybeSingle() {
          return { data: rows.get(ctx.id) || null, error: null }
        },
        async insert(row) {
          inserts += 1
          if (rows.has(row.business_id)) return { error: { code: '23505' } }
          rows.set(row.business_id, { ...row })
          return { error: null }
        },
        update() { throw new Error('trial activation must not update') },
      }
    },
  }
}

const biz = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const t0 = Date.parse('2026-09-08T15:00:00.000Z')
const store = memoryTrials()
const first = await trial.activateMarketingTrial(store, biz, t0)
const second = await trial.activateMarketingTrial(store, biz, t0 + DAY_MS)
const refresh = await trial.activateMarketingTrial(store, biz, t0 + 2 * DAY_MS)
const login = await trial.activateMarketingTrial(store, biz, t0 + 3 * DAY_MS)
const deploy = await trial.activateMarketingTrial(store, biz, t0 + 4 * DAY_MS)
assert('first activation creates trial timestamp', first.started_at === new Date(t0).toISOString() && first.ends_at === new Date(trial.trialEndsAt(t0)).toISOString())
assert('second activation does not change timestamp', second.started_at === first.started_at && second.ends_at === first.ends_at)
assert('page refresh preserves start', refresh.started_at === first.started_at)
assert('login preserves start', login.started_at === first.started_at)
assert('deploy/restart preserves start', deploy.started_at === first.started_at)
assert('unique insert conflict does not restart trial', store.inserts === 1 && store.rows.size === 1)

const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const otherRow = await trial.activateMarketingTrial(store, other, t0 + 10 * DAY_MS)
assert('another business gets its own trial', otherRow.started_at !== first.started_at && store.rows.size === 2)

const missing = {
  from() {
    return {
      select() { return this },
      eq() { return this },
      async maybeSingle() { return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.marketing_trials' in the schema cache" } } },
      async insert() { return { error: { code: 'PGRST205' } } },
    }
  },
}
let threw = false
try {
  await trial.activateMarketingTrial(missing, biz, t0)
} catch (err) {
  threw = err instanceof trial.MarketingTrialStorageError && err.code === 'unavailable'
}
assert('missing table does not fall back to created_at', threw)

if (failed) {
  console.error('marketing trial tests FAIL ' + failed)
  process.exit(1)
}
console.log('marketing trial tests PASS')
