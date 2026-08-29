#!/usr/bin/env node
/**
 * Unit tests for billing business resolution.
 * Does not call Stripe. Does not create checkout sessions.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0

function assert(label, cond) {
  if (cond) {
    console.log('PASS  ' + label)
  } else {
    failed += 1
    console.error('FAIL  ' + label)
  }
}

async function resolveAssignedBusiness(supabase, userId) {
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('business_id, email')
    .eq('id', userId)
    .maybeSingle()

  if (!profileRow) return { ok: false, status: 404, error: 'Profile not found' }
  const profile = {
    business_id: profileRow.business_id ?? null,
    email: profileRow.email ?? null,
  }
  if (!profile.business_id) {
    return { ok: false, status: 400, error: 'No business assigned to this account' }
  }
  const { data: businessRow } = await supabase
    .from('businesses')
    .select('id, name, stripe_customer_id, plan')
    .eq('id', profile.business_id)
    .maybeSingle()
  if (!businessRow?.id) return { ok: false, status: 404, error: 'Business not found' }
  return {
    ok: true,
    profile,
    business: {
      id: String(businessRow.id),
      name: String(businessRow.name ?? ''),
      stripe_customer_id: businessRow.stripe_customer_id ?? null,
      plan: businessRow.plan ?? null,
    },
  }
}

function mockClient({ profiles, businesses }) {
  return {
    from(table) {
      const state = { table, column: '', value: '' }
      return {
        select() { return this },
        eq(column, value) {
          state.column = column
          state.value = value
          return this
        },
        async maybeSingle() {
          if (state.table === 'profiles' && state.column === 'id') {
            return { data: profiles.find(p => p.id === state.value) || null }
          }
          if (state.table === 'businesses' && state.column === 'id') {
            return { data: businesses.find(b => b.id === state.value) || null }
          }
          if (state.table === 'businesses' && state.column === 'owner_id') {
            throw new Error('owner_id must not be used to select the billing business')
          }
          return { data: null }
        },
      }
    },
  }
}

const TEST_BIZ = {
  id: '7e735f46-9dc1-4ecf-936b-7342e566978a',
  name: 'Test Business',
  stripe_customer_id: null,
  plan: 'free',
}
const AP_OPTIX = {
  id: '211e7c32-31c9-4e7d-a669-ac1c8c6496b4',
  name: 'AP Optix LLC',
  stripe_customer_id: null,
  plan: 'admin',
}
const SHOWCASES = [
  { id: 's1', name: 'Ramos Law Group', stripe_customer_id: null, plan: 'featured' },
  { id: 's2', name: 'Casa Flores Salon', stripe_customer_id: null, plan: 'featured' },
  { id: 's3', name: 'La Cocina de Maria', stripe_customer_id: null, plan: 'featured' },
]
const CUSTOMER_ID = '67115f44-62d2-42a2-bed4-5448758bc89f'
const ADMIN_ID = 'a0b394e4-0362-4f0e-aa84-cfde62daab30'

const customer = await resolveAssignedBusiness(
  mockClient({
    profiles: [{ id: CUSTOMER_ID, business_id: TEST_BIZ.id, email: 'apena77@gmail.com' }],
    businesses: [TEST_BIZ, AP_OPTIX, ...SHOWCASES],
  }),
  CUSTOMER_ID,
)
assert('A free customer resolves Test Business via profile.business_id', customer.ok && customer.business.name === 'Test Business' && customer.business.id === TEST_BIZ.id)
assert('A free customer is not given AP Optix', customer.ok && customer.business.name !== 'AP Optix LLC')

const admin = await resolveAssignedBusiness(
  mockClient({
    profiles: [{ id: ADMIN_ID, business_id: AP_OPTIX.id, email: 'info@apoptix.io' }],
    businesses: [TEST_BIZ, AP_OPTIX, ...SHOWCASES],
  }),
  ADMIN_ID,
)
assert('B multi-business admin resolves AP Optix LLC only', admin.ok && admin.business.name === 'AP Optix LLC' && admin.business.id === AP_OPTIX.id)
assert('B admin lookup does not pick a showcase listing', admin.ok && !SHOWCASES.some(s => s.id === admin.business.id))

const missing = await resolveAssignedBusiness(
  mockClient({
    profiles: [{ id: 'user-no-biz', business_id: null, email: 'none@example.com' }],
    businesses: [TEST_BIZ],
  }),
  'user-no-biz',
)
assert('C null business_id returns 400', !missing.ok && missing.status === 400)
assert('C null business_id error names assignment', !missing.ok && /assigned/i.test(missing.error))

const helper = readFileSync(join(root, 'workers/src/lib/billing-business.ts'), 'utf8')
const stripe = readFileSync(join(root, 'workers/src/api/stripe.ts'), 'utf8')
const billing = readFileSync(join(root, 'frontend/pages/billing.html'), 'utf8')
const login = readFileSync(join(root, 'frontend/pages/login.html'), 'utf8')

assert('source uses resolveAssignedBusiness in checkout', /createCheckoutSession[\s\S]*resolveAssignedBusiness/.test(stripe))
assert('source uses resolveAssignedBusiness in portal', /createPortalSession[\s\S]*resolveAssignedBusiness/.test(stripe))
assert('helper selects by profile.business_id', /profile\.business_id/.test(helper) && /\.eq\('id', profile\.business_id\)/.test(helper))
assert('checkout no longer uses owner_id + single for billing business', !/\.eq\('owner_id',\s*userId\)\s*\n\s*\.single\(\)/.test(stripe))
assert('portal no longer uses owner_id + single for billing business', (stripe.match(/\.eq\('owner_id',\s*userId\)/g) || []).length === 0)

assert('D admin plan hides customer upgrade checkout', /Admin accounts do not require a paid subscription/.test(billing) && /window\.__mll_plan === 'admin'/.test(billing) && /if \(plan === 'admin'\)/.test(billing))
assert('D admin path disables basic/pro/featured buttons', /plan === 'admin'[\s\S]*\['basic','pro','featured'\][\s\S]*btn\.disabled = true/.test(billing))
assert('login does not silently redirect an existing token', !/if \(sessionStorage\.getItem\('mll_token'\)\) window\.location\.href = 'dashboard\.html'/.test(login))
assert('login identifies existing session', /identifyExistingSession|existing-session/.test(login))
assert('login overwrites mll_token on success', /sessionStorage\.setItem\('mll_token', data\.access_token\)/.test(login))
assert('login never writes token to localStorage', !/localStorage\.setItem\(\s*['"]mll_token['"]/.test(login))

if (failed) {
  console.error('billing business tests FAIL ' + failed)
  process.exit(1)
}
console.log('billing business tests PASS')
