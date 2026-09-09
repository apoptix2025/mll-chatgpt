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
  /qa[-_\s]?staging|test[-_\s]?description|testing new account|lorem ipsum|^test\b|^n\/?a$|^todo\b|^asdf\b|^dummy\b|^placeholder\b|^sample (text|description)\b|^foo bar\b/i

const LOW_INFO_FILLER =
  /\b(test business|new account|coming soon|tbd|n\/a|none|none listed)\b/i

export const CUSTOMER_UNSUPPORTED_HYPE =
  /#1\b|\bnumber\s*one\b|\bn[uú]mero\s*1\b|\bbest\b|\btop(?:-rated)?\b|\bleading\b|\bindustry-leading\b|\btrusted\b|\baward(?:s|ed|-winning)?\b|\bcertified\b|\btestimonials?\b|\bhighly rated\b|\bpopular\b|\bpremier\b|\bexceptional\b|\binnovative\b|\binnovators?\b|\blatest\b|\bgo-to\b|\bgo to\b|\bperfect place\b|\bel lugar perfecto\b|\blo [uú]ltimo\b|\bde confianza\b|\bl[ií]der(?:es)?\b|\bcutting[- ]edge\b|\bstate[- ]of[- ]the[- ]art\b|\bworld-class\b|\bunparalleled\b|\bpushing the boundaries\b|\bat the forefront\b|\bcalificaci[oó]n(?:es)?\b|\bmejor(?:es)?\b|m[aá]s confiable|el mejor|la mejor|\b\d+\s+reviews?\b|\bstar ratings?\b|\b\d+(?:\.\d+)?\s*stars?\b|\bfollowers\b|\brevenue\b|\branking|\d+\s*%|\$\d+|\bsince\s+\d{4}\b|\byears in business\b/i

const PHYSICAL_ASSUMPTION =
  /\bstorefronts?\b|\brestaurant interiors?\b|\bkitchen\b|\bemployees?\b|\bstaff\b|\bteam of\b|\bcashiers?\b|\boffice\b|\bequipment\b|\bcustomers? (waiting|lined|seated)\b|\bwork being performed\b|\bcrowded\b|\bparking lot\b|\bdining room\b/i

const UNSAFE_CTA =
  /\bbook a (table|consultation|appointment)\b|\border now\b|\bbuy now\b|\bshop now\b|\bvisit our (store|storefront|office|restaurant)\b|\breserve\b|\bget \d+%\s*off\b/i

export function locLabel(listing: QualityListing): string {
  return [listing.city, listing.state].filter(Boolean).join(', ')
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
  const description = isLowInformationDescription(listing.description) ? null : listing.description
  return { ...listing, description }
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
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

export function rewriteUnsupportedHype(text: string, listing: QualityListing): string {
  if (!text) return ''
  const name = listing.name || 'this business'
  const cat = listing.category || 'listing'
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  return String(text)
    .replace(/\bdiscover the latest(?:\s+in\s+\w+)?(?:\s+from)?\b/gi, 'Discover')
    .replace(/\bthe latest in\b/gi, '')
    .replace(/\blatest(?:\s+innovations?)?\b/gi, '')
    .replace(/\byour go-to\b/gi, '')
    .replace(/\bgo-to\b/gi, '')
    .replace(/\bthe perfect place for\b/gi, 'a listing for')
    .replace(/\bel lugar perfecto para\b/gi, 'un anuncio de')
    .replace(/\bel lugar perfecto\b/gi, 'este anuncio')
    .replace(/\bpushing the boundaries of\b/gi, 'listed as')
    .replace(/\bat the forefront of\b/gi, 'listed as')
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
    || `Explore ${name}, a ${cat} listing${locBit} on My Latino List.`
}

export function neutralizeUnsupportedSentences(text: string, listing: QualityListing): string {
  const rewritten = rewriteUnsupportedHype(stripPlaceholderText(text, listing), listing)
  return rewritten
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => rewriteUnsupportedHype(sentence, listing))
    .filter((sentence) => sentence && !CUSTOMER_UNSUPPORTED_HYPE.test(sentence))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  if (!next || (PHYSICAL_ASSUMPTION.test(next) && !PHYSICAL_ASSUMPTION.exec(next)?.[0]?.split(/\s+/).every((word) => blob.includes(word.toLowerCase())))) {
    if (listing.website) return `Screen recording of the ${name} website.`
    if (listing.facebook_url || listing.instagram_url) return `Show the verified social profile linked from the ${name} listing.`
    return `Show the My Latino List listing card for ${name}${locBit}.`
  }
  if (PHYSICAL_ASSUMPTION.test(next)) {
    const matches = next.toLowerCase().match(new RegExp(PHYSICAL_ASSUMPTION.source, 'gi')) || []
    if (matches.some((term) => !blob.includes(term.toLowerCase().trim()))) {
      return `Show the My Latino List listing card for ${name}${locBit}.`
    }
  }
  return next
}

export function groundCta(cta: string, listing: QualityListing): string {
  const cleaned = neutralizeUnsupportedSentences(cta, listing)
  const lower = cleaned.toLowerCase()
  if (UNSAFE_CTA.test(lower) && !marketingFactsBlob(listing).includes(lower.slice(0, 12))) {
    return listing.website ? `Visit the ${listing.name} website.` : 'View this listing on My Latino List.'
  }
  if (listing.website && /website|sitio/.test(lower)) return cleaned || `Visit the ${listing.name} website.`
  if (/listing|my latino list|learn more|connect|profile|directorio|ficha|website|sitio/.test(lower)) {
    return cleaned || 'View this listing on My Latino List.'
  }
  if (listing.phone && /call|llame/.test(lower)) return cleaned
  return listing.website ? `Learn more at the ${listing.name} website.` : 'View this listing on My Latino List.'
}

export function isGroundedCta(cta: string, listing: QualityListing): boolean {
  const lower = String(cta || '').toLowerCase()
  if (!lower) return false
  if (UNSAFE_CTA.test(lower) && !marketingFactsBlob(listing).match(/book|order|reserve|shop/)) return false
  return /listing|my latino list|learn more|connect|profile|directorio|ficha|website|sitio|llame|call/.test(lower)
}

function facebookFallback(listing: QualityListing): [string, string] {
  const name = listing.name || 'This business'
  const cat = listing.category || 'local business'
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  const site = listing.website ? ` Visit the business website from the listing.` : ''
  const one = `Explore ${name}, a ${cat} listing${locBit} on My Latino List. Open the profile to see what ${name} shares and how to get in touch.`
  const two = loc
    ? `Looking for ${cat} businesses in ${loc}? Discover ${name} on My Latino List.${site} Nothing auto-posts from here.`
    : `Discover ${name} on My Latino List. This ${cat} listing is ready to view in the directory.${site}`
  return [one, two]
}

function instagramFallback(listing: QualityListing): [string, string] {
  const name = listing.name || 'This business'
  const cat = listing.category || 'local business'
  const loc = locLabel(listing)
  const tags = ['#MyLatinoList', '#LatinoOwned']
  if (listing.city) tags.push('#' + listing.city.replace(/\s+/g, ''))
  const one = loc
    ? `Explore ${name} on My Latino List. Find this listing in ${loc}. Nothing auto-posts. ${tags.join(' ')}`
    : `Explore ${name} on My Latino List. Open the listing to connect. ${tags.join(' ')}`
  const two = loc
    ? `Looking for ${cat} in ${loc}? Find ${name}. ${tags[0]} ${tags[1]}`
    : `Find ${name} on My Latino List and view the listing. ${tags[0]} ${tags[1]}`
  return [one, two]
}

function tiktokFallback(listing: QualityListing): QualityTiktokConcept[] {
  const name = listing.name || 'This business'
  const cat = listing.category || 'local business'
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  const websiteVisual = listing.website
    ? `Screen recording of the ${name} website.`
    : `Show the My Latino List listing card for ${name}${locBit}.`
  return [
    {
      hook: `Meet ${name} on My Latino List`,
      visual: `Show the My Latino List listing card for ${name}${locBit}.`,
      talking_point: `${name} is a ${cat} listing${locBit}. Use only the details on the listing.`,
      cta: 'View this listing on My Latino List.',
    },
    {
      hook: loc ? `Looking for ${cat} in ${loc}?` : `Looking for ${cat} on My Latino List?`,
      visual: listing.website ? websiteVisual : 'Screen recording of the directory search opening this listing.',
      talking_point: `Discover ${name} on My Latino List. Share the listing, not invented reviews or prices.`,
      cta: listing.website ? `Learn more at the ${name} website.` : 'Search My Latino List and open this profile.',
    },
  ]
}

function spotlightFallback(listing: QualityListing): { en: string; es: string } {
  const name = listing.name || 'This business'
  const cat = listing.category || 'local business'
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  const locEs = loc ? ` en ${loc}` : ''
  const desc = listing.description ? ` ${listing.description.slice(0, 180)}` : ''
  const site = listing.website ? ` Learn more at ${listing.website}.` : ''
  const phone = listing.phone ? ` Call ${listing.phone}.` : ''
  return {
    en: `${name} is a ${cat} listing on My Latino List${locBit}.${desc}${site}${phone} View the listing to connect.`.replace(/\s+/g, ' ').trim(),
    es: `${name} aparece en My Latino List como un anuncio de ${cat.toLowerCase()}${locEs}. Entra al directorio para ver esta ficha y contactar al negocio.`,
  }
}

function emailFallback(listing: QualityListing): QualityPack['email_campaign'] {
  const name = listing.name || 'This business'
  const cat = listing.category || 'local business'
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  const site = listing.website ? ` You can also visit ${listing.website}.` : ''
  return {
    subject: `Find ${name} on My Latino List`,
    preview: loc ? `${cat} in ${loc}` : `${cat} on My Latino List`,
    body: `A neighbor asked where to find ${cat}${locBit}. ${name} is listed on My Latino List, with contact details on the profile.${site} This note is a draft — nothing auto-posts.`,
    cta: listing.website ? `Visit the ${name} website` : 'View this listing on My Latino List',
  }
}

export function channelSpecificFallbackPack(listing: QualityListing): QualityPack {
  const safe = marketingListingFrom(listing)
  const [facebook1, facebook2] = facebookFallback(safe)
  const [ig1, ig2] = instagramFallback(safe)
  const spotlight = spotlightFallback(safe)
  const email = emailFallback(safe)
  const loc = locLabel(safe)
  const cat = safe.category || ''
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
  let next = String(text || '').toLowerCase()
  for (const token of [listing.name, listing.category, listing.city, listing.state, 'my latino list', 'latino-owned']) {
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
  return inter / new Set([...wa, ...wb]).size >= 0.72
}

export function packHasCrossChannelReuse(pack: QualityPack, listing: QualityListing): boolean {
  const samples = [
    pack.facebook_posts[0],
    pack.bilingual_spotlight.en,
    pack.email_campaign.body,
  ].map((text) => normalizeFingerprint(String(text || '').split(/(?<=[.!?])\s+/)[0] || '', listing))
  return similarFingerprints(samples[0], samples[1])
    || similarFingerprints(samples[0], samples[2])
    || similarFingerprints(samples[1], samples[2])
}

function postsAreParaphrases(a: string, b: string, listing: QualityListing): boolean {
  return similarFingerprints(normalizeFingerprint(a, listing), normalizeFingerprint(b, listing))
}

function invalidSubject(subject: string): boolean {
  const value = String(subject || '').trim()
  if (!value) return true
  if (/(\b[\wáéíóúñü]+)(?:\s+\1\b)+/i.test(value)) return true
  if (CUSTOMER_UNSUPPORTED_HYPE.test(value)) return true
  return false
}

export function packHasInvalidSubject(pack: QualityPack): boolean {
  return invalidSubject(pack.email_campaign.subject)
}

export function packHasPlaceholderText(pack: QualityPack, listing: QualityListing): boolean {
  const blob = [
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
  if (isPlaceholderDescription(listing.description) && listing.description && blob.includes(listing.description)) return true
  return /qa-staging-test-description|testing new account|lorem ipsum/i.test(blob)
}

export function packHasPhysicalAssumptions(pack: QualityPack, listing: QualityListing): boolean {
  const blob = marketingFactsBlob(listing)
  const visuals = pack.tiktok_concepts.map((row) => row.visual).join(' ')
  const matches = visuals.match(new RegExp(PHYSICAL_ASSUMPTION.source, 'gi')) || []
  return matches.some((term) => !blob.includes(term.toLowerCase().trim()))
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
  if (postsAreParaphrases(facebook[0] || '', facebook[1] || '', safe)) {
    replaced.push('facebook_diversity')
    facebook[0] = fallback.facebook_posts[0]
    facebook[1] = fallback.facebook_posts[1]
  }
  if (instagram.length < 2) {
    replaced.push('instagram')
    instagram[0] = fillText(instagram[0], fallback.instagram_captions[0])
    instagram[1] = fillText(instagram[1], fallback.instagram_captions[1])
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
  if (!spotlight.en) {
    replaced.push('spotlight_en')
    spotlight.en = fallback.bilingual_spotlight.en
  }
  if (!spotlight.es) {
    replaced.push('spotlight_es')
    spotlight.es = fallback.bilingual_spotlight.es
  }
  if (invalidSubject(email.subject) || !email.body) {
    replaced.push('email')
    email.subject = fallback.email_campaign.subject
    email.preview = email.preview || fallback.email_campaign.preview
    email.body = fillText(email.body, fallback.email_campaign.body)
    email.cta = email.cta || fallback.email_campaign.cta
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

  if (packHasCrossChannelReuse(next, safe)) {
    replaced.push('cross_channel')
    next = {
      ...next,
      bilingual_spotlight: fallback.bilingual_spotlight,
      email_campaign: fallback.email_campaign,
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
  const blob = [
    ...pack.facebook_posts,
    ...pack.instagram_captions,
    ...pack.tiktok_concepts.flatMap((row) => [row.hook, row.visual, row.talking_point, row.cta]),
    pack.bilingual_spotlight.en,
    pack.bilingual_spotlight.es,
    pack.email_campaign.subject,
    pack.email_campaign.preview,
    pack.email_campaign.body,
    pack.email_campaign.cta,
  ].join('\n')

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
  if (/el mejor|de confianza|líder|el lugar perfecto|lo último|número uno/i.test(pack.bilingual_spotlight.es)) issues.push('spanish_hype')
  return { acceptable: issues.length === 0, issues }
}
