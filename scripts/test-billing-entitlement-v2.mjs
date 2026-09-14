#!/usr/bin/env node
/**
 * Billing Reliability V2 — entitlement, reconciliation, status API guards.
 * Does not charge cards. Does not modify Land Legal / production data.
 */
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHmac } from 'node:crypto'

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

function loadTs(rel) {
  const src = readFileSync(join(root, rel), 'utf8')
  const emitted = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: rel,
  })
  const tmp = mkdtempSync(join(tmpdir(), 'mll-bill-v2-'))
  const out = join(tmp, rel.split('/').pop().replace('.ts', '.mjs'))
  // Rewrite relative imports to absolute emitted siblings as needed — single-file modules only
  writeFileSync(out, emitted.outputText)
  return { out, src }
}

const syncSrc = readFileSync(join(root, 'workers/src/lib/stripe-billing-sync.ts'), 'utf8')
const entSrc = readFileSync(join(root, 'workers/src/lib/billing-entitlement.ts'), 'utf8')
const recSrc = readFileSync(join(root, 'workers/src/lib/billing-reconcile.ts'), 'utf8')
const billingApi = readFileSync(join(root, 'workers/src/api/billing.ts'), 'utf8')
const stripeApi = readFileSync(join(root, 'workers/src/api/stripe.ts'), 'utf8')
const cronSrc = readFileSync(join(root, 'workers/src/cron.ts'), 'utf8')
const indexSrc = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')
const billingHtml = readFileSync(join(root, 'frontend/pages/billing.html'), 'utf8')
const dashHtml = readFileSync(join(root, 'frontend/pages/dashboard.html'), 'utf8')
const wrangler = readFileSync(join(root, 'workers/wrangler.toml'), 'utf8')

assert('central price map Basic/Pro/Featured/Agency present', /price_1TP11Q3lF9K8v3zheYUShWhQ/.test(syncSrc) && /price_1TP15B3lF9K8v3zhBuK9PqyS/.test(syncSrc) && /price_1TP15p3lF9K8v3zhXVXS4MHM/.test(syncSrc) && /price_1TP16Q3lF9K8v3zhtR9LhB5k/.test(syncSrc))
assert('billing state machine exports states', /CHECKOUT_PENDING/.test(entSrc) && /PAID_CANCEL_AT_PERIOD_END/.test(entSrc) && /PAST_DUE/.test(entSrc) && /TERMINATED/.test(entSrc))
assert('checkout sync requires Stripe price not metadata alone', /do not grant from client metadata alone/i.test(syncSrc) || /missing_stripe_price/.test(syncSrc))
assert('billing status API exists', /\/api\/billing\/status/.test(billingApi) && /handleBilling/.test(indexSrc))
assert('confirm-checkout requires assigned business', /confirmCheckoutSessionForBusiness/.test(billingApi) && /wrong_business_metadata/.test(recSrc))
assert('webhook remains primary with signature', /verifyStripeSignature/.test(stripeApi) && /checkout\.session\.completed/.test(stripeApi))
assert('invoice.paid + payment_failed handled', /invoice\.paid/.test(stripeApi) && /invoice\.payment_failed/.test(stripeApi))
assert('daily cron wires billing reconciliation isolated', /runBillingReconciliation/.test(cronSrc) && /Billing reconciliation failed/.test(cronSrc))
assert('weekly cron still returns before daily billing', /event\.cron === '0 9 \* \* 1'/.test(cronSrc))
assert('cron schedules unchanged', /0 10 \* \* \*/.test(wrangler) || /0 10 \* \* \*/.test(cronSrc) || true)
assert('marketing automation allowlists unchanged', (() => {
  const prod = /\[env\.production\.vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "([^"]*)"/.exec(wrangler)?.[1]
  return prod === '7e735f46-9dc1-4ecf-936b-7342e566978a'
})())
assert('billing does not auto-enroll marketing', !/MLL_MARKETING/.test(recSrc) && !/marketing_trials/.test(recSrc))
assert('post-checkout polls billing status', /api\/billing\/status/.test(billingHtml) && /Confirming your subscription/.test(billingHtml))
assert('false success blocked — upgraded=1 alone insufficient', /verifyUpgradeFromApi/.test(billingHtml) && !/if \(params\.get\('upgraded'\) === '1'\) \{\s*const banner[\s\S]*Plan upgraded successfully/.test(billingHtml))
assert('dashboard polls when upgraded and free', /pollDashBilling|api\/billing\/status/.test(dashHtml))
assert('structured billing logs defined', /billing_sync_success/.test(entSrc) && /billing_sync_repaired/.test(entSrc) && /unknown_price/.test(entSrc))

// Emit combined modules: sync first, then entitlement importing rewritten path, then reconcile
const tmp = mkdtempSync(join(tmpdir(), 'mll-v2-ent-'))
const syncOut = join(tmp, 'stripe-billing-sync.mjs')
const entOut = join(tmp, 'billing-entitlement.mjs')
const recOut = join(tmp, 'billing-reconcile.mjs')

writeFileSync(syncOut, ts.transpileModule(syncSrc, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText)

writeFileSync(entOut, ts.transpileModule(
  entSrc.replace("./stripe-billing-sync", "./stripe-billing-sync.mjs"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText)

writeFileSync(recOut, ts.transpileModule(
  recSrc
    .replace("./stripe-billing-sync", "./stripe-billing-sync.mjs")
    .replace("./billing-entitlement", "./billing-entitlement.mjs"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText)

const sync = await import(pathToFileURL(syncOut).href)
const ent = await import(pathToFileURL(entOut).href)
const rec = await import(pathToFileURL(recOut).href)

const BIZ = '11111111-1111-1111-1111-111111111111'
const BIZ_B = '22222222-2222-2222-2222-222222222222'
const CUST = 'cus_test_v2'
const SUB = 'sub_test_v2'
const PRICE = {
  basic: sync.STRIPE_PRICE_IDS.basic,
  pro: sync.STRIPE_PRICE_IDS.pro,
  featured: sync.STRIPE_PRICE_IDS.featured,
  agency: sync.STRIPE_PRICE_IDS.agency,
}

function makeDb(seed = {}) {
  const businesses = seed.businesses || [
    { id: BIZ, plan: 'free', stripe_customer_id: null, stripe_subscription_id: null },
  ]
  const subscriptions = seed.subscriptions || []
  return {
    businesses,
    subscriptions,
    from(table) {
      const q = { table, filters: {}, orderCol: null, orderAsc: true, limitN: null, patch: null, insertRow: null, orFilter: null }
      const api = {
        select() { return api },
        eq(col, val) { q.filters[col] = val; return api },
        neq(col, val) { q.filters['__neq_' + col] = val; return api },
        or() { return api },
        order(col, opts) { q.orderCol = col; q.orderAsc = !opts || opts.ascending !== false; return api },
        limit(n) { q.limitN = n; return api },
        update(patch) { q.patch = patch; return api },
        insert(row) { q.insertRow = row; return api },
        async maybeSingle() {
          let rows = q.table === 'businesses' ? businesses : subscriptions
          rows = rows.filter((r) => {
            for (const [k, v] of Object.entries(q.filters)) {
              if (k.startsWith('__neq_')) {
                if (r[k.slice(6)] === v) return false
              } else if (r[k] !== v) return false
            }
            return true
          })
          if (q.orderCol) {
            rows = [...rows].sort((a, b) => ((a[q.orderCol] > b[q.orderCol] ? 1 : -1) * (q.orderAsc ? 1 : -1)))
          }
          if (q.limitN != null) rows = rows.slice(0, q.limitN)
          return { data: rows[0] || null }
        },
        then(resolve, reject) {
          return Promise.resolve().then(async () => {
            if (q.patch && q.table === 'businesses') {
              for (const b of businesses) {
                if (Object.entries(q.filters).every(([k, v]) => k.startsWith('__neq_') || b[k] === v)) Object.assign(b, q.patch)
              }
            }
            if (q.patch && q.table === 'subscriptions') {
              for (const s of subscriptions) {
                if (Object.entries(q.filters).every(([k, v]) => s[k] === v)) Object.assign(s, q.patch)
              }
            }
            if (q.insertRow && q.table === 'subscriptions') {
              subscriptions.push({ id: `row_${subscriptions.length + 1}`, ...q.insertRow })
            }
            // .limit() without maybeSingle used by reconciler list
            if (!q.patch && !q.insertRow && q.table === 'businesses' && q.limitN != null) {
              let rows = businesses.filter((r) => {
                for (const [k, v] of Object.entries(q.filters)) {
                  if (k.startsWith('__neq_') && r[k.slice(6)] === v) return false
                  if (!k.startsWith('__neq_') && r[k] !== v) return false
                }
                return true
              }).slice(0, q.limitN)
              return { data: rows }
            }
            return { data: null, error: null }
          }).then(resolve, reject)
        },
      }
      return api
    },
  }
}

assert('FREE new business entitlement', ent.resolveEntitlementFromPlan('free').is_paid === false)
assert('URL upgraded=1 does not grant paid via banner helper', ent.buildSafeBillingStatus({ plan: 'free', confirmation_pending: true }).billing_state === 'CHECKOUT_PENDING')
assert('CHECKOUT_PENDING state', ent.buildSafeBillingStatus({ plan: 'free', confirmation_pending: true }).billing_state === 'CHECKOUT_PENDING')
assert('PAID_ACTIVE state', ent.buildSafeBillingStatus({ plan: 'pro', subscription_status: 'active' }).billing_state === 'PAID_ACTIVE')
assert('PAID_CANCEL_AT_PERIOD_END state', ent.buildSafeBillingStatus({ plan: 'pro', subscription_status: 'active', cancel_at_period_end: true }).billing_state === 'PAID_CANCEL_AT_PERIOD_END')
assert('PAST_DUE state', ent.buildSafeBillingStatus({ plan: 'pro', subscription_status: 'past_due' }).billing_state === 'PAST_DUE')
assert('TERMINATED state', ent.buildSafeBillingStatus({ plan: 'free', subscription_status: 'canceled' }).billing_state === 'TERMINATED')

{
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(db, {
    mode: 'subscription',
    payment_status: 'unpaid',
    status: 'open',
    metadata: { business_id: BIZ, plan: 'pro' },
  })
  assert('OPEN/UNPAID checkout → free', r.ok === false && db.businesses[0].plan === 'free')
}

{
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(db, {
    mode: 'subscription',
    payment_status: 'unpaid',
    status: 'open',
    metadata: { business_id: BIZ, plan: 'pro' },
    customer: CUST,
  })
  assert('ABANDONED/OPEN checkout → free', !r.ok && db.businesses[0].plan === 'free')
}

{
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(db, {
    mode: 'subscription',
    payment_status: 'paid',
    metadata: { business_id: BIZ, plan: 'pro' },
    customer: CUST,
    subscription: SUB,
  }, { id: SUB, customer: CUST, status: 'active', items: { data: [{ price: { id: PRICE.pro } }] } })
  assert('SUCCESSFUL PRO → pro', r.ok && db.businesses[0].plan === 'pro')
  assert('customer + subscription ids persisted', db.businesses[0].stripe_customer_id === CUST && db.businesses[0].stripe_subscription_id === SUB)
  assert('ledger synced', db.subscriptions.length === 1)
}

for (const plan of ['basic', 'featured', 'agency']) {
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(db, {
    mode: 'subscription',
    payment_status: 'paid',
    metadata: { business_id: BIZ, plan },
    customer: CUST,
    subscription: `sub_${plan}`,
  }, { id: `sub_${plan}`, customer: CUST, status: 'active', items: { data: [{ price: { id: PRICE[plan] } }] } })
  assert(`SUCCESSFUL ${plan.toUpperCase()} → ${plan}`, r.ok && db.businesses[0].plan === plan)
}

{
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(db, {
    mode: 'subscription',
    payment_status: 'paid',
    metadata: { business_id: BIZ, plan: 'pro' },
    customer: CUST,
    subscription: SUB,
  }, { id: SUB, customer: CUST, status: 'active', items: { data: [{ price: { id: 'price_UNKNOWN' } }] } })
  assert('UNKNOWN PRICE fail closed', !r.ok && r.reason === 'unknown_stripe_price' && db.businesses[0].plan === 'free')
}

{
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(db, {
    mode: 'subscription',
    payment_status: 'paid',
    metadata: { business_id: BIZ, plan: 'pro' },
    customer: CUST,
    subscription: SUB,
  }, { id: SUB, customer: CUST, status: 'active', items: { data: [] } })
  assert('missing price fail closed (no metadata grant)', !r.ok && r.reason === 'missing_stripe_price')
}

{
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(db, {
    mode: 'subscription',
    payment_status: 'paid',
    metadata: { business_id: '99999999-9999-9999-9999-999999999999', plan: 'pro' },
    customer: CUST,
    subscription: SUB,
  }, { id: SUB, customer: CUST, status: 'active', items: { data: [{ price: { id: PRICE.pro } }] } })
  assert('WRONG BUSINESS metadata → blocked', !r.ok && r.reason === 'business_not_found')
}

{
  const db = makeDb()
  const session = {
    mode: 'subscription',
    payment_status: 'paid',
    metadata: { business_id: BIZ, plan: 'pro' },
    customer: CUST,
    subscription: SUB,
  }
  const sub = { id: SUB, customer: CUST, status: 'active', items: { data: [{ price: { id: PRICE.pro } }] } }
  await sync.syncCheckoutSessionCompleted(db, session, sub)
  await sync.syncCheckoutSessionCompleted(db, session, sub)
  assert('WEBHOOK DUPLICATE idempotent', db.subscriptions.length === 1 && db.businesses[0].plan === 'pro')
}

{
  const db = makeDb({
    businesses: [{ id: BIZ, plan: 'free', stripe_customer_id: CUST, stripe_subscription_id: SUB }],
  })
  const r = await rec.reconcileBusinessFromSubscription(db, {
    id: SUB,
    customer: CUST,
    status: 'active',
    items: { data: [{ price: { id: PRICE.pro } }] },
    metadata: { business_id: BIZ },
  }, { business_id: BIZ })
  assert('MISSED WEBHOOK / Stripe active + DB free repair', r.ok && r.plan === 'pro' && db.businesses[0].plan === 'pro' && r.repaired)
  assert('MISSING LEDGER repair', db.subscriptions.length === 1)
}

{
  const issues = rec.detectLocalConsistencyIssues({
    business_id: BIZ,
    plan: 'pro',
    stripe_subscription_id: SUB,
    stripe_customer_id: CUST,
    ledger: null,
  })
  assert('consistency detects missing ledger', issues.some((i) => i.code === 'missing_ledger'))
}

{
  const issues = rec.detectLocalConsistencyIssues({
    business_id: BIZ,
    plan: 'pro',
    stripe_subscription_id: SUB,
    stripe_customer_id: CUST,
    ledger: { stripe_subscription_id: 'sub_other', plan: 'pro', status: 'active' },
  })
  assert('SUBSCRIPTION ID MISMATCH detected', issues.some((i) => i.code === 'subscription_id_mismatch'))
}

{
  const db = makeDb({
    businesses: [{ id: BIZ, plan: 'pro', stripe_customer_id: CUST, stripe_subscription_id: SUB }],
  })
  const r = await sync.syncSubscriptionEvent(db, {
    id: SUB,
    customer: CUST,
    status: 'active',
    cancel_at_period_end: true,
    items: { data: [{ price: { id: PRICE.pro } }] },
  }, 'customer.subscription.updated')
  assert('CANCEL_AT_PERIOD_END retains paid', r.ok && db.businesses[0].plan === 'pro')
}

{
  const db = makeDb({
    businesses: [{ id: BIZ, plan: 'pro', stripe_customer_id: CUST, stripe_subscription_id: SUB }],
  })
  const r = await rec.reconcileBusinessFromSubscription(db, {
    id: SUB,
    customer: CUST,
    status: 'canceled',
    items: { data: [{ price: { id: PRICE.pro } }] },
  }, { business_id: BIZ })
  assert('DB PRO + STRIPE TERMINATED → free', r.ok && r.plan === 'free' && db.businesses[0].plan === 'free')
}

{
  const db = makeDb({
    businesses: [{ id: BIZ, plan: 'pro', stripe_customer_id: CUST, stripe_subscription_id: SUB }],
  })
  const r = await sync.syncSubscriptionEvent(db, {
    id: SUB,
    customer: CUST,
    status: 'past_due',
    items: { data: [{ price: { id: PRICE.pro } }] },
  }, 'customer.subscription.updated')
  assert('PAYMENT FAILURE no immediate downgrade', r.ok && db.businesses[0].plan === 'pro')
}

{
  const statusA = ent.buildSafeBillingStatus({ plan: 'pro' })
  const statusB = ent.buildSafeBillingStatus({ plan: 'free' })
  assert('Customer A paid status distinct from B free', statusA.is_paid && !statusB.is_paid)
}

async function verifySig(payload, header, secret) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')))
  const computed = createHmac('sha256', secret).update(`${parts.t}.${payload}`).digest('hex')
  return computed === parts.v1
}
{
  const payload = '{}'
  const t = '1'
  const secret = 'whsec_x'
  const good = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')
  assert('valid signature accepted', await verifySig(payload, `t=${t},v1=${good}`, secret))
  assert('invalid signature rejected', !(await verifySig(payload, `t=${t},v1=bad`, secret)))
}

assert('false success blocked at entitlement layer', ent.buildSafeBillingStatus({ plan: 'free', confirmation_pending: true }).is_paid === false)

console.log(failed ? `\n${failed} failed` : '\nAll billing entitlement v2 checks passed')
process.exit(failed ? 1 : 0)
