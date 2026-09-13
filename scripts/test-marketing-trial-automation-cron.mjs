#!/usr/bin/env node
/**
 * Phase D: marketing trial automation cron wiring tests.
 * Does not call production/staging live. Does not print secrets.
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

const cronSrc = readFileSync(join(root, 'workers/src/cron.ts'), 'utf8')
const indexTs = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')
const wrangler = readFileSync(join(root, 'workers/wrangler.toml'), 'utf8')
const autoSrc = readFileSync(join(root, 'workers/src/lib/marketing-trial-automation.ts'), 'utf8')

assert('production cron schedules unchanged', /\[env\.production\.triggers\][\s\S]*?crons = \[\s*"0 10 \* \* \*",\s*"0 9 \* \* 1"\s*\]/.test(wrangler))
assert('root/default triggers remain empty', /\[triggers\]\s*\ncrons = \[\]/.test(wrangler))
assert('staging does not add automation cron trigger', !/\[env\.staging\.triggers\]/.test(wrangler))
assert('production automation flag Test-Business-only', /\[env\.production\.vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "7e735f46-9dc1-4ecf-936b-7342e566978a"/.test(wrangler))
assert('staging automation flag QA-only', /\[env\.staging\.vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "f38ce2e6-9dd0-462c-a4fb-fd14a3875648"/.test(wrangler))
assert('default empty; production Test Business; staging QA; no cross-env UUID leak', (() => {
  const prod = /\[env\.production\.vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "([^"]*)"/.exec(wrangler)?.[1]
  const staging = /\[env\.staging\.vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "([^"]*)"/.exec(wrangler)?.[1]
  const defaults = /\[vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "([^"]*)"/.exec(wrangler)?.[1]
  return (
    defaults === '' &&
    prod === '7e735f46-9dc1-4ecf-936b-7342e566978a' &&
    staging === 'f38ce2e6-9dd0-462c-a4fb-fd14a3875648' &&
    !String(prod).includes('f38ce2e6') &&
    !String(staging).includes('7e735f46')
  )
})())

assert('cron imports automation processor', /from '\.\/lib\/marketing-trial-automation'/.test(cronSrc))
assert('daily path calls runMarketingTrialAutomationJob', /runMarketingTrialAutomationJob\(env, supabase\)/.test(cronSrc))
assert('weekly cron early-returns before automation', (() => {
  const weeklyIdx = cronSrc.indexOf("event.cron === '0 9 * * 1'")
  const callIdx = cronSrc.indexOf('await runMarketingTrialAutomationJob(env, supabase)')
  const weeklyReturn = cronSrc.indexOf('return', weeklyIdx)
  return weeklyIdx >= 0 && callIdx > weeklyReturn && weeklyReturn > weeklyIdx
})())
assert('automation not invoked inside weekly branch body', (() => {
  const start = cronSrc.indexOf("event.cron === '0 9 * * 1'")
  const end = cronSrc.indexOf('Daily 10am UTC')
  const weeklyBlock = cronSrc.slice(start, end)
  return !/processMarketingTrialAutomation|runMarketingTrialAutomationJob/.test(weeklyBlock)
})())
assert('automation error is caught/logged', /Marketing trial automation failed:/.test(cronSrc) && /try \{/.test(cronSrc))
assert('automation does not use pilot allowlist fallback', !/MLL_MARKETING_PILOT_BUSINESS_IDS/.test(cronSrc))
assert('index scheduled still delegates to handleScheduled', /handleScheduled\(event, env, ctx\)/.test(indexTs))
assert('empty allowlist processor short-circuits', /if \(!allowlist\.length\) \{\s*return \{ allowlist_size: 0, results: \[\] \}/.test(autoSrc))
assert('processor still zero AI / packs / stripe / email', /ai_calls: 0/.test(autoSrc) && /pack_generated: false/.test(autoSrc) && /stripe_called: false/.test(autoSrc) && !/sendEmail|RESEND/.test(autoSrc))

function transpile(src, fileName, rewrite) {
  const emitted = ts.transpileModule(rewrite ? rewrite(src) : src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName,
  })
  return emitted.outputText
}

const tmp = mkdtempSync(join(tmpdir(), 'mll-auto-cron-'))
const state = {
  processCalls: 0,
  inserts: 0,
  updates: 0,
  aiCalls: 0,
  packGens: 0,
  emails: 0,
  stripe: 0,
  dripStarted: 0,
  weeklyReport: 0,
  weeklyNewsletter: 0,
  throwAutomation: false,
  lastFlag: undefined,
}

writeFileSync(
  join(tmp, 'notify.mjs'),
  `
export async function notifyExpiryWarning() {}
export async function notifyExpired() {}
export async function notifyExpiredAdmin() {}
`,
)

writeFileSync(
  join(tmp, 'marketing-trial-automation.mjs'),
  `
export async function processMarketingTrialAutomation(supabase, flag) {
  globalThis.__MLL_CRON_STATE__.processCalls += 1
  globalThis.__MLL_CRON_STATE__.lastFlag = flag
  if (globalThis.__MLL_CRON_STATE__.throwAutomation) throw new Error('boom-automation')
  const raw = String(flag || '').trim()
  if (!raw) return { allowlist_size: 0, results: [] }
  globalThis.__MLL_CRON_STATE__.inserts += 1
  return { allowlist_size: 1, results: [{ business_id: 'x', processed: 1 }] }
}
`,
)

writeFileSync(
  join(tmp, 'supabase-js.mjs'),
  `
function chain() {
  const api = {
    select() { return api },
    eq() { return api },
    lte() { return api },
    not() { return api },
    in() { return api },
    is() { return api },
    gte() { return api },
    order() { return api },
    limit() { return api },
    single() { return Promise.resolve({ data: null }) },
    update() {
      globalThis.__MLL_CRON_STATE__.updates += 1
      return api
    },
    then(resolve) {
      return Promise.resolve(resolve({ data: [], count: 0 }))
    },
  }
  return api
}
export function createClient() {
  return {
    from() { return chain() },
  }
}
`,
)

writeFileSync(
  join(tmp, 'cron.mjs'),
  transpile(cronSrc, 'cron.ts', (src) =>
    src
      .replaceAll("from '@supabase/supabase-js'", "from './supabase-js.mjs'")
      .replaceAll("from './api/notify'", "from './notify.mjs'")
      .replaceAll("from './lib/marketing-trial-automation'", "from './marketing-trial-automation.mjs'")
      .replace(
        'async function sendDripEmails(env: Env): Promise<void> {',
        'async function sendDripEmails(env: Env): Promise<void> { globalThis.__MLL_CRON_STATE__.dripStarted += 1; return;',
      )
      .replace(
        'async function sendWeeklyNewsletter(env: Env): Promise<void> {',
        'async function sendWeeklyNewsletter(env: Env): Promise<void> { globalThis.__MLL_CRON_STATE__.weeklyNewsletter += 1; return;',
      )
      .replace(
        'async function sendWeeklyReport(env: Env): Promise<void> {',
        'async function sendWeeklyReport(env: Env): Promise<void> { globalThis.__MLL_CRON_STATE__.weeklyReport += 1; return;',
      ),
  ),
)

globalThis.__MLL_CRON_STATE__ = state
const { handleScheduled } = await import(pathToFileURL(join(tmp, 'cron.mjs')).href)

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-service-key',
  MLL_MARKETING_AUTOMATION_BUSINESS_IDS: '',
  RESEND_API_KEY: '',
}
const ctx = { waitUntil(p) { Promise.resolve(p).catch(() => {}) } }

function resetCounters() {
  state.processCalls = 0
  state.inserts = 0
  state.updates = 0
  state.aiCalls = 0
  state.packGens = 0
  state.emails = 0
  state.stripe = 0
  state.dripStarted = 0
  state.weeklyReport = 0
  state.weeklyNewsletter = 0
  state.throwAutomation = false
  state.lastFlag = undefined
}

resetCounters()
await handleScheduled({ cron: '0 10 * * *' }, env, ctx)
assert('daily cron invokes automation processor once', state.processCalls === 1)
assert('daily cron still starts drip job', state.dripStarted === 1)
assert('empty allowlist creates 0 inserts via processor', state.inserts === 0)
assert('empty allowlist AI/pack/email/stripe remain 0', state.aiCalls === 0 && state.packGens === 0 && state.emails === 0 && state.stripe === 0)
assert('daily cron passes automation flag (empty)', state.lastFlag === '')

resetCounters()
await handleScheduled({ cron: '0 9 * * 1' }, env, ctx)
assert('weekly cron does not invoke automation', state.processCalls === 0)
assert('weekly report still runs', state.weeklyReport === 1)
assert('weekly newsletter still runs', state.weeklyNewsletter === 1)

// Monday scenario: weekly then daily = automation once total
resetCounters()
await handleScheduled({ cron: '0 9 * * 1' }, env, ctx)
await handleScheduled({ cron: '0 10 * * *' }, env, ctx)
assert('monday weekly+daily invokes automation once', state.processCalls === 1)
assert('monday still runs weekly jobs', state.weeklyReport === 1 && state.weeklyNewsletter === 1)
assert('monday still runs daily drip', state.dripStarted === 1)

// Error isolation: automation throw does not block already-finished daily work; weekly unaffected
resetCounters()
state.throwAutomation = true
await handleScheduled({ cron: '0 10 * * *' }, env, ctx)
assert('automation error still counts one attempt', state.processCalls === 1)
assert('automation error does not prevent drip start', state.dripStarted === 1)
assert('automation error causes 0 inserts', state.inserts === 0)

resetCounters()
state.throwAutomation = true
await handleScheduled({ cron: '0 9 * * 1' }, env, ctx)
assert('weekly unaffected by automation throw flag', state.processCalls === 0 && state.weeklyReport === 1)

if (failed) {
  console.error('marketing trial automation cron tests FAIL ' + failed)
  process.exit(1)
}
console.log('marketing trial automation cron tests PASS')
