#!/usr/bin/env node
/**
 * Authenticated dashboard placeholder / fake-metric checks.
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
  else {
    failed += 1
    console.error('FAIL  ' + label)
  }
}

const dashboard = readFileSync(join(root, 'frontend/pages/dashboard.html'), 'utf8')
const analytics = readFileSync(join(root, 'frontend/pages/analytics.html'), 'utf8')
const helperSrc = readFileSync(join(root, 'frontend/js/current-business.js'), 'utf8')
const indexHtml = readFileSync(join(root, 'frontend/index.html'), 'utf8')

assert('A no fake 1,284 KPI on dashboard', !/1,284/.test(dashboard))
assert('A no fake $830 KPI on dashboard', !/\$830/.test(dashboard))
assert('A no mock-kpi block on dashboard', !/mock-kpi/.test(dashboard))
assert('A homepage marketing demo may keep mock KPIs', /mock-kpi/.test(indexHtml) && /1,284/.test(indexHtml))
assert('A profile views stay unlabeled numbers', /id="kpi-views"/.test(dashboard) && /Profile analytics coming soon/.test(dashboard))
assert('A profile views are not shown as 0', !/id="kpi-views"[^>]*>0</.test(dashboard))

assert('B export is disabled coming soon', /Export report · Coming soon/.test(dashboard) && /btn-soon/.test(dashboard) && /disabled aria-disabled="true"/.test(dashboard))
assert('B no export implementation', !/exportCSV|exportReport|Export report<\/button>/.test(dashboard))

assert('C Appointments coming soon', /sb-soon[\s\S]*Appointments/.test(dashboard))
assert('C Messages coming soon', /sb-soon[\s\S]*Messages/.test(dashboard))
assert('C Leads module coming soon', /sb-soon[\s\S]*Leads/.test(dashboard))
const dashAside = dashboard.split('<aside class="sidebar">')[1]?.split('</aside>')[0] || ''
assert('C no hash or javascript:void module links', !/javascript:void/.test(dashAside) && !/href="#"/ .test(dashAside))
assert('C coming soon items are spans not dashboard links', (dashAside.match(/href="dashboard\.html"/g) || []).length === 1)

assert('D recent leads uses real API path', /\/api\/leads\?business_id=/.test(dashboard) && /lead-list/.test(dashboard))
assert('D recent leads renders API rows or honest empty state', /leadsData\?\.leads/.test(dashboard) && /No leads yet/.test(dashboard))
assert('D no dedicated leads page link', !/href="leads\.html"/.test(dashboard))

assert('marketplace sales is not a fake $0 metric', /Marketplace sales tracking coming soon/.test(dashboard) && !/sales_count \* p\.price/.test(dashboard))
assert('product rows do not claim sold this month', !/sold this month/.test(dashboard))

const sandbox = { globalThis: {} }
vm.runInNewContext(helperSrc, sandbox)
const api = sandbox.globalThis.MLL_CURRENT_BUSINESS
const AP_OPTIX_ID = '211e7c32-31c9-4e7d-a669-ac1c8c6496b4'
const TEST_BIZ_ID = '7e735f46-9dc1-4ecf-936b-7342e566978a'
const admin = api.resolveAssignedBusiness({
  user: { email: 'info@apoptix.io' },
  profile: {
    business_id: AP_OPTIX_ID,
    businesses: [
      { id: 's1', name: 'Ramos Law Group' },
      { id: AP_OPTIX_ID, name: 'AP Optix LLC', slug: 'ap-optix-llc' },
    ],
  },
})
const customer = api.resolveAssignedBusiness({
  user: { email: 'apena77@gmail.com' },
  profile: { business_id: TEST_BIZ_ID, businesses: [{ id: TEST_BIZ_ID, name: 'Test Business', slug: 'test-business' }] },
})
assert('E dashboard still uses resolveAssignedBusiness', /MLL_CURRENT_BUSINESS\.resolveAssignedBusiness/.test(dashboard))
assert('E helper still uses profile.business_id', /profile\.business_id/.test(helperSrc))
assert('E admin resolves AP Optix', admin.business?.id === AP_OPTIX_ID)
assert('E customer resolves Test Business', customer.business?.id === TEST_BIZ_ID)
assert('F no businesses[0] fallback', !/businesses\[0\]/.test(dashboard) && !/bArr\[0\]/.test(dashboard) && !/\|\| list\[0\]/.test(helperSrc))

function sidebarHrefs(html) {
  const block = html.split('<aside class="sidebar">')[1]?.split('</aside>')[0] || ''
  return [...block.matchAll(/<a\s+[^>]*href="([^"]+)"/g)].map(m => m[1])
}
const hrefs = sidebarHrefs(dashboard)
const counts = hrefs.reduce((acc, d) => { acc[d] = (acc[d] || 0) + 1; return acc }, {})
const required = ['dashboard.html', 'listing.html', 'analytics.html', 'marketplace.html', 'jobs.html', 'voz.html', 'affiliates.html', 'dashboard.html#refer-earn', 'billing.html']
assert('G sidebar destinations unique', Object.values(counts).every(n => n === 1))
assert('G required sidebar entries present once', required.every(h => hrefs.includes(h)))
assert('G admin/health not hardcoded in static sidebar', !/<a href="admin\.html"/.test(dashAside) && !/<a href="health\.html"/.test(dashAside))

assert('analytics page has no fake KPI numbers', !/1,284/.test(analytics) && !/\$830/.test(analytics) && !/mock-kpi/.test(analytics))
assert('analytics page is honest coming soon', /Analytics coming soon/.test(analytics))

if (failed) {
  console.error('dashboard placeholder tests FAIL ' + failed)
  process.exit(1)
}
console.log('dashboard placeholder tests PASS')
