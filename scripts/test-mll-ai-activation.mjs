#!/usr/bin/env node
/**
 * Staging AI activation source guards. Does not call production. Does not print secrets.
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

const wrangler = readFileSync(join(root, 'workers/wrangler.toml'), 'utf8')
const aiApi = readFileSync(join(root, 'workers/src/api/ai-search.ts'), 'utf8')
const aiJs = readFileSync(join(root, 'frontend/js/mll-ai.js'), 'utf8')
const aiCss = readFileSync(join(root, 'frontend/css/mll-ai.css'), 'utf8')
const worker = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')

assert('small instruct model is Worker-side only', /MLL_AI_MODEL = '@cf\/meta\/llama-3\.2-3b-instruct'/.test(aiApi) && !/llama-3\.2-3b-instruct/.test(aiJs))
assert('no large expensive model', !/70b|llama-3\.1-8b|gpt-4|claude/i.test(aiApi))
assert('staging AI binding only', /\[env\.staging\.ai\]/.test(wrangler) && /binding = "AI"/.test(wrangler) && !/(?:^|\n)\[env\.production\.ai\]/.test(wrangler) && !/(?:^|\n)\[ai\]/.test(wrangler))
assert('production remains AI disabled', /\[env\.production\.vars\][\s\S]*?MLL_AI_ENABLED = "false"/.test(wrangler))
assert('staging AI enabled', /\[env\.staging\.vars\][\s\S]*?MLL_AI_ENABLED = "true"/.test(wrangler))
assert('supported intents only', /business_search/.test(aiApi) && /job_search/.test(aiApi) && /resource_search/.test(aiApi) && /unsupported/.test(aiApi))
assert('spanish intent keywords', /abogado/.test(aiApi) && /restaurante/.test(aiApi) && /empleo/.test(aiApi) && /inmigraci/.test(aiApi))
assert('never invent listings', /Never invent businesses/.test(aiApi) && /publicBusiness/.test(aiApi) && /SAFE_BIZ/.test(aiApi))
assert('quota is KV not localStorage-only', /aiquota:/.test(aiApi) && /SESSION_CACHE/.test(aiApi) && /hashedId/.test(aiApi))
assert('rate limit 429', /airate:/.test(aiApi) && /RATE_TTL_SEC = 4/.test(aiApi) && /rate_limited/.test(aiApi))
assert('query length 300', /MAX_QUERY = 300/.test(aiApi) && /maxlength="300"/.test(aiJs))
assert('visitor 3 / auth 10', /VISITOR_LIMIT = 3/.test(aiApi) && /AUTH_LIMIT = 10/.test(aiApi))
assert('no Stripe AI billing', !/STRIPE/.test(aiApi) && !/create-checkout-session/.test(aiApi))
assert('usage metrics keys', /aimetrics:/.test(aiApi) && /bumpMetric/.test(aiApi))
assert('canonical business route', /\/pages\/business\?slug=/.test(aiJs))
assert('quota copy near input', /free AI searches available/.test(aiJs) && /You've used your free MLL AI searches/.test(aiJs) && /Create Account/.test(aiJs) && /View Plans/.test(aiJs))
assert('error fallbacks', /temporarily unavailable/.test(aiJs) && /MLL AI is coming soon/.test(aiJs))
assert('desktop panel ~360', /width: 360px/.test(aiCss))
assert('AI routes remain public', /path === '\/api\/ai\/status'/.test(worker) && /path === '\/api\/ai\/search'/.test(worker))

if (failed) {
  console.error('mll ai activation tests FAIL ' + failed)
  process.exit(1)
}
console.log('mll ai activation tests PASS')
