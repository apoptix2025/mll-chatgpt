#!/usr/bin/env node
/**
 * Public pricing page contract tests.
 * Does not call Stripe. Does not print secrets.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0

function assert(label, cond) {
  if (cond) console.log('PASS  ' + label)
  else { failed += 1; console.error('FAIL  ' + label) }
}

const pricingPath = join(root, 'frontend/pages/pricing.html')
assert('pricing.html exists', existsSync(pricingPath))
const pricing = readFileSync(pricingPath, 'utf8')
const billing = readFileSync(join(root, 'frontend/pages/billing.html'), 'utf8')
const index = readFileSync(join(root, 'frontend/index.html'), 'utf8')
const partners = readFileSync(join(root, 'frontend/pages/partners.html'), 'utf8')

assert('unique pricing markers', /data-mll-page="pricing"/.test(pricing) && /MLL Pricing/.test(pricing) && /Choose your plan/.test(pricing))
assert('not homepage fallback', !/v2-hero/.test(pricing) && !/Popular near you/.test(pricing))
assert('public — no token gate', !/if \(!token\) window\.location\.href = 'login\.html'/.test(pricing))
assert('Starter $0', /\$0/.test(pricing))
assert('Basic $19 matches billing', /basic:'\$19'/.test(pricing) && /basic:'\$19'/.test(billing))
assert('Pro $49 matches billing', /pro:'\$49'/.test(pricing) && /pro:'\$49'/.test(billing))
assert('Featured $99 matches billing', /featured:'\$99'/.test(pricing) && /featured:'\$99'/.test(billing))
assert('Agency $299 matches billing', /agency:'\$299'/.test(pricing) && /agency:'\$299'/.test(billing))
assert('annual prices match billing', /basic:'\$190'/.test(pricing) && /pro:'\$490'/.test(pricing) && /featured:'\$990'/.test(pricing) && /agency:'\$2,990'/.test(pricing))
assert('unauth paid CTA enrolls', /data-plan-cta[\s\S]*href="enroll\.html"/.test(pricing) || /a\.href = 'enroll\.html'/.test(pricing))
assert('auth paid CTA goes to billing', /href = 'billing\.html'/.test(pricing))
assert('no Stripe checkout on pricing', !/create-checkout-session/.test(pricing))
assert('Agency is contact mailto', /mailto:partners@mylatinolist\.io/.test(pricing))
assert('homepage Pricing → /pages/pricing', /href="\/pages\/pricing"/.test(index))
assert('partners Pricing → /pages/pricing', /href="\/pages\/pricing"/.test(partners))
assert('homepage no longer uses enroll#pricing', !/enroll\.html#pricing/.test(index))

if (failed) {
  console.error('pricing tests FAIL ' + failed)
  process.exit(1)
}
console.log('pricing tests PASS')
