#!/usr/bin/env node
/**
 * Dashboard + My Listing ownership and sidebar tests.
 * Does not call production. Does not print secrets.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0

function assert(label, cond) {
  if (cond) console.log('PASS  ' + label)
  else { failed += 1; console.error('FAIL  ' + label) }
}

const helperSrc = readFileSync(join(root, 'frontend/js/current-business.js'), 'utf8')
const sandbox = { globalThis: {} }
vm.runInNewContext(helperSrc, sandbox)
const api = sandbox.globalThis.MLL_CURRENT_BUSINESS

const AP_OPTIX_ID = '211e7c32-31c9-4e7d-a669-ac1c8c6496b4'
const TEST_BIZ_ID = '7e735f46-9dc1-4ecf-936b-7342e566978a'

const showcases = [
  { id: '23114f63-3efe-4d0c-adf4-a94a1bbe6423', name: 'Ramos Law Group', slug: 'ramos-law-group', plan: 'featured' },
  { id: '7d4471ba-54ec-49e7-8694-aeb43c8ad26b', name: 'Casa Flores Salon', slug: 'casa-flores-salon', plan: 'featured' },
  { id: '96e7e53b-d839-4c45-a576-3cf3a2d2cf28', name: 'La Cocina de Maria', slug: 'la-cocina-de-maria', plan: 'featured' },
]
const apOptix = { id: AP_OPTIX_ID, name: 'AP Optix LLC', slug: 'ap-optix-llc', plan: 'admin', referral_code: 'APOPTIX' }
const testBiz = { id: TEST_BIZ_ID, name: 'Test Business', slug: 'test-business', plan: 'free', referral_code: '5VMJSQ3L' }

const adminMe = {
  user: { email: 'info@apoptix.io' },
  profile: { business_id: AP_OPTIX_ID, first_name: 'AP', last_name: 'Optix', businesses: [...showcases, apOptix] },
}
const customerMe = {
  user: { email: 'apena77@gmail.com' },
  profile: { business_id: TEST_BIZ_ID, first_name: 'Test', last_name: 'Owner', businesses: [testBiz] },
}
const multiFirstShowcase = {
  user: { email: 'info@apoptix.io' },
  profile: { business_id: AP_OPTIX_ID, businesses: [...showcases, apOptix] },
}

const adminResolved = api.resolveAssignedBusiness(adminMe)
assert('A AP Optix admin → AP Optix business', adminResolved.business?.id === AP_OPTIX_ID && adminResolved.business?.slug === 'ap-optix-llc')
assert('A admin isAdmin true', adminResolved.isAdmin === true)
assert('A admin does not resolve Ramos', adminResolved.business?.slug !== 'ramos-law-group')

const customerResolved = api.resolveAssignedBusiness(customerMe)
assert('B Test customer → Test Business', customerResolved.business?.id === TEST_BIZ_ID && customerResolved.business?.slug === 'test-business')
assert('B customer is not admin', customerResolved.isAdmin === false)
assert('B customer is not AP Optix', customerResolved.business?.id !== AP_OPTIX_ID)

const multi = api.resolveAssignedBusiness(multiFirstShowcase)
assert('C multi-business owner does not default to first owned business', multi.business?.id === AP_OPTIX_ID && multi.business?.name === 'AP Optix LLC')
assert('C first array item is ignored when it is not assigned', showcases[0].id !== multi.business?.id)

assert('no assigned id returns no business', api.resolveAssignedBusiness({ user: { email: 'x@y.com' }, profile: { businesses: showcases } }).business === null)
assert('unknown assigned id is not first business', api.resolveAssignedBusiness({
  user: { email: 'x@y.com' },
  profile: { business_id: 'missing', businesses: showcases },
}).business === null)

const dashboard = readFileSync(join(root, 'frontend/pages/dashboard.html'), 'utf8')
const listing = readFileSync(join(root, 'frontend/pages/listing.html'), 'utf8')
const billing = readFileSync(join(root, 'frontend/pages/billing.html'), 'utf8')
const analytics = readFileSync(join(root, 'frontend/pages/analytics.html'), 'utf8')
const login = readFileSync(join(root, 'frontend/pages/login.html'), 'utf8')

assert('dashboard uses resolveAssignedBusiness', /MLL_CURRENT_BUSINESS\.resolveAssignedBusiness/.test(dashboard))
assert('listing uses resolveAssignedBusiness', /MLL_CURRENT_BUSINESS\.resolveAssignedBusiness/.test(listing))
assert('dashboard does not use businesses[0]', !/businesses\[0\]/.test(dashboard) && !/bArr\[0\]/.test(dashboard))
assert('listing does not use businesses[0]', !/businesses\[0\]/.test(listing) && !/bArr\[0\]/.test(listing))
assert('listing public profile is /pages/business?slug=', /\/pages\/business\?slug=/.test(listing))
assert('dashboard token stays in sessionStorage', /sessionStorage\.getItem\('mll_token'\)/.test(dashboard) && !/localStorage\.setItem\(\s*['"]mll_token['"]/.test(dashboard))
assert('listing token stays in sessionStorage', /sessionStorage\.getItem\('mll_token'\)/.test(listing) && !/localStorage\.setItem\(\s*['"]mll_token['"]/.test(listing))
assert('logout still clears session', /sessionStorage\.clear\(\)/.test(dashboard) && /sessionStorage\.clear\(\)/.test(listing))

function sidebarHrefs(html) {
  const block = html.split('<aside class="sidebar">')[1]?.split('</aside>')[0] || ''
  return [...block.matchAll(/<a\s+[^>]*href="([^"]+)"/g)].map(m => m[1])
}

for (const [name, html] of [['dashboard', dashboard], ['listing', listing], ['billing', billing], ['analytics', analytics]]) {
  const hrefs = sidebarHrefs(html)
  const counts = hrefs.reduce((acc, d) => { acc[d] = (acc[d] || 0) + 1; return acc }, {})
  const aside = html.split('<aside class="sidebar">')[1]?.split('</aside>')[0] || ''
  assert(`D ${name} sidebar has no duplicate destinations`, Object.values(counts).every(n => n === 1))
  assert(`D ${name} has Dashboard + My Listing + Billing once`, hrefs.includes('dashboard.html') && hrefs.includes('listing.html') && hrefs.includes('billing.html'))
  assert(`E ${name} dead modules are not dashboard self-links`, hrefs.filter(h => h === 'dashboard.html').length === 1)
  assert(`E ${name} Appointments/Messages/Leads are Coming soon`, /sb-soon[\s\S]*Appointments/.test(html) && /sb-soon[\s\S]*Messages/.test(html) && /sb-soon[\s\S]*Leads/.test(html))
  assert(`E ${name} no javascript:void or hash-only module links`, !/javascript:void/.test(aside) && !/href="#"/ .test(aside))
}

assert('admin helper injects Admin + System Health', /admin\.html/.test(helperSrc) && /health\.html/.test(helperSrc) && /injectAdminSidebarLinks/.test(helperSrc))
assert('dashboard injects admin nav from helper', /injectAdminSidebarLinks/.test(dashboard))
assert('listing injects admin nav from helper', /injectAdminSidebarLinks/.test(listing))
assert('customer pages do not hardcode Admin/Health in static sidebar', !/<a href="admin\.html"/.test(dashboard) && !/<a href="health\.html"/.test(dashboard))
assert('login uses assigned business helper', /MLL_CURRENT_BUSINESS\.resolveAssignedBusiness/.test(login))
assert('login does not fall back to businesses[0]', !/list\[0\]/.test(login) && !/businesses\[0\]/.test(login))
assert('IDs remain distinct', AP_OPTIX_ID !== TEST_BIZ_ID)

if (failed) {
  console.error('dashboard/listing tests FAIL ' + failed)
  process.exit(1)
}
console.log('dashboard/listing tests PASS')
