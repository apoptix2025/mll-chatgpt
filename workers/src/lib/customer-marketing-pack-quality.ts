export type QualityListing = {
  name: string
  category: string | null
  description: string | null
  city: string | null
  state: string | null
  website: string | null
  phone: string | null
  email: string | null
  address: string | null
  zip: string | null
  tags: string[]
  facebook_url: string | null
  instagram_url: string | null
  other_social: Record<string, string>
}

export type QualityTiktokConcept = {
  hook: string
  visual: string
  talking_point: string
  cta: string
}

export type QualityPack = {
  facebook_posts: string[]
  instagram_captions: string[]
  tiktok_concepts: QualityTiktokConcept[]
  seo: { keywords: string[]; local_discovery: string[] }
  bilingual_spotlight: { en: string; es: string }
  email_campaign: { subject: string; preview: string; body: string; cta: string }
  auto_post: false
  disclaimer: string
}

export type FallbackReason =
  | 'unsupported_claim'
  | 'invented_service'
  | 'malformed_json'
  | 'missing_business_name'
  | 'low_information_description'
  | 'excessive_duplication'
  | 'invalid_subject'
  | 'other_validation_failure'
  | 'parse_failed'
  | 'ungrounded'

const PLACEHOLDER_DESCRIPTION =
  /qa[-_\s]?staging|test[-_\s]?description|testing new account|lorem ipsum|^test\b|^n\/?a$|^todo\b|^asdf\b|^dummy\b|^placeholder\b|^sample (text|description)\b|^foo bar\b|example\.test|\bstaging qa\b|\bqa listing\b|\bused to test\b/i

const LOW_INFO_FILLER =
  /\b(new account|coming soon|tbd|n\/a|none|none listed)\b/i

const QA_HASHTAG = /#(qa|test|demo|staging|placeholder)\b/i

const PLACEHOLDER_HOST =
  /example\.test|localhost|127\.0\.0\.1|\bexample\.com\b|\.example(?:\/|:|$)|(^|\/\/)qa[-.]|(^|\/\/)staging[-.]|@example\.test/i

const RAW_URL = /https?:\/\/\S+|\b[\w.-]*example\.test\b|\blocalhost\b/i

export const CUSTOMER_UNSUPPORTED_HYPE =
  /#1\b|\bnumber\s*one\b|\bn[uú]mero\s*1\b|\bbest\b|\btop(?:-rated)?\b|\bleading\b|\bindustry-leading\b|\btrusted\b|\baward(?:s|ed|-winning)?\b|\bcertified\b|\btestimonials?\b|\bhighly rated\b|\bpopular\b|\bpremier\b|\bexceptional\b|\binnovative\b|\binnovators?\b|\blatest\b|\bgo-to\b|\bgo to\b|\bperfect place\b|\bel lugar perfecto\b|\blo [uú]ltimo\b|\bde confianza\b|\bl[ií]der(?:es)?\b|\bcutting[- ]edge\b|\bstate[- ]of[- ]the[- ]art\b|\bworld-class\b|\bunparalleled\b|\bpushing the boundaries\b|\bat the forefront\b|\bcalificaci[oó]n(?:es)?\b|\bmejor(?:es)?\b|m[aá]s confiable|el mejor|la mejor|\b\d+\s+reviews?\b|\bstar ratings?\b|\b\d+(?:\.\d+)?\s*stars?\b|\bfollowers\b|\brevenue\b|\branking|\d+\s*%|\$\d+|\bsince\s+\d{4}\b|\byears in business\b/i

const PHYSICAL_ASSUMPTION =
  /\bstorefronts?\b|\brestaurant interiors?\b|\boffice interiors?\b|\bkitchen\b|\bemployees?\b|\bstaff\b|\bteam (?:of|meeting)\b|\bcashiers?\b|\bequipment\b|\bcustomers? (?:waiting|lined|seated|visiting)\b|\bperson using (?:a )?computer\b|\bpeople using (?:a )?computer\b|\busing a computer\b|\bemployees working\b|\bwork being performed\b|\bcrowded\b|\bparking lot\b|\bdining room\b|\ban image of a person\b/i

const UNSAFE_CTA =
  /\bbook a (table|consultation|appointment)\b|\border now\b|\bbuy now\b|\bshop now\b|\bvisit our (store|storefront|office|restaurant)\b|\breserve\b|\bget \d+%\s*off\b/i

const STATE_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
}

export function locLabel(listing: QualityListing): string {
  return [listing.city, listing.state].filter(Boolean).join(', ')
}

export function naturalCategory(category: string | null | undefined): string {
  const value = String(category || '').replace(/\s+listings?$/i, '').trim()
  return value || 'local businesses'
}

export function isPlaceholderUrl(url: string | null | undefined): boolean {
  const value = String(url || '').trim()
  if (!value) return true
  if (PLACEHOLDER_HOST.test(value)) return true
  return /\/(?:qa|test|demo|staging|placeholder)\/?$/i.test(value)
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  const value = String(email || '').trim()
  if (!value) return false
  return PLACEHOLDER_HOST.test(value) || /@example\.(test|com)$/i.test(value)
}

export function isQaMetadataTag(tag: string): boolean {
  const value = String(tag || '').replace(/^#/, '').trim()
  return /^(qa|test|demo|staging|placeholder|mllqa)$/i.test(value)
}

export function isPlaceholderDescription(text: string | null | undefined): boolean {
  const value = String(text || '').trim()
  if (!value) return false
  return PLACEHOLDER_DESCRIPTION.test(value)
}

export function isLowInformationDescription(text: string | null | undefined): boolean {
  const value = String(text || '').trim()
  if (!value) return true
  if (isPlaceholderDescription(value)) return true
  if (value.length < 28) return true
  const words = value.split(/\s+/).filter((word) => /[a-zA-Záéíóúñü]{3,}/i.test(word))
  if (words.length < 4) return true
  if (LOW_INFO_FILLER.test(value) && words.length < 8) return true
  return false
}

export function marketingListingFrom(listing: QualityListing): QualityListing {
  const social: Record<string, string> = {}
  for (const [key, value] of Object.entries(listing.other_social || {})) {
    if (!isPlaceholderUrl(value)) social[key] = value
  }
  return {
    ...listing,
    description: isLowInformationDescription(listing.description) ? null : listing.description,
    website: isPlaceholderUrl(listing.website) ? null : listing.website,
    email: isPlaceholderEmail(listing.email) ? null : listing.email,
    facebook_url: isPlaceholderUrl(listing.facebook_url) ? null : listing.facebook_url,
    instagram_url: isPlaceholderUrl(listing.instagram_url) ? null : listing.instagram_url,
    other_social: social,
    tags: (listing.tags || []).filter((tag) => !isQaMetadataTag(tag)),
  }
}

export function marketingFactsBlob(listing: QualityListing): string {
  const safe = marketingListingFrom(listing)
  return [
    safe.name,
    safe.category,
    safe.description,
    safe.city,
    safe.state,
    safe.website,
    safe.phone,
    safe.email,
    safe.address,
    ...safe.tags,
  ].filter(Boolean).join(' ').toLowerCase()
}

export function stripPlaceholderText(text: string, listing: QualityListing): string {
  if (!text) return ''
  let next = text
  const raw = String(listing.description || '').trim()
  if (raw && isLowInformationDescription(raw)) {
    next = next.split(raw).join(' ').replace(/\s+/g, ' ').trim()
  }
  return next
    .replace(/\bqa[-_\s]?staging[-_\s]?test[-_\s]?description\b/gi, '')
    .replace(/\btesting new account\b/gi, '')
    .replace(/\blorem ipsum\b/gi, '')
    .replace(RAW_URL, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

export function sanitizeHashtags(text: string): string {
  return String(text || '')
    .replace(/#([A-Za-z0-9_]+)/g, (full, tag) => (isQaMetadataTag(tag) ? '' : full))
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function captionHasProse(text: string): boolean {
  const prose = String(text || '').replace(/#[A-Za-z0-9_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const words = prose.split(/\s+/).filter((word) => /[a-zA-Záéíóúñü]{3,}/i.test(word))
  return words.length >= 6
}

export function rewriteMechanicalListingLanguage(text: string, listing: QualityListing): string {
  if (!text) return ''
  const trimmed = String(text).trim()
  if (/^explore this .+ listings? on my latino list\.?$/i.test(trimmed)) return trimmed
  const name = listing.name || 'this business'
  const cat = naturalCategory(listing.category)
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  const catRe = cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let next = trimmed
  next = next.replace(
    new RegExp(`\\bDiscover\\s+${catRe}\\s+listings?\\s+in\\s+([^!.?]+)`, 'gi'),
    `Looking for ${cat.toLowerCase()} in $1? Learn more about ${name} and connect through My Latino List`,
  )
  next = next.replace(new RegExp(`\\ba\\s+${catRe}\\s+listings?\\b`, 'gi'), cat.toLowerCase())
  next = next.replace(new RegExp(`\\b${catRe}\\s+listings?\\b`, 'gi'), cat.toLowerCase())
  next = next.replace(/\bListed as\s+/gi, 'listed under ')
  next = next.replace(/\bCategory:\s+/gi, '')
  next = next.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim()
  if (!next) {
    return loc
      ? `Looking for ${cat.toLowerCase()}${locBit}? Learn more about ${name} and connect through My Latino List.`
      : `Learn more about ${name} and connect through My Latino List.`
  }
  return next
}

export function rewriteUnsupportedHype(text: string, listing: QualityListing): string {
  if (!text) return ''
  const name = listing.name || 'this business'
  const cat = naturalCategory(listing.category)
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  return String(text)
    .replace(/\bdiscover the latest(?:\s+in\s+\w+)?(?:\s+from)?\b/gi, 'Discover')
    .replace(/\bthe latest in\b/gi, '')
    .replace(/\blatest(?:\s+innovations?)?\b/gi, '')
    .replace(/\byour go-to\b/gi, '')
    .replace(/\bgo-to\b/gi, '')
    .replace(/\bthe perfect place for\b/gi, 'a place to learn about')
    .replace(/\bel lugar perfecto para\b/gi, 'un perfil de')
    .replace(/\bel lugar perfecto\b/gi, 'este perfil')
    .replace(/\bpushing the boundaries of\b/gi, 'listed under')
    .replace(/\bat the forefront of\b/gi, 'listed under')
    .replace(/\btech innovators, assemble!?/gi, `Meet ${name} on My Latino List`)
    .replace(/\binnovators, assemble!?/gi, `Meet ${name} on My Latino List`)
    .replace(/\bindustry-leading\b/gi, '')
    .replace(/\bhighly rated\b/gi, '')
    .replace(/\bcutting[- ]edge\b/gi, '')
    .replace(/\bstate[- ]of[- ]the[- ]art\b/gi, '')
    .replace(/\bworld-class\b/gi, '')
    .replace(/\bunparalleled\b/gi, '')
    .replace(/\bpremier\b/gi, '')
    .replace(/\bexceptional\b/gi, '')
    .replace(/\binnovative\b/gi, '')
    .replace(/\binnovators?\b/gi, cat)
    .replace(/\bpopular\b/gi, '')
    .replace(/\blo [uú]ltimo(?: en)?\b/gi, '')
    .replace(/\bde confianza\b/gi, '')
    .replace(/\bl[ií]der(?:es)?\b/gi, '')
    .replace(/\bthe best\b/gi, '')
    .replace(/\bbest\b/gi, '')
    .replace(/\b#1\b/gi, '')
    .replace(/\bnumber\s*one\b/gi, '')
    .replace(/\btop(?:-rated)?\b/gi, '')
    .replace(/\bleading\b/gi, '')
    .replace(/\btrusted\b/gi, '')
    .replace(/\baward(?:s|ed|-winning)?\b/gi, '')
    .replace(/\bcertified\b/gi, '')
    .replace(/\btestimonials?\b/gi, '')
    .replace(/\b\d+\s+reviews?\b/gi, '')
    .replace(/\bstar ratings?\b/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*stars?\b/gi, '')
    .replace(/\byears in business\b/gi, '')
    .replace(/\bsince\s+\d{4}\b/gi, '')
    .replace(/\bcalificaci[oó]n(?:es)?\b/gi, '')
    .replace(/\bmejor(?:es)?\b/gi, '')
    .replace(/\bm[aá]s confiable\b/gi, '')
    .replace(/\bel mejor\b/gi, '')
    .replace(/\bla mejor\b/gi, '')
    .replace(/\bn[uú]mero\s*1\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[ ,.;:—-]+/, '')
    .trim()
    || (loc
      ? `Looking for ${cat.toLowerCase()}${locBit}? Learn more about ${name} and connect through My Latino List.`
      : `Learn more about ${name} and connect through My Latino List.`)
}

export function neutralizeUnsupportedSentences(text: string, listing: QualityListing): string {
  const rewritten = rewriteMechanicalListingLanguage(
    rewriteUnsupportedHype(stripPlaceholderText(text, listing), listing),
    listing,
  )
  return sanitizeHashtags(
    rewritten
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => rewriteMechanicalListingLanguage(rewriteUnsupportedHype(sentence, listing), listing))
      .filter((sentence) => sentence && !CUSTOMER_UNSUPPORTED_HYPE.test(sentence))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

export function containsUnsupportedHype(text: string): boolean {
  return CUSTOMER_UNSUPPORTED_HYPE.test(text)
}

export function sanitizeVisual(visual: string, listing: QualityListing): string {
  const name = listing.name || 'this business'
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  const blob = marketingFactsBlob(listing)
  const next = neutralizeUnsupportedSentences(visual, listing)
  const assumed = next.match(new RegExp(PHYSICAL_ASSUMPTION.source, 'gi')) || []
  const invented = assumed.some((term) => !blob.includes(term.toLowerCase().trim()))
  if (!next || invented) {
    if (listing.website) return `Screen recording of the ${name} website as it appears from the verified link.`
    if (listing.facebook_url || listing.instagram_url) return `Show the verified social profile linked from the ${name} My Latino List profile.`
    return loc
      ? `Show the My Latino List profile screen for ${name}, with a short text animation of the name and ${loc}.`
      : `Show the My Latino List profile screen for ${name}.`
  }
  return next
}

export function groundCta(cta: string, listing: QualityListing): string {
  const cleaned = neutralizeUnsupportedSentences(cta, listing)
  const lower = cleaned.toLowerCase()
  if (UNSAFE_CTA.test(lower) && !marketingFactsBlob(listing).includes(lower.slice(0, 12))) {
    return listing.website ? 'Visit Website' : 'View Profile'
  }
  if (RAW_URL.test(cleaned) || isPlaceholderUrl(cleaned)) {
    return listing.website ? 'Visit Website' : 'View the My Latino List profile'
  }
  if (listing.website && /website|sitio/.test(lower)) return 'Visit Website'
  if (/learn more/.test(lower)) return 'Learn More'
  if (/connect/.test(lower)) return 'Connect with Business'
  if (/listing|profile|my latino list|directorio|ficha/.test(lower)) return /profile/.test(lower) ? 'View Profile' : 'View Listing'
  if (listing.phone && /call|llame/.test(lower)) return 'Connect with Business'
  return listing.website ? 'Visit Website' : 'View the My Latino List profile'
}

export function isGroundedCta(cta: string, listing: QualityListing): boolean {
  const lower = String(cta || '').toLowerCase()
  if (!lower) return false
  if (RAW_URL.test(lower) || isPlaceholderUrl(lower)) return false
  if (UNSAFE_CTA.test(lower) && !marketingFactsBlob(listing).match(/book|order|reserve|shop/)) return false
  return /listing|profile|learn more|connect|visit website|my latino list|directorio|ficha/.test(lower)
}

function categoryHashtag(listing: QualityListing): string | null {
  const cat = naturalCategory(listing.category).replace(/[^A-Za-z0-9]+/g, '')
  if (!cat || isQaMetadataTag(cat)) return null
  return '#' + cat
}

function regionHashtag(listing: QualityListing): string | null {
  const city = String(listing.city || '').replace(/[^A-Za-z0-9]/g, '')
  if (!city) return null
  const state = String(listing.state || '').trim()
  const abbr = state.length === 2 ? state.toUpperCase() : (STATE_ABBR[state.toLowerCase()] || '')
  return '#' + city + abbr
}

function instagramTags(listing: QualityListing): string {
  const tags = ['#MyLatinoList', '#LatinoOwned', regionHashtag(listing), categoryHashtag(listing)]
    .filter((tag): tag is string => !!tag && !isQaMetadataTag(tag.replace('#', '')))
  return tags.slice(0, 5).join(' ')
}

function facebookFallback(listing: QualityListing): [string, string] {
  const name = listing.name || 'This business'
  const cat = naturalCategory(listing.category)
  const loc = locLabel(listing)
  const city = listing.city || loc
  const one = loc
    ? `Looking for ${cat.toLowerCase()} in ${loc}? Learn more about ${name} and connect through My Latino List. The profile is ready when you want details the business has shared. Nothing auto-posts.`
    : `Looking for ${cat.toLowerCase()}? Learn more about ${name} and connect through My Latino List. Nothing auto-posts.`
  const two = city
    ? `${name} has a My Latino List profile that local users in ${city} can open to learn more and get in touch. Use only the information published on that profile.`
    : `${name} has a My Latino List profile you can open to learn more and get in touch. Use only the information published on that profile.`
  return [one, two]
}

function instagramFallback(listing: QualityListing): [string, string] {
  const name = listing.name || 'This business'
  const cat = naturalCategory(listing.category)
  const city = listing.city || locLabel(listing)
  const tags = instagramTags(listing)
  const one = city
    ? `Save this note: ${name} is on My Latino List for ${cat.toLowerCase()} around ${city}. Open the profile when you want the details the business shared.\n\n${tags}`
    : `Save this note: ${name} is on My Latino List. Open the profile when you want the details the business shared.\n\n${tags}`
  const two = city
    ? `Share ${name} with someone looking nearby in ${city}. The My Latino List profile is the place to read what the business published.\n\n#MyLatinoList #LatinoOwned`
    : `Share ${name} with someone looking nearby. The My Latino List profile is the place to read what the business published.\n\n#MyLatinoList #LatinoOwned`
  return [one, two]
}

function tiktokFallback(listing: QualityListing): QualityTiktokConcept[] {
  const name = listing.name || 'This business'
  const cat = naturalCategory(listing.category)
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  return [
    {
      hook: `Meet ${name} on My Latino List`,
      visual: loc
        ? `Show the My Latino List profile screen for ${name}, with a short text animation of the name and ${loc}.`
        : `Show the My Latino List profile screen for ${name}.`,
      talking_point: `${name} is listed under ${cat}${locBit} on My Latino List. Share only what appears on the profile.`,
      cta: 'View Listing',
    },
    {
      hook: loc ? `Looking for ${cat.toLowerCase()} in ${loc}?` : `Looking for ${cat.toLowerCase()} on My Latino List?`,
      visual: listing.website
        ? `Screen recording of the ${name} website as it appears from the verified link.`
        : 'Screen recording of a My Latino List search opening this profile.',
      talking_point: `Discover ${name} on My Latino List. Do not invent reviews, prices, or work happening off camera.`,
      cta: listing.website ? 'Visit Website' : 'Learn More',
    },
  ]
}

function spotlightFallback(listing: QualityListing): { en: string; es: string } {
  const name = listing.name || 'This business'
  const cat = naturalCategory(listing.category)
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  const locEs = loc ? ` en ${loc}` : ''
  const desc = listing.description ? ` ${listing.description.slice(0, 180)}` : ''
  const phone = listing.phone ? ' Call using the number published on the profile.' : ''
  return {
    en: `${name} is listed under ${cat}${locBit}. Its My Latino List profile gives local users a place to learn more and connect using the information the business has provided.${desc}${phone}`.replace(/\s+/g, ' ').trim(),
    es: `${name} está publicado en My Latino List en la categoría de ${cat.toLowerCase()}${locEs}. Quienes buscan en el directorio pueden abrir el perfil para conocer el negocio y contactarlo con los datos que la empresa compartió.`,
  }
}

function emailFallback(listing: QualityListing): QualityPack['email_campaign'] {
  const name = listing.name || 'This business'
  const cat = naturalCategory(listing.category)
  const loc = locLabel(listing)
  const city = listing.city || loc
  return {
    subject: city ? `Discover ${name} in ${city}` : `Discover ${name}`,
    preview: `Explore this ${cat} listing on My Latino List.`,
    body: city
      ? `If you are exploring ${cat.toLowerCase()} around ${city}, ${name} has a profile on My Latino List. Open it to learn more from the details the business provided. This note is a draft and nothing auto-posts.`
      : `${name} has a profile on My Latino List. Open it to learn more from the details the business provided. This note is a draft and nothing auto-posts.`,
    cta: listing.website ? 'Visit Website' : 'View the My Latino List profile',
  }
}

export function channelSpecificFallbackPack(listing: QualityListing): QualityPack {
  const safe = marketingListingFrom(listing)
  const [facebook1, facebook2] = facebookFallback(safe)
  const [ig1, ig2] = instagramFallback(safe)
  const spotlight = spotlightFallback(safe)
  const email = emailFallback(safe)
  const loc = locLabel(safe)
  const cat = naturalCategory(safe.category)
  return {
    facebook_posts: [facebook1, facebook2],
    instagram_captions: [ig1, ig2],
    tiktok_concepts: tiktokFallback(safe),
    seo: {
      keywords: [
        safe.name,
        cat,
        loc && cat ? `${cat} ${loc}` : '',
        loc,
        cat ? `Latino-owned ${cat}` : 'My Latino List',
      ].filter(Boolean).slice(0, 8),
      local_discovery: [
        loc && cat ? `${cat} in ${loc}` : cat,
        safe.city && cat ? `${cat} ${safe.city}` : '',
        `${safe.name} My Latino List`,
      ].filter(Boolean).slice(0, 8),
    },
    bilingual_spotlight: spotlight,
    email_campaign: email,
    auto_post: false,
    disclaimer: 'Drafts only. Review before publishing. Nothing auto-posts. No performance claims.',
  }
}

function normalizeFingerprint(text: string, listing: QualityListing): string {
  let next = String(text || '').toLowerCase().replace(/#[a-z0-9_]+/g, ' ')
  const extras = ['my latino list', 'latino-owned', 'listed under', 'profile', 'connect', 'learn more', 'looking for', 'local users']
  for (const token of [listing.name, listing.category, listing.city, listing.state, naturalCategory(listing.category), ...extras]) {
    if (!token) continue
    next = next.split(String(token).toLowerCase()).join(' ')
  }
  return next.replace(/[^a-z0-9áéíóúñü\s]/gi, ' ').replace(/\s+/g, ' ').trim()
}

function similarFingerprints(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if ((a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) > 24) return true
  const wa = new Set(a.split(' ').filter((word) => word.length > 2))
  const wb = new Set(b.split(' ').filter((word) => word.length > 2))
  if (!wa.size || !wb.size) return false
  let inter = 0
  for (const word of wa) if (wb.has(word)) inter += 1
  return inter / new Set([...wa, ...wb]).size >= 0.62
}

export function packHasCrossChannelReuse(pack: QualityPack, listing: QualityListing): boolean {
  const facebook = normalizeFingerprint(pack.facebook_posts.join(' '), listing)
  const instagram = normalizeFingerprint(pack.instagram_captions.join(' ').replace(/#[A-Za-z0-9_]+/g, ' '), listing)
  const spotlight = normalizeFingerprint(pack.bilingual_spotlight.en, listing)
  const email = normalizeFingerprint(pack.email_campaign.body, listing)
  return similarFingerprints(facebook, spotlight)
    || similarFingerprints(facebook, email)
    || similarFingerprints(spotlight, email)
    || similarFingerprints(instagram, facebook)
}

function postsAreParaphrases(a: string, b: string, listing: QualityListing): boolean {
  return similarFingerprints(normalizeFingerprint(a, listing), normalizeFingerprint(b, listing))
}

function invalidSubject(subject: string): boolean {
  const value = String(subject || '').trim()
  if (!value) return true
  if (/(\b[\wáéíóúñü]+)(?:\s+\1\b)+/i.test(value)) return true
  if (CUSTOMER_UNSUPPORTED_HYPE.test(value)) return true
  if (RAW_URL.test(value)) return true
  return false
}

export function packHasInvalidSubject(pack: QualityPack): boolean {
  return invalidSubject(pack.email_campaign.subject)
}

export function packHasPlaceholderText(pack: QualityPack, listing: QualityListing): boolean {
  const blob = packBlob(pack)
  if (isPlaceholderDescription(listing.description) && listing.description && blob.includes(listing.description)) return true
  return /qa-staging-test-description|testing new account|lorem ipsum|example\.test|localhost/i.test(blob)
}

export function packHasQaTestHashtags(pack: QualityPack): boolean {
  return QA_HASHTAG.test(pack.instagram_captions.join(' ') + ' ' + pack.facebook_posts.join(' '))
}

export function packHasRawUrls(pack: QualityPack): boolean {
  const prose = [
    ...pack.facebook_posts,
    ...pack.instagram_captions,
    pack.bilingual_spotlight.en,
    pack.bilingual_spotlight.es,
    pack.email_campaign.subject,
    pack.email_campaign.preview,
    pack.email_campaign.body,
    pack.email_campaign.cta,
    ...pack.tiktok_concepts.map((row) => [row.hook, row.talking_point, row.cta].join(' ')),
  ].join('\n')
  return RAW_URL.test(prose)
}

export function packHasMechanicalListingLanguage(pack: QualityPack, listing: QualityListing): boolean {
  const cat = naturalCategory(listing.category)
  if (!cat) return false
  const re = new RegExp(`\\b${cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+listings?\\b`, 'i')
  return re.test(pack.facebook_posts.join(' ') + ' ' + pack.instagram_captions.join(' ') + ' ' + pack.bilingual_spotlight.en)
}

export function packHasPhysicalAssumptions(pack: QualityPack, listing: QualityListing): boolean {
  const blob = marketingFactsBlob(listing)
  const visuals = pack.tiktok_concepts.map((row) => row.visual).join(' ')
  const matches = visuals.match(new RegExp(PHYSICAL_ASSUMPTION.source, 'gi')) || []
  return matches.some((term) => !blob.includes(term.toLowerCase().trim()))
}

function packBlob(pack: QualityPack): string {
  return [
    ...pack.facebook_posts,
    ...pack.instagram_captions,
    ...pack.tiktok_concepts.flatMap((row) => [row.hook, row.visual, row.talking_point, row.cta]),
    pack.bilingual_spotlight.en,
    pack.bilingual_spotlight.es,
    pack.email_campaign.subject,
    pack.email_campaign.preview,
    pack.email_campaign.body,
    pack.email_campaign.cta,
  ].join(' ')
}

function fillText(current: string, fallback: string): string {
  return current && current.length > 12 ? current : fallback
}

export function polishCustomerPack(pack: QualityPack, listing: QualityListing): {
  pack: QualityPack
  reason: FallbackReason | null
  replacedChannels: string[]
} {
  const safe = marketingListingFrom(listing)
  const fallback = channelSpecificFallbackPack(safe)
  const replaced: string[] = []

  const facebook = pack.facebook_posts.map((text) => neutralizeUnsupportedSentences(text, safe)).filter(Boolean)
  const instagram = pack.instagram_captions.map((text) => neutralizeUnsupportedSentences(text, safe)).filter(Boolean)
  const concepts = pack.tiktok_concepts.map((row) => ({
    hook: neutralizeUnsupportedSentences(row.hook, safe),
    visual: sanitizeVisual(row.visual, safe),
    talking_point: neutralizeUnsupportedSentences(row.talking_point, safe),
    cta: groundCta(row.cta, safe),
  })).filter((row) => row.hook || row.talking_point)
  const spotlight = {
    en: neutralizeUnsupportedSentences(pack.bilingual_spotlight.en, safe),
    es: neutralizeUnsupportedSentences(pack.bilingual_spotlight.es, safe),
  }
  const email = {
    subject: neutralizeUnsupportedSentences(pack.email_campaign.subject, safe),
    preview: neutralizeUnsupportedSentences(pack.email_campaign.preview, safe),
    body: neutralizeUnsupportedSentences(pack.email_campaign.body, safe),
    cta: groundCta(pack.email_campaign.cta, safe),
  }

  if (facebook.length < 2) {
    replaced.push('facebook')
    facebook[0] = fillText(facebook[0], fallback.facebook_posts[0])
    facebook[1] = fillText(facebook[1], fallback.facebook_posts[1])
  }
  if (postsAreParaphrases(facebook[0] || '', facebook[1] || '', safe) || packHasMechanicalListingLanguage({
    ...fallback,
    facebook_posts: facebook.slice(0, 2),
  }, safe)) {
    replaced.push('facebook_diversity')
    facebook[0] = fallback.facebook_posts[0]
    facebook[1] = fallback.facebook_posts[1]
  }
  if (instagram.length < 2 || !captionHasProse(instagram[0] || '') || !captionHasProse(instagram[1] || '')) {
    replaced.push('instagram')
    instagram[0] = fallback.instagram_captions[0]
    instagram[1] = fallback.instagram_captions[1]
  }
  if (postsAreParaphrases(instagram[0], instagram[1], safe) || postsAreParaphrases(instagram[0], facebook[0], safe)) {
    replaced.push('instagram_diversity')
    instagram[0] = fallback.instagram_captions[0]
    instagram[1] = fallback.instagram_captions[1]
  }
  if (concepts.length < 2) {
    replaced.push('tiktok')
    concepts[0] = fallback.tiktok_concepts[0]
    concepts[1] = fallback.tiktok_concepts[1]
  }
  if (!spotlight.en || packHasRawUrls({ ...fallback, bilingual_spotlight: spotlight })) {
    replaced.push('spotlight_en')
    spotlight.en = fallback.bilingual_spotlight.en
  }
  if (!spotlight.es) {
    replaced.push('spotlight_es')
    spotlight.es = fallback.bilingual_spotlight.es
  }
  if (invalidSubject(email.subject) || !email.body || email.body.length < 60 || RAW_URL.test(email.body) || /example\.test|localhost/i.test(email.body)) {
    replaced.push('email')
    email.subject = fallback.email_campaign.subject
    email.preview = fallback.email_campaign.preview
    email.body = fallback.email_campaign.body
    email.cta = fallback.email_campaign.cta
  }
  if (email.preview && !/^explore this .+ listings? on my latino list\.?$/i.test(email.preview)) {
    const catRe = naturalCategory(safe.category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (catRe && new RegExp(`\\b${catRe}\\s+listings?\\b`, 'i').test(email.preview)) {
      email.preview = fallback.email_campaign.preview
    }
  }

  let next: QualityPack = {
    facebook_posts: facebook.slice(0, 2),
    instagram_captions: instagram.slice(0, 2),
    tiktok_concepts: concepts.slice(0, 2),
    seo: fallback.seo,
    bilingual_spotlight: spotlight,
    email_campaign: email,
    auto_post: false,
    disclaimer: pack.disclaimer || fallback.disclaimer,
  }

  if (packHasCrossChannelReuse(next, safe) || packHasQaTestHashtags(next) || packHasRawUrls(next) || packHasMechanicalListingLanguage(next, safe)) {
    replaced.push('cross_channel')
    next = {
      ...next,
      facebook_posts: fallback.facebook_posts,
      instagram_captions: fallback.instagram_captions,
      bilingual_spotlight: fallback.bilingual_spotlight,
      email_campaign: fallback.email_campaign,
      tiktok_concepts: next.tiktok_concepts.some((row) => PHYSICAL_ASSUMPTION.test(row.visual))
        ? fallback.tiktok_concepts
        : next.tiktok_concepts,
    }
  }

  let reason: FallbackReason | null = null
  if (replaced.includes('cross_channel')) reason = 'excessive_duplication'
  else if (replaced.includes('email') && invalidSubject(pack.email_campaign.subject)) reason = 'invalid_subject'
  else if (replaced.length) reason = 'other_validation_failure'
  if (isLowInformationDescription(listing.description) && replaced.length >= 3) reason = 'low_information_description'

  return { pack: next, reason, replacedChannels: [...new Set(replaced)] }
}

export function evaluatePackQuality(pack: QualityPack, listing: QualityListing): {
  acceptable: boolean
  issues: string[]
} {
  const issues: string[] = []
  const blob = packBlob(pack)

  if (!pack.facebook_posts[0]?.includes(listing.name)) issues.push('facebook_name')
  if (!pack.bilingual_spotlight.en.includes(listing.name) || !pack.bilingual_spotlight.es.includes(listing.name)) issues.push('spotlight_name')
  if (containsUnsupportedHype(blob)) issues.push('unsupported_claim')
  if (packHasPlaceholderText(pack, listing)) issues.push('placeholder')
  if (packHasPhysicalAssumptions(pack, listing)) issues.push('physical_assumption')
  if (packHasCrossChannelReuse(pack, listing)) issues.push('duplication')
  if (packHasInvalidSubject(pack)) issues.push('invalid_subject')
  if (!isGroundedCta(pack.email_campaign.cta, listing)) issues.push('cta')
  if (!isGroundedCta(pack.tiktok_concepts[0]?.cta || '', listing)) issues.push('tiktok_cta')
  if (postsAreParaphrases(pack.facebook_posts[0], pack.facebook_posts[1], listing)) issues.push('facebook_same')
  if (postsAreParaphrases(pack.instagram_captions[0], pack.facebook_posts[0], listing)) issues.push('instagram_copy')
  if (!captionHasProse(pack.instagram_captions[0]) || !captionHasProse(pack.instagram_captions[1])) issues.push('instagram_prose')
  if (packHasQaTestHashtags(pack)) issues.push('qa_hashtags')
  if (packHasRawUrls(pack)) issues.push('raw_url')
  if (packHasMechanicalListingLanguage(pack, listing)) issues.push('mechanical_listing')
  if (/el mejor|de confianza|líder|el lugar perfecto|lo último|número uno/i.test(pack.bilingual_spotlight.es)) issues.push('spanish_hype')
  return { acceptable: issues.length === 0, issues }
}
