import { MLL_AI_MODEL } from '../api/ai-search'
import { parseMarketingPack } from '../api/marketing'
import type { PilotBusiness } from './marketing-pilot'
import type { MarketingTrialStatus } from './marketing-trial'
import {
  CUSTOMER_UNSUPPORTED_HYPE,
  channelSpecificFallbackPack,
  isLowInformationDescription,
  marketingFactsBlob,
  marketingListingFrom,
  neutralizeUnsupportedSentences,
  packHasCrossChannelReuse,
  packHasInvalidSubject,
  packHasPhysicalAssumptions,
  packHasPlaceholderText,
  polishCustomerPack,
  type FallbackReason,
} from './customer-marketing-pack-quality'

/** Conservative V2 staging-pilot limit. Not a paid-plan entitlement. */
export const CUSTOMER_PACK_PILOT_LIMIT = 3
export const CUSTOMER_PACK_COOLDOWN_MS = 15_000
export const CUSTOMER_PACK_AI_TIMEOUT_MS = 20_000
export const CUSTOMER_PACK_MAX_TOKENS = 1800
export const CUSTOMER_PACK_TABLE = 'customer_marketing_packs'

export const CUSTOMER_UNGROUNDED_CLAIM = CUSTOMER_UNSUPPORTED_HYPE
export type { FallbackReason }

export type GroundedListing = {
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

export type CustomerTiktokConcept = {
  hook: string
  visual: string
  talking_point: string
  cta: string
}

export type CustomerMarketingPack = {
  facebook_posts: string[]
  instagram_captions: string[]
  tiktok_concepts: CustomerTiktokConcept[]
  seo: { keywords: string[]; local_discovery: string[] }
  bilingual_spotlight: { en: string; es: string }
  email_campaign: { subject: string; preview: string; body: string; cta: string }
  auto_post: false
  disclaimer: string
}

export type GenerationSource = 'ai_grounded' | 'deterministic_fallback'

export type CustomerPackUsage = {
  packs_generated: number
  last_pack_generated_at: string | null
  last_pack: CustomerMarketingPack | null
  content_copy_events: number
  model: string | null
  fallback: boolean
  generation_source: GenerationSource | null
}

export type GenerationLockReason =
  | 'trial_expired'
  | 'trial_cancelled'
  | 'converted_entitlement_todo'
  | 'pilot_limit'
  | 'cooldown'
  | 'storage_unavailable'

export type GenerationEntitlement = {
  allowed: boolean
  reason: GenerationLockReason | null
  remaining: number
  lock_message: string | null
}

export class MarketingPackStorageError extends Error {
  readonly code: 'unavailable' | 'failed'
  constructor(code: 'unavailable' | 'failed', message: string) {
    super(message)
    this.name = 'MarketingPackStorageError'
    this.code = code
  }
}

type PackClient = {
  from: (table: string) => any
}

function hasHttp(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url)
}

function socialUrl(links: Record<string, string> | null | undefined, key: string): string | null {
  if (!links || typeof links !== 'object') return null
  const value = String(links[key] || links[key.toLowerCase()] || '').trim()
  return hasHttp(value) ? value : null
}

function asTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12)
}

export function generationSourceFromFallback(fallback: boolean): GenerationSource {
  return fallback ? 'deterministic_fallback' : 'ai_grounded'
}

export {
  evaluatePackQuality,
  isLowInformationDescription,
  isPlaceholderDescription,
  rewriteUnsupportedHype,
  polishCustomerPack,
  channelSpecificFallbackPack,
} from './customer-marketing-pack-quality'

export function allowedFactsFromListing(listing: GroundedListing): Record<string, unknown> {
  const safe = marketingListingFrom(listing)
  const facts: Record<string, unknown> = {
    business_name: safe.name || null,
  }
  const optional: Record<string, unknown> = {
    category: safe.category,
    description: safe.description,
    city: safe.city,
    state: safe.state,
    website: safe.website,
    phone: safe.phone,
    email: safe.email,
    address: safe.address,
    zip: safe.zip,
    tags: safe.tags.length ? safe.tags : null,
    facebook_url: safe.facebook_url,
    instagram_url: safe.instagram_url,
    other_social: Object.keys(safe.other_social).length ? safe.other_social : null,
  }
  for (const [key, value] of Object.entries(optional)) {
    if (value == null || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    facts[key] = value
  }
  return facts
}

export function groundedListingFromBusiness(biz: PilotBusiness): GroundedListing {
  const links = biz.social_links
  const other: Record<string, string> = {}
  if (links && typeof links === 'object') {
    for (const [key, value] of Object.entries(links)) {
      const lower = key.toLowerCase()
      if (lower === 'facebook' || lower === 'instagram') continue
      if (hasHttp(value)) other[key] = String(value)
    }
  }
  return {
    name: String(biz.name || '').trim(),
    category: biz.category ? String(biz.category) : null,
    description: biz.description ? String(biz.description).trim() : null,
    city: biz.city ? String(biz.city) : null,
    state: biz.state ? String(biz.state) : null,
    website: hasHttp(biz.website) ? String(biz.website) : null,
    phone: biz.phone && String(biz.phone).trim().length > 6 ? String(biz.phone).trim() : null,
    email: biz.email && /@/.test(biz.email) ? String(biz.email).trim() : null,
    address: biz.address ? String(biz.address).trim() : null,
    zip: biz.zip ? String(biz.zip) : null,
    tags: asTags(biz.tags),
    facebook_url: socialUrl(links, 'facebook'),
    instagram_url: socialUrl(links, 'instagram'),
    other_social: other,
  }
}

export function lockMessageFor(reason: GenerationLockReason | null): string | null {
  if (reason === 'trial_expired') return 'Your free Growth Trial is complete.'
  if (reason === 'trial_cancelled') return 'Generation is unavailable for this trial.'
  if (reason === 'converted_entitlement_todo') return 'Generation is not available for this trial status.'
  if (reason === 'pilot_limit') return 'You have used the staging-pilot Marketing Pack generations for this trial.'
  if (reason === 'cooldown') return 'Please wait a moment before generating another pack.'
  if (reason === 'storage_unavailable') return 'Marketing Pack storage is not ready yet.'
  return null
}

export function generationEntitlement(
  trialStatus: MarketingTrialStatus | string | null | undefined,
  usage: Pick<CustomerPackUsage, 'packs_generated' | 'last_pack_generated_at'>,
  now = Date.now(),
): GenerationEntitlement {
  const generated = Math.max(0, Number(usage.packs_generated) || 0)
  const remaining = Math.max(0, CUSTOMER_PACK_PILOT_LIMIT - generated)
  const status = String(trialStatus || '').toLowerCase()

  if (status === 'expired' || status === 'ended') {
    return { allowed: false, reason: 'trial_expired', remaining, lock_message: lockMessageFor('trial_expired') }
  }
  if (status === 'cancelled') {
    return { allowed: false, reason: 'trial_cancelled', remaining, lock_message: lockMessageFor('trial_cancelled') }
  }
  if (status === 'converted') {
    // TODO: future plan entitlement engine. Do not invent paid-plan pack limits.
    return { allowed: false, reason: 'converted_entitlement_todo', remaining, lock_message: lockMessageFor('converted_entitlement_todo') }
  }
  if (status !== 'active') {
    return { allowed: false, reason: 'trial_expired', remaining, lock_message: lockMessageFor('trial_expired') }
  }
  if (generated >= CUSTOMER_PACK_PILOT_LIMIT) {
    return { allowed: false, reason: 'pilot_limit', remaining: 0, lock_message: lockMessageFor('pilot_limit') }
  }
  const last = usage.last_pack_generated_at ? Date.parse(usage.last_pack_generated_at) : NaN
  if (Number.isFinite(last) && now - last < CUSTOMER_PACK_COOLDOWN_MS) {
    return { allowed: false, reason: 'cooldown', remaining, lock_message: lockMessageFor('cooldown') }
  }
  return { allowed: true, reason: null, remaining, lock_message: null }
}

function asStringList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === 'string') return item.trim()
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>
      return String(row.text || row.caption || row.post || row.keyword || row.phrase || '').trim()
    }
    return ''
  }).filter(Boolean).slice(0, max)
}

function asTiktokList(raw: unknown, max: number): CustomerTiktokConcept[] {
  if (!Array.isArray(raw)) return []
  const out: CustomerTiktokConcept[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const text = item.trim()
      if (text) out.push({ hook: text, visual: '', talking_point: text, cta: 'Visit this listing on My Latino List.' })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const hook = String(row.hook || row.title || '').trim()
    const visual = String(row.visual || row.video || '').trim()
    const talking = String(row.talking_point || row.talking || row.script || '').trim()
    const cta = String(row.cta || row.call_to_action || '').trim()
    if (!hook && !talking) continue
    out.push({
      hook: hook || talking,
      visual,
      talking_point: talking || hook,
      cta: cta || 'Visit this listing on My Latino List.',
    })
  }
  return out.slice(0, max)
}

function asText(raw: unknown): string {
  if (typeof raw === 'string') {
    const text = raw.trim()
    return text === '[object Object]' ? '' : text
  }
  if (raw && typeof raw === 'object') {
    const row = raw as Record<string, unknown>
    return asText(row.text || row.body || row.content || row.caption || '')
  }
  return ''
}

function asSpotlight(raw: unknown): { en: string; es: string } {
  if (!raw || typeof raw !== 'object') return { en: '', es: '' }
  const row = raw as Record<string, unknown>
  return { en: asText(row.en || row.english), es: asText(row.es || row.spanish || row.espanol) }
}

function asEmail(raw: unknown): CustomerMarketingPack['email_campaign'] {
  if (!raw || typeof raw !== 'object') return { subject: '', preview: '', body: '', cta: '' }
  const row = raw as Record<string, unknown>
  return {
    subject: String(row.subject || '').trim(),
    preview: String(row.preview || row.preview_text || '').trim(),
    body: String(row.body || row.purpose || '').trim(),
    cta: String(row.cta || row.call_to_action || '').trim(),
  }
}

function asSeo(pack: Record<string, unknown>): CustomerMarketingPack['seo'] {
  const seo = pack.seo && typeof pack.seo === 'object' ? pack.seo as Record<string, unknown> : {}
  const keywords = asStringList(seo.keywords ?? pack.keywords, 8)
  const local = asStringList(seo.local_discovery ?? seo.local ?? pack.local_discovery, 8)
  return { keywords, local_discovery: local }
}

export function stripUngroundedClaims(text: string, listing?: GroundedListing): string {
  if (!text) return ''
  if (listing) return neutralizeUnsupportedSentences(text, listing)
  return neutralizeClaimPhrases(text)
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !CUSTOMER_UNGROUNDED_CLAIM.test(sentence))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function neutralizeClaimPhrases(text: string): string {
  return String(text || '')
    .replace(/\bthe best\b/gi, '')
    .replace(/\bbest\b/gi, '')
    .replace(/\b#1\b/gi, '')
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
    .trim()
}

function cleanList(items: string[], listing: GroundedListing): string[] {
  return items.map((text) => stripUngroundedClaims(text, listing)).filter(Boolean)
}

export function normalizeCustomerPack(raw: Record<string, unknown>): CustomerMarketingPack {
  const spotlight = asSpotlight(raw.bilingual_spotlight ?? raw.business_spotlight ?? raw.spotlight)
  const email = asEmail(raw.email_campaign ?? raw.newsletter ?? raw.email)
  return {
    facebook_posts: asStringList(raw.facebook_posts ?? raw.facebook, 2),
    instagram_captions: asStringList(raw.instagram_captions ?? raw.instagram, 2),
    tiktok_concepts: asTiktokList(raw.tiktok_concepts ?? raw.reel_concepts ?? raw.reels, 2),
    seo: asSeo(raw),
    bilingual_spotlight: spotlight,
    email_campaign: email,
    auto_post: false,
    disclaimer: 'Drafts only. Review before publishing. Nothing auto-posts. No performance claims.',
  }
}

export function filterCustomerPackToGrounded(pack: CustomerMarketingPack, listing: GroundedListing): CustomerMarketingPack {
  const concepts = pack.tiktok_concepts.map((row) => ({
    hook: cleanGroundedText(row.hook, listing),
    visual: cleanGroundedText(row.visual, listing),
    talking_point: cleanGroundedText(row.talking_point, listing),
    cta: cleanGroundedText(row.cta, listing) || 'Visit this listing on My Latino List.',
  })).filter((row) => row.hook || row.talking_point)

  return {
    facebook_posts: cleanList(pack.facebook_posts.map((text) => cleanGroundedText(text, listing)), listing).slice(0, 2),
    instagram_captions: cleanList(pack.instagram_captions.map((text) => cleanGroundedText(text, listing)), listing).slice(0, 2),
    tiktok_concepts: concepts.slice(0, 2),
    seo: deterministicSeo(listing),
    bilingual_spotlight: {
      en: cleanGroundedText(pack.bilingual_spotlight.en, listing),
      es: cleanGroundedText(pack.bilingual_spotlight.es, listing),
    },
    email_campaign: {
      subject: cleanGroundedText(pack.email_campaign.subject, listing),
      preview: cleanGroundedText(pack.email_campaign.preview, listing),
      body: cleanGroundedText(pack.email_campaign.body, listing),
      cta: cleanGroundedText(pack.email_campaign.cta, listing) || 'View this listing on My Latino List',
    },
    auto_post: false,
    disclaimer: pack.disclaimer || 'Drafts only. Review before publishing. Nothing auto-posts. No performance claims.',
  }
}

export function isCustomerPackComplete(pack: CustomerMarketingPack): boolean {
  return (
    pack.facebook_posts.length === 2 &&
    pack.instagram_captions.length === 2 &&
    pack.tiktok_concepts.length === 2 &&
    pack.bilingual_spotlight.en.length > 0 &&
    pack.bilingual_spotlight.es.length > 0 &&
    pack.email_campaign.subject.length > 0 &&
    pack.email_campaign.body.length > 0
  )
}

function locLabel(listing: GroundedListing): string {
  return [listing.city, listing.state].filter(Boolean).join(', ')
}

function groundedBlob(listing: GroundedListing): string {
  return marketingFactsBlob(listing)
}

const INVENTED_VERTICAL =
  /\bsoftware\b|\bapps?\b|\bbugs?\b|\bquality assurance\b|\btesting\b|\bpruebas?\b|\bcalificaci[oó]n(?:es)?\b|\bqa testing\b|\bqa game\b|\brestaurant\b|\bplumb(?:er|ing)\b|\battorney\b|\bdentist\b|\bconsultations?\b|\bbook a consultation\b/i

function fillNamePlaceholders(text: string, name: string): string {
  return String(text || '')
    .replace(/\[object Object\]/g, name)
    .replace(/\[(?:business name|nombre(?: del negocio)?)\]/gi, name)
}

function rewriteInventedPhrases(text: string, listing: GroundedListing): string {
  if (!text) return ''
  const blob = groundedBlob(listing)
  const cat = listing.category || 'listing'
  const catEs = listing.category || 'negocio'
  const replacements: Array<[RegExp, string]> = [
    [/\bsoftware testing\b/gi, cat],
    [/\bquality assurance\b/gi, cat],
    [/\bqa testing(?: services)?\b/gi, `${cat} listing`],
    [/\bqa services\b/gi, `${cat} listing`],
    [/\btesting services\b/gi, `${cat} listing`],
    [/\btesting needs\b/gi, `${cat} listing`],
    [/\btesting partner\b/gi, `${cat} listing`],
    [/\bbook a consultation\b/gi, 'open the listing'],
    [/\bconsultations?\b/gi, 'listing'],
    [/\bpruebas de calidad\b/gi, catEs],
    [/\bservicios de qa\b/gi, catEs],
    [/\bqa testing\b/gi, cat],
  ]
  let next = text
  for (const [pattern, replacement] of replacements) {
    const sample = pattern.source.replace(/\\b/g, '').replace(/\\/g, '')
    if (blob.includes(sample.toLowerCase())) continue
    next = next.replace(pattern, replacement)
  }
  if (!blob.includes('testing')) next = next.replace(/\btesting\b/gi, cat)
  if (!blob.includes('pruebas')) next = next.replace(/\bpruebas\b/gi, catEs)
  if (!blob.includes('software')) next = next.replace(/\bsoftware\b/gi, cat)
  return next.replace(/\s{2,}/g, ' ').trim()
}

function stripInventedServices(text: string, blob: string): string {
  if (!text) return ''
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const matches = sentence.toLowerCase().match(INVENTED_VERTICAL)
      if (!matches) return true
      return matches.every((term) => blob.includes(term.trim()))
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanGroundedText(text: string, listing: GroundedListing): string {
  const blob = groundedBlob(listing)
  const rewritten = rewriteInventedPhrases(fillNamePlaceholders(text, listing.name), listing)
  return stripInventedServices(stripUngroundedClaims(rewritten, listing), blob)
}

function deterministicSeo(listing: GroundedListing): CustomerMarketingPack['seo'] {
  const loc = locLabel(listing)
  const cat = listing.category || ''
  return {
    keywords: [
      listing.name,
      cat,
      loc && cat ? `${cat} ${loc}` : '',
      loc,
      cat ? `Latino-owned ${cat}` : 'My Latino List',
    ].filter(Boolean).slice(0, 8),
    local_discovery: [
      loc && cat ? `${cat} in ${loc}` : cat,
      listing.city && cat ? `${cat} ${listing.city}` : '',
      `${listing.name} My Latino List`,
    ].filter(Boolean).slice(0, 8),
  }
}

function packContentBlob(pack: CustomerMarketingPack): string {
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

export function packMentionsBusinessName(pack: CustomerMarketingPack, listing: GroundedListing): boolean {
  if (!listing.name) return true
  const name = listing.name
  const facebookOk = pack.facebook_posts.some((text) => text.includes(name))
  const spotlightOk = pack.bilingual_spotlight.en.includes(name) && pack.bilingual_spotlight.es.includes(name)
  const emailOk = pack.email_campaign.subject.includes(name) || pack.email_campaign.body.includes(name)
  return facebookOk && spotlightOk && emailOk
}

export function packMentionsCategory(pack: CustomerMarketingPack, listing: GroundedListing): boolean {
  if (!listing.category) return true
  return packContentBlob(pack).toLowerCase().includes(listing.category.toLowerCase())
}

export function packMentionsLocation(pack: CustomerMarketingPack, listing: GroundedListing): boolean {
  if (!listing.city) return true
  return packContentBlob(pack).includes(listing.city)
}

export function packHasUnsupportedClaims(pack: CustomerMarketingPack): boolean {
  return CUSTOMER_UNGROUNDED_CLAIM.test(packContentBlob(pack))
}

export function packHasInventedServices(pack: CustomerMarketingPack, listing: GroundedListing): boolean {
  const blob = groundedBlob(listing)
  const matches = packContentBlob(pack).toLowerCase().match(new RegExp(INVENTED_VERTICAL.source, 'gi'))
  if (!matches) return false
  return matches.some((term) => !blob.includes(term.trim().toLowerCase()))
}

export function isCustomerPackGrounded(pack: CustomerMarketingPack, listing: GroundedListing): boolean {
  const safe = marketingListingFrom(listing)
  return (
    isCustomerPackComplete(pack)
    && packMentionsBusinessName(pack, safe)
    && packMentionsCategory(pack, safe)
    && packMentionsLocation(pack, safe)
    && !packHasUnsupportedClaims(pack)
    && !packHasInventedServices(pack, safe)
    && !packHasPlaceholderText(pack, listing)
    && !packHasPhysicalAssumptions(pack, safe)
    && !packHasCrossChannelReuse(pack, safe)
    && !packHasInvalidSubject(pack)
  )
}

export function packChannelsAreDistinct(pack: CustomerMarketingPack): boolean {
  const samples = [
    pack.facebook_posts[0],
    pack.instagram_captions[0],
    pack.tiktok_concepts[0]?.hook,
    pack.bilingual_spotlight.en,
    pack.email_campaign.body,
  ].map((value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean)
  return new Set(samples).size >= 4
}

function withName(text: string, name: string): string {
  if (!text || !name || text.includes(name)) return text
  return `${name} — ${text}`
}

export function repairCustomerPackFacts(pack: CustomerMarketingPack, listing: GroundedListing): CustomerMarketingPack {
  const name = listing.name
  const cat = listing.category
  const loc = locLabel(listing)
  const facebook = pack.facebook_posts.map((text, index) => {
    let next = withName(text, name)
    if (index === 0 && cat && !next.toLowerCase().includes(cat.toLowerCase())) {
      next = `${next} Listed as ${cat} on My Latino List.`
    }
    if (index === 0 && listing.city && !next.includes(listing.city)) {
      next = `${next} ${loc}.`
    }
    return next.replace(/\s+/g, ' ').trim()
  })
  const instagram = pack.instagram_captions.map((text) => withName(text, name))
  const spotlightEn = (() => {
    let next = withName(pack.bilingual_spotlight.en, name)
    if (cat && !next.toLowerCase().includes(cat.toLowerCase())) next = `${next} Category: ${cat}.`
    if (listing.city && !next.includes(listing.city)) next = `${next} ${loc}.`
    return next.replace(/\s+/g, ' ').trim()
  })()
  const spotlightEs = withName(pack.bilingual_spotlight.es, name)
  const subject = pack.email_campaign.subject.includes(name) || pack.email_campaign.body.includes(name)
    ? pack.email_campaign.subject
    : withName(pack.email_campaign.subject, name)
  return {
    ...pack,
    facebook_posts: facebook,
    instagram_captions: instagram,
    bilingual_spotlight: { en: spotlightEn, es: spotlightEs },
    email_campaign: { ...pack.email_campaign, subject },
  }
}

export function buildCustomerFallbackPack(listing: GroundedListing): CustomerMarketingPack {
  return channelSpecificFallbackPack(marketingListingFrom(listing))
}

export function buildCustomerPackPrompt(listing: GroundedListing): string {
  const facts = allowedFactsFromListing(listing)
  const sparse = isLowInformationDescription(listing.description)
  return [
    'Generate marketing content ONLY from ALLOWED_FACTS.',
    'Anything not present in ALLOWED_FACTS must be treated as unknown.',
    'Do not infer services, qualities, achievements, facilities, products, experience, popularity, or customer sentiment.',
    'ALLOWED_FACTS: ' + JSON.stringify(facts),
    sparse
      ? 'The listing description is missing or low-information. Use only business name, category, city/state, website, phone, and verified social URLs. Do not invent services.'
      : 'Use only explicitly stated facts and themes from the description. Do not add anything else.',
    'business_name is mandatory in Facebook posts, the English spotlight, the Spanish spotlight, and the email subject or body. Never write [Business Name] or omit the name.',
    'category is a directory classification, not a menu of services. You may say the listing is in that category. DO NOT infer services from category or from letters like QA.',
    'Write useful, natural, action-oriented DRAFT copy for this My Latino List listing. Nothing auto-posts.',
    'Safe language includes: Discover [Business], Explore [Business], Learn more about [Business], Find [category] businesses in [location], Connect with [Business], View the listing on My Latino List.',
    'NEVER write: latest, go-to, perfect place, el lugar perfecto, pushing the boundaries, at the forefront, leading, industry-leading, innovative, premier, exceptional, best, top, trusted, #1, number one, award-winning, highly rated, popular — unless those exact words appear in ALLOWED_FACTS.',
    'Never invent reviews, ratings, awards, rankings, years in business, customer counts, prices, discounts, services not present in ALLOWED_FACTS, certifications, testimonials, specialties, employees, storefronts, or promotions.',
    'Facebook: two distinct community/discovery posts, somewhat longer than Instagram, different openings and structure, grounded CTA. Do not paraphrase the same sentence twice.',
    'Instagram: two distinct shorter social captions. Preserve the exact business name. Natural hashtags. Do not truncate Facebook posts. Avoid awkward category insertion and mechanical Spanish-English mixtures.',
    'Reel/TikTok: two concepts with HOOK, VISUAL, TALKING POINT, CTA. Hooks must be engaging but factual. VISUAL may use logo, MLL listing card, website screen if website exists, category/location text, directory search, or a verified social profile. Do not invent storefront, interior, employees, customers, products, equipment, or an office unless ALLOWED_FACTS support it.',
    'SEO: deterministic phrases using only business name, category, city, state, and My Latino List. No ranking claims. No unsupported service keywords.',
    'English Spotlight: neutral editorial introduction. Do NOT duplicate Facebook copy.',
    'Spanish Spotlight: independently written natural Latin American Spanish. Preserve the business name exactly. Avoid el mejor, de confianza, líder, el lugar perfecto, lo último, número uno unless those words are in ALLOWED_FACTS.',
    'Email: SUBJECT, PREVIEW TEXT, BODY, CTA. Informative discovery tone, different from Facebook and Spotlight. No duplicated words like Services Services. CTA must match an actual destination (listing, website if present).',
    'Each channel must be meaningfully different. Do not reuse the same primary sentence across Facebook, Spotlight, and Email.',
    'Do not mention businesses that are not this listing. Do not mention AP Optix Marketing Command Center.',
    'Return ONLY one JSON object. No markdown. No preface. No trailing explanation. Keys:',
    '- facebook_posts: exactly 2 conversational strings with a clear CTA to the listing, website, or My Latino List.',
    '- instagram_captions: exactly 2 short captions with grounded hashtags.',
    '- tiktok_concepts: exactly 2 objects {hook, visual, talking_point, cta}.',
    '- seo: {keywords: string[], local_discovery: string[] } using only name, category, city, and state.',
    '- bilingual_spotlight: {en, es} independently written.',
    '- email_campaign: {subject, preview, body, cta}.',
  ].join('\n')
}

function emptyUsage(): CustomerPackUsage {
  return {
    packs_generated: 0,
    last_pack_generated_at: null,
    last_pack: null,
    content_copy_events: 0,
    model: null,
    fallback: false,
    generation_source: null,
  }
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01' || code === 'PGRST205' || (message.includes('customer_marketing_packs') && message.includes('schema cache'))
}

function asStoredPack(raw: unknown): CustomerMarketingPack | null {
  if (!raw || typeof raw !== 'object') return null
  try {
    return normalizeCustomerPack(raw as Record<string, unknown>)
  } catch {
    return null
  }
}

export function presentPackUsage(row: {
  packs_generated?: number | null
  last_pack_generated_at?: string | null
  pack?: unknown
  content_copy_events?: number | null
  model?: string | null
  fallback?: boolean | null
} | null): CustomerPackUsage {
  if (!row) return emptyUsage()
  const lastPack = asStoredPack(row.pack)
  return {
    packs_generated: Math.max(0, Number(row.packs_generated) || 0),
    last_pack_generated_at: row.last_pack_generated_at ? String(row.last_pack_generated_at) : null,
    last_pack: lastPack,
    content_copy_events: Math.max(0, Number(row.content_copy_events) || 0),
    model: row.model ? String(row.model) : null,
    fallback: !!row.fallback,
    generation_source: lastPack ? generationSourceFromFallback(!!row.fallback) : null,
  }
}

export async function loadCustomerPackUsage(supabase: PackClient, businessId: string): Promise<CustomerPackUsage> {
  const { data, error } = await supabase
    .from(CUSTOMER_PACK_TABLE)
    .select('pack, packs_generated, last_pack_generated_at, content_copy_events, model, fallback')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error && isMissingTable(error)) {
    throw new MarketingPackStorageError('unavailable', 'Marketing Pack storage is not ready yet.')
  }
  if (error) throw new MarketingPackStorageError('failed', 'Could not load Marketing Pack usage.')
  return presentPackUsage(data)
}

export async function saveGeneratedPack(
  supabase: PackClient,
  businessId: string,
  pack: CustomerMarketingPack,
  model: string,
  fallback: boolean,
  now = new Date(),
): Promise<CustomerPackUsage> {
  const current = await loadCustomerPackUsage(supabase, businessId)
  const nextCount = current.packs_generated + 1
  const payload = {
    business_id: businessId,
    pack,
    packs_generated: nextCount,
    last_pack_generated_at: now.toISOString(),
    content_copy_events: current.content_copy_events,
    model,
    fallback,
    updated_at: now.toISOString(),
  }
  const { error } = await supabase
    .from(CUSTOMER_PACK_TABLE)
    .upsert(payload, { onConflict: 'business_id' })
  if (error && isMissingTable(error)) {
    throw new MarketingPackStorageError('unavailable', 'Marketing Pack storage is not ready yet.')
  }
  if (error) throw new MarketingPackStorageError('failed', 'Could not store Marketing Pack.')
  return {
    packs_generated: nextCount,
    last_pack_generated_at: payload.last_pack_generated_at,
    last_pack: pack,
    content_copy_events: current.content_copy_events,
    model,
    fallback,
    generation_source: generationSourceFromFallback(fallback),
  }
}

export async function incrementCopyEvents(supabase: PackClient, businessId: string): Promise<number> {
  const current = await loadCustomerPackUsage(supabase, businessId)
  if (!current.last_pack) return current.content_copy_events
  const next = current.content_copy_events + 1
  const { error } = await supabase
    .from(CUSTOMER_PACK_TABLE)
    .update({ content_copy_events: next, updated_at: new Date().toISOString() })
    .eq('business_id', businessId)
  if (error && isMissingTable(error)) {
    throw new MarketingPackStorageError('unavailable', 'Marketing Pack storage is not ready yet.')
  }
  if (error) throw new MarketingPackStorageError('failed', 'Could not record copy event.')
  return next
}

export function buildPackSummary(
  trialStatus: MarketingTrialStatus | string | null | undefined,
  usage: CustomerPackUsage,
  storage: 'ready' | 'unavailable' = 'ready',
) {
  if (storage === 'unavailable') {
    return {
      storage,
      can_generate: false,
      generation_locked: true,
      lock_reason: 'storage_unavailable' as const,
      lock_message: lockMessageFor('storage_unavailable'),
      packs_generated: 0,
      remaining: CUSTOMER_PACK_PILOT_LIMIT,
      limit: CUSTOMER_PACK_PILOT_LIMIT,
      last_pack_generated_at: null,
      last_pack: null,
      content_copy_events: 0,
      model: null,
      fallback: false,
      generation_source: null as GenerationSource | null,
    }
  }
  const entitlement = generationEntitlement(trialStatus, usage)
  return {
    storage,
    can_generate: entitlement.allowed,
    generation_locked: !entitlement.allowed,
    lock_reason: entitlement.reason,
    lock_message: entitlement.lock_message,
    packs_generated: usage.packs_generated,
    remaining: entitlement.remaining,
    limit: CUSTOMER_PACK_PILOT_LIMIT,
    last_pack_generated_at: usage.last_pack_generated_at,
    last_pack: usage.last_pack,
    content_copy_events: usage.content_copy_events,
    model: usage.model,
    fallback: usage.fallback,
    generation_source: usage.last_pack ? generationSourceFromFallback(usage.fallback) : null,
  }
}

async function runWithTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('ai_timeout')), ms)
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function extractAiText(result: unknown): string {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return ''
  const row = result as Record<string, unknown>
  if (typeof row.response === 'string' && row.response.trim()) return row.response
  if (typeof row.result === 'string' && row.result.trim()) return row.result
  if (row.response && typeof row.response === 'object') {
    const nested = extractAiText(row.response)
    if (nested) return nested
  }
  if (row.result && typeof row.result === 'object') {
    const nested = extractAiText(row.result)
    if (nested) return nested
  }
  if (Array.isArray(row.choices) && row.choices[0] && typeof row.choices[0] === 'object') {
    const choice = row.choices[0] as Record<string, unknown>
    const message = choice.message && typeof choice.message === 'object'
      ? choice.message as Record<string, unknown>
      : null
    if (typeof message?.content === 'string' && message.content.trim()) return message.content
    if (typeof choice.text === 'string' && choice.text.trim()) return choice.text
  }
  return ''
}

export function describeAiResult(result: unknown): { keys: string; excerpt: string } {
  if (typeof result === 'string') return { keys: 'string', excerpt: result.slice(0, 400) }
  if (!result || typeof result !== 'object') return { keys: typeof result, excerpt: '' }
  const keys = Object.keys(result as object).join(',')
  const text = extractAiText(result)
  return { keys, excerpt: (text || JSON.stringify(result)).slice(0, 400) }
}

function listingOnlyResult(listing: GroundedListing, model: string, reason: FallbackReason): {
  pack: CustomerMarketingPack
  fallback: true
  model: string
  generation_source: 'deterministic_fallback'
  fallback_reason: FallbackReason
} {
  return {
    pack: filterCustomerPackToGrounded(buildCustomerFallbackPack(listing), listing),
    fallback: true,
    model,
    generation_source: 'deterministic_fallback',
    fallback_reason: reason,
  }
}

function fallbackReasonFor(pack: CustomerMarketingPack, listing: GroundedListing): FallbackReason {
  if (!packMentionsBusinessName(pack, listing)) return 'missing_business_name'
  if (packHasUnsupportedClaims(pack)) return 'unsupported_claim'
  if (packHasInventedServices(pack, listing)) return 'invented_service'
  if (packHasInvalidSubject(pack)) return 'invalid_subject'
  if (packHasCrossChannelReuse(pack, listing)) return 'excessive_duplication'
  if (packHasPlaceholderText(pack, listing)) return 'low_information_description'
  return 'other_validation_failure'
}

export async function generateCustomerMarketingPack(input: {
  listing: GroundedListing
  runAi: (model: string, payload: Record<string, unknown>) => Promise<unknown>
  timeoutMs?: number
}): Promise<{
  pack: CustomerMarketingPack
  fallback: boolean
  model: string
  generation_source: GenerationSource
  fallback_reason: FallbackReason | null
}> {
  const model = MLL_AI_MODEL
  const listing = marketingListingFrom(input.listing)
  const prompt = buildCustomerPackPrompt(input.listing)
  let parsed: Record<string, unknown> | null = null
  try {
    const result = await runWithTimeout(
      input.runAi(model, {
        messages: [
          {
            role: 'system',
            content: 'Generate marketing content ONLY from ALLOWED_FACTS. Anything not present in ALLOWED_FACTS must be treated as unknown. Do not infer services, qualities, achievements, facilities, products, experience, popularity, or customer sentiment. Return one JSON object only. No markdown. No preface. No trailing explanation.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: CUSTOMER_PACK_MAX_TOKENS,
      }),
      input.timeoutMs ?? CUSTOMER_PACK_AI_TIMEOUT_MS,
    )
    parsed = parseMarketingPack(extractAiText(result))
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'ai_timeout') throw new Error('ai_timeout')
    throw new Error('ai_failed')
  }

  if (!parsed) return listingOnlyResult(listing, model, 'malformed_json')

  const polished = polishCustomerPack(
    repairCustomerPackFacts(
      filterCustomerPackToGrounded(normalizeCustomerPack(parsed), listing),
      listing,
    ),
    listing,
  )
  if (isCustomerPackGrounded(polished.pack, listing)) {
    return {
      pack: polished.pack,
      fallback: false,
      model,
      generation_source: 'ai_grounded',
      fallback_reason: null,
    }
  }
  return listingOnlyResult(listing, model, fallbackReasonFor(polished.pack, listing))
}

/** Client identity fields must never authorize or override the server business. */
export function clientIdentityOverrideAttempt(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const row = body as Record<string, unknown>
  return bodyHasIdentity(row)
}

export function bodyHasIdentity(row: Record<string, unknown>): boolean {
  return (
    row.business_id != null ||
    row.businessId != null ||
    row.slug != null ||
    row.owner_id != null ||
    row.started_at != null ||
    row.ends_at != null ||
    row.status != null
  )
}
