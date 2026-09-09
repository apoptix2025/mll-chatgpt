#!/usr/bin/env node
/**
 * Customer AI Marketing Pack V2.2 content-quality fixtures.
 * Does not call production. Does not consume production generations.
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

function transpile(src, fileName, rewrite) {
  const emitted = ts.transpileModule(rewrite ? rewrite(src) : src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName,
  })
  return emitted.outputText
}

const tmp = mkdtempSync(join(tmpdir(), 'mll-pack-quality-'))
const packLib = readFileSync(join(root, 'workers/src/lib/customer-marketing-pack.ts'), 'utf8')
const qualityLib = readFileSync(join(root, 'workers/src/lib/customer-marketing-pack-quality.ts'), 'utf8')
writeFileSync(join(tmp, 'customer-marketing-pack-quality.mjs'), transpile(qualityLib, 'customer-marketing-pack-quality.ts'))
writeFileSync(join(tmp, 'customer-marketing-pack.mjs'), transpile(packLib, 'customer-marketing-pack.ts', (src) => src
  .replace(/import \{ MLL_AI_MODEL \} from '\.\.\/api\/ai-search'\r?\n/, "const MLL_AI_MODEL = '@cf/meta/llama-3.2-3b-instruct'\n")
  .replace(/import \{ parseMarketingPack \} from '\.\.\/api\/marketing'\r?\n/, `
function parseMarketingPack(text) {
  const trimmed = String(text || '').trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(trimmed.slice(start, end + 1)) } catch { return null }
}
`)
  .replace(/import type \{ PilotBusiness \} from '\.\/marketing-pilot'\r?\n/, '')
  .replace(/import type \{ MarketingTrialStatus \} from '\.\/marketing-trial'\r?\n/, '')
  .replaceAll("from './customer-marketing-pack-quality'", "from './customer-marketing-pack-quality.mjs'")
))
const pack = await import(pathToFileURL(join(tmp, 'customer-marketing-pack.mjs')).href)

function listing(partial = {}) {
  return {
    name: 'Test Business',
    category: 'Tech',
    description: null,
    city: 'Silver Spring',
    state: 'Maryland',
    website: null,
    phone: null,
    email: null,
    address: null,
    zip: null,
    tags: [],
    facebook_url: null,
    instagram_url: null,
    other_social: {},
    ...partial,
  }
}

function groundedJson(row, extra = {}) {
  const loc = [row.city, row.state].filter(Boolean).join(', ')
  const cat = row.category
  const name = row.name
  const serviceLine = row.description && !pack.isLowInformationDescription(row.description)
    ? ` ${row.description}`
    : ''
  return {
    facebook_posts: [
      `Explore ${name}, a ${cat} listing in ${loc} on My Latino List. Open the profile to connect.`,
      `Looking for ${cat} businesses in ${loc}? Discover ${name} on My Latino List.`,
    ],
    instagram_captions: [
      `Explore ${name} on My Latino List. Find this listing in ${loc}. #MyLatinoList #LatinoOwned`,
      `Looking for ${cat} in ${loc}? Find ${name}. #MyLatinoList`,
    ],
    tiktok_concepts: [
      { hook: `Meet ${name} on My Latino List`, visual: `Show the My Latino List listing card for ${name} in ${loc}.`, talking_point: `${name} is a ${cat} listing in ${loc}.`, cta: 'View this listing on My Latino List.' },
      { hook: `Looking for ${cat} in ${loc}?`, visual: 'Screen recording of the directory search opening this listing.', talking_point: `Discover ${name} on My Latino List.${serviceLine}`.trim(), cta: 'Search My Latino List and open this profile.' },
    ],
    seo: { keywords: [name, cat, `${cat} ${loc}`], local_discovery: [`${cat} in ${loc}`] },
    bilingual_spotlight: {
      en: `${name} is a ${cat} listing on My Latino List in ${loc}.${serviceLine} View the listing to learn more.`.trim(),
      es: `${name} aparece en My Latino List como un anuncio de ${cat.toLowerCase()} en ${loc}. Entra al directorio para ver esta ficha.`,
    },
    email_campaign: {
      subject: `Find ${name} on My Latino List`,
      preview: `${cat} in ${loc}`,
      body: `A neighbor asked where to find ${cat} in ${loc}. ${name} is listed on My Latino List, with contact details on the profile.`,
      cta: 'View this listing on My Latino List',
    },
    ...extra,
  }
}

const fixtures = {
  sparseTech: listing(),
  cleaning: listing({
    name: 'Limpieza Clara',
    category: 'Cleaning',
    description: 'We clean homes and apartments in Miami using eco-friendly products.',
    city: 'Miami',
    state: 'FL',
    website: 'https://limpiezaclara.example',
    phone: '305-555-0100',
  }),
  restaurant: listing({
    name: 'Casa Sol',
    category: 'Restaurant',
    description: 'Family restaurant serving Mexican breakfast and lunch in Houston.',
    city: 'Houston',
    state: 'TX',
    website: 'https://casasol.example',
  }),
  professional: listing({
    name: 'MLL QA Test Business',
    category: 'Professional Services',
    description: 'A staging QA listing used to test customer marketing drafts.',
    city: 'Miami',
    state: 'FL',
    website: 'https://example.com',
    phone: '555-0100',
  }),
  bilingual: listing({
    name: 'Academia Luna',
    category: 'Education',
    description: 'Ofrecemos clases de español e inglés para familias en Orlando, presenciales y virtuales.',
    city: 'Orlando',
    state: 'FL',
    facebook_url: 'https://facebook.com/academicluna',
  }),
  placeholder: listing({
    name: 'Test Business',
    category: 'Tech',
    description: 'qa-staging-test-description',
    city: 'Silver Spring',
    state: 'Maryland',
  }),
}

assert('low-information detects missing and short text', pack.isLowInformationDescription(null) && pack.isLowInformationDescription('Tech shop'))
assert('placeholder description is detected', pack.isPlaceholderDescription('qa-staging-test-description') && pack.isLowInformationDescription('Testing new account'))
assert('rich cleaning description is kept', !pack.isLowInformationDescription(fixtures.cleaning.description))
assert('placeholder omitted from ALLOWED_FACTS', !JSON.stringify(pack.allowedFactsFromListing(fixtures.placeholder)).includes('qa-staging-test-description'))

const phrases = {
  latest: 'Discover the latest in Tech from Test Business',
  goTo: 'Get to know Test Business, your go-to Tech spot',
  innovators: 'Tech innovators, assemble!',
  boundaries: 'Test Business is pushing the boundaries of Tech',
  forefront: 'Test Business is at the forefront of Tech',
  perfectEs: 'Descubre Test Business, el lugar perfecto para Tech',
}
for (const [key, phrase] of Object.entries(phrases)) {
  const rewritten = pack.rewriteUnsupportedHype(phrase, fixtures.sparseTech)
  assert('regression rewrite ' + key, rewritten.includes('Test Business') && !pack.CUSTOMER_UNGROUNDED_CLAIM.test(rewritten) && rewritten !== phrase)
}

const stats = { total: 0, ai: 0, fallback: 0, acceptable: 0 }

async function runPack(label, listingRow, aiPayload) {
  const generated = await pack.generateCustomerMarketingPack({
    listing: listingRow,
    runAi: async () => (typeof aiPayload === 'string' ? aiPayload : JSON.stringify(aiPayload)),
  })
  stats.total += 1
  if (generated.generation_source === 'ai_grounded') stats.ai += 1
  else stats.fallback += 1
  const blob = JSON.stringify(generated.pack)
  const quality = pack.evaluatePackQuality(generated.pack, listingRow)
  const grounded = pack.isCustomerPackComplete(generated.pack) && pack.isCustomerPackGrounded(generated.pack, listingRow)
  const noPlaceholder = !/qa-staging-test-description|testing new account/i.test(blob)
  const noInvented = !pack.packHasInventedServices(generated.pack, listingRow)
  const noClaims = !pack.packHasUnsupportedClaims(generated.pack)
  const ok = grounded && quality.acceptable && noPlaceholder && noInvented && noClaims && generated.pack.facebook_posts[0].includes(listingRow.name)
  if (ok) stats.acceptable += 1
  assert(label + ' identity', generated.pack.facebook_posts[0].includes(listingRow.name) && generated.pack.bilingual_spotlight.es.includes(listingRow.name))
  assert(label + ' grounded/useful', ok)
  assert(label + ' no invented services', noInvented)
  assert(label + ' no unsupported claims', noClaims)
  assert(label + ' no placeholder text', noPlaceholder)
  assert(label + ' channel diversity', !pack.evaluatePackQuality(generated.pack, listingRow).issues.includes('duplication'))
  return generated
}

await runPack('A sparse Tech AI', fixtures.sparseTech, groundedJson(fixtures.sparseTech))
await runPack('A sparse Tech fallback', fixtures.sparseTech, 'not json')
await runPack('B cleaning AI', fixtures.cleaning, groundedJson(fixtures.cleaning))
await runPack('C restaurant AI', fixtures.restaurant, groundedJson(fixtures.restaurant))
await runPack('D professional AI', fixtures.professional, groundedJson(fixtures.professional))
await runPack('E bilingual AI', fixtures.bilingual, groundedJson(fixtures.bilingual))
await runPack('low-info placeholder AI', fixtures.placeholder, groundedJson({ ...fixtures.placeholder, description: null }))
await runPack('low-info placeholder fallback', fixtures.placeholder, 'malformed')

const hypeJson = groundedJson(fixtures.sparseTech, {
  facebook_posts: [
    'Discover the latest in Tech from Test Business',
    'Get to know Test Business, your go-to Tech spot',
  ],
  tiktok_concepts: [
    { hook: 'Tech innovators, assemble!', visual: 'Show employees in the office working on equipment.', talking_point: 'Test Business is pushing the boundaries of Tech', cta: 'Book a consultation' },
    { hook: 'Test Business is at the forefront of Tech', visual: 'Restaurant interior packed with customers', talking_point: 'Latest innovations', cta: 'Order now' },
  ],
  bilingual_spotlight: {
    en: 'Test Business is at the forefront of Tech.',
    es: 'Descubre Test Business, el lugar perfecto para Tech',
  },
  email_campaign: {
    subject: 'Services Services',
    preview: 'Your go-to Tech spot',
    body: 'Discover the latest in Tech from Test Business',
    cta: 'Shop now',
  },
})
const hype = await runPack('production regression hype AI', fixtures.sparseTech, hypeJson)
const hypeBlob = JSON.stringify(hype.pack)
assert('LATEST removed', !/latest/i.test(hypeBlob))
assert('GO_TO removed', !/go-to|go to/i.test(hypeBlob))
assert('TECH_INNOVATORS removed', !/innovators, assemble/i.test(hypeBlob))
assert('PUSHING_BOUNDARIES removed', !/pushing the boundaries/i.test(hypeBlob))
assert('FOREFRONT removed', !/forefront/i.test(hypeBlob))
assert('PERFECT_PLACE_ES removed', !/lugar perfecto/i.test(hypeBlob))

const inventedRestaurant = await runPack('invented plumber services on restaurant', fixtures.restaurant, groundedJson(fixtures.restaurant, {
  facebook_posts: [
    'Casa Sol offers emergency plumbing and attorney consults.',
    'Looking for Restaurant businesses in Houston, TX? Discover Casa Sol on My Latino List.',
  ],
}))
assert('invented plumber/attorney dropped', !/plumb|attorney/i.test(JSON.stringify(inventedRestaurant.pack)))

const duplicateJson = groundedJson(fixtures.sparseTech)
duplicateJson.bilingual_spotlight.en = duplicateJson.facebook_posts[0]
duplicateJson.email_campaign.body = duplicateJson.facebook_posts[0]
await runPack('duplication repair', fixtures.sparseTech, duplicateJson)

const fallback = pack.buildCustomerFallbackPack(fixtures.sparseTech)
const fallbackQ = pack.evaluatePackQuality(fallback, fixtures.sparseTech)
assert('channel-specific fallback is acceptable', fallbackQ.acceptable)
assert('fallback facebook posts differ', fallback.facebook_posts[0] !== fallback.facebook_posts[1])
assert('fallback instagram is not truncated facebook', !fallback.instagram_captions[0].startsWith(fallback.facebook_posts[0].slice(0, 40)))
assert('fallback spanish avoids hype', !/el mejor|de confianza|líder|lugar perfecto|lo último|número uno/i.test(fallback.bilingual_spotlight.es))
assert('fallback does not expose placeholder', !/qa-staging-test-description/.test(JSON.stringify(pack.buildCustomerFallbackPack(fixtures.placeholder))))

assert('at least 10 quality generations', stats.total >= 10)
const rate = stats.acceptable / stats.total
assert('quality success rate >= 90%', rate >= 0.9)
console.log('QUALITY_STATS ' + JSON.stringify({ ...stats, rate }))

if (failed) {
  console.error('marketing pack quality tests FAIL ' + failed)
  process.exit(1)
}
console.log('marketing pack quality tests PASS')
