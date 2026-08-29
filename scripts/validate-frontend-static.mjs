#!/usr/bin/env node
/**
 * Static frontend checks for MLL 2.0 (no bundler).
 * Does not print secrets. Does not deploy.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const frontend = join(root, 'frontend')
const pages = [
  'index.html',
  'pages/login.html',
  'pages/enroll.html',
  'pages/directory.html',
  'pages/dashboard.html',
  'pages/listing.html',
  'pages/analytics.html',
  'pages/marketplace.html',
  'pages/jobs.html',
  'pages/voz.html',
  'pages/affiliates.html',
  'pages/partners.html',
  'pages/billing.html',
  'pages/admin.html',
  'pages/business.html',
  'pages/reset-password.html',
  'js/config.js',
  'js/current-business.js',
  'css/main.css',
]

let failed = 0
for (const rel of pages) {
  const p = join(frontend, rel)
  if (!existsSync(p)) {
    console.error('MISSING ' + rel)
    failed += 1
  }
}

const config = readFileSync(join(frontend, 'js/config.js'), 'utf8')
const checks = [
  ["production host mylatinolist.io", /host === 'mylatinolist.io'/],
  ["www host", /host === 'www.mylatinolist.io'/],
  ["production API", /https:\/\/api\.mylatinolist\.io/],
  ["staging API constant", /mll-api-staging\.sparkling-hill-934f\.workers\.dev/],
  ["production assignment", /isProduction[\s\S]*PRODUCTION_API/],
]
for (const [label, re] of checks) {
  if (!re.test(config)) {
    console.error('CONFIG FAIL ' + label)
    failed += 1
  }
}
if (config.includes('bjtfrmkhishoadjtpzgg')) {
  console.error('CONFIG FAIL staging supabase ref hardcoded')
  failed += 1
}

const dashboard = readFileSync(join(frontend, 'pages/dashboard.html'), 'utf8')
const dashChecks = [
  ['referral empty state', /Referral code unavailable/],
  ['referral renderer', /function renderReferralCard/],
  ['referral error state', /Could not load referral details/],
  ['La Voz Latino sidebar', /href="voz\.html"[\s\S]*La Voz Latino/],
  ['resources API', /\/api\/resources/],
  ['resources empty state', /No resources available/],
  ['resources error state', /Could not load resources/],
]
for (const [label, re] of dashChecks) {
  if (!re.test(dashboard)) {
    console.error('DASHBOARD FAIL ' + label)
    failed += 1
  }
}
if (/if \(bizRaw\?\.referral_code\)/.test(dashboard) && !/Referral code unavailable/.test(dashboard)) {
  console.error('DASHBOARD FAIL referral card still skips empty code')
  failed += 1
}
if (/SBA loan programs|DACA business resources|Minority business grants/.test(dashboard)) {
  console.error('DASHBOARD FAIL hard-coded La Voz Latino resources')
  failed += 1
}

const indexHtml = readFileSync(join(frontend, 'index.html'), 'utf8')
const navJs = readFileSync(join(frontend, 'js/nav.js'), 'utf8')
if (!/href="pages\/voz\.html"[^>]*>La Voz Latino/.test(indexHtml)) {
  console.error('NAV FAIL homepage public label is not La Voz Latino')
  failed += 1
}
if (/href="pages\/voz\.html"[^>]*>Resources</.test(indexHtml) || /data-en="Resources"[\s\S]{0,40}voz\.html/.test(indexHtml)) {
  console.error('NAV FAIL homepage still uses Resources as voz dest label')
  failed += 1
}
if (!/voz\.html" data-en="La Voz Latino"/.test(navJs)) {
  console.error('NAV FAIL shared nav.js label is not La Voz Latino')
  failed += 1
}
if (/voz\.html" data-en="Resources"/.test(navJs)) {
  console.error('NAV FAIL shared nav.js still uses Resources label')
  failed += 1
}

const mediaJs = readFileSync(join(frontend, 'js/media.js'), 'utf8')
if (!/ap-optix-llc['"]:\s*BASE \+ ['"]ap-optix-ai-tech\.webp['"]/.test(mediaJs)) {
  console.error('MEDIA FAIL AP Optix slug is not mapped to ap-optix-ai-tech.webp')
  failed += 1
}
if (/ap-optix-llc['"]:\s*BASE \+ ['"]community\.jpg['"]/.test(mediaJs)) {
  console.error('MEDIA FAIL AP Optix still mapped to community fallback')
  failed += 1
}
const optixImg = join(frontend, 'assets/businesses/ap-optix-ai-tech.webp')
if (!existsSync(optixImg)) {
  console.error('MEDIA FAIL missing frontend/assets/businesses/ap-optix-ai-tech.webp')
  failed += 1
}
if (!/function profileHref/.test(mediaJs) || !/\/pages\/business\?slug=/.test(mediaJs)) {
  console.error('ROUTE FAIL media.js missing canonical /pages/business?slug= helper')
  failed += 1
}
if (/\(opts\.prefix\s*\|\|\s*['"]pages\//.test(mediaJs) || /['"]pages\/['"]\s*\+\s*['"]business\.html/.test(mediaJs)) {
  console.error('ROUTE FAIL media.js still builds relative pages/business.html links')
  failed += 1
}

const businessHtml = readFileSync(join(frontend, 'pages/business.html'), 'utf8')
if (!/params\.get\('slug'\)/.test(businessHtml)) {
  console.error('ROUTE FAIL business.html does not read ?slug=')
  failed += 1
}
if (!/params\.get\('id'\)/.test(businessHtml)) {
  console.error('ROUTE FAIL business.html dropped ?id= fallback')
  failed += 1
}

const listingHtml = readFileSync(join(frontend, 'pages/listing.html'), 'utf8')
if (!/\/pages\/business\?slug=/.test(listingHtml)) {
  console.error('ROUTE FAIL listing.html public profile link is not canonical')
  failed += 1
}

const routeFiles = [
  'js/media.js',
  'js/main.js',
  'pages/directory.html',
  'pages/business.html',
  'pages/listing.html',
  'pages/dashboard.html',
  'index.html',
]
for (const rel of routeFiles) {
  const src = readFileSync(join(frontend, rel), 'utf8')
  if (/\/pages\/pages\/business/.test(src) || /pages\/pages\/business/.test(src)) {
    console.error('ROUTE FAIL ' + rel + ' contains /pages/pages/business')
    failed += 1
  }
}

const billingHtml = readFileSync(join(frontend, 'pages/billing.html'), 'utf8')
const billingChecks = [
  ['admin plan copy', /Admin accounts do not require a paid subscription/],
  ['admin checkout guard', /window\.__mll_plan === 'admin'/],
  ['admin hides upgrade UI', /if \(plan === 'admin'\)/],
  ['assigned business_id preference', /profile\?\.business_id/],
]
for (const [label, re] of billingChecks) {
  if (!re.test(billingHtml)) {
    console.error('BILLING FAIL ' + label)
    failed += 1
  }
}
if (/btn-basic[\s\S]*startCheckout\('basic'\)/.test(billingHtml) && !/plan === 'admin'/.test(billingHtml)) {
  console.error('BILLING FAIL admin can still start customer checkout')
  failed += 1
}

const loginHtml = readFileSync(join(frontend, 'pages/login.html'), 'utf8')
if (/if \(sessionStorage\.getItem\('mll_token'\)\) window\.location\.href = 'dashboard\.html'/.test(loginHtml)) {
  console.error('LOGIN FAIL silent redirect of existing session')
  failed += 1
}
if (!/existing-session/.test(loginHtml) || !/Sign in with a different account/.test(loginHtml)) {
  console.error('LOGIN FAIL existing session is not identified')
  failed += 1
}
if (!/sessionStorage\.setItem\('mll_token', data\.access_token\)/.test(loginHtml)) {
  console.error('LOGIN FAIL successful login does not overwrite mll_token')
  failed += 1
}
if (/localStorage\.setItem\(\s*['"]mll_token['"]/.test(loginHtml)) {
  console.error('LOGIN FAIL token stored in localStorage')
  failed += 1
}

const healthHtml = readFileSync(join(frontend, 'pages/health.html'), 'utf8')
if (!/\/api\/admin\/health/.test(healthHtml)) {
  console.error('HEALTH FAIL dashboard does not call protected /api/admin/health')
  failed += 1
}
if (/fetch\(`\$\{API\}\/api\/health`\)/.test(healthHtml)) {
  console.error('HEALTH FAIL dashboard still loads public /api/health for details')
  failed += 1
}
if (!/data\.timestamp/.test(healthHtml)) {
  console.error('HEALTH FAIL dashboard does not display API timestamp')
  failed += 1
}
if (!/MRR unavailable/.test(healthHtml)) {
  console.error('HEALTH FAIL dashboard still treats listing plans as MRR')
  failed += 1
}

const listingSrc = readFileSync(join(frontend, 'pages/listing.html'), 'utf8')
const currentBiz = readFileSync(join(frontend, 'js/current-business.js'), 'utf8')
if (!/resolveAssignedBusiness/.test(currentBiz) || !/profile\.business_id/.test(currentBiz)) {
  console.error('DASH FAIL current-business helper does not use profile.business_id')
  failed += 1
}
if (/businesses\[0\]/.test(currentBiz) || /\|\| list\[0\]/.test(currentBiz)) {
  console.error('DASH FAIL current-business helper still falls back to first business')
  failed += 1
}
if (!/MLL_CURRENT_BUSINESS\.resolveAssignedBusiness/.test(dashboard) || !/MLL_CURRENT_BUSINESS\.resolveAssignedBusiness/.test(listingSrc)) {
  console.error('DASH FAIL dashboard/listing do not use assigned-business helper')
  failed += 1
}
if (/businesses\[0\]/.test(dashboard) || /bArr\[0\]/.test(dashboard) || /businesses\[0\]/.test(listingSrc) || /bArr\[0\]/.test(listingSrc)) {
  console.error('DASH FAIL dashboard/listing still use businesses[0]')
  failed += 1
}
if (/href="dashboard\.html" class="sb-link">Appointments/.test(dashboard) || /href="dashboard\.html#leads"/.test(dashboard)) {
  console.error('DASH FAIL dead modules still route to dashboard')
  failed += 1
}
if (!/sb-soon[\s\S]*Coming soon/.test(dashboard)) {
  console.error('DASH FAIL coming soon modules missing')
  failed += 1
}
const dashSidebar = dashboard.split('<aside class="sidebar">')[1]?.split('</aside>')[0] || ''
if ((dashSidebar.match(/href="billing\.html"/g) || []).length !== 1) {
  console.error('DASH FAIL billing sidebar destination is not unique')
  failed += 1
}
if (!/injectAdminSidebarLinks/.test(dashboard) || !/health\.html/.test(currentBiz)) {
  console.error('DASH FAIL admin/health nav is not helper-gated')
  failed += 1
}

if (failed) {
  console.error('frontend static validation FAIL ' + failed)
  process.exit(1)
}
console.log('frontend static validation PASS')
console.log('  pages and config.js production mapping verified')
console.log('  dashboard referral empty/error states verified')
console.log('  dashboard La Voz Latino navigation and resources API verified')
console.log('  public nav branded as La Voz Latino')
console.log('  AP Optix AI tech listing image mapped')
console.log('  billing admin upgrade guard verified')
console.log('  login existing-session handling verified')
console.log('  business profile canonical /pages/business?slug= routing verified')
console.log('  health dashboard uses protected /api/admin/health')
console.log('  dashboard/listing assigned-business context verified')
