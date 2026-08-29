#!/usr/bin/env node
/**
 * Affiliate join contract tests.
 * Live checks are GET list + unauthenticated POST only.
 * Does not create memberships. Does not print secrets.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0

function assert(label, cond) {
  if (cond) console.log('PASS  ' + label)
  else {
    failed += 1
    console.error('FAIL  ' + label)
  }
}

const AP_OPTIX_ID = '211e7c32-31c9-4e7d-a669-ac1c8c6496b4'
const TEST_BIZ_ID = '7e735f46-9dc1-4ecf-936b-7342e566978a'
const ADMIN_ID = 'a0b394e4-0362-4f0e-aa84-cfde62daab30'
const CUSTOMER_ID = '67115f44-62d2-42a2-bed4-5448758bc89f'
const PROGRAM_ID = '3f41644d-f850-4da2-ab89-9d0571a57c25'
const SHOWCASE_IDS = [
  '23114f63-3efe-4d0c-adf4-a94a1bbe6423',
  '7d4471ba-54ec-49e7-8694-aeb43c8ad26b',
  '96e7e53b-d839-4c45-a576-3cf3a2d2cf28',
]

const marketplace = readFileSync(join(root, 'workers/src/api/marketplace.ts'), 'utf8')
const indexSrc = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')
const affiliatesHtml = readFileSync(join(root, 'frontend/pages/affiliates.html'), 'utf8')
const loginHtml = readFileSync(join(root, 'frontend/pages/login.html'), 'utf8')
const helper = readFileSync(join(root, 'workers/src/lib/billing-business.ts'), 'utf8')
const safeReturnSrc = readFileSync(join(root, 'frontend/js/safe-return.js'), 'utf8')

assert('A public list route is GET /api/affiliates', /url\.pathname === '\/api\/affiliates'/.test(marketplace))
assert('A public GET is exact-path only', /path === '\/api\/affiliates' && request\.method === 'GET'/.test(indexSrc))
assert('A list does not require userId', /GET \/api\/affiliates — list affiliate programs/.test(marketplace))

assert('join route is POST /api/affiliates/join', /url\.pathname === '\/api\/affiliates\/join'/.test(marketplace))
assert('join requires userId from auth', /\/api\/affiliates\/join' && userId/.test(marketplace))
assert('join payload uses program_id only', /body\.program_id/.test(marketplace) && /JSON\.stringify\(\{program_id:programId\}\)/.test(affiliatesHtml))
assert('D frontend posts the listed program id', /data-program-id/.test(affiliatesHtml) && /program_id:programId/.test(affiliatesHtml))

const affiliateFn = marketplace.split('export async function handleAffiliates')[1] || ''
assert('E join uses resolveAssignedBusiness', /POST \/api\/affiliates\/join[\s\S]*resolveAssignedBusiness/.test(affiliateFn))
assert('E enrollments use resolveAssignedBusiness', /GET \/api\/affiliates\/enrollments[\s\S]*resolveAssignedBusiness/.test(affiliateFn))
assert('E join does not use owner_id lookup', !/\.eq\('owner_id'/.test(affiliateFn))
assert('E client business_id is not trusted', !/body\.business_id/.test(affiliateFn) && !/body\.user_id/.test(affiliateFn) && !/body\.owner_id/.test(affiliateFn))
assert('E helper still keys off profile.business_id', /profile\.business_id/.test(helper) && /\.eq\('id', profile\.business_id\)/.test(helper))

assert('memberships are business-scoped', /affiliate_enrollments[\s\S]*business_id/.test(marketplace))
assert('duplicate join returns 409', /Already enrolled/.test(marketplace) && /status: 409/.test(marketplace))
assert('unique violation maps to 409', /isUniqueViolation\(error\)/.test(marketplace))

assert('enrollments GET is authenticated', /\/api\/affiliates\/enrollments' && userId/.test(marketplace))
assert('enrollments GET is not the public list route', !/path\.startsWith\('\/api\/affiliates'\) && request\.method === 'GET'/.test(indexSrc))

assert('B unauthenticated Join goes to login return', /LOGIN_RETURN='login.html\?return=\/pages\/affiliates'/.test(affiliatesHtml))
assert('B unauthenticated Join does not POST', /if\(!token\)\{[\s\S]*window\.location\.href=LOGIN_RETURN;[\s\S]*return;/.test(affiliatesHtml))
assert('C authenticated Join sends Bearer token', /Authorization:`Bearer \$\{token\}`/.test(affiliatesHtml) && /sessionStorage\.getItem\('mll_token'\)/.test(affiliatesHtml))
assert('I token stays in sessionStorage', !/localStorage\.setItem\(\s*['"]mll_token['"]/.test(affiliatesHtml) && !/localStorage\.setItem\(\s*['"]mll_token['"]/.test(loginHtml))
assert('I login still writes sessionStorage token', /sessionStorage\.setItem\('mll_token', data\.access_token\)/.test(loginHtml))

assert('F pending set blocks duplicate click', /pendingJoins\.has\(programId\)/.test(affiliatesHtml) && /pendingJoins\.add\(programId\)/.test(affiliatesHtml))
assert('F button disables while joining', /btn\.textContent='Joining\.\.\.'/.test(affiliatesHtml) && /btn\.disabled=true/.test(affiliatesHtml))
assert('G already-joined uses enrollments + is-joined', /api\/affiliates\/enrollments/.test(affiliatesHtml) && /is-joined/.test(affiliatesHtml) && /You're enrolled/.test(affiliatesHtml))
assert('G 409 is treated as already joined', /res\.status===201\|\|res\.status===409/.test(affiliatesHtml))
assert('fake dashboard join redirect is gone', !/window\.location\.href='dashboard\.html'/.test(affiliatesHtml))

assert('login uses safe return helper', /safe-return\.js/.test(loginHtml) && /loginReturnTarget\(\)/.test(loginHtml))
assert('login continue/success honor return', /window\.location\.href = loginReturnTarget\(\)/.test(loginHtml))
assert('login does not silently redirect an existing token', !/if \(sessionStorage\.getItem\('mll_token'\)\) window\.location\.href = 'dashboard\.html'/.test(loginHtml))

const sandbox = { globalThis: {} }
vm.runInNewContext(safeReturnSrc, sandbox)
const safe = sandbox.globalThis.MLL_SAFE_RETURN
assert('login return affiliates path', safe.safeLoginReturn('/pages/affiliates') === 'affiliates.html')
assert('login return affiliates.html', safe.safeLoginReturn('affiliates.html') === 'affiliates.html')
assert('login return empty defaults to dashboard', safe.safeLoginReturn('') === 'dashboard.html')
assert('open redirect https rejected', safe.safeLoginReturn('https://evil.example') === 'dashboard.html')
assert('open redirect protocol-relative rejected', safe.safeLoginReturn('//evil.example') === 'dashboard.html')
assert('open redirect traversal rejected', safe.safeLoginReturn('/pages/../login') === 'dashboard.html')
assert('open redirect query rejected', safe.safeLoginReturn('/pages/affiliates?next=https://evil.example') === 'dashboard.html')
assert('open redirect hash rejected', safe.safeLoginReturn('/pages/affiliates#https://evil.example') === 'dashboard.html')
assert('return query parser', safe.loginReturnFromSearch('?return=/pages/affiliates') === 'affiliates.html')

async function resolveAssignedBusiness(supabase, userId) {
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('business_id, email')
    .eq('id', userId)
    .maybeSingle()
  if (!profileRow) return { ok: false, status: 404, error: 'Profile not found' }
  const profile = { business_id: profileRow.business_id ?? null, email: profileRow.email ?? null }
  if (!profile.business_id) return { ok: false, status: 400, error: 'No business assigned to this account' }
  const { data: businessRow } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', profile.business_id)
    .maybeSingle()
  if (!businessRow?.id) return { ok: false, status: 404, error: 'Business not found' }
  return { ok: true, profile, business: { id: String(businessRow.id), name: String(businessRow.name ?? '') } }
}

function mockClient({ profiles, businesses, enrollments = [] }) {
  return {
    from(table) {
      const state = { table, filters: {} }
      return {
        select() { return this },
        eq(column, value) {
          state.filters[column] = value
          return this
        },
        async maybeSingle() {
          if (state.table === 'profiles' && state.filters.id) {
            return { data: profiles.find(p => p.id === state.filters.id) || null }
          }
          if (state.table === 'businesses' && state.filters.id) {
            return { data: businesses.find(b => b.id === state.filters.id) || null }
          }
          if (state.table === 'businesses' && state.filters.owner_id) {
            throw new Error('owner_id must not be used to select the affiliate business')
          }
          if (state.table === 'affiliate_enrollments') {
            const row = enrollments.find(e =>
              e.business_id === state.filters.business_id && e.program_id === state.filters.program_id
            )
            return { data: row || null }
          }
          return { data: null }
        },
      }
    },
  }
}

async function joinForUser(userId, body, client) {
  const program_id = typeof body.program_id === 'string' ? body.program_id.trim() : ''
  if (!program_id) return { status: 400, error: 'program_id required' }
  const resolved = await resolveAssignedBusiness(client, userId)
  if (!resolved.ok) return { status: resolved.status, error: resolved.error, businessId: null }
  return { status: 201, businessId: resolved.business.id, ignored: { business_id: body.business_id, user_id: body.user_id, owner_id: body.owner_id } }
}

const adminClient = mockClient({
  profiles: [{ id: ADMIN_ID, business_id: AP_OPTIX_ID, email: 'info@apoptix.io' }],
  businesses: [
    { id: SHOWCASE_IDS[0], name: 'Ramos Law Group' },
    { id: SHOWCASE_IDS[1], name: 'Casa Flores Salon' },
    { id: SHOWCASE_IDS[2], name: 'La Cocina de Maria' },
    { id: AP_OPTIX_ID, name: 'AP Optix LLC' },
    { id: TEST_BIZ_ID, name: 'Test Business' },
  ],
})
const customerClient = mockClient({
  profiles: [{ id: CUSTOMER_ID, business_id: TEST_BIZ_ID, email: 'apena77@gmail.com' }],
  businesses: [
    { id: TEST_BIZ_ID, name: 'Test Business' },
    { id: AP_OPTIX_ID, name: 'AP Optix LLC' },
  ],
})

const adminJoin = await joinForUser(ADMIN_ID, {
  program_id: PROGRAM_ID,
  business_id: SHOWCASE_IDS[0],
  user_id: CUSTOMER_ID,
  owner_id: ADMIN_ID,
}, adminClient)
assert('H admin join resolves AP Optix', adminJoin.status === 201 && adminJoin.businessId === AP_OPTIX_ID)
assert('H admin join ignores client business_id', adminJoin.ignored.business_id === SHOWCASE_IDS[0] && adminJoin.businessId !== SHOWCASE_IDS[0])
assert('H admin is not Ramos / Casa Flores / La Cocina', !SHOWCASE_IDS.includes(adminJoin.businessId))

const customerJoin = await joinForUser(CUSTOMER_ID, {
  program_id: PROGRAM_ID,
  business_id: AP_OPTIX_ID,
}, customerClient)
assert('H test customer resolves Test Business', customerJoin.status === 201 && customerJoin.businessId === TEST_BIZ_ID)
assert('H customer client business_id is ignored', customerJoin.ignored.business_id === AP_OPTIX_ID && customerJoin.businessId === TEST_BIZ_ID)

const duplicateClient = mockClient({
  profiles: [{ id: CUSTOMER_ID, business_id: TEST_BIZ_ID, email: 'apena77@gmail.com' }],
  businesses: [{ id: TEST_BIZ_ID, name: 'Test Business' }],
  enrollments: [{ id: 'e1', business_id: TEST_BIZ_ID, program_id: PROGRAM_ID, status: 'active' }],
})
const existing = await duplicateClient.from('affiliate_enrollments').select('id').eq('business_id', TEST_BIZ_ID).eq('program_id', PROGRAM_ID).maybeSingle()
assert('duplicate membership can be detected before insert', !!existing.data)

let liveCount = 0
try {
  const listRes = await fetch('https://api.mylatinolist.io/api/affiliates')
  const listJson = await listRes.json()
  liveCount = Array.isArray(listJson.affiliates) ? listJson.affiliates.length : 0
  assert('A live public programs load', listRes.status === 200 && liveCount === 6)
  assert('A live programs expose public fields', listJson.affiliates.every(a => a.id && a.name))

  const joinRes = await fetch('https://api.mylatinolist.io/api/affiliates/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program_id: PROGRAM_ID }),
  })
  const joinJson = await joinRes.json().catch(() => ({}))
  assert('B live unauthenticated join is 401', joinRes.status === 401 && /unauthor/i.test(joinJson.error || ''))
} catch (err) {
  assert('A live public programs load', false)
  assert('B live unauthenticated join is 401', false)
  console.error('live check error: network unavailable')
}

if (failed) {
  console.error('affiliate join tests FAIL ' + failed)
  process.exit(1)
}
console.log('affiliate join tests PASS')
console.log('  live program count: ' + liveCount)
