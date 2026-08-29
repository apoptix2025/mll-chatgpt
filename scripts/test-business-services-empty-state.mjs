#!/usr/bin/env node
/**
 * Public profile Services tab empty/error state.
 * Does not call production. Does not print secrets.
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

const html = readFileSync(join(root, 'frontend/pages/business.html'), 'utf8')
const fnMatch = html.match(/function marketplaceOfferingsView\(payload, bizId, failed\) \{[\s\S]*?return \{ state: products\.length \? 'ready' : 'empty', products: products \};\r?\n\}/)
assert('helper is present', !!fnMatch)

const marketplaceOfferingsView = fnMatch
  ? new Function(fnMatch[0] + '; return marketplaceOfferingsView;')()
  : function () { return { state: 'error', products: [] } }

const BIZ = '7e735f46-9dc1-4ecf-936b-7342e566978a'
const OTHER = '211e7c32-31c9-4e7d-a669-ac1c8c6496b4'
const sample = { business_id: BIZ, name: 'Test Widget', price: 12, emoji: '📦', bg_color: '#EBF2FF', rating: 4.5 }

const zero = marketplaceOfferingsView({ products: [] }, BIZ, false)
assert('A zero products is empty', zero.state === 'empty' && zero.products.length === 0)

const missing = marketplaceOfferingsView({ products: null }, BIZ, false)
const omitted = marketplaceOfferingsView({}, BIZ, false)
assert('A missing/null products is empty', missing.state === 'empty' && omitted.state === 'empty')

const noneMatch = marketplaceOfferingsView({
  products: [{ business_id: OTHER, name: 'Other', price: 5, emoji: '📦', bg_color: '#eee', rating: 5 }],
}, BIZ, false)
assert('B unmatched business_id is empty', noneMatch.state === 'empty' && noneMatch.products.length === 0)

const ready = marketplaceOfferingsView({ products: [sample] }, BIZ, false)
assert('C matching product is ready', ready.state === 'ready' && ready.products.length === 1 && ready.products[0].name === 'Test Widget')

const err = marketplaceOfferingsView({ products: [sample] }, BIZ, true)
assert('D failed request is error', err.state === 'error' && err.products.length === 0)

assert('A empty copy remains', /id="no-products"[\s\S]*No products listed yet\./.test(html))
assert('A empty state is shown after empty result', /showProductsEmptyState\('No products listed yet\.'\)/.test(html))
assert('A empty state stays hidden while loading', /if \(empty\) empty\.style\.display = 'none';/.test(html))
assert('A early blank return is gone', !/if \(!prods\.length\) return;/.test(html))
assert('B unmatched uses same empty helper', /marketplaceOfferingsView\(data, bizId, false\)/.test(html))
assert('C product cards still use name/price/emoji/bg_color/rating', /p\.name/.test(html) && /p\.price/.test(html) && /p\.emoji/.test(html) && /p\.bg_color/.test(html) && /p\.rating/.test(html))
assert('D API error uses safe message', /Products are unavailable right now\./.test(html) && /if \(!res\.ok\) throw/.test(html))
assert('D catch is not silent', /catch \{\s*showProductsEmptyState\('Products are unavailable right now\.'\)/.test(html))

assert('E About tab still switches', /showTab\('overview'/.test(html) && /id="tab-overview"/.test(html))
assert('E Services tab still switches products panel', /showTab\('products'/.test(html) && /id="tab-products"/.test(html))
assert('E Photos tab still switches', /showTab\('photos'/.test(html) && /id="tab-photos"/.test(html))
assert('E Reviews tab still switches', /showTab\('reviews'/.test(html) && /id="tab-reviews"/.test(html))
assert('E showTab still toggles known panels', /\['overview','products','photos','reviews','hours'\]/.test(html))
assert('no new services schema/API', !/business_services/.test(html) && !/PUT \/api\/businesses/.test(html))

if (failed) {
  console.error('business services empty-state tests FAIL ' + failed)
  process.exit(1)
}
console.log('business services empty-state tests PASS')
