#!/usr/bin/env node
/**
 * Marketing trial automation Phase A+B: source guards + runtime contract tests.
 * Does not call production/staging. Does not apply migrations. Does not print secrets.
 */
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

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

const autoSrc = readFileSync(join(root, 'workers/src/lib/marketing-trial-automation.ts'), 'utf8')
const trialSrc = readFileSync(join(root, 'workers/src/lib/marketing-trial.ts'), 'utf8')
const pilotSrc = readFileSync(join(root, 'workers/src/lib/marketing-pilot.ts'), 'utf8')
const packSrc = readFileSync(join(root, 'workers/src/lib/customer-marketing-pack.ts'), 'utf8')
const cronSrc = readFileSync(join(root, 'workers/src/cron.ts'), 'utf8')
const indexTs = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')
const ai = readFileSync(join(root, 'workers/src/api/ai-search.ts'), 'utf8')
const wrangler = readFileSync(join(root, 'workers/wrangler.toml'), 'utf8')
const migration = readFileSync(join(root, 'supabase/migrations/010_marketing_trial_automation_events.sql'), 'utf8')
const page = readFileSync(join(root, 'frontend/pages/marketing-growth.html'), 'utf8')

assert('migration proposes automation events table and is marked do not apply', /CREATE TABLE IF NOT EXISTS public\.marketing_trial_automation_events/.test(migration) && /DO NOT APPLY/.test(migration))
assert('migration enables RLS with no client policies', /ENABLE ROW LEVEL SECURITY/.test(migration) && /Intentionally no policies/.test(migration))
assert('migration unique key is business_id + trial_started_at + milestone', /UNIQUE \(business_id, trial_started_at, milestone\)/.test(migration))
assert('migration lists all 9 milestones', /DAY_0_BASELINE/.test(migration) && /DAY_1_ANALYSIS/.test(migration) && /DAY_2_MARKETING_PACK/.test(migration) && /DAY_7_RECOMMENDATIONS/.test(migration) && /DAY_14_MID_TRIAL_REPORT/.test(migration) && /DAY_21_RECOMMENDATIONS/.test(migration) && /DAY_25_UPGRADE_RECOMMENDATION/.test(migration) && /DAY_28_ENDING_REMINDER/.test(migration) && /DAY_30_FINAL_REPORT/.test(migration))
assert('migration status enum includes pending processing completed failed skipped', /pending/.test(migration) && /processing/.test(migration) && /completed/.test(migration) && /failed/.test(migration) && /skipped/.test(migration))
assert('migration has no environment UUIDs', !/f38ce2e6-9dd0-462c-a4fb-fd14a3875648/.test(migration) && !/7e735f46-9dc1-4ecf-936b-7342e566978a/.test(migration))
assert('cron is not connected to automation processor', !/processMarketingTrialAutomation/.test(cronSrc) && !/marketing-trial-automation/.test(cronSrc))
assert('customer UI uses timeline without raw table name', /mg-timeline|renderTimeline/.test(page) && !/marketing_trial_automation/.test(page))
assert('customer UI keeps View Plans billing link', /billing\.html/.test(page))
assert('customer UI keeps language toggle hooks', /data-en=/.test(page) && /data-es=/.test(page))
const pilotApiSrc = readFileSync(join(root, 'workers/src/api/marketing-pilot.ts'), 'utf8')
assert('customer automation GET route exists in pilot API', /\/api\/marketing\/pilot\/automation/.test(pilotApiSrc))
assert('customer automation API does not call processor', !/processMarketingTrialAutomation/.test(pilotApiSrc) && !/ensureAutomationEvents/.test(pilotApiSrc) && !/claimAutomationEvent/.test(pilotApiSrc))
assert('index still does not define processor route', !/processBusinessAutomation/.test(indexTs) && !/processMarketingTrialAutomation/.test(indexTs))
assert('automation flag is separate from pilot flag', /MLL_MARKETING_AUTOMATION_BUSINESS_IDS/.test(autoSrc) === false ? /parseAutomationBusinessIds/.test(autoSrc) : true)
assert('Env declares automation flag', /MLL_MARKETING_AUTOMATION_BUSINESS_IDS\?:/.test(indexTs))
assert('wrangler automation defaults empty in default/production/staging', (() => {
  const all = [...wrangler.matchAll(/MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "([^"]*)"/g)].map((m) => m[1])
  return all.length >= 3 && all.every((v) => v === '')
})())
assert('automation does not fall back to pilot allowlist', !/MLL_MARKETING_PILOT_BUSINESS_IDS/.test(autoSrc))
assert('authoritative clock is marketing_trials.started_at', /from\('marketing_trials'\)/.test(autoSrc) && !/businesses\.created_at/.test(autoSrc) && !/biz\.created_at/.test(autoSrc))
assert('zero AI in automation module', !/env\.AI/.test(autoSrc) && !/runAi/.test(autoSrc) && !/\.AI!/.test(autoSrc) && !/AI\.run/.test(autoSrc) && /ai_calls: 0/.test(autoSrc) && !/generateCustomerMarketingPack/.test(autoSrc))
assert('no pack generation from automation', !/generateCustomerMarketingPack/.test(autoSrc) && !/saveGeneratedPack/.test(autoSrc) && /pack_generated: false/.test(autoSrc))
assert('no Stripe or email from automation', !/stripe/i.test(autoSrc.replace(/stripe_called/g, '')) || /stripe_called: false/.test(autoSrc))
assert('no Resend/sendEmail in automation', !/sendEmail|RESEND|resend/.test(autoSrc))
assert('public AI quotas unchanged', /VISITOR_LIMIT = 3/.test(ai) && /AUTH_LIMIT = 10/.test(ai))
assert('marketing pack limits unchanged', /CUSTOMER_PACK_PILOT_LIMIT = 3/.test(packSrc) && /CUSTOMER_PACK_COOLDOWN_MS = 15_000/.test(packSrc))
assert('max attempts is 5', /AUTOMATION_MAX_ATTEMPTS = 5/.test(autoSrc))
assert('stale reclaim is 30 minutes', /AUTOMATION_STALE_PROCESSING_MS = 30 \* 60 \* 1000/.test(autoSrc))
assert('app source does not hardcode env business UUIDs', !/f38ce2e6-9dd0-462c-a4fb-fd14a3875648/.test(autoSrc) && !/7e735f46-9dc1-4ecf-936b-7342e566978a/.test(autoSrc))

function transpile(src, fileName, rewrite) {
  const emitted = ts.transpileModule(rewrite ? rewrite(src) : src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName,
  })
  return emitted.outputText
}

const tmp = mkdtempSync(join(tmpdir(), 'mll-auto-'))
writeFileSync(join(tmp, 'marketing-trial.mjs'), transpile(trialSrc, 'marketing-trial.ts'))
writeFileSync(
  join(tmp, 'marketing-pilot.mjs'),
  transpile(pilotSrc, 'marketing-pilot.ts', (src) =>
    src.replaceAll("from './marketing-trial'", "from './marketing-trial.mjs'"),
  ),
)
writeFileSync(
  join(tmp, 'customer-marketing-pack.mjs'),
  `export const CUSTOMER_PACK_PILOT_LIMIT = 3\nexport const CUSTOMER_PACK_COOLDOWN_MS = 15000\n`,
)
writeFileSync(
  join(tmp, 'marketing-trial-automation.mjs'),
  transpile(autoSrc, 'marketing-trial-automation.ts', (src) =>
    src
      .replaceAll("from './customer-marketing-pack'", "from './customer-marketing-pack.mjs'")
      .replaceAll("from './marketing-pilot'", "from './marketing-pilot.mjs'")
      .replaceAll("from './marketing-trial'", "from './marketing-trial.mjs'"),
  ),
)

const auto = await import(pathToFileURL(join(tmp, 'marketing-trial-automation.mjs')).href)
const DAY_MS = 24 * 60 * 60 * 1000
const BIZ = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const START = '2026-09-08T00:00:00.000Z'
const END = '2026-10-08T00:00:00.000Z'

assert('exactly 9 milestone definitions', auto.AUTOMATION_MILESTONES.length === 9)
assert('day offsets match required schedule', auto.MILESTONE_DAY_OFFSET.DAY_0_BASELINE === 0 && auto.MILESTONE_DAY_OFFSET.DAY_1_ANALYSIS === 1 && auto.MILESTONE_DAY_OFFSET.DAY_2_MARKETING_PACK === 2 && auto.MILESTONE_DAY_OFFSET.DAY_7_RECOMMENDATIONS === 7 && auto.MILESTONE_DAY_OFFSET.DAY_14_MID_TRIAL_REPORT === 14 && auto.MILESTONE_DAY_OFFSET.DAY_21_RECOMMENDATIONS === 21 && auto.MILESTONE_DAY_OFFSET.DAY_25_UPGRADE_RECOMMENDATION === 25 && auto.MILESTONE_DAY_OFFSET.DAY_28_ENDING_REMINDER === 28 && auto.MILESTONE_DAY_OFFSET.DAY_30_FINAL_REPORT === 30)

for (const m of auto.AUTOMATION_MILESTONES) {
  const scheduled = auto.milestoneScheduledFor(START, m)
  const expected = new Date(Date.parse(START) + auto.MILESTONE_DAY_OFFSET[m] * DAY_MS).toISOString()
  assert('UTC schedule ' + m, scheduled === expected)
}

assert('empty automation allowlist is OFF', auto.parseAutomationBusinessIds('').size === 0 && auto.parseAutomationBusinessIds(null).size === 0)
assert('invalid UUIDs ignored', auto.parseAutomationBusinessIds('not-a-uuid,coastal-maid,' + BIZ).size === 1 && auto.isAutomationBusinessId('not-a-uuid,' + BIZ, BIZ))
assert('exact business isolation', !auto.isAutomationBusinessId(BIZ, OTHER) && auto.isAutomationBusinessId(BIZ, BIZ))
assert('pack limits re-exported unchanged', auto.CUSTOMER_PACK_PILOT_LIMIT === 3 && auto.CUSTOMER_PACK_COOLDOWN_MS === 15000)

function memoryDb(seed = {}) {
  const trials = new Map(Object.entries(seed.trials || {}))
  const businesses = new Map(Object.entries(seed.businesses || {}))
  const packs = new Map(Object.entries(seed.packs || {}))
  const leads = new Map(Object.entries(seed.leads || {}))
  /** @type {Map<string, any>} */
  const events = new Map()

  function eventKey(row) {
    return `${row.business_id}|${row.trial_started_at}|${row.milestone}`
  }

  function matches(row, filters) {
    for (const [col, op, val] of filters) {
      if (op === 'eq' && String(row[col]) !== String(val)) return false
      if (op === 'neq' && String(row[col]) === String(val)) return false
      if (op === 'lte') {
        const a = Date.parse(row[col])
        const b = Date.parse(val)
        if (!(Number.isFinite(a) && Number.isFinite(b) && a <= b)) return false
      }
    }
    return true
  }

  function table(name) {
    const state = {
      filters: [],
      patch: null,
      insertRow: null,
      mode: 'select',
      returning: false,
      countExact: false,
      head: false,
    }
    const api = {
      select(_cols, opts) {
        if (state.mode === 'update') {
          state.returning = true
        } else {
          state.mode = 'select'
        }
        if (opts?.count === 'exact') state.countExact = true
        if (opts?.head) state.head = true
        return api
      },
      insert(row) {
        state.mode = 'insert'
        state.insertRow = row
        return api
      },
      update(patch) {
        state.mode = 'update'
        state.patch = patch
        return api
      },
      eq(col, val) {
        state.filters.push([col, 'eq', val])
        return api
      },
      neq(col, val) {
        state.filters.push([col, 'neq', val])
        return api
      },
      lte(col, val) {
        state.filters.push([col, 'lte', val])
        return api
      },
      async maybeSingle() {
        if (name === 'marketing_trials') {
          const id = state.filters.find((f) => f[0] === 'business_id')?.[2]
          return { data: trials.get(id) || null, error: null }
        }
        if (name === 'businesses') {
          const id = state.filters.find((f) => f[0] === 'business_id' || f[0] === 'id')?.[2]
          return { data: businesses.get(id) || null, error: null }
        }
        if (name === 'customer_marketing_packs') {
          const id = state.filters.find((f) => f[0] === 'business_id')?.[2]
          return { data: packs.get(id) || null, error: null }
        }
        if (name === auto.AUTOMATION_EVENT_TABLE) {
          if (state.mode === 'update') {
            const rows = [...events.values()].filter((r) => matches(r, state.filters))
            if (!rows.length) return { data: null, error: null }
            const row = rows[0]
            Object.assign(row, state.patch)
            events.set(row.id, row)
            return { data: { ...row }, error: null }
          }
          const rows = [...events.values()].filter((r) => matches(r, state.filters))
          return { data: rows[0] ? { ...rows[0] } : null, error: null }
        }
        return { data: null, error: null }
      },
      async then(resolve, reject) {
        try {
          if (name === 'leads' && state.countExact) {
            const id = state.filters.find((f) => f[0] === 'business_id')?.[2]
            resolve({ count: leads.get(id) || 0, error: null, data: null })
            return
          }
          if (name === auto.AUTOMATION_EVENT_TABLE && state.mode === 'insert') {
            const row = {
              id: randomUUID(),
              executed_at: null,
              attempt_count: 0,
              last_error: null,
              result: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...state.insertRow,
            }
            const key = eventKey(row)
            if ([...events.values()].some((e) => eventKey(e) === key)) {
              resolve({ data: null, error: { code: '23505' } })
              return
            }
            events.set(row.id, row)
            resolve({ data: row, error: null })
            return
          }
          if (name === auto.AUTOMATION_EVENT_TABLE && state.mode === 'update') {
            const rows = [...events.values()].filter((r) => matches(r, state.filters))
            for (const row of rows) Object.assign(row, state.patch)
            resolve({ data: rows.map((r) => ({ ...r })), error: null })
            return
          }
          if (name === auto.AUTOMATION_EVENT_TABLE) {
            const rows = [...events.values()].filter((r) => matches(r, state.filters))
            resolve({ data: rows.map((r) => ({ ...r })), error: null })
            return
          }
          resolve({ data: null, error: null })
        } catch (err) {
          reject(err)
        }
      },
    }
    return api
  }

  return {
    events,
    from(name) {
      return table(name)
    },
  }
}

const sampleBiz = {
  id: BIZ,
  name: 'QA Cafe',
  slug: 'qa-cafe',
  category: 'Restaurant',
  description: 'A short description that is long enough for the footprint check.',
  website: 'https://example.com',
  phone: '2025550100',
  email: 'qa@example.com',
  address: '1 Main St',
  city: 'Miami',
  state: 'FL',
  zip: '33101',
  tags: ['food'],
  social_links: { facebook: 'https://facebook.com/qa' },
  plan: 'free',
  status: 'active',
}

const incompleteBiz = {
  ...sampleBiz,
  description: '',
  website: null,
  phone: null,
  city: null,
  state: null,
  social_links: null,
}

// Deterministic milestone payloads
const snap0 = auto.buildTrialStateSnapshot({
  business: incompleteBiz,
  trial: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' },
  pack: { packs_generated: 0, content_copy_events: 0, last_pack_generated_at: null },
  leadCount: 2,
  now: Date.parse('2026-09-08T12:00:00.000Z'),
})
assert('Day 0 snapshot has result_version 1', snap0.result_version === 1)
assert('Day 0 captures trustworthy listing flags', snap0.listing.description_present === false && snap0.listing.website_present === false)
assert('Day 0 includes pack and lead counters', snap0.packs_generated === 0 && snap0.listing_leads === 2)

const day1 = auto.buildMilestoneResult('DAY_1_ANALYSIS', snap0, null)
assert('Day 1 recommends only missing items', day1.missing_items.length > 0 && day1.top_actions.length > 0 && day1.ai_calls === 0)
const day1Complete = auto.buildMilestoneResult(
  'DAY_1_ANALYSIS',
  auto.buildTrialStateSnapshot({
    business: sampleBiz,
    trial: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' },
    pack: { packs_generated: 0, content_copy_events: 0, last_pack_generated_at: null },
    leadCount: 0,
    now: Date.parse('2026-09-09T12:00:00.000Z'),
  }),
  null,
)
assert('Day 1 does not recommend present fields as missing', !day1Complete.missing_items.includes('Website') && !day1Complete.missing_items.includes('Phone') && day1Complete.completed_items.includes('Website'))

const day2 = auto.buildMilestoneResult('DAY_2_MARKETING_PACK', snap0, null)
assert('Day 2 does not generate pack', day2.pack_generated === false && day2.marketing_pack_available === true && day2.packs_remaining === 3)
assert('Day 2 leaves pack counters unchanged conceptually', day2.packs_generated === 0 && day2.pack_limit === 3)

const improved = auto.buildTrialStateSnapshot({
  business: sampleBiz,
  trial: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' },
  pack: { packs_generated: 1, content_copy_events: 4, last_pack_generated_at: '2026-09-10T00:00:00.000Z' },
  leadCount: 3,
  now: Date.parse('2026-09-15T12:00:00.000Z'),
})
const day7 = auto.buildMilestoneResult('DAY_7_RECOMMENDATIONS', improved, snap0)
assert('Day 7 diffs against baseline', Array.isArray(day7.improvements_completed) && day7.improvements_completed.length > 0 && day7.ai_calls === 0)

const day14 = auto.buildMilestoneResult('DAY_14_MID_TRIAL_REPORT', improved, snap0)
assert('Day 14 report has score_change without ROI', typeof day14.score_change === 'number' && day14.roi_claimed === false && day14.causality_claimed === false)

const day21 = auto.buildMilestoneResult('DAY_21_RECOMMENDATIONS', improved, snap0)
assert('Day 21 recommendations deterministic', day21.kind === 'recommendations' && day21.ai_calls === 0)

const day25 = auto.buildMilestoneResult('DAY_25_UPGRADE_RECOMMENDATION', improved, snap0)
assert('Day 25 upgrade has no Stripe side effects', day25.view_plans === true && day25.checkout_created === false && day25.charged === false && day25.stripe_called === false)

const day28 = auto.buildMilestoneResult('DAY_28_ENDING_REMINDER', improved, snap0)
assert('Day 28 reminder is dashboard-only no email', day28.email_sent === false && day28.view_plans === true)

const day30 = auto.buildMilestoneResult('DAY_30_FINAL_REPORT', improved, snap0)
assert('Day 30 final report no charge/convert', day30.trial_completed === true && day30.charged === false && day30.converted === false && day30.extended === false && day30.roi_claimed === false)

// Initialization idempotency + processing
{
  const db = memoryDb({
    trials: {
      [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' },
    },
    businesses: { [BIZ]: incompleteBiz },
    packs: { [BIZ]: { packs_generated: 0, content_copy_events: 0, last_pack_generated_at: null } },
    leads: { [BIZ]: 1 },
  })
  const first = await auto.ensureAutomationEvents(db, { business_id: BIZ, started_at: START })
  const second = await auto.ensureAutomationEvents(db, { business_id: BIZ, started_at: START })
  assert('initialization creates 9 events', first.length === 9)
  assert('initialization is idempotent', second.length === 9 && db.events.size === 9)

  const day0 = first.find((e) => e.milestone === 'DAY_0_BASELINE')
  const completedKeep = { ...day0, status: 'completed', result: { keep: true }, attempt_count: 2, executed_at: '2026-09-08T01:00:00.000Z' }
  db.events.set(completedKeep.id, completedKeep)
  const third = await auto.ensureAutomationEvents(db, { business_id: BIZ, started_at: START })
  const kept = third.find((e) => e.milestone === 'DAY_0_BASELINE')
  assert('ensure does not reset completed events', kept.status === 'completed' && kept.attempt_count === 2 && kept.result?.keep === true && kept.executed_at === '2026-09-08T01:00:00.000Z')
}

// Atomic + concurrent claims
{
  const db = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' } },
    businesses: { [BIZ]: sampleBiz },
    packs: {},
    leads: { [BIZ]: 0 },
  })
  await auto.ensureAutomationEvents(db, { business_id: BIZ, started_at: START })
  const events = [...db.events.values()]
  const target = events.find((e) => e.milestone === 'DAY_0_BASELINE')
  const now = Date.parse('2026-09-08T12:00:00.000Z')
  const a = await auto.claimAutomationEvent(db, target, now)
  const b = await auto.claimAutomationEvent(db, { ...target, status: 'pending', attempt_count: 0 }, now)
  assert('atomic claim succeeds once', a && a.status === 'processing' && a.attempt_count === 1)
  assert('concurrent claim loses race', b === null)

  await auto.completeAutomationEvent(db, a.id, { ok: true }, now)
  const after = db.events.get(a.id)
  assert('completed event immutable via re-claim', (await auto.claimAutomationEvent(db, after, now + DAY_MS)) === null && after.status === 'completed')
}

// Retry increments + attempt 5 terminal + stale reclaim
{
  const db = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' } },
    businesses: { [BIZ]: sampleBiz },
  })
  await auto.ensureAutomationEvents(db, { business_id: BIZ, started_at: START })
  let event = [...db.events.values()].find((e) => e.milestone === 'DAY_1_ANALYSIS')
  const t1 = Date.parse('2026-09-09T12:00:00.000Z')
  for (let i = 1; i <= 5; i++) {
    event = db.events.get(event.id)
    const claimed = await auto.claimAutomationEvent(db, event, t1)
    assert('claim attempt ' + i, claimed && claimed.attempt_count === i)
    await auto.failAutomationEvent(db, claimed, new Error('boom ' + i), t1)
    event = db.events.get(event.id)
    if (i < 5) assert('retryable after fail ' + i, event.status === 'pending' && event.attempt_count === i)
    else assert('attempt 5 terminal failed', event.status === 'failed' && event.attempt_count === 5)
  }
  assert('no further claim after terminal failure', (await auto.claimAutomationEvent(db, db.events.get(event.id), t1)) === null)

  // stale reclaim
  const day2 = [...db.events.values()].find((e) => e.milestone === 'DAY_2_MARKETING_PACK')
  const t2 = Date.parse('2026-09-10T12:00:00.000Z')
  const claimed2 = await auto.claimAutomationEvent(db, day2, t2)
  assert('day2 claimed', !!claimed2)
  const stuck = db.events.get(claimed2.id)
  stuck.updated_at = new Date(t2 - auto.AUTOMATION_STALE_PROCESSING_MS - 1000).toISOString()
  const reclaimed = await auto.claimAutomationEvent(db, stuck, t2 + 1000)
  assert('stale processing reclaimed after 30 minutes', reclaimed && reclaimed.status === 'processing' && reclaimed.attempt_count === 2)
}

// Active process Day 0
{
  const db = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' } },
    businesses: { [BIZ]: incompleteBiz },
    packs: { [BIZ]: { packs_generated: 0, content_copy_events: 0, last_pack_generated_at: null } },
    leads: { [BIZ]: 2 },
  })
  const empty = await auto.processMarketingTrialAutomation(db, '', Date.parse('2026-09-08T12:00:00.000Z'))
  assert('empty allowlist processes nothing', empty.allowlist_size === 0 && empty.results.length === 0)

  const denied = await auto.processBusinessAutomation(db, OTHER, BIZ, Date.parse('2026-09-08T12:00:00.000Z'))
  assert('non-allowlisted business not processed', denied.status === 'not_allowed' && denied.processed === 0)

  const run = await auto.processBusinessAutomation(db, BIZ, BIZ, Date.parse('2026-09-08T12:00:00.000Z'))
  assert('active trial processes Day 0', run.status === 'active' && run.processed === 1)
  const day0 = [...db.events.values()].find((e) => e.milestone === 'DAY_0_BASELINE')
  assert('Day 0 completed with baseline payload', day0.status === 'completed' && day0.result?.kind === 'baseline' && day0.result?.ai_calls === 0 && day0.result?.pack_generated === false)

  const run2 = await auto.processBusinessAutomation(db, BIZ, BIZ, Date.parse('2026-09-08T13:00:00.000Z'))
  assert('second pass does not re-run Day 0', run2.processed === 0 && db.events.get(day0.id).status === 'completed')
}

// Cancelled / converted skip futures
{
  const db = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'cancelled' } },
    businesses: { [BIZ]: sampleBiz },
  })
  await auto.ensureAutomationEvents(db, { business_id: BIZ, started_at: START })
  const day0 = [...db.events.values()].find((e) => e.milestone === 'DAY_0_BASELINE')
  day0.status = 'completed'
  day0.result = { keep: true }
  day0.executed_at = '2026-09-08T01:00:00.000Z'
  const cancelled = await auto.processBusinessAutomation(db, BIZ, BIZ, Date.parse('2026-09-20T12:00:00.000Z'))
  assert('cancelled skips remaining milestones', cancelled.status === 'cancelled')
  assert('cancelled keeps completed Day 0', db.events.get(day0.id).status === 'completed')
  assert('cancelled futures are skipped', [...db.events.values()].filter((e) => e.milestone !== 'DAY_0_BASELINE').every((e) => e.status === 'skipped'))

  const db2 = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'converted' } },
    businesses: { [BIZ]: sampleBiz },
  })
  await auto.ensureAutomationEvents(db2, { business_id: BIZ, started_at: START })
  const converted = await auto.processBusinessAutomation(db2, BIZ, BIZ, Date.parse('2026-09-20T12:00:00.000Z'))
  assert('converted skips remaining and does not run upgrade reminders', converted.status === 'converted' && [...db2.events.values()].every((e) => e.status === 'skipped'))
}

// Expired Day 30
{
  const db = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' } },
    businesses: { [BIZ]: sampleBiz },
    packs: { [BIZ]: { packs_generated: 1, content_copy_events: 2, last_pack_generated_at: null } },
    leads: { [BIZ]: 5 },
  })
  await auto.ensureAutomationEvents(db, { business_id: BIZ, started_at: START })
  // Mark earlier milestones completed with baseline
  const baseline = auto.buildTrialStateSnapshot({
    business: incompleteBiz,
    trial: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' },
    pack: { packs_generated: 0, content_copy_events: 0, last_pack_generated_at: null },
    leadCount: 1,
    now: Date.parse(START),
  })
  for (const e of db.events.values()) {
    if (e.milestone === 'DAY_30_FINAL_REPORT') continue
    e.status = 'completed'
    e.result = e.milestone === 'DAY_0_BASELINE' ? baseline : { ok: true }
    e.executed_at = e.scheduled_for
  }
  const expiredNow = Date.parse('2026-10-08T00:00:00.000Z')
  const run = await auto.processBusinessAutomation(db, BIZ, BIZ, expiredNow)
  assert('expired trial can complete Day 30', run.status === 'expired' && run.processed === 1)
  const final = [...db.events.values()].find((e) => e.milestone === 'DAY_30_FINAL_REPORT')
  assert('Day 30 final report stored', final.status === 'completed' && final.result?.trial_completed === true && final.result?.charged === false && final.result?.ai_calls === 0)
}

assert('eligibility day 2 not due on day 1', !auto.isMilestoneDue(auto.milestoneScheduledFor(START, 'DAY_2_MARKETING_PACK'), Date.parse('2026-09-09T12:00:00.000Z')))
assert('eligibility day 2 due on day 2', auto.isMilestoneDue(auto.milestoneScheduledFor(START, 'DAY_2_MARKETING_PACK'), Date.parse('2026-09-10T00:00:00.000Z')))

if (failed) {
  console.error('marketing trial automation tests FAIL ' + failed)
  process.exit(1)
}
console.log('marketing trial automation tests PASS')
