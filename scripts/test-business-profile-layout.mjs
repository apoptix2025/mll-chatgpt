#!/usr/bin/env node
/**
 * Public business profile header layout (banner / title / avatar).
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

function block(source, selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]+)\\}')
  const match = source.match(re)
  return match ? match[1] : ''
}

function decl(block, prop) {
  const re = new RegExp('(?:^|;)\\s*' + prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*([^;]+)', 'i')
  const m = block.match(re)
  return m ? m[1].trim() : ''
}

function px(value) {
  const m = String(value).match(/(-?\d+(?:\.\d+)?)px/)
  return m ? Number(m[1]) : NaN
}

const html = readFileSync(join(root, 'frontend/pages/business.html'), 'utf8')
const visual = readFileSync(join(root, 'frontend/css/v2-visual.css'), 'utf8')
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/)
const pageCss = styleMatch ? styleMatch[1] : ''

assert('banner container is present', /class="prof-banner" id="prof-banner"/.test(html))
assert('identity container is present', /class="prof-identity"/.test(html))
assert('avatar container is present', /class="prof-avatar" id="biz-avatar"/.test(html))
assert('business name is present', /<h1 id="biz-name">/.test(html))
assert('category/location row is present', /class="biz-meta-row"/.test(html) && /id="biz-cat"/.test(html) && /id="biz-location"/.test(html))
assert('review row is present', /class="biz-rating-row"/.test(html))
assert('action buttons are present', /id="btn-save"/.test(html) && /id="btn-call"/.test(html) && /id="btn-message"/.test(html) && /id="btn-directions"/.test(html))
assert('profile tabs are present', /showTab\('overview'/.test(html) && /showTab\('products'/.test(html) && /showTab\('photos'/.test(html) && /showTab\('reviews'/.test(html))

const section = visual.slice(
  visual.indexOf('/* Business profile */'),
  visual.indexOf('/* Listing wizard */')
)
const identity = block(section, '.prof-identity')
const avatar = block(section, '.prof-avatar')
const info = block(pageCss, '.biz-info')
const title = block(pageCss, '.biz-info h1')
const hero = block(pageCss, '.biz-hero')

assert('identity is not pulled into the banner', decl(identity, 'margin-top') === '0' && !/margin-top\s*:\s*-/.test(identity))
assert('identity aligns title below banner', decl(identity, 'align-items') === 'flex-start')
const identityPad = px(decl(identity, 'padding-top'))
assert('identity has 16–24px gap below banner', identityPad >= 16 && identityPad <= 24)
assert('avatar overlap is preserved', px(decl(avatar, 'margin-top')) <= -48)
assert('hero no longer adds competing top padding', decl(hero, 'padding') === '0')
assert('title can wrap long names', /overflow-wrap\s*:\s*anywhere/.test(title) && /word-break\s*:\s*break-word/.test(title))
assert('title block can shrink without overflow', decl(info, 'min-width') === '0')
assert('title is not AP Optix-specific', !/ap-optix|AP Optix/.test(identity + avatar + info + title))

const profileStart = visual.indexOf('/* Business profile */')
const identityIdx = visual.indexOf('.prof-identity {', profileStart)
const lastMobile = visual.lastIndexOf('@media (max-width: 768px)')
assert('tablet/mobile profile overrides follow base rules', lastMobile > identityIdx && /padding-top:\s*16px/.test(visual.slice(lastMobile)))
assert('mobile avatar stays smaller than title block', /margin-top:\s*-56px/.test(visual) && /width:\s*88px/.test(visual))
assert('canonical slug route is unchanged', /\/pages\/business\?slug=/.test(html) && /params\.get\('slug'\)/.test(html))
assert('services empty state is unchanged', /id="no-products"[\s\S]*No products listed yet\./.test(html))

if (failed) {
  console.error('business profile layout tests FAIL ' + failed)
  process.exit(1)
}
console.log('business profile layout tests PASS')
