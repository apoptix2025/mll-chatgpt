#!/usr/bin/env node
/**
 * Homepage theme + MLL AI foundation regression.
 * Static source checks only. Does not call production. Does not print secrets.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0

function assert(label, cond) {
  if (cond) console.log('PASS  ' + label)
  else {
    failed += 1
    console.error('FAIL  ' + label)
  }
}

function between(source, start, end) {
  const a = source.indexOf(start)
  const b = source.indexOf(end, a + start.length)
  return a >= 0 && b > a ? source.slice(a, b) : ''
}

function count(source, re) {
  return (source.match(re) || []).length
}

const index = readFileSync(join(root, 'frontend/index.html'), 'utf8')
const navJs = readFileSync(join(root, 'frontend/js/nav.js'), 'utf8')
const mainJs = readFileSync(join(root, 'frontend/js/main.js'), 'utf8')
const mediaJs = readFileSync(join(root, 'frontend/js/media.js'), 'utf8')
const aiJs = readFileSync(join(root, 'frontend/js/mll-ai.js'), 'utf8')
const aiCss = readFileSync(join(root, 'frontend/css/mll-ai.css'), 'utf8')
const themeCss = readFileSync(join(root, 'frontend/css/mll-theme.css'), 'utf8')
const mainCss = readFileSync(join(root, 'frontend/css/main.css'), 'utf8')
const worker = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')
const aiApi = readFileSync(join(root, 'workers/src/api/ai-search.ts'), 'utf8')
const wrangler = readFileSync(join(root, 'workers/wrangler.toml'), 'utf8')
const currentBiz = readFileSync(join(root, 'frontend/js/current-business.js'), 'utf8')
const dataJs = readFileSync(join(root, 'frontend/js/data.js'), 'utf8')
const login = readFileSync(join(root, 'frontend/pages/login.html'), 'utf8')
const billing = readFileSync(join(root, 'frontend/pages/billing.html'), 'utf8')

const desktop = between(index, '<div class="v2-links">', '</div>')
const homeMobile = between(index, '<div class="nav-mobile" id="nav-mobile">', '</nav>')

assert('1 homepage desktop has Home and Businesses routes', /href="\/"[^>]*>Home/.test(desktop) && /href="pages\/directory\.html"[^>]*>Businesses/.test(desktop))
assert('1 homepage keeps Jobs Marketplace La Voz Partners For Business', /pages\/jobs\.html/.test(desktop) && /pages\/marketplace\.html/.test(desktop) && /pages\/voz\.html/.test(desktop) && /href="\/pages\/partners"/.test(desktop) && /pages\/enroll\.html/.test(desktop))
assert('1 injected nav has Home + Businesses', /data-en="Home"/.test(navJs) && /data-en="Businesses"/.test(navJs))

assert('2 Partners remains visible on homepage desktop', /data-en="Partners"/.test(desktop) && count(desktop, /data-en="Partners"/g) === 1)
assert('3 La Voz Latino remains visible', /data-en="La Voz Latino"/.test(desktop) && /data-en="La Voz Latino"/.test(navJs))

assert('4 search still uses handleSearch + search-input + search-city', /id="search-input"/.test(index) && /id="search-city"/.test(index) && /handleSearch\(\)/.test(index) && /window\.handleSearch/.test(mainJs) && /pages\/directory\.html\?/.test(mainJs))
assert('4 location field is free text Enter a location', /id="search-city"[^>]*placeholder="Enter a location\.\.\."/.test(index))
assert('4 category pills use real directory categories', /directory\.html\?category=Food%20%26%20Dining/.test(index) && /category=Construction/.test(index) && /category=Beauty%20%26%20Salon/.test(index) && /category=Auto%20%26%20Repair/.test(index) && /category=Legal%20Services/.test(index) && /category=Health%20%26%20Wellness/.test(index))

assert('5 featured businesses render from MLL.getBusinesses API', /MLL\.getBusinesses\(\)/.test(mainJs) && /featured-grid/.test(mainJs) && /id="featured-grid"/.test(index))
const featuredSrc = between(index, 'id="featured"', 'mll-cta-band')
const vozLatestSrc = between(index, 'id="voz-latest"', '</section>')
assert('5 no hardcoded production fixtures in featured/La Voz API grids', !/AP Optix LLC|La Cocina de Maria|Ramos Law Group|Casa Flores Salon/.test(featuredSrc + vozLatestSrc) && /id="featured-grid"/.test(featuredSrc) && /id="voz-latest-grid"/.test(vozLatestSrc))
assert('5 ratings only when review_count > 0', /hasRealRating/.test(mediaJs) && /review_count\) > 0/.test(mediaJs))
assert('5 Verified only from real verification data', /is_verified === true/.test(mediaJs) && /verified/.test(mediaJs))

assert('6 AI launcher exists and open/close are wired', /Ask MLL AI/.test(aiJs) && /function open\(/.test(aiJs) && /function close\(/.test(aiJs) && /aria-expanded/.test(aiJs) && /Escape/.test(aiJs))
assert('7 AI mobile panel is a bottom sheet above bottom nav', /max-width: 768px/.test(aiCss) && /bottom: 0/.test(aiCss) && /has-mll-bottom-nav \.mll-ai-panel/.test(aiCss) && /has-mll-bottom-nav \.mll-ai-launch/.test(aiCss))
assert('8 AI disabled state shows coming soon', /MLL AI is coming soon/.test(aiJs) && /if \(!enabled\)/.test(aiJs))
assert('8 Worker flag defaults false', /MLL_AI_ENABLED = "false"/.test(wrangler) && /MLL_AI_ENABLED \|\| ''\)\.toLowerCase\(\) !== 'true'/.test(aiApi))
assert('9 AI no-results state is friendly and not fabricated', /No matching listings/.test(aiJs) && /No matching listings on My Latino List yet/.test(aiApi))

assert('10 no /pages/pages/ routing', !/\/pages\/pages\//.test(index) && !/\/pages\/pages\//.test(navJs) && !/\/pages\/pages\//.test(aiJs) && !/\/pages\/pages\//.test(mainJs))
assert('11 no duplicate homepage desktop nav items', count(desktop, /data-en="Home"/g) === 1 && count(desktop, /data-en="Businesses"/g) === 1 && count(desktop, /data-en="Jobs"/g) === 1 && count(desktop, /data-en="Partners"/g) === 1 && count(desktop, /data-en="La Voz Latino"/g) === 1)
assert('12 mobile bottom nav remains', /function injectMobileNav/.test(navJs) && /mll-bottom-nav/.test(navJs) && /data-en="Saved"/.test(navJs))

const mountFn = between(aiJs, 'function mount()', 'function setOpen')
assert('13 mount does not fetch AI', !/fetch\(/.test(mountFn) && /await ensureStatus\(\)/.test(aiJs) && /async function open/.test(aiJs))
assert('13 POST /api/ai/search only from send()', /\/api\/ai\/search/.test(aiJs.slice(aiJs.indexOf('async function send'))))

assert('14 auth token remains sessionStorage mll_token', /sessionStorage\.getItem\('mll_token'\)/.test(dataJs) && /sessionStorage\.setItem\('mll_token'/.test(login) && /sessionStorage\.getItem\('mll_token'\)/.test(aiJs) && !/localStorage\.setItem\(\s*['"]mll_token['"]/.test(aiJs) && /profile\.business_id/.test(currentBiz) && !/businesses\[0\]/.test(currentBiz))
assert('14 billing assigned-business still uses profile.business_id', /profile\?\.business_id/.test(billing))

const feBundle = [index, navJs, mainJs, mediaJs, aiJs, themeCss, aiCss, mainCss].join('\n')
assert('15 no secrets in frontend source', !/SUPABASE_SERVICE_KEY|STRIPE_SECRET|STRIPE_WEBHOOK|sk_live_|sk_test_|service_role/.test(feBundle))

assert('theme CSS and AI CSS are imported', /mll-theme\.css/.test(mainCss) && /mll-ai\.css/.test(mainCss))
assert('hero uses community photo not a skyline class', /hero-community-v2\.png/.test(index) && /mll-hero-premium/.test(index) && /Empower Latinos\./.test(index))
assert('hero is split copy + image', /mll-hero-copy/.test(index) && /mll-hero-image/.test(index) && /grid-template-columns: minmax\(0, 1fr\) minmax\(280px, 46%\)/.test(themeCss))
assert('hero copy is left aligned', /mll-hero-copy/.test(index) && /text-align: left/.test(themeCss) && /align-items: flex-start/.test(themeCss))
assert('desktop hero height is <= 410', /height: 380px/.test(themeCss) && /max-height: 390px/.test(themeCss) && !/min-height: 440px/.test(themeCss) && !/min-height: 560px/.test(themeCss))
assert('compact header 64-70', /min-height: 66px/.test(themeCss))
assert('search lives inside the hero', /mll-hero-search/.test(between(index, 'mll-hero-premium', '</section>')) && /id="search-input"/.test(between(index, 'mll-hero-premium', '</section>')))
assert('popular searches label remains in hero', /Popular Searches:/.test(between(index, 'mll-hero-premium', '</section>')))
assert('shared mll-container width', /\.mll-container/.test(themeCss) && /max-width: 1260px/.test(themeCss) && /class="mll-container"/.test(index))
assert('shortcut row sits before featured', index.indexOf('id="mll-shortcuts"') > 0 && index.indexOf('id="mll-shortcuts"') < index.indexOf('id="featured"'))
assert('six compact shortcuts', count(between(index, 'id="mll-shortcuts"', '</section>'), /class="mll-shortcut"/g) === 6)
assert('featured heading is Featured Latino Businesses', /Featured Latino Businesses/.test(between(index, 'id="featured"', 'mll-cta-band')) && /View All Businesses/.test(between(index, 'id="featured"', 'mll-cta-band')))
assert('featured desktop is four columns', /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/.test(themeCss))
assert('category shortcuts use existing routes', /class="mll-shortcuts"/.test(index) && /href="pages\/directory\.html"/.test(index) && /href="pages\/jobs\.html"/.test(index) && /href="pages\/marketplace\.html"/.test(index) && /href="pages\/voz\.html"/.test(index) && /href="\/pages\/partners"/.test(index) && /href="pages\/enroll\.html"/.test(index))
assert('community CTA uses existing enroll', /A Stronger Community Starts With You/.test(index) && /Join MyLatinoList Today/.test(index) && /pages\/enroll\.html/.test(between(index, 'mll-cta-band', '</section>')))
assert('La Voz latest grid is API-driven', /id="voz-latest-grid"/.test(index) && /voz-latest-grid/.test(mainJs) && /\/api\/resources/.test(mainJs) && /Latest from La Voz Latino/.test(index))
assert('AI launcher desktop offset', /right: 24px/.test(aiCss) && /bottom: 24px/.test(aiCss) && /linear-gradient/.test(aiCss))
assert('AI desktop panel is docked', /min-width: 1200px/.test(aiCss) && /top: 100px/.test(aiCss) && /max-height: calc\(100vh - 130px\)/.test(aiCss) && /width: 348px/.test(aiCss))
assert('AI mobile panel remains bottom sheet', /max-width: 768px/.test(aiCss) && /border-radius: 20px 20px 0 0/.test(aiCss))
assert('responsive breakpoints cover tablet and mobile', /max-width: 1100px/.test(themeCss) && /max-width: 768px/.test(themeCss) && /max-width: 768px/.test(aiCss))
assert('Worker AI routes are public', /path === '\/api\/ai\/status'/.test(worker) && /path === '\/api\/ai\/search'/.test(worker) && /handleAiSearch/.test(worker))
assert('Worker AI never invents businesses', /Never invent businesses/.test(aiApi) && /publicBusiness/.test(aiApi) && /SAFE_BIZ/.test(aiApi))
assert('quota entitlements are stubbed not billed', /visitor: 3/.test(aiJs) && /agency: 200/.test(aiJs) && !/create-checkout-session/.test(aiApi) && !/STRIPE/.test(aiApi))
assert('Affiliates stays out of desktop shortcuts', !/affiliates\.html/.test(between(index, 'id="mll-shortcuts"', '</section>')))
assert('homepage hamburger still has Affiliates', /pages\/affiliates\.html/.test(homeMobile))

if (failed) {
  console.error('mll ai theme tests FAIL ' + failed)
  process.exit(1)
}
console.log('mll ai theme tests PASS')
