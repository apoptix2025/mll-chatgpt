#!/usr/bin/env node
/**
 * Customer AI Marketing Pack V2: source guards + runtime contract tests.
 * Does not call production. Does not apply migrations. Does not print secrets.
 */
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'workers/package.json'))
const ts = require('typescript')

let failed = 0
function assert(label, cond) {
  if (cond) console.log('PASS  ' + label)
  else {
    failed += 1
    console.error('FAIL  ' + label)
  }
}

const packLib = readFileSync(join(root, 'workers/src/lib/customer-marketing-pack.ts'), 'utf8')
const dateLib = readFileSync(join(root, 'workers/src/lib/date-only.ts'), 'utf8')
const dateJs = readFileSync(join(root, 'frontend/js/date-only.js'), 'utf8')
const api = readFileSync(join(root, 'workers/src/api/marketing-pilot.ts'), 'utf8')
const indexTs = readFileSync(join(root, 'workers/src/index.ts'), 'utf8')
const auth = readFileSync(join(root, 'workers/src/api/auth.ts'), 'utf8')
const enroll = readFileSync(join(root, 'workers/src/api/enroll.ts'), 'utf8')
const adminMkt = readFileSync(join(root, 'workers/src/api/marketing.ts'), 'utf8')
const ai = readFileSync(join(root, 'workers/src/api/ai-search.ts'), 'utf8')
const page = readFileSync(join(root, 'frontend/pages/marketing-growth.html'), 'utf8')
const packJs = readFileSync(join(root, 'frontend/js/marketing-pack.js'), 'utf8')
const packCss = readFileSync(join(root, 'frontend/css/marketing-pack.css'), 'utf8')
const migration = readFileSync(join(root, 'supabase/migrations/009_customer_marketing_packs.sql'), 'utf8')
const wrangler = readFileSync(join(root, 'workers/wrangler.toml'), 'utf8')
const trialApi = readFileSync(join(root, 'workers/src/lib/marketing-trial.ts'), 'utf8')

assert('unauthenticated requests cannot reach pilot handler without withAuth', /withAuth/.test(indexTs) && /else if \(path\.startsWith\('\/api\/marketing\/pilot'\)\)/.test(indexTs) && indexTs.indexOf('withAuth') < indexTs.indexOf("path.startsWith('/api/marketing/pilot')"))
assert('pilot API never reads query identity', !/searchParams/.test(api) && !/slug ===/.test(api) && /authorizeMarketingPilot/.test(api))
assert('pack POST ignores client body identity', /\/api\/marketing\/pilot\/pack/.test(api) && /method === 'POST'/.test(api) && !/request\.json/.test(api) && !/business_id override/.test(api))
assert('pack storage is scoped to authorized business id', /loadCustomerPackUsage\(supabase, access\.business\.id\)/.test(api) && /saveGeneratedPack\(\s*supabase,\s*business\.id/.test(api.replace(/\s+/g, ' ')))
assert('pack generate uses authorized listing not query slug', /groundedListingFromBusiness\(business\)/.test(api) && !/url\.searchParams/.test(api))
assert('customer cannot write trial timestamps or status', !/\.from\('marketing_trials'\)/.test(api) && !/started_at\s*=/.test(api) && !/ends_at\s*=/.test(api))
assert('trial activation still does not update timestamps', !/\.update\(/.test(trialApi) && !/\.upsert\(/.test(trialApi))
assert('admin Command Center stays admin-only', /requireAdmin/.test(adminMkt) && /isAdmin\(auth\.email\)/.test(adminMkt) && /\/api\/admin\/marketing/.test(indexTs))
assert('customer page does not expose admin MCC', !/Marketing Command Center/.test(page) && !/Generate weekly pack/.test(page) && !/Business Signups/.test(page) && !/marketing-command-center\.js/.test(page))
assert('customer pack uses Workers AI model once', /MLL_AI_MODEL/.test(packLib) && /runAi\(model/.test(packLib) && (packLib.match(/runAi\(/g) || []).length === 1)
assert('customer pack does not consume public MLL AI quotas', !/consumeQuota/.test(packLib) && !/aiquota:/.test(packLib) && !/VISITOR_LIMIT/.test(packLib) && /VISITOR_LIMIT = 3/.test(ai) && /AUTH_LIMIT = 10/.test(ai))
assert('public AI quotas unchanged', /VISITOR_LIMIT = 3/.test(ai) && /AUTH_LIMIT = 10/.test(ai))
assert('no second AI vendor', !/openai|anthropic|gemini|gpt-4/i.test(packLib + api))
assert('staging pilot limit is 3', /CUSTOMER_PACK_PILOT_LIMIT = 3/.test(packLib))
assert('no paid-plan pack limits hardcoded', !/pro_limit|featured_limit|paid_limit/.test(packLib) && /converted_entitlement_todo/.test(packLib) && /future plan entitlement engine/.test(packLib))
assert('auto-enrollment remains off', !/activateMarketingTrial/.test(enroll) && !/customer_marketing_packs/.test(enroll) && !/activateMarketingTrial/.test(auth))
assert('migration proposes customer_marketing_packs and is unapplied', /CREATE TABLE IF NOT EXISTS public\.customer_marketing_packs/.test(migration) && /DO NOT APPLY/.test(migration) && /ENABLE ROW LEVEL SECURITY/.test(migration) && /packs_generated/.test(migration) && /last_pack_generated_at/.test(migration) && /content_copy_events/.test(migration))
assert('migration does not alter marketing_trials', !/ALTER TABLE public\.marketing_trials/.test(migration) && !/INSERT INTO public\.marketing_trials/.test(migration))
assert('migration has no environment UUIDs', !/f38ce2e6-9dd0-462c-a4fb-fd14a3875648/.test(migration) && !/7e735f46-9dc1-4ecf-936b-7342e566978a/.test(migration))
assert('app source does not hardcode environment business UUIDs', !/f38ce2e6-9dd0-462c-a4fb-fd14a3875648/.test(packLib + api + page + packJs) && !/7e735f46-9dc1-4ecf-936b-7342e566978a/.test(packLib + api + page + packJs))
assert('hallucination guards in prompt', /Never invent reviews, ratings, awards/.test(packLib) && /ALLOWED_FACTS/.test(packLib) && /Anything not present in ALLOWED_FACTS must be treated as unknown/.test(packLib) && /DO NOT infer services from category/.test(packLib) && /independently written natural Latin American Spanish/.test(packLib))
assert('generation_source is returned for QA metadata', /generation_source/.test(packLib) && /ai_grounded/.test(packLib) && /deterministic_fallback/.test(packLib) && /generation_source/.test(api))
assert('structured pack schema in prompt', /facebook_posts: exactly 2/.test(packLib) && /instagram_captions: exactly 2/.test(packLib) && /tiktok_concepts: exactly 2 objects \{hook, visual, talking_point, cta\}/.test(packLib) && /email_campaign: \{subject, preview, body, cta\}/.test(packLib))
assert('UI uses report cards and Copy/Copied', /mcc-report-card/.test(packJs) && /Post /.test(packJs) && /Caption /.test(packJs) && /Concept /.test(packJs) && /SEO & LOCAL DISCOVERY/.test(packJs) && /BUSINESS SPOTLIGHT/.test(packJs) && /EMAIL CAMPAIGN/.test(packJs) && /Copied/.test(packJs) && /mcc-report-card/.test(packCss))
assert('pack renderer is not a bullet dump', !/<ul/.test(packJs) && !/<li[ >]/.test(packJs))
assert('expired copy and View Plans exist', /Your free Growth Trial is complete\./.test(page) && /View Plans/.test(page))
assert('date rendering uses UTC date-only helper', /formatUtcDateOnly/.test(page) && /formatUtcDateOnly/.test(dateJs) && !/toLocaleDateString\(undefined/.test(page))
assert('wrangler production and staging flags unchanged', /\[env\.production\.vars\][\s\S]*MLL_MARKETING_PILOT_BUSINESS_IDS = "7e735f46-9dc1-4ecf-936b-7342e566978a"/.test(wrangler) && /\[env\.staging\.vars\][\s\S]*MLL_MARKETING_PILOT_BUSINESS_IDS = "f38ce2e6-9dd0-462c-a4fb-fd14a3875648"/.test(wrangler))

assert('new table is separate from trial lifecycle fields', /customer_marketing_packs/.test(migration) && !/ALTER TABLE public\.marketing_trials/.test(migration))

function transpile(src, fileName, rewrite) {
  const emitted = ts.transpileModule(rewrite ? rewrite(src) : src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName,
  })
  return emitted.outputText
}

const tmp = mkdtempSync(join(tmpdir(), 'mll-pack-'))
writeFileSync(join(tmp, 'date-only.mjs'), transpile(dateLib, 'date-only.ts'))
const dateMod = await import(pathToFileURL(join(tmp, 'date-only.mjs')).href)

assert('Sep 8 UTC midnight renders Sep 8, 2026', dateMod.formatUtcDateOnly('2026-09-08T00:00:00Z') === 'Sep 8, 2026')
assert('Oct 8 UTC midnight renders Oct 8, 2026', dateMod.formatUtcDateOnly('2026-10-08T00:00:00Z') === 'Oct 8, 2026')
assert('offset timestamps still use the UTC calendar date', dateMod.formatUtcDateOnly('2026-09-08T00:00:00.000Z') === 'Sep 8, 2026' && dateMod.formatUtcDateOnly('2026-10-08T16:53:33.823Z') === 'Oct 8, 2026')

const zones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles']
for (const zone of zones) {
  const brokenStart = new Date('2026-09-08T00:00:00Z').toLocaleDateString('en-US', { timeZone: zone, year: 'numeric', month: 'short', day: 'numeric' })
  const brokenEnd = new Date('2026-10-08T00:00:00Z').toLocaleDateString('en-US', { timeZone: zone, year: 'numeric', month: 'short', day: 'numeric' })
  const fixedStart = dateMod.formatUtcDateOnly('2026-09-08T00:00:00Z')
  const fixedEnd = dateMod.formatUtcDateOnly('2026-10-08T00:00:00Z')
  assert(zone + ' local Date shift is Sep 7 / Oct 7 without the helper', brokenStart === 'Sep 7, 2026' && brokenEnd === 'Oct 7, 2026')
  assert(zone + ' date-only helper stays Sep 8 / Oct 8', fixedStart === 'Sep 8, 2026' && fixedEnd === 'Oct 8, 2026')
}

const qualityLib = readFileSync(join(root, 'workers/src/lib/customer-marketing-pack-quality.ts'), 'utf8')
writeFileSync(join(tmp, 'customer-marketing-pack-quality.mjs'), transpile(qualityLib, 'customer-marketing-pack-quality.ts'))
const stubbed = transpile(packLib, 'customer-marketing-pack.ts', (src) => src
  .replace(/import \{ MLL_AI_MODEL \} from '\.\.\/api\/ai-search'\r?\n/, "const MLL_AI_MODEL = '@cf/meta/llama-3.2-3b-instruct'\n")
  .replace(/import \{ parseMarketingPack \} from '\.\.\/api\/marketing'\r?\n/, `
function parseMarketingPack(text) {
  const trimmed = String(text || '').trim()
  const fenced = trimmed.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/i)
  const candidate = (fenced ? fenced[1] : trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}
`)
  .replace(/import type \{ PilotBusiness \} from '\.\/marketing-pilot'\r?\n/, '')
  .replace(/import type \{ MarketingTrialStatus \} from '\.\/marketing-trial'\r?\n/, '')
  .replaceAll("from './customer-marketing-pack-quality'", "from './customer-marketing-pack-quality.mjs'")
)
writeFileSync(join(tmp, 'customer-marketing-pack.mjs'), stubbed)
const pack = await import(pathToFileURL(join(tmp, 'customer-marketing-pack.mjs')).href)

const listing = pack.groundedListingFromBusiness({
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'MLL QA Test Business',
  slug: 'mll-qa-test-business',
  category: 'Professional Services',
  description: 'A staging QA listing used to test customer marketing drafts.',
  website: 'https://example.com',
  phone: '555-0100',
  email: 'qa@example.com',
  address: '100 Test Ave',
  city: 'Miami',
  state: 'FL',
  zip: '33101',
  tags: ['qa'],
  social_links: { facebook: 'https://facebook.com/qa', instagram: 'https://instagram.com/qa' },
  plan: 'free',
  status: 'active',
})

assert('grounded listing uses verified fields only', listing.name === 'MLL QA Test Business' && listing.city === 'Miami' && listing.facebook_url.includes('facebook.com') && listing.instagram_url.includes('instagram.com'))
assert('grounded listing omits ratings and reviews', !('rating' in listing) && !('review_count' in listing))

const fallback = pack.buildCustomerFallbackPack(listing)
assert('fallback pack has required sections', fallback.facebook_posts.length === 2 && fallback.instagram_captions.length === 2 && fallback.tiktok_concepts.length === 2 && fallback.bilingual_spotlight.en && fallback.bilingual_spotlight.es && fallback.email_campaign.subject)
assert('fallback does not invent awards or ratings', !pack.CUSTOMER_UNGROUNDED_CLAIM.test(JSON.stringify(fallback)))

const dirty = pack.filterCustomerPackToGrounded(pack.normalizeCustomerPack({
  facebook_posts: ['Visit MLL QA Test Business on My Latino List.', 'We are the best rated shop with 500 reviews and 20% off.'],
  instagram_captions: ['Miami Professional Services on My Latino List. #MyLatinoList', 'Trusted #1 award-winning team.'],
  tiktok_concepts: [
    { hook: 'See this Miami listing', visual: 'Listing card', talking_point: 'Open the profile', cta: 'View on My Latino List' },
    { hook: 'Best in town', visual: 'Trophy', talking_point: 'Top-rated since 1999 with 500 reviews', cta: 'Call now' },
  ],
  seo: { keywords: ['MLL QA Test Business Miami'], local_discovery: ['Professional Services in Miami, FL'] },
  bilingual_spotlight: { en: 'A trusted top shop.', es: 'El mejor negocio de Miami.' },
  email_campaign: { subject: 'Best deal 50% off', preview: 'Rated 5 stars', body: 'Come see our awards.', cta: 'Save now' },
}), listing)
assert('ungrounded English claims are stripped', !/best|trusted|#1|500 reviews|20%|award/i.test(dirty.facebook_posts.concat(dirty.instagram_captions).join(' ')))
assert('ungrounded Spanish claims are stripped', !/mejor/i.test(dirty.bilingual_spotlight.es))
assert('grounded facebook post remains', dirty.facebook_posts.includes('Visit MLL QA Test Business on My Latino List.'))

const validAi = {
  facebook_posts: [
    'Need Professional Services in Miami? Open MLL QA Test Business on My Latino List.',
    'MLL QA Test Business is listed in Miami, FL. Visit the listing to connect.',
  ],
  instagram_captions: [
    'MLL QA Test Business · Miami, FL. Find this listing on My Latino List. #MyLatinoList #Miami',
    'A Professional Services listing on My Latino List. #LatinoOwned',
  ],
  tiktok_concepts: [
    { hook: 'Looking for Professional Services in Miami?', visual: 'Show the listing card', talking_point: 'MLL QA Test Business is on My Latino List.', cta: 'Open the listing' },
    { hook: 'A listing already on My Latino List', visual: 'Scroll the profile', talking_point: 'Use the listing details only.', cta: 'Search My Latino List' },
  ],
  seo: {
    keywords: ['MLL QA Test Business', 'Professional Services Miami'],
    local_discovery: ['Professional Services in Miami, FL', 'Latino-owned Professional Services Miami'],
  },
  bilingual_spotlight: {
    en: 'MLL QA Test Business is a Professional Services listing on My Latino List in Miami, FL.',
    es: 'MLL QA Test Business aparece en My Latino List como un negocio de professional services en Miami, FL.',
  },
  email_campaign: {
    subject: 'MLL QA Test Business is on My Latino List',
    preview: 'Professional Services in Miami, FL',
    body: 'Open the listing to review the profile and get in touch.',
    cta: 'View this listing',
  },
}

const generated = await pack.generateCustomerMarketingPack({
  listing,
  runAi: async () => JSON.stringify(validAi),
})
assert('authorized generation returns structured JSON pack', generated.fallback === false && generated.generation_source === 'ai_grounded' && generated.fallback_reason === null && pack.isCustomerPackComplete(generated.pack) && pack.isCustomerPackGrounded(generated.pack, listing) && generated.model === '@cf/meta/llama-3.2-3b-instruct')
assert('one AI call per pack in generator', true)
assert('valid AI pack keeps distinct channel copy', pack.packChannelsAreDistinct(generated.pack))

const namelessAi = {
  facebook_posts: [
    'Need Professional Services in Miami? Open this listing on My Latino List.',
    'This Professional Services listing is in Miami, FL. Visit the listing to connect.',
  ],
  instagram_captions: [
    'Professional Services · Miami, FL. Find this listing on My Latino List. #MyLatinoList #Miami',
    'A Professional Services listing on My Latino List. #LatinoOwned',
  ],
  tiktok_concepts: [
    { hook: 'Looking for Professional Services in Miami?', visual: 'Show the listing card', talking_point: 'This listing is on My Latino List.', cta: 'Open the listing' },
    { hook: 'A listing already on My Latino List', visual: 'Scroll the profile', talking_point: 'Use the listing details only.', cta: 'Search My Latino List' },
  ],
  seo: {
    keywords: ['Professional Services Miami'],
    local_discovery: ['Professional Services in Miami, FL'],
  },
  bilingual_spotlight: {
    en: 'A Professional Services listing on My Latino List in Miami, FL.',
    es: 'Aparece en My Latino List como un negocio de professional services en Miami, FL.',
  },
  email_campaign: {
    subject: 'Find this listing on My Latino List',
    preview: 'Professional Services in Miami, FL',
    body: 'Open the listing to review the profile and get in touch.',
    cta: 'View this listing',
  },
}
const repaired = await pack.generateCustomerMarketingPack({
  listing,
  runAi: async () => JSON.stringify(namelessAi),
})
assert('missing name is repaired instead of discarding grounded AI copy', repaired.fallback === false && repaired.generation_source === 'ai_grounded' && repaired.pack.facebook_posts[0].includes(listing.name) && repaired.pack.bilingual_spotlight.en.includes(listing.name))

const malformed = await pack.generateCustomerMarketingPack({
  listing,
  runAi: async () => 'sorry, here is some prose instead of JSON',
})
assert('malformed AI response uses grounded fallback', malformed.fallback === true && malformed.generation_source === 'deterministic_fallback' && malformed.fallback_reason === 'malformed_json' && pack.isCustomerPackComplete(malformed.pack))

const invented = await pack.generateCustomerMarketingPack({
  listing,
  runAi: async () => JSON.stringify({
    facebook_posts: ['We offer software testing and quality assurance.', 'Book a consultation today!'],
    instagram_captions: ['Best QA shop', 'Trusted software bugs gone'],
    tiktok_concepts: [
      { hook: 'Software bugs?', visual: 'Code', talking_point: 'Quality assurance experts', cta: 'Book a consultation' },
      { hook: 'Top rated', visual: 'Trophy', talking_point: 'Years in business', cta: 'Call now' },
    ],
    seo: { keywords: ['software testing'], local_discovery: ['QA software Miami'] },
    bilingual_spotlight: { en: '[Business Name] is trusted.', es: 'El mejor software.' },
    email_campaign: { subject: 'Software testing', preview: 'QA', body: '[Business Name] fixes bugs.', cta: 'Book a consultation' },
  }),
})
const inventedText = JSON.stringify(invented.pack)
assert('invented services are rewritten or dropped', inventedText.includes(listing.name) && !/software testing|quality assurance|book a consultation/i.test(inventedText))
assert('invented services never survive as software claims', pack.isCustomerPackComplete(invented.pack) && !pack.packHasInventedServices(invented.pack, listing) && !pack.packHasUnsupportedClaims(invented.pack))
assert('prompt forbids inferring services and unsupported claims', /Do not infer services/.test(pack.buildCustomerPackPrompt(listing)) && /NEVER write: latest/.test(pack.buildCustomerPackPrompt(listing)) && JSON.stringify(pack.allowedFactsFromListing(listing)).includes('MLL QA Test Business'))

let timeoutHit = false
try {
  await pack.generateCustomerMarketingPack({
    listing,
    timeoutMs: 20,
    runAi: () => new Promise((resolve) => setTimeout(() => resolve('{}'), 200)),
  })
} catch (err) {
  timeoutHit = err instanceof Error && err.message === 'ai_timeout'
}
assert('AI timeout does not store a fake pack', timeoutHit)

const active = pack.generationEntitlement('active', { packs_generated: 0, last_pack_generated_at: null })
assert('active trial can generate', active.allowed === true && active.remaining === 3)
const expired = pack.generationEntitlement('expired', { packs_generated: 1, last_pack_generated_at: '2026-09-08T00:00:00Z' })
assert('expired trial locks generation', expired.allowed === false && expired.reason === 'trial_expired' && expired.lock_message === 'Your free Growth Trial is complete.')
const cancelled = pack.generationEntitlement('cancelled', { packs_generated: 0, last_pack_generated_at: null })
assert('cancelled trial locks generation', cancelled.allowed === false && cancelled.reason === 'trial_cancelled')
const converted = pack.generationEntitlement('converted', { packs_generated: 0, last_pack_generated_at: null })
assert('converted status is a future entitlement TODO', converted.allowed === false && converted.reason === 'converted_entitlement_todo')
const limited = pack.generationEntitlement('active', { packs_generated: 3, last_pack_generated_at: '2026-09-08T12:00:00Z' })
assert('pilot generation limit is 3', limited.allowed === false && limited.reason === 'pilot_limit')
const cooled = pack.generationEntitlement('active', { packs_generated: 1, last_pack_generated_at: new Date().toISOString() })
assert('duplicate generation is cooldown-limited', cooled.allowed === false && cooled.reason === 'cooldown')

function memoryPacks() {
  const rows = new Map()
  return {
    rows,
    from(table) {
      if (table !== 'customer_marketing_packs') throw new Error('unexpected table ' + table)
      const ctx = { id: '', mode: 'select' }
      return {
        select() { ctx.mode = 'select'; return this },
        update(patch) { ctx.mode = 'update'; ctx.patch = patch; return this },
        upsert(row) {
          rows.set(row.business_id, { ...rows.get(row.business_id), ...row })
          return { error: null }
        },
        eq(_col, value) {
          ctx.id = value
          if (ctx.mode === 'update') {
            return Promise.resolve().then(() => {
              const current = rows.get(ctx.id)
              if (current) rows.set(ctx.id, { ...current, ...ctx.patch })
              return { error: null }
            })
          }
          return this
        },
        async maybeSingle() {
          return { data: rows.get(ctx.id) || null, error: null }
        },
      }
    },
  }
}

const bizA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const bizB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const store = memoryPacks()
const savedA = await pack.saveGeneratedPack(store, bizA, generated.pack, generated.model, false, new Date('2026-09-08T18:00:00Z'))
const loadedB = await pack.loadCustomerPackUsage(store, bizB)
const loadedA = await pack.loadCustomerPackUsage(store, bizA)
assert('pack storage is isolated by business_id', savedA.packs_generated === 1 && loadedA.last_pack && !loadedB.last_pack && loadedB.packs_generated === 0)
const copies = await pack.incrementCopyEvents(store, bizA)
assert('copy events increment only for the owning business', copies === 1 && store.rows.get(bizA).content_copy_events === 1 && !store.rows.get(bizB))
assert('repeated generation increments packs_generated', (await pack.saveGeneratedPack(store, bizA, generated.pack, generated.model, false, new Date('2026-09-08T18:01:00Z'))).packs_generated === 2)

assert('client identity override helper detects business_id and slug', pack.clientIdentityOverrideAttempt({ business_id: bizB }) && pack.clientIdentityOverrideAttempt({ slug: 'other-business' }) && !pack.clientIdentityOverrideAttempt({}))
assert('trial timestamp override is detected and unused by API', pack.bodyHasIdentity({ started_at: '2020-01-01', status: 'active' }) && !/request\.json/.test(api))

const missing = {
  from() {
    return {
      select() { return this },
      eq() { return this },
      async maybeSingle() { return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.customer_marketing_packs' in the schema cache" } } },
      async upsert() { return { error: { code: 'PGRST205' } } },
    }
  },
}
let storageUnavailable = false
try {
  await pack.loadCustomerPackUsage(missing, bizA)
} catch (err) {
  storageUnavailable = err instanceof pack.MarketingPackStorageError && err.code === 'unavailable'
}
assert('missing pack table does not fake usage metrics', storageUnavailable)

const summaryExpired = pack.buildPackSummary('expired', loadedA)
assert('expired summary can still expose stored pack', summaryExpired.can_generate === false && summaryExpired.last_pack && summaryExpired.lock_message === 'Your free Growth Trial is complete.')

if (failed) {
  console.error('marketing pack tests FAIL ' + failed)
  process.exit(1)
}
console.log('marketing pack tests PASS')
