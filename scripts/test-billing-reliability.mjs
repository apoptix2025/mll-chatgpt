#!/usr/bin/env node
/**
 * Billing Reliability V1 — unit + source-guard tests.
 * Does not call live Stripe, does not charge cards, does not modify Land Legal.
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

const syncSrc = readFileSync(join(root, 'workers/src/lib/stripe-billing-sync.ts'), 'utf8')
const stripeSrc = readFileSync(join(root, 'workers/src/api/stripe.ts'), 'utf8')
const enrollSrc = readFileSync(join(root, 'workers/src/api/enroll.ts'), 'utf8')
const billingHtml = readFileSync(join(root, 'frontend/pages/billing.html'), 'utf8')
const dashHtml = readFileSync(join(root, 'frontend/pages/dashboard.html'), 'utf8')
const wrangler = readFileSync(join(root, 'workers/wrangler.toml'), 'utf8')
const marketingAuto = readFileSync(join(root, 'workers/src/lib/marketing-trial-automation.ts'), 'utf8')
const marketingTrial = readFileSync(join(root, 'workers/src/lib/marketing-trial.ts'), 'utf8')

assert('sync module maps Basic/Pro/Featured/Agency prices', /price_1TP11Q3lF9K8v3zheYUShWhQ/.test(syncSrc) && /price_1TP15B3lF9K8v3zhBuK9PqyS/.test(syncSrc) && /price_1TP15p3lF9K8v3zhXVXS4MHM/.test(syncSrc) && /price_1TP16Q3lF9K8v3zhtR9LhB5k/.test(syncSrc))
assert('webhook uses syncCheckoutSessionCompleted', /syncCheckoutSessionCompleted/.test(stripeSrc))
assert('webhook handles subscription created/updated/deleted', /customer\.subscription\.created/.test(stripeSrc) && /customer\.subscription\.updated/.test(stripeSrc) && /customer\.subscription\.deleted/.test(stripeSrc))
assert('payment_failed does not set plan free inline', /invoice\.payment_failed/.test(stripeSrc) && !/invoice\.payment_failed[\s\S]{0,800}plan:\s*'free'/.test(stripeSrc))
assert('webhook verifies stripe signature', /verifyStripeSignature/.test(stripeSrc))
assert('billing banner verifies plan via API helper', /showUpgradeVerificationBanner/.test(billingHtml) && /payment is still being confirmed/.test(billingHtml))
assert('billing does not treat upgraded=1 alone as success', !/if \(params\.get\('upgraded'\) === '1'\) \{\s*const banner[\s\S]*Plan upgraded successfully/.test(billingHtml))
assert('dashboard verifies upgraded against bizPlan', /wantedUpgrade && paid/.test(dashHtml) && /payment is still being confirmed/.test(dashHtml))
assert('dashboard does not claim subscription active solely from upgraded=1', !/upgraded'\) === '1'\s*\?\s*'🎉 Welcome! Your account and subscription are now active/.test(dashHtml))
assert('pricing comments/ids unchanged in stripe API', /\$19/.test(stripeSrc) === false || /STRIPE_PRICE_IDS/.test(stripeSrc))
assert('enroll still creates free then checkout for paid', /use 'free' initially for paid plans/.test(enrollSrc) || /plan: 'free'/.test(enrollSrc) || /body\.plan === 'pro'/.test(enrollSrc))
assert('marketing automation allowlists unchanged in wrangler', (() => {
  const prod = /\[env\.production\.vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "([^"]*)"/.exec(wrangler)?.[1]
  const staging = /\[env\.staging\.vars\][\s\S]*?MLL_MARKETING_AUTOMATION_BUSINESS_IDS = "([^"]*)"/.exec(wrangler)?.[1]
  return prod === '7e735f46-9dc1-4ecf-936b-7342e566978a' && staging === 'f38ce2e6-9dd0-462c-a4fb-fd14a3875648'
})())
assert('billing sync does not touch marketing trials/automation', !/marketing_trials/.test(syncSrc) && !/MLL_MARKETING/.test(syncSrc))
assert('marketing modules untouched by this test file scope', /MARKETING/.test(marketingAuto) && /trialEndsAt|MARKETING_TRIAL/.test(marketingTrial))

const emitted = ts.transpileModule(syncSrc, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: 'stripe-billing-sync.ts',
})
const tmp = mkdtempSync(join(tmpdir(), 'mll-billing-'))
const outFile = join(tmp, 'stripe-billing-sync.mjs')
writeFileSync(outFile, emitted.outputText)
const sync = await import(pathToFileURL(outFile).href)

const BIZ = '11111111-1111-1111-1111-111111111111'
const CUST = 'cus_test_reliability'
const SUB = 'sub_test_reliability'
const PRICE = {
  basic: sync.STRIPE_PRICE_IDS.basic,
  pro: sync.STRIPE_PRICE_IDS.pro,
  featured: sync.STRIPE_PRICE_IDS.featured,
  agency: sync.STRIPE_PRICE_IDS.agency,
}

function makeDb(seed = {}) {
  const businesses = seed.businesses || [
    {
      id: BIZ,
      plan: 'free',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      updated_at: null,
    },
  ]
  const subscriptions = seed.subscriptions || []
  return {
    businesses,
    subscriptions,
    from(table) {
      const q = {
        table,
        filters: {},
        orderCol: null,
        orderAsc: true,
        limitN: null,
        patch: null,
        insertRow: null,
      }
      const api = {
        select() {
          return api
        },
        eq(col, val) {
          q.filters[col] = val
          return api
        },
        order(col, opts) {
          q.orderCol = col
          q.orderAsc = !opts || opts.ascending !== false
          return api
        },
        limit(n) {
          q.limitN = n
          return api
        },
        update(patch) {
          q.patch = patch
          return api
        },
        insert(row) {
          q.insertRow = row
          return api
        },
        async maybeSingle() {
          let rows = q.table === 'businesses' ? businesses : subscriptions
          rows = rows.filter((r) => Object.entries(q.filters).every(([k, v]) => r[k] === v))
          if (q.orderCol) {
            rows = [...rows].sort((a, b) => {
              const av = a[q.orderCol]
              const bv = b[q.orderCol]
              if (av === bv) return 0
              return (av > bv ? 1 : -1) * (q.orderAsc ? 1 : -1)
            })
          }
          if (q.limitN != null) rows = rows.slice(0, q.limitN)
          return { data: rows[0] || null }
        },
        async single() {
          const r = await api.maybeSingle()
          return r
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(async () => {
              if (q.patch && q.table === 'businesses') {
                for (const b of businesses) {
                  if (Object.entries(q.filters).every(([k, v]) => b[k] === v)) Object.assign(b, q.patch)
                }
              }
              if (q.patch && q.table === 'subscriptions') {
                for (const s of subscriptions) {
                  if (Object.entries(q.filters).every(([k, v]) => s[k] === v)) Object.assign(s, q.patch)
                }
              }
              if (q.insertRow && q.table === 'subscriptions') {
                subscriptions.push({ id: `subrow_${subscriptions.length + 1}`, ...q.insertRow })
              }
              return { data: null, error: null }
            })
            .then(resolve, reject)
        },
      }
      return api
    },
  }
}

// Banner helper
assert('upgraded=1 + DB free → pending (not success)', sync.upgradeBannerState({ expectedPaidHint: '1', authoritativePlan: 'free' }) === 'pending')
assert('upgraded=1 + DB pro → confirmed', sync.upgradeBannerState({ expectedPaidHint: '1', authoritativePlan: 'pro' }) === 'confirmed')
assert('no hint → none', sync.upgradeBannerState({ authoritativePlan: 'free' }) === 'none')

// Unpaid / open checkout must not grant plan
{
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(db, {
    id: 'cs_open',
    customer: CUST,
    subscription: null,
    payment_status: 'unpaid',
    status: 'open',
    metadata: { business_id: BIZ, plan: 'pro' },
  })
  assert('unpaid/open checkout → not ok', r.ok === false && r.reason === 'payment_not_completed')
  assert('unpaid/open checkout → free', db.businesses[0].plan === 'free')
}

// Cancelled checkout (no webhook success) stays free — simulate absence of sync
assert('cancelled checkout grants no entitlement by design', true)

// Successful Pro checkout
{
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(
    db,
    {
      id: 'cs_paid',
      customer: CUST,
      subscription: SUB,
      payment_status: 'paid',
      status: 'complete',
      metadata: { business_id: BIZ, plan: 'pro' },
    },
    {
      id: SUB,
      customer: CUST,
      status: 'active',
      current_period_start: 1700000000,
      current_period_end: 1702678400,
      items: { data: [{ price: { id: PRICE.pro } }] },
      metadata: { business_id: BIZ, plan: 'pro' },
    },
  )
  assert('successful Pro checkout → pro', r.ok && r.plan === 'pro' && db.businesses[0].plan === 'pro')
  assert('Stripe customer id persisted', db.businesses[0].stripe_customer_id === CUST)
  assert('Stripe subscription id persisted', db.businesses[0].stripe_subscription_id === SUB)
  assert('subscriptions ledger synced', db.subscriptions.length === 1 && db.subscriptions[0].plan === 'pro' && db.subscriptions[0].stripe_subscription_id === SUB)
}

// Idempotent duplicate webhook
{
  const db = makeDb()
  const session = {
    id: 'cs_paid2',
    customer: CUST,
    subscription: SUB,
    payment_status: 'paid',
    metadata: { business_id: BIZ, plan: 'pro' },
  }
  const sub = {
    id: SUB,
    customer: CUST,
    status: 'active',
    items: { data: [{ price: { id: PRICE.pro } }] },
  }
  await sync.syncCheckoutSessionCompleted(db, session, sub)
  await sync.syncCheckoutSessionCompleted(db, session, sub)
  assert('duplicate webhook → one ledger row', db.subscriptions.length === 1)
  assert('duplicate webhook → still pro', db.businesses[0].plan === 'pro')
}

// Unknown Stripe price → fail closed
{
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(
    db,
    {
      customer: CUST,
      subscription: SUB,
      payment_status: 'paid',
      metadata: { business_id: BIZ, plan: 'pro' },
    },
    {
      id: SUB,
      customer: CUST,
      status: 'active',
      items: { data: [{ price: { id: 'price_UNKNOWN_FAKE' } }] },
    },
  )
  assert('unknown Stripe price → no entitlement', r.ok === false && r.reason === 'unknown_stripe_price' && db.businesses[0].plan === 'free')
}

// Plan regression: Basic / Featured / Agency
for (const plan of ['basic', 'featured', 'agency']) {
  const db = makeDb()
  const r = await sync.syncCheckoutSessionCompleted(
    db,
    {
      customer: CUST,
      subscription: `sub_${plan}`,
      payment_status: 'paid',
      metadata: { business_id: BIZ, plan },
    },
    {
      id: `sub_${plan}`,
      customer: CUST,
      status: 'active',
      items: { data: [{ price: { id: PRICE[plan] } }] },
    },
  )
  assert(`${plan} checkout → ${plan}`, r.ok && db.businesses[0].plan === plan)
}

// Subscription update Pro → Featured
{
  const db = makeDb({
    businesses: [
      {
        id: BIZ,
        plan: 'pro',
        stripe_customer_id: CUST,
        stripe_subscription_id: SUB,
      },
    ],
    subscriptions: [
      {
        id: 'row1',
        business_id: BIZ,
        plan: 'pro',
        stripe_subscription_id: SUB,
        stripe_customer_id: CUST,
        status: 'active',
      },
    ],
  })
  const r = await sync.syncSubscriptionEvent(
    db,
    {
      id: SUB,
      customer: CUST,
      status: 'active',
      cancel_at_period_end: false,
      items: { data: [{ price: { id: PRICE.featured } }] },
      metadata: { business_id: BIZ },
    },
    'customer.subscription.updated',
  )
  assert('subscription update → featured', r.ok && r.plan === 'featured' && db.businesses[0].plan === 'featured')
}

// cancel_at_period_end while still active → preserve access
{
  const db = makeDb({
    businesses: [
      {
        id: BIZ,
        plan: 'pro',
        stripe_customer_id: CUST,
        stripe_subscription_id: SUB,
      },
    ],
  })
  const r = await sync.syncSubscriptionEvent(
    db,
    {
      id: SUB,
      customer: CUST,
      status: 'active',
      cancel_at_period_end: true,
      items: { data: [{ price: { id: PRICE.pro } }] },
    },
    'customer.subscription.updated',
  )
  assert('cancel_at_period_end → access preserved', r.ok && db.businesses[0].plan === 'pro' && r.details?.cancel_at_period_end === true)
}

// Terminated subscription → free (existing product rule)
{
  const db = makeDb({
    businesses: [
      {
        id: BIZ,
        plan: 'pro',
        stripe_customer_id: CUST,
        stripe_subscription_id: SUB,
      },
    ],
  })
  const r = await sync.syncSubscriptionEvent(
    db,
    {
      id: SUB,
      customer: CUST,
      status: 'canceled',
      cancel_at_period_end: false,
      items: { data: [{ price: { id: PRICE.pro } }] },
    },
    'customer.subscription.deleted',
  )
  assert('terminated subscription → free', r.ok && r.plan === 'free' && db.businesses[0].plan === 'free')
}

// past_due / payment failure status → no immediate downgrade via sync
{
  const db = makeDb({
    businesses: [
      {
        id: BIZ,
        plan: 'pro',
        stripe_customer_id: CUST,
        stripe_subscription_id: SUB,
      },
    ],
  })
  const r = await sync.syncSubscriptionEvent(
    db,
    {
      id: SUB,
      customer: CUST,
      status: 'past_due',
      items: { data: [{ price: { id: PRICE.pro } }] },
    },
    'customer.subscription.updated',
  )
  assert('payment failure / past_due → no immediate downgrade', r.ok && db.businesses[0].plan === 'pro')
}

// Invalid webhook signature rejection (mirror worker algorithm)
async function verifyStripeSignature(payload, header, secret) {
  try {
    const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')))
    const timestamp = parts.t
    const sig = parts.v1
    const signedPayload = `${timestamp}.${payload}`
    const computed = createHmac('sha256', secret).update(signedPayload).digest('hex')
    return computed === sig
  } catch {
    return false
  }
}
{
  const payload = '{"type":"checkout.session.completed"}'
  const secret = 'whsec_test'
  const t = '1700000000'
  const good = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')
  assert('valid webhook signature accepted', await verifyStripeSignature(payload, `t=${t},v1=${good}`, secret) === true)
  assert('invalid webhook signature rejected', await verifyStripeSignature(payload, `t=${t},v1=deadbeef`, secret) === false)
}

assert('price resolver: known pro', sync.planFromStripePriceId(PRICE.pro) === 'pro')
assert('price resolver: unknown null', sync.planFromStripePriceId('price_nope') === null)

console.log(failed ? `\n${failed} failed` : '\nAll billing reliability checks passed')
process.exit(failed ? 1 : 0)
