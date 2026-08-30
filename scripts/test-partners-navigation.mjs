#!/usr/bin/env node
/**
 * Public Partners navigation restore.
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

function count(source, re) {
  return (source.match(re) || []).length
}

function between(source, start, end) {
  const a = source.indexOf(start)
  const b = source.indexOf(end, a + start.length)
  return a >= 0 && b > a ? source.slice(a, b) : ''
}

const index = readFileSync(join(root, 'frontend/index.html'), 'utf8')
const navJs = readFileSync(join(root, 'frontend/js/nav.js'), 'utf8')
const partners = readFileSync(join(root, 'frontend/pages/partners.html'), 'utf8')
const affiliates = readFileSync(join(root, 'frontend/pages/affiliates.html'), 'utf8')
const workerIndex = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')

const desktop = between(index, '<div class="v2-links">', '</div>')
const homeMobile = between(index, '<div class="nav-mobile" id="nav-mobile">', '</nav>')
const injected = between(navJs, 'function injectMarketingNav()', 'function injectMobileNav()')
const injectedDesktop = between(injected, "'<div class=\"v2-links\">'", "'</div>' +")
const injectedMobile = between(injected, "'<div class=\"nav-mobile\" id=\"nav-mobile\">'", ';')

const order = /La Voz Latino[\s\S]+Partners[\s\S]+For Business/
const partnersHref = /href="\/pages\/partners"/
const pagesPages = /\/pages\/pages\/partners/
const partnersLabel = /data-en="Partners"/

assert('A homepage desktop includes Partners', partnersHref.test(desktop) && partnersLabel.test(desktop) && /Partners<\/a>/.test(desktop))
assert('A homepage desktop order is Discover…Partners…For Business', order.test(desktop) && /Discover[\s\S]+Jobs[\s\S]+Marketplace[\s\S]+La Voz Latino/.test(desktop))
assert('A homepage desktop Partners appears once', count(desktop, /data-en="Partners"/g) === 1)

assert('B injected desktop includes Partners', partnersHref.test(injectedDesktop) && partnersLabel.test(injectedDesktop))
assert('B injected desktop order includes Partners before For Business', order.test(injectedDesktop))
assert('B injected desktop Partners appears once', count(injectedDesktop, /data-en="Partners"/g) === 1)

assert('C homepage mobile includes Partners', partnersHref.test(homeMobile) && partnersLabel.test(homeMobile))
assert('C homepage mobile Partners appears once', count(homeMobile, /data-en="Partners"/g) === 1)
assert('C injected mobile includes Partners', partnersHref.test(injectedMobile) && partnersLabel.test(injectedMobile))
assert('C injected mobile Partners appears once', count(injectedMobile, /data-en="Partners"/g) === 1)

assert('D Partners route is /pages/partners', partnersHref.test(desktop) && partnersHref.test(injected) && !/href="\/pages\/partners\.html"/.test(desktop + injectedDesktop + injectedMobile + homeMobile))
assert('D no /pages/pages/partners links', !pagesPages.test(index) && !pagesPages.test(navJs) && !pagesPages.test(partners))

assert('E no duplicate Partners in homepage desktop', count(desktop, /data-en="Partners"/g) === 1)
assert('E no duplicate Partners in homepage mobile', count(homeMobile, /data-en="Partners"/g) === 1)
assert('E no duplicate Partners in injected nav', count(injected, /data-en="Partners"/g) === 2)

assert('F Peblla card remains present', /<span class="sp-name">Peblla<\/span>/.test(partners) && /href="https:\/\/www\.peblla\.com\/"/.test(partners) && /Visit Peblla/.test(partners))
assert('F partners page is still a marketing page', /Partners we trust/.test(partners) && !/\/api\/partners/.test(partners))

assert('G Affiliates is not treated as Partners', /affiliates\.html/.test(affiliates) && /\/api\/affiliates/.test(affiliates) && !/\/api\/affiliates/.test(partners))
assert('G injected public top nav does not add Affiliates', !/affiliates\.html/.test(injectedDesktop) && !/data-en="Affiliates"/.test(injectedDesktop))

assert('H no /api/partners dependency', !/\/api\/partners/.test(index) && !/\/api\/partners/.test(navJs) && !/\/api\/partners/.test(partners) && !/\/api\/partners/.test(workerIndex))
assert('H footer still has Partners', /href="\/pages\/partners\.html"[\s\S]*data-en="Partners"/.test(index))
assert('H partners.html is unchanged as the destination page', /id="partner"/.test(partners) && /mailto:partners@mylatinolist\.io/.test(partners))

if (failed) {
  console.error('partners navigation tests FAIL ' + failed)
  process.exit(1)
}
console.log('partners navigation tests PASS')
