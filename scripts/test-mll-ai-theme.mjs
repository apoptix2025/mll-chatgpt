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
assert('8 Worker flag defaults false', /\[env\.production\.vars\][\s\S]*?MLL_AI_ENABLED = "false"/.test(wrangler) && /toLowerCase\(\) === 'true'/.test(aiApi))
assert('8 staging AI flag is isolated', /\[env\.staging\.vars\][\s\S]*MLL_AI_ENABLED = "true"/.test(wrangler) && /\[env\.staging\.ai\]/.test(wrangler) && !/(?:^|\n)\[env\.production\.ai\]/.test(wrangler))
assert('9 AI no-results state is friendly and not fabricated', /No matching listings/.test(aiJs) && /couldn't find a matching MLL business/.test(aiApi))

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
assert('premium hero avoids legacy mll-hero-inner 820px trap', !/class="mll-hero-inner"/.test(index) && /mll-hero-split/.test(index) && /max-width: 820px/.test(readFileSync(join(root, 'frontend/css/components.css'), 'utf8')))
assert('desktop hero is explicit two-column grid', /grid-template-columns: minmax\(0, 56%\) minmax\(0, 44%\)/.test(themeCss) && /mll-hero-copy/.test(index) && /mll-hero-media/.test(index))
assert('hero columns cannot collapse under image min-content', /\.mll-hero-copy \{[\s\S]*min-width: 0/.test(themeCss) && /\.mll-hero-media \{[\s\S]*min-width: 0/.test(themeCss))
assert('hero media clips image overflow', /\.mll-hero-media \{[\s\S]*overflow: hidden/.test(themeCss))
assert('hero image fills media cell with cover', /width: 100%/.test(themeCss) && /height: 100%/.test(themeCss) && /object-fit: cover/.test(themeCss) && /object-position: center 30%/.test(themeCss))
assert('hero image crop keeps family heads in frame', /object-position: center 30%/.test(themeCss) && /object-position: center 24%/.test(themeCss) && /object-position: center 32%/.test(themeCss))
const heroImgRule = between(themeCss, '.mll-hero-media img.mll-hero-bg {', '}')
assert('desktop hero image is not absolutely positioned across copy', /object-fit: cover/.test(heroImgRule) && !/position:\s*absolute/.test(heroImgRule) && !/\.mll-hero-premium img\.mll-hero-bg \{/.test(themeCss))
assert('hero copy is left aligned', /mll-hero-copy/.test(index) && /text-align: left/.test(themeCss) && /align-items: flex-start/.test(themeCss))
assert('desktop hero height is <= 410', /height: 380px/.test(themeCss) && /max-height: 400px/.test(themeCss) && !/min-height: 440px/.test(themeCss) && !/min-height: 560px/.test(themeCss))
assert('compact header 64-70', /min-height: 66px/.test(themeCss))
assert('search lives inside the copy column', /mll-hero-search/.test(between(index, 'mll-hero-copy', 'mll-hero-media')) && /id="search-input"/.test(between(index, 'mll-hero-copy', 'mll-hero-media')))
assert('search is constrained inside copy', /max-width: 780px/.test(themeCss) && /minmax\(0, 1fr\) minmax\(180px, 0\.55fr\) 100px/.test(themeCss))
assert('popular searches wrap inside copy', /Popular Searches:/.test(between(index, 'mll-hero-premium', '</section>')) && /mll-hero-popular/.test(index) && /flex-wrap: wrap/.test(themeCss))
assert('popular row sits below search with bottom breathing room', /margin-top: 12px/.test(themeCss) && /padding: 16px 24px 20px/.test(themeCss) && between(index, 'mll-hero-search', 'mll-hero-media').indexOf('mll-hero-popular') > 0)
assert('desktop widths 1366-2560 keep the same two-column grid', /minmax\(0, 56%\) minmax\(0, 44%\)/.test(themeCss) && !/\.mll-hero-split[^{]*\{[^}]*max-width:\s*820px/.test(themeCss) && /max-width: 1099px/.test(themeCss) && /max-width: 767px/.test(themeCss))
assert('tablet and mobile stack hero columns', /max-width: 1099px/.test(themeCss) && /max-width: 767px/.test(themeCss) && count(themeCss, /grid-template-columns: minmax\(0, 1fr\)/g) >= 2)
assert('shared mll-container width', /\.mll-container/.test(themeCss) && /max-width: 1260px/.test(themeCss) && /class="mll-container"/.test(index))
assert('shortcut row sits before featured', index.indexOf('id="mll-shortcuts"') > 0 && index.indexOf('id="mll-shortcuts"') < index.indexOf('id="featured"'))
assert('six compact shortcuts', count(between(index, 'id="mll-shortcuts"', '</section>'), /class="mll-shortcut"/g) === 6)
assert('featured heading is Featured Latino Businesses', /Featured Latino Businesses/.test(between(index, 'id="featured"', 'mll-cta-band')) && /View All Businesses/.test(between(index, 'id="featured"', 'mll-cta-band')))
assert('featured desktop is four columns', /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/.test(themeCss))
assert('category shortcuts use existing routes', /class="mll-shortcuts"/.test(index) && /href="pages\/directory\.html"/.test(index) && /href="pages\/jobs\.html"/.test(index) && /href="pages\/marketplace\.html"/.test(index) && /href="pages\/voz\.html"/.test(index) && /href="\/pages\/partners"/.test(index) && /href="pages\/enroll\.html"/.test(index))
assert('community CTA uses existing enroll', /A Stronger Community Starts With You/.test(index) && /Join MyLatinoList Today/.test(index) && /pages\/enroll\.html/.test(between(index, 'mll-cta-band', '</section>')))
assert('La Voz latest grid is API-driven', /id="voz-latest-grid"/.test(index) && /voz-latest-grid/.test(mainJs) && /\/api\/resources/.test(mainJs) && /Latest from La Voz Latino/.test(index))
assert('AI launcher desktop offset', /right: 24px/.test(aiCss) && /bottom: 24px/.test(aiCss) && /linear-gradient/.test(aiCss))
assert('AI desktop panel is docked', /min-width: 1200px/.test(aiCss) && /top: 100px/.test(aiCss) && /max-height: calc\(100vh - 130px\)/.test(aiCss) && /width: 360px/.test(aiCss))
assert('AI mobile panel remains bottom sheet', /max-width: 768px/.test(aiCss) && /border-radius: 20px 20px 0 0/.test(aiCss))
assert('responsive breakpoints cover tablet and mobile', /max-width: 1099px/.test(themeCss) && /max-width: 767px/.test(themeCss) && /max-width: 768px/.test(aiCss))
assert('Worker AI routes are public', /path === '\/api\/ai\/status'/.test(worker) && /path === '\/api\/ai\/search'/.test(worker) && /handleAiSearch/.test(worker))
assert('Worker AI never invents businesses', /Never invent businesses/.test(aiApi) && /publicBusiness/.test(aiApi) && /SAFE_BIZ/.test(aiApi))
assert('quota entitlements are stubbed not billed', /visitor: 3/.test(aiJs) && /auth: 10/.test(aiJs) && /AUTH_LIMIT = 10/.test(aiApi) && !/create-checkout-session/.test(aiApi) && !/STRIPE/.test(aiApi))
assert('Affiliates stays out of desktop shortcuts', !/affiliates\.html/.test(between(index, 'id="mll-shortcuts"', '</section>')))
assert('homepage hamburger still has Affiliates', /pages\/affiliates\.html/.test(homeMobile))
assert('mobile menu button exists', /id="hamburger"/.test(index) && /aria-label="Open menu"/.test(index) && /aria-expanded/.test(index) && /aria-controls="nav-mobile"/.test(index))
assert('mobile drawer/menu exists', /id="nav-mobile"/.test(index) && /id="nav-mobile-backdrop"/.test(index) && /aria-label="Close menu"/.test(index) && /mll-nav-open/.test(navJs) && /Escape/.test(navJs))
assert('mobile drawer keeps Search Saved Sign In', /data-en="Search"/.test(homeMobile) && /data-en="Saved"/.test(homeMobile) && /id="mob-signin"/.test(homeMobile) && /id="mob-dashboard"/.test(homeMobile))
assert('mobile Popular Search pills use strong white border', /@media \(max-width: 767px\)[\s\S]*\.mll-hero-premium \.mll-pill \{[\s\S]*border: 2px solid rgba\(255,255,255,\.80\)/.test(themeCss) && /background: rgba\(255,255,255,\.08\)/.test(themeCss) && /min-height: 38px/.test(themeCss))
assert('mobile menu drawer contains Home through For Business', /data-en="Home"/.test(homeMobile) && /data-en="Businesses"/.test(homeMobile) && /data-en="Jobs"/.test(homeMobile) && /data-en="Marketplace"/.test(homeMobile) && /data-en="La Voz Latino"/.test(homeMobile) && /data-en="Partners"/.test(homeMobile) && /data-en="For Business"/.test(homeMobile))
assert('mobile menu drawer contains List Your Business', /data-en="List Your Business"/.test(homeMobile) && /mll-nav-cta/.test(homeMobile))
assert('mobile menu reuses desktop v2-links source', /function syncMobileDrawerFromDesktop/.test(navJs) && /nav-mobile-primary/.test(navJs) && /getElementById\('nav-mobile-primary'\)/.test(navJs))
assert('signed-in mobile account uses existing token toggle', /getElementById\('mob-signin'\)/.test(mainJs) && /getElementById\('mob-dashboard'\)/.test(mainJs) && /sessionStorage\.getItem\('mll_token'\)/.test(mainJs))
assert('mobile drawer open/close hooks lock scroll', /function openMobileDrawer/.test(navJs) && /function closeMobileDrawer/.test(navJs) && /mll-nav-open/.test(navJs) && /Escape/.test(navJs) && /nav-mobile-backdrop/.test(navJs) && /body\.mll-nav-open \{ overflow: hidden; \}/.test(themeCss))
assert('mobile drawer is not clipped by header containing-block', /backdrop-filter: none/.test(themeCss) && /height: 100dvh/.test(themeCss))
assert('desktop navigation source is unchanged', /<div class="v2-links">/.test(index) && count(desktop, /data-en="Home"/g) === 1 && count(desktop, /data-en="For Business"/g) === 1)
assert('desktop shortcuts remain 6 columns', /grid-template-columns: repeat\(6, 1fr\)/.test(themeCss))
assert('tablet shortcuts use 3 columns', /repeat\(3, minmax\(0, 1fr\)\)/.test(themeCss))
assert('mobile shortcuts use 2-column grid not horizontal scroll', /repeat\(2, minmax\(0, 1fr\)\)/.test(themeCss) && !/\.mll-shortcuts \{ display: flex; overflow-x: auto/.test(themeCss))
assert('mobile Popular Searches uses grid', /@media \(max-width: 767px\)[\s\S]*\.mll-hero-popular \{[\s\S]*display: grid/.test(themeCss) && /max-width: 360px/.test(themeCss))
const mobileHero = between(themeCss, '@media (max-width: 767px) {', '@media (max-width: 360px)')
assert('mobile hero family image is first', /\.mll-hero-media \{[\s\S]*order: 1/.test(mobileHero) && /\.mll-hero-copy \{[\s\S]*order: 2/.test(mobileHero))
assert('mobile hero copy is second under image', /\.mll-hero-copy \{[\s\S]*order: 2/.test(mobileHero) && /\.mll-hero-copy \{[\s\S]*padding: 18px 12px 20px/.test(mobileHero))
assert('mobile hero search and popular remain in copy', /mll-hero-search/.test(between(index, 'mll-hero-copy', 'mll-hero-media')) && /mll-hero-popular/.test(between(index, 'mll-hero-search', 'mll-hero-media')))
assert('mobile family image is a full-width banner', /\.mll-hero-media \{[\s\S]*width: 100%/.test(mobileHero) && /\.mll-hero-media \{[\s\S]*height: 230px/.test(mobileHero) && /object-fit: cover/.test(mobileHero) && /object-position: center 32%/.test(mobileHero))
assert('mobile hero uses one existing family image', count(index, /hero-community-v2\.png/g) === 1 && count(index, /class="mll-hero-media"/g) === 1)
const tabletHero = between(themeCss, '@media (max-width: 1099px) {', '@media (max-width: 767px)')
assert('tablet hero does not use mobile image-first order', !/\.mll-hero-media \{[\s\S]*order: 1/.test(tabletHero) && !/\.mll-hero-copy \{[\s\S]*order: 2/.test(tabletHero))
assert('desktop split hero stays copy left image right', /grid-template-columns: minmax\(0, 56%\) minmax\(0, 44%\)/.test(themeCss) && index.indexOf('mll-hero-copy') < index.indexOf('mll-hero-media') && !/\border:/.test(between(themeCss, '.mll-hero-split {', '.mll-hero-copy {')))
assert('mobile hamburger remains after hero flow change', /id="hamburger"/.test(index) && /aria-controls="nav-mobile"/.test(index))
assert('mobile toolbar order is Logo EN/ES MLL AI Menu', /class="logo"/.test(index) && /class="lang-toggle"/.test(index) && /id="mll-ai-toolbar"/.test(index) && /id="hamburger"/.test(index) && index.indexOf('class="logo"') < index.indexOf('class="lang-toggle"') && index.indexOf('class="lang-toggle"') < index.indexOf('id="mll-ai-toolbar"') && index.indexOf('id="mll-ai-toolbar"') < index.indexOf('id="hamburger"'))
assert('mobile toolbar uses compact 4-column grid', /@media \(max-width: 767px\)[\s\S]*grid-template-columns: auto auto minmax\(0, 1fr\) auto/.test(themeCss) && /\.v2-home \.v2-top-actions \{ display: contents; \}/.test(themeCss))
assert('mobile toolbar AI opens existing bottom sheet', /id="mll-ai-toolbar"/.test(index) && /✨/.test(index) && /mll-ai-toolbar-brand/.test(index) && /getElementById\('mll-ai-launch'\)/.test(navJs) && /function bindToolbarAi/.test(navJs) && /Ask MLL AI/.test(aiJs))
assert('mobile floating AI launcher is hidden', /@media \(max-width: 767px\)[\s\S]*\.v2-home \.mll-ai-launch \{ display: none; \}/.test(themeCss))
assert('desktop toolbar AI pill stays hidden', /\.v2-home \.mll-ai-toolbar \{ display: none; \}/.test(themeCss) && !/@media \(min-width: 1100px\)[\s\S]*\.mll-ai-toolbar \{[\s\S]*display: inline-flex/.test(themeCss))
assert('tiny screens shorten toolbar AI label', /@media \(max-width: 360px\)[\s\S]*\.v2-home \.mll-ai-toolbar-brand \{ display: none; \}/.test(themeCss))

if (failed) {
  console.error('mll ai theme tests FAIL ' + failed)
  process.exit(1)
}
console.log('mll ai theme tests PASS')
