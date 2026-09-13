#!/usr/bin/env node
/**
 * Phase C: customer read-only automation timeline API + UI source guards.
 * Does not call production/staging. Does not apply migrations. Does not print secrets.
 */
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

const viewSrc = readFileSync(join(root, 'workers/src/lib/marketing-trial-automation-view.ts'), 'utf8')
const autoSrc = readFileSync(join(root, 'workers/src/lib/marketing-trial-automation.ts'), 'utf8')
const api = readFileSync(join(root, 'workers/src/api/marketing-pilot.ts'), 'utf8')
const trialSrc = readFileSync(join(root, 'workers/src/lib/marketing-trial.ts'), 'utf8')
const cronSrc = readFileSync(join(root, 'workers/src/cron.ts'), 'utf8')
const indexTs = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')
const page = readFileSync(join(root, 'frontend/pages/marketing-growth.html'), 'utf8')
const wrangler = readFileSync(join(root, 'workers/wrangler.toml'), 'utf8')
const ai = readFileSync(join(root, 'workers/src/api/ai-search.ts'), 'utf8')
const packSrc = readFileSync(join(root, 'workers/src/lib/customer-marketing-pack.ts'), 'utf8')

assert('automation GET route exists', /\/api\/marketing\/pilot\/automation/.test(api))
assert('non-GET methods rejected before mutations', /method !== 'GET'/.test(api) && /Method not allowed/.test(api))
assert('automation POST not defined', !/pilot\/automation' && method === 'POST'/.test(api))
assert('automation uses authorizeMarketingPilot', /authorizeMarketingPilot/.test(api) && /buildCustomerAutomationView/.test(api))
assert('automation never uses searchParams', !/searchParams/.test(api))
assert('automation view is read-only (no ensure/process/claim)', !/ensureAutomationEvents/.test(viewSrc) && !/processBusinessAutomation/.test(viewSrc) && !/claimAutomationEvent/.test(viewSrc) && !/processMarketingTrialAutomation/.test(viewSrc))
assert('automation GET does not call processor', !/processMarketingTrialAutomation/.test(api) && !/ensureAutomationEvents/.test(api) && !/claimAutomationEvent/.test(api))
assert('read-only trial loader exported', /export async function getMarketingTrial/.test(trialSrc))
assert('internal fields stripped', /last_error/.test(viewSrc) && /sanitizeCustomerMilestoneResult/.test(viewSrc) && /attempt_count/.test(viewSrc))
assert('customer labels defined', /Starting Point/.test(viewSrc) && /30-Day Growth Report/.test(viewSrc) && /Week 1 Growth Recommendations/.test(viewSrc))
assert('cron wires daily automation processor', /processMarketingTrialAutomation/.test(cronSrc) && /marketing-trial-automation/.test(cronSrc))
assert('production automation flag empty; staging QA-only', (() => {
  const prod = /\[env\.production\.vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "([^"]*)"/.exec(wrangler)?.[1]
  const staging = /\[env\.staging\.vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "([^"]*)"/.exec(wrangler)?.[1]
  const defaults = /\[vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "([^"]*)"/.exec(wrangler)?.[1]
  return defaults === '' && prod === '' && staging === 'f38ce2e6-9dd0-462c-a4fb-fd14a3875648'
})())
assert('summary includes automation payload', /automation/.test(api) && /buildCustomerAutomationView/.test(api))
assert('UI renders timeline and empty state', /mg-timeline/.test(page) && /renderTimeline/.test(page) && /milestones are completed/.test(page))
assert('UI preserves listing checklist', /Listing checklist/.test(page) && /mg-progress/.test(page))
assert('UI preserves pack and opportunities', /AI Marketing Pack/.test(page) && /Growth Opportunities/.test(page) && /Generate My Marketing Pack/.test(page))
assert('UI has View Plans CTAs', /billing\.html/.test(page) && /View Plans/.test(page))
assert('language toggle preserved', /switchLang/.test(page) && /data-lang="es"/.test(page))
assert('public AI quotas unchanged', /VISITOR_LIMIT = 3/.test(ai) && /AUTH_LIMIT = 10/.test(ai))
assert('pack limits unchanged', /CUSTOMER_PACK_PILOT_LIMIT = 3/.test(packSrc) && /CUSTOMER_PACK_COOLDOWN_MS = 15_000/.test(packSrc))
assert('no env business UUIDs in phase C sources', !/f38ce2e6-9dd0-462c-a4fb-fd14a3875648/.test(viewSrc + api) && !/7e735f46-9dc1-4ecf-936b-7342e566978a/.test(viewSrc + api))

function transpile(src, fileName, rewrite) {
  return ts.transpileModule(rewrite ? rewrite(src) : src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName,
  }).outputText
}

const tmp = mkdtempSync(join(tmpdir(), 'mll-auto-view-'))
writeFileSync(join(tmp, 'marketing-trial.mjs'), transpile(trialSrc, 'marketing-trial.ts'))
writeFileSync(
  join(tmp, 'customer-marketing-pack.mjs'),
  'export const CUSTOMER_PACK_PILOT_LIMIT = 3\nexport const CUSTOMER_PACK_COOLDOWN_MS = 15000\n',
)
writeFileSync(
  join(tmp, 'marketing-pilot.mjs'),
  transpile(readFileSync(join(root, 'workers/src/lib/marketing-pilot.ts'), 'utf8'), 'marketing-pilot.ts', (src) =>
    src.replaceAll("from './marketing-trial'", "from './marketing-trial.mjs'"),
  ),
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
writeFileSync(
  join(tmp, 'marketing-trial-automation-view.mjs'),
  transpile(viewSrc, 'marketing-trial-automation-view.ts', (src) =>
    src
      .replaceAll("from './marketing-trial-automation'", "from './marketing-trial-automation.mjs'")
      .replaceAll("from './marketing-trial'", "from './marketing-trial.mjs'"),
  ),
)

const view = await import(pathToFileURL(join(tmp, 'marketing-trial-automation-view.mjs')).href)
const START = '2026-09-08T00:00:00.000Z'
const END = '2026-10-08T00:00:00.000Z'
const BIZ = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const now = Date.parse('2026-09-15T12:00:00.000Z')

assert('pending future maps to upcoming', view.mapCustomerMilestoneStatus({ status: 'pending', scheduled_for: '2026-09-29T00:00:00.000Z' }, now) === 'upcoming')
assert('pending due maps to available', view.mapCustomerMilestoneStatus({ status: 'pending', scheduled_for: '2026-09-10T00:00:00.000Z' }, now) === 'available')
assert('completed maps to completed', view.mapCustomerMilestoneStatus({ status: 'completed', scheduled_for: START }, now) === 'completed')
assert('processing maps to in_progress', view.mapCustomerMilestoneStatus({ status: 'processing', scheduled_for: START }, now) === 'in_progress')
assert('failed maps to unavailable', view.mapCustomerMilestoneStatus({ status: 'failed', scheduled_for: START }, now) === 'unavailable')
assert('skipped maps to skipped', view.mapCustomerMilestoneStatus({ status: 'skipped', scheduled_for: START }, now) === 'skipped')

const sanitized = view.sanitizeCustomerMilestoneResult('DAY_14_MID_TRIAL_REPORT', {
  result_version: 1,
  baseline_score: 40,
  current_score: 55,
  last_error: 'SECRET boom',
  attempt_count: 3,
  view_plans: false,
})
assert('sanitize removes last_error and attempt_count', sanitized.last_error == null && sanitized.attempt_count == null && sanitized.baseline_score === 40)

function memoryDb(seed) {
  const trials = new Map(Object.entries(seed.trials || {}))
  const events = [...(seed.events || [])]
  return {
    writes: 0,
    from(table) {
      const state = { filters: [], mode: 'select' }
      const api = {
        select() { state.mode = 'select'; return api },
        insert() { this.parent.writes += 1; throw new Error('write_not_allowed') },
        update() { this.parent.writes += 1; throw new Error('write_not_allowed') },
        delete() { this.parent.writes += 1; throw new Error('write_not_allowed') },
        eq(col, val) { state.filters.push([col, val]); return api },
        async maybeSingle() {
          if (table === 'marketing_trials') {
            const id = state.filters.find((f) => f[0] === 'business_id')?.[1]
            return { data: trials.get(id) || null, error: null }
          }
          return { data: null, error: null }
        },
        async then(resolve) {
          if (table === 'marketing_trial_automation_events') {
            const biz = state.filters.find((f) => f[0] === 'business_id')?.[1]
            const started = state.filters.find((f) => f[0] === 'trial_started_at')?.[1]
            const rows = events.filter((e) => e.business_id === biz && e.trial_started_at === started)
            resolve({ data: rows, error: null })
            return
          }
          resolve({ data: null, error: null })
        },
      }
      api.parent = this
      return api
    },
  }
}

{
  const db = memoryDb({ trials: {}, events: [] })
  const empty = await view.buildCustomerAutomationView(db, BIZ, now)
  assert('no trial returns preparation empty state', empty.ready === false && empty.milestones.length === 0 && /ready to begin|appear here/i.test(empty.message || ''))
  assert('empty state causes zero writes', db.writes === 0)
}

{
  const db = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' } },
    events: [],
  })
  const empty = await view.buildCustomerAutomationView(db, BIZ, now)
  assert('trial without events returns honest empty timeline', empty.ready === false && empty.trial_started_at === START && empty.milestones.length === 0)
  assert('no-event load causes zero writes', db.writes === 0)
}

{
  const db = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' } },
    events: [
      {
        id: '1', business_id: BIZ, trial_started_at: START, milestone: 'DAY_0_BASELINE', status: 'completed',
        scheduled_for: START, executed_at: '2026-09-08T12:00:00.000Z', attempt_count: 1, last_error: 'hide-me',
        result: { result_version: 1, kind: 'baseline', score: { total: 42, max: 100 }, last_error: 'nope' },
      },
      {
        id: '2', business_id: BIZ, trial_started_at: START, milestone: 'DAY_7_RECOMMENDATIONS', status: 'pending',
        scheduled_for: '2026-09-15T00:00:00.000Z', executed_at: null, attempt_count: 0, last_error: null, result: null,
      },
      {
        id: '3', business_id: BIZ, trial_started_at: START, milestone: 'DAY_14_MID_TRIAL_REPORT', status: 'pending',
        scheduled_for: '2026-09-22T00:00:00.000Z', executed_at: null, attempt_count: 0, last_error: null, result: null,
      },
      {
        id: '4', business_id: BIZ, trial_started_at: START, milestone: 'DAY_25_UPGRADE_RECOMMENDATION', status: 'failed',
        scheduled_for: '2026-10-03T00:00:00.000Z', executed_at: null, attempt_count: 5, last_error: 'secret', result: null,
      },
      {
        id: '5', business_id: BIZ, trial_started_at: START, milestone: 'DAY_30_FINAL_REPORT', status: 'skipped',
        scheduled_for: END, executed_at: END, attempt_count: 0, last_error: null, result: null,
      },
    ],
  })
  const out = await view.buildCustomerAutomationView(db, BIZ, now)
  assert('ready timeline with events', out.ready === true && out.milestones.length === 9)
  const day0 = out.milestones.find((m) => m.code === 'DAY_0_BASELINE')
  const day7 = out.milestones.find((m) => m.code === 'DAY_7_RECOMMENDATIONS')
  const day14 = out.milestones.find((m) => m.code === 'DAY_14_MID_TRIAL_REPORT')
  const day25 = out.milestones.find((m) => m.code === 'DAY_25_UPGRADE_RECOMMENDATION')
  const day30 = out.milestones.find((m) => m.code === 'DAY_30_FINAL_REPORT')
  assert('labels are customer friendly', day0.label === 'Starting Point' && day7.label === 'Week 1 Growth Recommendations')
  assert('day0 completed and sanitized', day0.status === 'completed' && day0.result && day0.result.last_error == null)
  assert('day7 available when due', day7.status === 'available')
  assert('day14 upcoming when future', day14.status === 'upcoming')
  assert('failed maps unavailable without error text', day25.status === 'unavailable' && day25.result == null)
  assert('skipped preserved', day30.status === 'skipped')
  assert('baseline surfaced', out.baseline && out.baseline.score && out.baseline.score.total === 42)
  assert('current milestone is available day7', out.current_milestone && out.current_milestone.code === 'DAY_7_RECOMMENDATIONS')
  assert('read with events causes zero writes', db.writes === 0)
}

{
  const db = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'cancelled' } },
    events: [{
      id: '1', business_id: BIZ, trial_started_at: START, milestone: 'DAY_0_BASELINE', status: 'completed',
      scheduled_for: START, executed_at: START, attempt_count: 1, last_error: null,
      result: { result_version: 1, kind: 'baseline', score: { total: 10, max: 100 } },
    }],
  })
  const out = await view.buildCustomerAutomationView(db, BIZ, now)
  assert('cancelled trial messaging', out.trial_status === 'cancelled' && /cancelled/i.test(out.message || ''))
}

{
  const db = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'converted' } },
    events: [],
  })
  const out = await view.buildCustomerAutomationView(db, BIZ, Date.parse('2026-09-09T00:00:00.000Z'))
  assert('converted empty timeline still honest', out.trial_status === 'converted' || out.ready === false)
}

{
  const db = memoryDb({
    trials: { [BIZ]: { business_id: BIZ, started_at: START, ends_at: END, status: 'active' } },
    events: [{
      id: '30', business_id: BIZ, trial_started_at: START, milestone: 'DAY_30_FINAL_REPORT', status: 'completed',
      scheduled_for: END, executed_at: END, attempt_count: 1, last_error: null,
      result: { result_version: 1, kind: 'final_report', final_score: 70, baseline_score: 40, score_change: 30, view_plans: true, charged: false },
    }, {
      id: '14', business_id: BIZ, trial_started_at: START, milestone: 'DAY_14_MID_TRIAL_REPORT', status: 'completed',
      scheduled_for: '2026-09-22T00:00:00.000Z', executed_at: '2026-09-22T00:00:00.000Z', attempt_count: 1, last_error: null,
      result: { result_version: 1, kind: 'mid_trial_report', baseline_score: 40, current_score: 55, score_change: 15 },
    }],
  })
  const out = await view.buildCustomerAutomationView(db, BIZ, Date.parse('2026-10-08T00:00:00.000Z'))
  assert('expired/final report available', out.trial_status === 'expired' && out.latest_report && out.latest_report.final_score === 70)
  assert('day14 report retained', out.milestones.find((m) => m.code === 'DAY_14_MID_TRIAL_REPORT').result.current_score === 55)
}

if (failed) {
  console.error('marketing trial automation view tests FAIL ' + failed)
  process.exit(1)
}
console.log('marketing trial automation view tests PASS')
