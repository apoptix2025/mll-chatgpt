import { MLL_AI_MODEL } from '../api/ai-search'
import { parseMarketingPack } from '../api/marketing'
import type { PilotBusiness } from './marketing-pilot'
import type { MarketingTrialStatus } from './marketing-trial'

/** Conservative V2 staging-pilot limit. Not a paid-plan entitlement. */
export const CUSTOMER_PACK_PILOT_LIMIT = 3
export const CUSTOMER_PACK_COOLDOWN_MS = 15_000
export const CUSTOMER_PACK_AI_TIMEOUT_MS = 20_000
export const CUSTOMER_PACK_MAX_TOKENS = 1400
export const CUSTOMER_PACK_TABLE = 'customer_marketing_packs'

export const CUSTOMER_UNGROUNDED_CLAIM =
  /#1\b|\bbest\b|\btop(?:-rated)?\b|\bleading\b|\btrusted\b|\baward(?:s|ed|-winning)?\b|\bcertified\b|\btestimonials?\b|\b\d+\s+reviews?\b|\bstar ratings?\b|\b\d+(?:\.\d+)?\s*stars?\b|\bfollowers\b|\brevenue\b|\branking|\d+\s*%|\$\d+|\bsince\s+\d{4}\b|\byears in business\b|\bcalificaci[oó]n(?:es)?\b|\bmejor(?:es)?\b|m[aá]s confiable|el mejor|la mejor|n[uú]mero\s*1/i

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

export type CustomerPackUsage = {
  packs_generated: number
  last_pack_generated_at: string | null
  last_pack: CustomerMarketingPack | null
  content_copy_events: number
  model: string | null
  fallback: boolean
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

export function stripUngroundedClaims(text: string): string {
  if (!text) return ''
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !CUSTOMER_UNGROUNDED_CLAIM.test(sentence))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanList(items: string[]): string[] {
  return items.map(stripUngroundedClaims).filter(Boolean)
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
    facebook_posts: cleanList(pack.facebook_posts.map((text) => cleanGroundedText(text, listing))).slice(0, 2),
    instagram_captions: cleanList(pack.instagram_captions.map((text) => cleanGroundedText(text, listing))).slice(0, 2),
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
  return [
    listing.name,
    listing.category,
    listing.description,
    listing.city,
    listing.state,
    listing.website,
    listing.phone,
    listing.email,
    listing.address,
    ...listing.tags,
  ].filter(Boolean).join(' ').toLowerCase()
}

const INVENTED_VERTICAL =
  /\bsoftware\b|\bapps?\b|\bbugs?\b|\bquality assurance\b|\btesting\b|\bpruebas?\b|\bcalificaci[oó]n(?:es)?\b|\bqa testing\b|\bqa game\b|\brestaurant\b|\bplumb(?:er|ing)\b|\battorney\b|\bdentist\b|\bconsultations?\b|\bbook a consultation\b/i

function fillNamePlaceholders(text: string, name: string): string {
  return String(text || '').replace(/\[(?:business name|nombre(?: del negocio)?)\]/gi, name)
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
  return stripInventedServices(stripUngroundedClaims(fillNamePlaceholders(text, listing.name)), blob)
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

export function packMentionsBusinessName(pack: CustomerMarketingPack, listing: GroundedListing): boolean {
  if (!listing.name) return true
  const content = [
    ...pack.facebook_posts,
    ...pack.instagram_captions,
    pack.bilingual_spotlight.en,
    pack.bilingual_spotlight.es,
    pack.email_campaign.subject,
    pack.email_campaign.body,
  ].join(' ')
  return content.includes(listing.name)
}

export function buildCustomerFallbackPack(listing: GroundedListing): CustomerMarketingPack {
  const name = listing.name || 'This business'
  const cat = listing.category || 'local business'
  const loc = locLabel(listing)
  const locBit = loc ? ` in ${loc}` : ''
  const locEs = loc ? ` en ${loc}` : ''
  const desc = listing.description ? listing.description.slice(0, 180) : ''
  const site = listing.website ? ` Learn more at ${listing.website}.` : ''
  const phone = listing.phone ? ` Call ${listing.phone}.` : ''
  const fb = listing.facebook_url ? ' Find them on Facebook from the listing.' : ''
  const ig = listing.instagram_url ? ' Find them on Instagram from the listing.' : ''

  const facebook1 = `${name} is a ${cat} listing on My Latino List${locBit}. Open the listing to see what they offer and how to get in touch.`
  const facebook2 = desc
    ? `${name} on My Latino List: ${desc} Visit the listing to connect${phone}`
    : `Looking for ${cat}${locBit}? ${name} is listed on My Latino List. Open the profile to review their listing details.${site}`

  const ig1 = `${name} · ${cat}${loc ? ` · ${loc}` : ''}. Discover this listing on My Latino List. Nothing auto-posts from here. #MyLatinoList #LatinoOwned${loc ? ' #ApoyaLoLocal' : ''}`
  const ig2 = desc
    ? `${name}: ${desc.slice(0, 120)} Find the listing on My Latino List.${ig} #MyLatinoList`
    : `${name} is listed on My Latino List${locBit}. Browse the directory and open this ${cat.toLowerCase()} profile. #MyLatinoList #LatinoBusiness`

  return {
    facebook_posts: [facebook1, facebook2],
    instagram_captions: [ig1, ig2],
    tiktok_concepts: [
      {
        hook: `Meet ${name} on My Latino List`,
        visual: `Show the My Latino List listing card for ${name}${locBit}.`,
        talking_point: `${name} is a ${cat} listing${locBit}. Use only the details on the listing.`,
        cta: 'Open this listing on My Latino List.',
      },
      {
        hook: loc ? `Looking for ${cat} in ${loc}?` : `Looking for ${cat}?`,
        visual: 'Screen recording of the directory search opening this listing.',
        talking_point: `${name} appears on My Latino List. Share the listing, not invented reviews or prices.`,
        cta: 'Search My Latino List and open this profile.',
      },
    ],
    seo: {
      keywords: [
        name,
        cat,
        loc ? `${cat} ${loc}` : `${cat} near me`,
        loc ? `${name} ${loc}` : `${name} My Latino List`,
        `Latino-owned ${cat}`,
      ].filter(Boolean),
      local_discovery: [
        loc ? `${cat} in ${loc}` : cat,
        loc ? `Latino-owned ${cat} ${listing.city}` : `Latino-owned ${cat}`,
        `${name} My Latino List`,
        listing.city && listing.state ? `${listing.city} ${listing.state} ${cat}` : '',
      ].filter(Boolean),
    },
    bilingual_spotlight: {
      en: `${name} is a ${cat} listing on My Latino List${locBit}.${desc ? ` ${desc}` : ''}${site}${phone}${fb}`,
      es: `${name} aparece en My Latino List como un negocio de ${cat.toLowerCase()}${locEs}.${desc ? ` ${desc}` : ''} Entra al directorio para ver esta ficha y contactar al negocio.`,
    },
    email_campaign: {
      subject: `${name} is on My Latino List`,
      preview: loc ? `${cat} in ${loc}` : `${cat} listing on My Latino List`,
      body: `${name} is listed on My Latino List${locBit}. Open the listing to review their profile and reach out directly.${site}${phone}`,
      cta: 'View this listing on My Latino List',
    },
    auto_post: false,
    disclaimer: 'Drafts only. Review before publishing. Nothing auto-posts. No performance claims.',
  }
}

export function buildCustomerPackPrompt(listing: GroundedListing): string {
  const grounded = {
    business: {
      name: listing.name,
      category: listing.category,
      description: listing.description,
      city: listing.city,
      state: listing.state,
      website: listing.website,
      phone: listing.phone,
      email: listing.email,
      address: listing.address,
      zip: listing.zip,
      tags: listing.tags,
      facebook_url: listing.facebook_url,
      instagram_url: listing.instagram_url,
      other_verified_social: listing.other_social,
    },
  }
  return [
    'You generate DRAFT customer marketing copy for one My Latino List listing.',
    'Write useful, natural, action-oriented drafts. Nothing auto-posts.',
    'Use the exact supplied business name. Never write [Business Name] or omit the name.',
    'The only service type you may mention is the supplied category. Do not infer extra services from the business name, including the letters QA.',
    'Do not mention software, testing, bugs, consultations, prices, discounts, or other offerings unless those exact words appear in the grounded listing.',
    'Never invent reviews, ratings, awards, rankings, years in business, customer counts, prices, discounts, services not present in the listing, certifications, or testimonials.',
    'Never use unsupported claims such as best, #1, leading, top, top-rated, trusted, award-winning, certified, mejor, mejores, or más confiable.',
    'Do not mention businesses that are not this listing. Do not mention AP Optix Marketing Command Center.',
    'English and Spanish must sound natural. Spanish should be independently written Latin American Spanish, not a mechanical translation.',
    'Include useful hashtags on Instagram captions only when they follow from the listing name, category, or city.',
    'Return ONLY JSON with keys:',
    '- facebook_posts: exactly 2 conversational strings with a clear CTA to the listing or My Latino List.',
    '- instagram_captions: exactly 2 short captions with grounded hashtags.',
    '- tiktok_concepts: exactly 2 objects {hook, visual, talking_point, cta}.',
    '- seo: {keywords: string[], local_discovery: string[] } using only name, category, city, and state.',
    '- bilingual_spotlight: {en, es} same core facts, independently written.',
    '- email_campaign: {subject, preview, body, cta}.',
    'Grounded listing: ' + JSON.stringify(grounded),
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
  return {
    packs_generated: Math.max(0, Number(row.packs_generated) || 0),
    last_pack_generated_at: row.last_pack_generated_at ? String(row.last_pack_generated_at) : null,
    last_pack: asStoredPack(row.pack),
    content_copy_events: Math.max(0, Number(row.content_copy_events) || 0),
    model: row.model ? String(row.model) : null,
    fallback: !!row.fallback,
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
  if (result && typeof result === 'object' && 'response' in result) {
    return String((result as { response?: unknown }).response || '')
  }
  return ''
}

export async function generateCustomerMarketingPack(input: {
  listing: GroundedListing
  runAi: (model: string, payload: Record<string, unknown>) => Promise<unknown>
  timeoutMs?: number
}): Promise<{ pack: CustomerMarketingPack; fallback: boolean; model: string }> {
  const model = MLL_AI_MODEL
  const prompt = buildCustomerPackPrompt(input.listing)
  let parsed: Record<string, unknown> | null = null
  try {
    const result = await runWithTimeout(
      input.runAi(model, {
        messages: [
          { role: 'system', content: 'Return valid JSON only. Use only the supplied listing fields. Never invent reviews, ratings, prices, awards, or other businesses. One JSON object.' },
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

  if (!parsed) {
    return {
      pack: filterCustomerPackToGrounded(buildCustomerFallbackPack(input.listing), input.listing),
      fallback: true,
      model,
    }
  }

  const pack = filterCustomerPackToGrounded(normalizeCustomerPack(parsed), input.listing)
  if (!isCustomerPackComplete(pack) || !packMentionsBusinessName(pack, input.listing)) {
    return {
      pack: filterCustomerPackToGrounded(buildCustomerFallbackPack(input.listing), input.listing),
      fallback: true,
      model,
    }
  }
  return { pack, fallback: false, model }
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
