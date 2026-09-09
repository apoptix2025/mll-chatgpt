#!/usr/bin/env node
/**
 * Customer AI Marketing Pack V2.2.3 language + ownership grounding fixtures.
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
  const city = row.city || loc
  const serviceLine = row.description && !pack.isLowInformationDescription(row.description)
    ? ` ${row.description}`
    : ''
  return {
    facebook_posts: [
      `Looking for ${String(cat || 'local businesses').toLowerCase()} in ${loc}? Learn more about ${name} and connect through My Latino List. Nothing auto-posts.`,
      `Find ${name} in the ${cat} category on My Latino List. People in ${city} can open the profile to learn more.`,
    ],
    instagram_captions: [
      `Explore the ${name} profile on My Latino List to learn more.\n\n#MyLatinoList`,
      `Know someone looking for ${String(cat || 'local businesses').toLowerCase()} in ${city}? Share the ${name} profile on My Latino List.\n\n#MyLatinoList`,
    ],
    tiktok_concepts: [
      { hook: `Meet ${name} on My Latino List`, visual: 'My Latino List business profile on screen', talking_point: `${name} is listed under ${cat} in ${loc}.`, cta: 'View Listing' },
      { hook: `Looking for ${String(cat || '').toLowerCase()} in ${loc}?`, visual: loc ? `${loc} location text animation` : 'My Latino List search results showing the business profile', talking_point: `Discover ${name} on My Latino List.${serviceLine}`.trim(), cta: 'Learn More' },
    ],
    seo: { keywords: [name, cat, `${cat} ${loc}`], local_discovery: [`${cat} in ${loc}`] },
    bilingual_spotlight: {
      en: `${name} is listed under ${cat} in ${loc}.${serviceLine} Its My Latino List profile gives local users a place to learn more and connect.`.trim(),
      es: `${name} está publicado en My Latino List en la categoría de ${String(cat || '').toLowerCase()} en ${loc}. Quienes buscan en el directorio pueden abrir el perfil para conocer el negocio.`,
    },
    email_campaign: {
      subject: `Discover ${name} in ${city}`,
      preview: `Explore this ${cat} listing on My Latino List.`,
      body: `If you are exploring ${String(cat || '').toLowerCase()} around ${city}, ${name} has a profile on My Latino List. Open it to learn more.`,
      cta: 'View the My Latino List profile',
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
    description: 'We prepare bookkeeping and tax filings for small businesses in Miami.',
    city: 'Miami',
    state: 'FL',
    website: 'https://example.com',
    phone: '555-0100',
  }),
  sparseProfessional: listing({
    name: 'Test Business',
    category: 'Professional Services',
    description: null,
    city: 'Silver Spring',
    state: 'Maryland',
    address: '100 Test Ave',
    zip: '20910',
    website: 'https://qa.example.test',
    email: 'owner@example.test',
    tags: ['QA', 'Test', 'Demo'],
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
assert('placeholder domain omitted from facts', pack.isPlaceholderUrl('https://qa.example.test') && !pack.allowedFactsFromListing(fixtures.sparseProfessional).website)
assert('placeholder street omitted from facts', pack.isPlaceholderAddress('100 Test Ave') && pack.isPlaceholderAddress('Demo Street') && pack.isPlaceholderAddress('QA Avenue') && !pack.allowedFactsFromListing(fixtures.sparseProfessional).address)
assert('Test in business name is preserved', pack.allowedFactsFromListing(fixtures.sparseProfessional).business_name === 'Test Business')
assert('raw street visual is detected', pack.isRawStreetVisual('100 Test Ave, Silver Spring, MD 20910'))
assert('awkward share copy is detected', pack.packHasAwkwardCopy({
  facebook_posts: ['Share MLL QA Test Business with someone looking nearby in Silver Spring.'],
  instagram_captions: ['ok'],
  tiktok_concepts: [],
  seo: { keywords: [], local_discovery: [] },
  bilingual_spotlight: { en: 'ok', es: 'ok' },
  email_campaign: { subject: 'ok', preview: 'ok', body: 'ok', cta: 'ok' },
  auto_post: false,
  disclaimer: '',
}))
assert('awkward profile copy is detected', pack.packHasAwkwardCopy({
  facebook_posts: ['The profile is ready when you want details the business has shared.'],
  instagram_captions: ['ok'],
  tiktok_concepts: [],
  seo: { keywords: [], local_discovery: [] },
  bilingual_spotlight: { en: 'ok', es: 'ok' },
  email_campaign: { subject: 'ok', preview: 'ok', body: 'ok', cta: 'ok' },
  auto_post: false,
  disclaimer: '',
}))
assert('mechanical facebook is detected', pack.packHasMechanicalListingLanguage({
  facebook_posts: ['Discover Professional Services listing in Silver Spring, MD on My Latino List!'],
  instagram_captions: ['ok'],
  tiktok_concepts: [],
  seo: { keywords: [], local_discovery: [] },
  bilingual_spotlight: { en: 'ok', es: 'ok' },
  email_campaign: { subject: 'ok', preview: 'ok', body: 'ok', cta: 'ok' },
  auto_post: false,
  disclaimer: '',
}, fixtures.sparseProfessional))
assert('hashtag-only caption has no prose', !pack.captionHasProse('#SilverSpringMD #QA #Test'))
assert('person using a computer is unsupported', pack.packHasPhysicalAssumptions({
  facebook_posts: ['a', 'b'],
  instagram_captions: ['a', 'b'],
  tiktok_concepts: [
    { hook: 'h', visual: 'An image of a person using a computer', talking_point: 't', cta: 'View Listing' },
    { hook: 'h', visual: 'profile screen', talking_point: 't', cta: 'Learn More' },
  ],
  seo: { keywords: [], local_discovery: [] },
  bilingual_spotlight: { en: 'ok', es: 'ok' },
  email_campaign: { subject: 'ok', preview: 'ok', body: 'ok', cta: 'ok' },
  auto_post: false,
  disclaimer: '',
}, fixtures.sparseProfessional))

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
assert('awkward share rewrite', pack.rewriteAwkwardCopy('Share Test Business with someone looking nearby in Silver Spring.', fixtures.sparseProfessional).includes('Know someone looking for professional services in Silver Spring') && !/someone looking nearby/i.test(pack.rewriteAwkwardCopy('Share Test Business with someone looking nearby in Silver Spring.', fixtures.sparseProfessional)))
assert('awkward profile rewrite', !/details the business has shared/i.test(pack.rewriteAwkwardCopy('The profile is ready when you want details the business has shared.', fixtures.sparseProfessional)))

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
  const noPlaceholder = !/qa-staging-test-description|testing new account|example\.test|localhost|100 Test Ave|123 Test St|Demo Street|QA Avenue/i.test(blob)
  const noInvented = !pack.packHasInventedServices(generated.pack, listingRow)
  const noClaims = !pack.packHasUnsupportedClaims(generated.pack)
  const noQaTags = !pack.packHasQaTestHashtags(generated.pack)
  const noAwkward = !pack.packHasAwkwardCopy(generated.pack)
  const noAddressVisual = !pack.packHasAddressVisual(generated.pack)
  const igProse = pack.captionHasProse(generated.pack.instagram_captions[0]) && pack.captionHasProse(generated.pack.instagram_captions[1])
  const noLangSwitch = pack.packPrimaryLanguage(listingRow) !== 'en' || !pack.packHasUnexpectedLanguageSwitch(generated.pack, listingRow)
  const noOwnership = !pack.packHasUngroundedOwnershipClaims(generated.pack, listingRow)
  const ok = grounded && quality.acceptable && noPlaceholder && noInvented && noClaims && noQaTags && noAwkward && noAddressVisual && igProse && noLangSwitch && noOwnership && generated.pack.facebook_posts[0].includes(listingRow.name)
  if (ok) stats.acceptable += 1
  assert(label + ' identity', generated.pack.facebook_posts[0].includes(listingRow.name) && generated.pack.bilingual_spotlight.es.includes(listingRow.name))
  assert(label + ' grounded/useful', ok)
  assert(label + ' no invented services', noInvented)
  assert(label + ' no unsupported claims', noClaims)
  assert(label + ' no placeholder text', noPlaceholder)
  assert(label + ' instagram prose', igProse)
  assert(label + ' no QA hashtags', noQaTags)
  assert(label + ' no awkward copy', noAwkward)
  assert(label + ' no address visual', noAddressVisual)
  assert(label + ' english channels stay english', noLangSwitch)
  assert(label + ' no unverified ownership claims', noOwnership)
  assert(label + ' channel diversity', !pack.evaluatePackQuality(generated.pack, listingRow).issues.includes('duplication'))
  return generated
}

await runPack('A sparse Tech AI', fixtures.sparseTech, groundedJson(fixtures.sparseTech))
await runPack('A sparse Tech fallback', fixtures.sparseTech, 'not json')
await runPack('A sparse Professional Services AI', fixtures.sparseProfessional, groundedJson(fixtures.sparseProfessional))
await runPack('B cleaning AI', fixtures.cleaning, groundedJson(fixtures.cleaning))
await runPack('B cleaning fallback', fixtures.cleaning, 'not json')
await runPack('C restaurant AI', fixtures.restaurant, groundedJson(fixtures.restaurant))
await runPack('C restaurant fallback', fixtures.restaurant, 'not json')
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

const humanQa = fixtures.sparseProfessional
const mechanical = await runPack('human QA mechanical facebook', humanQa, groundedJson(humanQa, {
  facebook_posts: [
    'Discover Professional Services listing in Silver Spring, MD on My Latino List!',
    'Discover Professional Services listing in Silver Spring, MD on My Latino List!',
  ],
}))
assert('mechanical listing language repaired', !/Professional Services listing/i.test(mechanical.pack.facebook_posts.join(' ')))

const hashtagOnly = await runPack('human QA hashtag-only instagram', humanQa, groundedJson(humanQa, {
  instagram_captions: ['#SilverSpringMD #QA #Test', '#QA #Demo #Staging'],
}))
assert('instagram has real prose', pack.captionHasProse(hashtagOnly.pack.instagram_captions[0]) && pack.captionHasProse(hashtagOnly.pack.instagram_captions[1]))
assert('QA/test hashtags removed', !pack.packHasQaTestHashtags(hashtagOnly.pack))

const personVisual = await runPack('human QA person using computer', humanQa, groundedJson(humanQa, {
  tiktok_concepts: [
    { hook: 'Meet Test Business', visual: 'An image of a person using a computer', talking_point: 'Test Business is listed under Professional Services in Silver Spring.', cta: 'View Listing' },
    { hook: 'Looking for professional services in Silver Spring?', visual: 'Employees working in an office interior', talking_point: 'Open the My Latino List profile.', cta: 'Learn More' },
  ],
}))
assert('unsupported person visual repaired', !/person using a computer|employees working|office interior/i.test(personVisual.pack.tiktok_concepts.map((row) => row.visual).join(' ')))

const leak = await runPack('human QA example.test leak', humanQa, groundedJson(humanQa, {
  bilingual_spotlight: {
    en: 'Visit https://qa.example.test for Test Business.',
    es: 'Visita https://qa.example.test para Test Business.',
  },
  email_campaign: {
    subject: 'See Test Business',
    preview: 'Link',
    body: 'Write owner@example.test for more.',
    cta: 'https://qa.example.test',
  },
}))
assert('placeholder domains removed from prose', !/example\.test/i.test(JSON.stringify({
  facebook: leak.pack.facebook_posts,
  ig: leak.pack.instagram_captions,
  spotlight: leak.pack.bilingual_spotlight,
  email: leak.pack.email_campaign,
})))
assert('name Test Business kept', leak.pack.facebook_posts[0].includes('Test Business'))

const reused = await runPack('human QA facebook reused', humanQa, groundedJson(humanQa, {
  bilingual_spotlight: { en: groundedJson(humanQa).facebook_posts[0], es: groundedJson(humanQa).bilingual_spotlight.es },
  email_campaign: { ...groundedJson(humanQa).email_campaign, body: groundedJson(humanQa).facebook_posts[0] },
}))
assert('facebook not reused in spotlight/email', !pack.evaluatePackQuality(reused.pack, humanQa).issues.includes('duplication'))

const addressVisual = await runPack('human QA street address visual', humanQa, groundedJson(humanQa, {
  tiktok_concepts: [
    { hook: 'Meet Test Business', visual: '100 Test Ave, Silver Spring, MD 20910', talking_point: 'Test Business is listed under Professional Services in Silver Spring.', cta: 'View Listing' },
    { hook: 'Looking for professional services in Silver Spring?', visual: 'My Latino List search results showing the business profile', talking_point: 'Open the My Latino List profile.', cta: 'Learn More' },
  ],
}))
assert('street address visual repaired', !/100 Test Ave/i.test(addressVisual.pack.tiktok_concepts.map((row) => row.visual).join(' ')) && !pack.packHasAddressVisual(addressVisual.pack))

const awkwardShare = await runPack('human QA awkward share copy', humanQa, groundedJson(humanQa, {
  instagram_captions: [
    'Share MLL QA Test Business with someone looking nearby in Silver Spring.',
    'Share Test Business with someone looking nearby in Silver Spring.',
  ],
}))
assert('awkward share copy repaired', !/someone looking nearby/i.test(JSON.stringify(awkwardShare.pack)))

const awkwardProfile = await runPack('human QA awkward profile copy', humanQa, groundedJson(humanQa, {
  facebook_posts: [
    'The profile is ready when you want details the business has shared.',
    'Find Test Business in the Professional Services category on My Latino List.',
  ],
}))
assert('awkward profile copy repaired', !/details the business has shared|the profile is ready when you want/i.test(JSON.stringify(awkwardProfile.pack)))

const spanishIg = await runPack('human QA spanish instagram', humanQa, groundedJson(humanQa, {
  instagram_captions: [
    'Encontrar servicios profesionales en Silver Spring?',
    'Explore the Test Business profile on My Latino List to learn more.',
  ],
}))
assert('spanish instagram repaired', !/Encontrar servicios profesionales en Silver Spring/i.test(spanishIg.pack.instagram_captions.join(' ')) && !pack.hasSubstantialSpanish(spanishIg.pack.instagram_captions.join(' '), humanQa))

const spanishReelNeed = await runPack('human QA spanish reel need', humanQa, groundedJson(humanQa, {
  tiktok_concepts: [
    { hook: '¿Necesitas servicios profesionales en Silver Spring?', visual: 'My Latino List business profile on screen', talking_point: 'Test Business is listed under Professional Services in Silver Spring.', cta: 'View Listing' },
    { hook: 'Looking for professional services in Silver Spring?', visual: 'Silver Spring, Maryland location text animation', talking_point: 'Open the My Latino List profile.', cta: 'Learn More' },
  ],
}))
assert('spanish reel need repaired', !/¿Necesitas servicios profesionales en Silver Spring/i.test(JSON.stringify(spanishReelNeed.pack.tiktok_concepts)) && !pack.hasSubstantialSpanish(spanishReelNeed.pack.tiktok_concepts.map((row) => [row.hook, row.talking_point, row.cta].join(' ')).join(' '), humanQa))

const spanishReelConnect = await runPack('human QA spanish reel connect', humanQa, groundedJson(humanQa, {
  tiktok_concepts: [
    { hook: 'Meet Test Business on My Latino List', visual: 'My Latino List business profile on screen', talking_point: 'Conecta con My Latino List para encontrar más servicios como el tuyo', cta: 'View Listing' },
    { hook: 'Looking for professional services in Silver Spring?', visual: 'Silver Spring, Maryland location text animation', talking_point: 'Open the My Latino List profile.', cta: 'Learn More' },
  ],
}))
assert('spanish reel connect repaired', !/Conecta con My Latino List para encontrar más servicios como el tuyo/i.test(JSON.stringify(spanishReelConnect.pack.tiktok_concepts)) && !pack.hasSubstantialSpanish(spanishReelConnect.pack.tiktok_concepts.map((row) => [row.hook, row.talking_point, row.cta].join(' ')).join(' '), humanQa))

const latinoOwned = await runPack('human QA latino-owned seo', humanQa, groundedJson(humanQa, {
  seo: {
    keywords: ['Latino-owned Professional Services', 'Test Business', 'Professional Services'],
    local_discovery: ['Latino-owned Professional Services', 'Professional Services in Silver Spring, Maryland'],
  },
  facebook_posts: [
    'Looking for professional services in Silver Spring, Maryland? Learn more about Test Business and connect through My Latino List. Nothing auto-posts.',
    'Find Test Business, a Latino-owned Professional Services listing, on My Latino List.',
  ],
  instagram_captions: [
    'Explore Latino-owned Professional Services from Test Business on My Latino List.\n\n#MyLatinoList #LatinoOwned',
    'Know someone looking for professional services in Silver Spring? Share the Test Business profile on My Latino List.\n\n#MyLatinoList',
  ],
}))
assert('unverified latino-owned removed', !/latino-owned|#LatinoOwned/i.test(JSON.stringify(latinoOwned.pack)))

const verifiedOwnedListing = listing({
  ...fixtures.sparseProfessional,
  ownership_claims: ['latino-owned'],
})
const verifiedOwned = await runPack('verified latino-owned kept', verifiedOwnedListing, groundedJson(verifiedOwnedListing, {
  seo: { keywords: ['Latino-owned Professional Services', 'Test Business'], local_discovery: ['Latino-owned Professional Services'] },
}))
assert('verified latino-owned may remain', /latino-owned/i.test(JSON.stringify(verifiedOwned.pack)))

assert('primary language defaults to english', pack.packPrimaryLanguage(fixtures.sparseProfessional) === 'en')
assert('spanish description does not switch pack language', pack.packPrimaryLanguage(fixtures.bilingual) === 'en')
const englishChannels = pack.buildCustomerFallbackPack(fixtures.sparseProfessional)
assert('english facebook stays english', !pack.hasSubstantialSpanish(englishChannels.facebook_posts.join(' '), fixtures.sparseProfessional))
assert('english instagram stays english', !pack.hasSubstantialSpanish(englishChannels.instagram_captions.join(' '), fixtures.sparseProfessional))
assert('english reel stays english', !pack.hasSubstantialSpanish(englishChannels.tiktok_concepts.map((row) => [row.hook, row.talking_point, row.cta].join(' ')).join(' '), fixtures.sparseProfessional))
assert('english email stays english', !pack.hasSubstantialSpanish([englishChannels.email_campaign.subject, englishChannels.email_campaign.body].join(' '), fixtures.sparseProfessional))
assert('spotlight en stays english', !pack.hasSubstantialSpanish(englishChannels.bilingual_spotlight.en, fixtures.sparseProfessional))
assert('spotlight es remains natural spanish', /est[aá] publicado|quienes buscan|directorio/i.test(englishChannels.bilingual_spotlight.es) && !/el mejor|de confianza|líder|lugar perfecto/i.test(englishChannels.bilingual_spotlight.es))
assert('unexpected language switch detector catches human QA instagram', pack.hasSubstantialSpanish('Encontrar servicios profesionales en Silver Spring?', fixtures.sparseProfessional))
assert('unexpected language switch detector catches human QA reel need', pack.hasSubstantialSpanish('¿Necesitas servicios profesionales en Silver Spring?', fixtures.sparseProfessional))
assert('unexpected language switch detector catches human QA reel connect', pack.hasSubstantialSpanish('Conecta con My Latino List para encontrar más servicios como el tuyo', fixtures.sparseProfessional))
assert('ownership detector catches latino-owned without verification', pack.packHasUngroundedOwnershipClaims({
  ...englishChannels,
  seo: { keywords: ['Latino-owned Professional Services'], local_discovery: [] },
}, fixtures.sparseProfessional))

const fallback = pack.buildCustomerFallbackPack(fixtures.sparseTech)
const fallbackQ = pack.evaluatePackQuality(fallback, fixtures.sparseTech)
assert('channel-specific fallback is acceptable', fallbackQ.acceptable)
assert('fallback facebook posts differ', fallback.facebook_posts[0] !== fallback.facebook_posts[1])
assert('fallback instagram is not truncated facebook', !fallback.instagram_captions[0].startsWith(fallback.facebook_posts[0].slice(0, 40)))
assert('fallback instagram has prose', pack.captionHasProse(fallback.instagram_captions[0]))
assert('fallback has no mechanical category listing in facebook', !pack.packHasMechanicalListingLanguage(fallback, fixtures.sparseTech))
assert('fallback spanish avoids hype', !/el mejor|de confianza|líder|lugar perfecto|lo último|número uno/i.test(fallback.bilingual_spotlight.es))
assert('fallback does not expose placeholder', !/qa-staging-test-description/.test(JSON.stringify(pack.buildCustomerFallbackPack(fixtures.placeholder))))
assert('fallback has no awkward share/profile copy', !/someone looking nearby|details the business has shared/i.test(JSON.stringify(fallback)))
assert('fallback reel visual is not a street address', !pack.packHasAddressVisual(fallback) && !/100 Test Ave/i.test(fallback.tiktok_concepts.map((row) => row.visual).join(' ')))
assert('fallback does not expose placeholder street', !/100 Test Ave|Demo Street|QA Avenue/i.test(JSON.stringify(pack.buildCustomerFallbackPack(fixtures.sparseProfessional))))
assert('fallback omits unverified latino-owned', !/latino-owned|#LatinoOwned/i.test(JSON.stringify(pack.buildCustomerFallbackPack(fixtures.sparseProfessional))))
assert('fallback has no unexpected spanish switch', !pack.packHasUnexpectedLanguageSwitch(pack.buildCustomerFallbackPack(fixtures.sparseProfessional), fixtures.sparseProfessional))

assert('at least 12 quality generations', stats.total >= 12)
const rate = stats.acceptable / stats.total
assert('quality success rate >= 90%', rate >= 0.9)
console.log('QUALITY_STATS ' + JSON.stringify({ ...stats, rate }))

if (failed) {
  console.error('marketing pack quality tests FAIL ' + failed)
  process.exit(1)
}
console.log('marketing pack quality tests PASS')
