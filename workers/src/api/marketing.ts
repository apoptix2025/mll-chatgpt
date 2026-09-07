import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { isAdmin } from './auth'
import { withAuth } from '../middleware/auth'
import { MLL_AI_MODEL } from './ai-search'
import {
  ensureBaseline,
  readBaseline,
  sumEventsSince,
  trackMarketingEvent,
  utcDate,
} from '../lib/analytics'
import {
  buildFootprintScore,
  buildOpportunities,
  type FootprintInput,
} from '../lib/marketing-score'

const CAMPAIGN_KEY = 'mkt:campaigns'
const PACK_KEY = 'mkt:packs'
const SCORE_PREFIX = 'mkt:score:'
const PACK_RATE_KEY = 'mktpack:burst'
const PACK_DAY_PREFIX = 'mktpack:day:'
const PACK_BURST_MS = 15000
const PACK_DAY_LIMIT = 8
const MAX_CAMPAIGNS = 100
const MAX_PACKS = 10

const CHANNELS = ['facebook', 'instagram', 'tiktok', 'email', 'seo', 'la_voz', 'mll_internal', 'other'] as const
const STATUSES = ['draft', 'active', 'paused', 'complete'] as const

export type Campaign = {
  id: string
  name: string
  channel: (typeof CHANNELS)[number]
  objective: string
  status: (typeof STATUSES)[number]
  start_date: string | null
  end_date: string | null
  destination_url: string | null
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

type ListingRow = {
  id: string
  name: string
  slug: string
  category: string
  city: string | null
  state: string | null
  description: string | null
  phone: string | null
  website: string | null
  logo_url: string | null
  plan: string | null
  is_featured?: boolean
  social_links: Record<string, string> | null
}

export type PromotionCandidate = {
  name: string
  slug: string
  category: string
  city: string | null
  state: string | null
  reason: string
}

export const EMPTY_PROMOTE_MESSAGE = 'No eligible grounded listings available for this pack.'
const QA_SLUGS = new Set(['mll-qa-test-business'])
const UNGROUNDED_CLAIM = /#1\b|\bbest\b|\btop-rated\b|\bleading\b|testimonial|followers|revenue|ranking|\d+\s*%/i

function hasSocial(links: Record<string, string> | null | undefined, key: string): boolean {
  const value = links && typeof links === 'object' ? String(links[key] || links[key.toLowerCase()] || '') : ''
  return /^https?:\/\//i.test(value)
}

export function validateCampaignInput(raw: unknown, partial = false): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid_json' }
  const body = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim()
    if (name.length < 2 || name.length > 80) return { ok: false, error: 'name must be 2–80 characters' }
    out.name = name
  }
  if (!partial || body.channel !== undefined) {
    const channel = String(body.channel || '')
    if (!CHANNELS.includes(channel as (typeof CHANNELS)[number])) return { ok: false, error: 'invalid channel' }
    out.channel = channel
  }
  if (!partial || body.objective !== undefined) {
    const objective = String(body.objective || '').trim()
    if (objective.length < 2 || objective.length > 200) return { ok: false, error: 'objective must be 2–200 characters' }
    out.objective = objective
  }
  if (!partial || body.status !== undefined) {
    const status = String(body.status || 'draft')
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) return { ok: false, error: 'invalid status' }
    out.status = status
  }
  if (!partial || body.start_date !== undefined) {
    const start = body.start_date == null || body.start_date === '' ? null : String(body.start_date)
    if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) return { ok: false, error: 'start_date must be YYYY-MM-DD' }
    out.start_date = start
  }
  if (!partial || body.end_date !== undefined) {
    const end = body.end_date == null || body.end_date === '' ? null : String(body.end_date)
    if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) return { ok: false, error: 'end_date must be YYYY-MM-DD' }
    out.end_date = end
  }
  if (!partial || body.destination_url !== undefined) {
    const url = body.destination_url == null || body.destination_url === '' ? null : String(body.destination_url).trim()
    if (url && !/^https?:\/\/[^\s]+$/i.test(url)) return { ok: false, error: 'destination_url must be http(s)' }
    out.destination_url = url
  }
  if (!partial || body.notes !== undefined) {
    const notes = String(body.notes || '')
    if (notes.length > 500) return { ok: false, error: 'notes must be 500 characters or fewer' }
    out.notes = notes
  }
  return { ok: true, value: out }
}

export function parseMarketingPack(text: string): Record<string, unknown> | null {
  const trimmed = String(text || '').trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced ? fenced[1] : trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function filterPackToGrounded(
  pack: Record<string, unknown>,
  businesses: Array<{ name: string; slug: string; category: string }>,
  resources: Array<{ title: string }>
): Record<string, unknown> {
  const names = new Set(businesses.map((b) => b.name.toLowerCase()))
  const slugs = new Set(businesses.map((b) => b.slug.toLowerCase()))
  const categories = new Set(businesses.map((b) => b.category.toLowerCase()))
  const promote = Array.isArray(pack.promote) ? pack.promote : []
  pack.promote = promote.filter((item) => {
    if (!item || typeof item !== 'object') return false
    const row = item as Record<string, unknown>
    const name = String(row.name || '').toLowerCase()
    const slug = String(row.slug || '').toLowerCase()
    const category = String(row.category || '').toLowerCase()
    return (name && names.has(name)) || (slug && slugs.has(slug)) || (category && categories.has(category))
  }).slice(0, 3)
  if (!Array.isArray(pack.facebook_posts)) pack.facebook_posts = []
  if (!Array.isArray(pack.instagram_captions)) pack.instagram_captions = []
  if (!Array.isArray(pack.tiktok_concepts)) pack.tiktok_concepts = []
  if (!Array.isArray(pack.keywords)) pack.keywords = []
  pack.grounded_resource_titles = resources.map((r) => r.title).slice(0, 8)
  pack.auto_post = false
  pack.disclaimer = 'Drafts only. Review before publishing. No performance claims.'
  return pack
}

export function isEligibleListing(row: { name?: string; slug?: string; category?: string }): boolean {
  const name = String(row.name || '').trim()
  const slug = String(row.slug || '').trim()
  const category = String(row.category || '').trim()
  if (!name || !slug || !category) return false
  if (QA_SLUGS.has(slug.toLowerCase())) return false
  if (/^mll[\s-]?qa/i.test(name) || /(?:^|-)qa(?:-|$)/i.test(slug) && /test/i.test(slug)) return false
  return true
}

export function selectPromotionCandidates(
  listings: Array<{
    name: string
    slug: string
    category: string
    city?: string | null
    state?: string | null
    plan?: string | null
    is_featured?: boolean
  }>,
  limit = 3
): PromotionCandidate[] {
  const eligible = listings.filter(isEligibleListing)
  const scored = eligible.map((b) => {
    const plan = String(b.plan || '')
    let score = 0
    if (b.is_featured) score += 25
    if (plan === 'featured') score += 20
    else if (plan === 'pro') score += 12
    else if (plan === 'admin') score += 6
    if (b.city && b.state) score += 10
    return { b, score }
  }).sort((a, c) => c.score - a.score)

  const picked: PromotionCandidate[] = []
  const used = new Set<string>()
  const usedCat = new Set<string>()

  function add(b: (typeof scored)[number]['b']) {
    if (used.has(b.slug) || picked.length >= limit) return
    used.add(b.slug)
    usedCat.add(b.category.toLowerCase())
    const loc = [b.city, b.state].filter(Boolean).join(', ')
    picked.push({
      name: b.name,
      slug: b.slug,
      category: b.category,
      city: b.city || null,
      state: b.state || null,
      reason: loc
        ? `Active ${b.category} listing on My Latino List in ${loc}.`
        : `Active ${b.category} listing on My Latino List.`,
    })
  }

  for (const { b } of scored) {
    if (usedCat.has(b.category.toLowerCase()) && picked.length < limit && scored.length > limit) continue
    add(b)
  }
  for (const { b } of scored) add(b)
  return picked.slice(0, limit)
}

function asStringList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === 'string') return item.trim()
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>
      return String(row.text || row.caption || row.post || row.keyword || '').trim()
    }
    return ''
  }).filter(Boolean).slice(0, max)
}

function asTiktokList(raw: unknown, max: number): Array<Record<string, string>> {
  if (!Array.isArray(raw)) return []
  const out: Array<Record<string, string>> = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const text = item.trim()
      if (text) out.push({ hook: text, visual: '', talking_point: text, cta: 'Discover more on My Latino List.' })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const hook = String(row.hook || row.title || '').trim()
    const visual = String(row.visual || row.video || row.video_idea || '').trim()
    const talking = String(row.talking_point || row.talking || row.script || '').trim()
    const cta = String(row.cta || row.call_to_action || '').trim()
    if (!hook && !talking) continue
    out.push({
      hook: hook || talking,
      visual,
      talking_point: talking || hook,
      cta: cta || 'Search My Latino List and open a listing.',
    })
  }
  return out.slice(0, max)
}

function asSpotlight(raw: unknown): { en: string; es: string } {
  if (!raw || typeof raw !== 'object') return { en: '', es: '' }
  const row = raw as Record<string, unknown>
  return { en: String(row.en || '').trim(), es: String(row.es || '').trim() }
}

function asLaVoz(raw: unknown): { title: string; angle: string } {
  if (typeof raw === 'string') return { title: raw.trim(), angle: '' }
  if (!raw || typeof raw !== 'object') return { title: '', angle: '' }
  const row = raw as Record<string, unknown>
  return {
    title: String(row.title || '').trim(),
    angle: String(row.angle || row.description || '').trim(),
  }
}

function asNewsletter(raw: unknown): { subject: string; purpose: string } {
  if (typeof raw === 'string') return { subject: raw.trim(), purpose: '' }
  if (!raw || typeof raw !== 'object') return { subject: '', purpose: '' }
  const row = raw as Record<string, unknown>
  return {
    subject: String(row.subject || row.title || '').trim(),
    purpose: String(row.purpose || row.angle || row.description || '').trim(),
  }
}

export function normalizePackShape(pack: Record<string, unknown>): Record<string, unknown> {
  pack.facebook_posts = asStringList(pack.facebook_posts, 3)
  pack.instagram_captions = asStringList(pack.instagram_captions, 3)
  pack.tiktok_concepts = asTiktokList(pack.tiktok_concepts, 2)
  pack.keywords = asStringList(pack.keywords, 5)
  pack.bilingual_spotlight = asSpotlight(pack.bilingual_spotlight)
  pack.la_voz_idea = asLaVoz(pack.la_voz_idea)
  pack.newsletter = asNewsletter(pack.newsletter)
  pack.auto_post = false
  return pack
}

export function applyDeterministicPromote(
  pack: Record<string, unknown>,
  candidates: PromotionCandidate[]
): Record<string, unknown> {
  const modelPromote = Array.isArray(pack.promote) ? pack.promote : []
  const reasons = new Map<string, string>()
  for (const item of modelPromote) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const reason = String(row.reason || '').trim()
    if (!reason || UNGROUNDED_CLAIM.test(reason)) continue
    const slug = String(row.slug || '').toLowerCase()
    const name = String(row.name || '').toLowerCase()
    if (slug) reasons.set(slug, reason)
    if (name) reasons.set(name, reason)
  }
  if (!candidates.length) {
    pack.promote = []
    pack.promote_empty_message = EMPTY_PROMOTE_MESSAGE
    return pack
  }
  pack.promote = candidates.map((c) => ({
    name: c.name,
    slug: c.slug,
    category: c.category,
    city: c.city,
    state: c.state,
    reason: reasons.get(c.slug.toLowerCase()) || reasons.get(c.name.toLowerCase()) || c.reason,
  }))
  pack.promote_empty_message = null
  return pack
}

export function buildFallbackPack(
  candidates: PromotionCandidate[],
  resources: Array<{ title: string }>
): Record<string, unknown> {
  const first = candidates[0]
  const loc = first ? [first.city, first.state].filter(Boolean).join(', ') : ''
  const name = first?.name || ''
  const cat = first?.category || 'local services'
  return {
    facebook_posts: [
      `Need a Latino-owned restaurant, contractor, or professional nearby? Search the My Latino List directory and open a listing in your community.`,
      `My Latino List brings Latino-owned business listings, jobs, marketplace items, and La Voz Latino resources together so you can take the next step today.`,
      name
        ? `${name} is listed on My Latino List${loc ? ` in ${loc}` : ''}. Browse the directory to discover this ${cat.toLowerCase()} listing and other Latino-owned businesses.`
        : `Browse My Latino List to discover Latino-owned businesses, open jobs, and community resources — then visit a listing that fits what you need.`,
    ],
    instagram_captions: [
      `Search My Latino List for Latino-owned businesses near you. Directory + jobs + La Voz Latino. #MyLatinoList #LatinoOwned #ApoyaLoLocal`,
      name
        ? `${name} · ${cat}${loc ? ` · ${loc}` : ''}. Find this listing on My Latino List and keep exploring your community. #LatinoBusiness #MyLatinoList`
        : `Looking for a Latino-owned pro? Start on My Latino List and discover listings in your city. #MyLatinoList #Comunidad`,
      `Jobs, marketplace, and La Voz Latino live next to the directory. Explore My Latino List today. #LaVozLatino #MyLatinoList`,
    ],
    tiktok_concepts: [
      {
        hook: 'Need a Latino-owned business nearby?',
        visual: 'Quick cuts of the MLL directory search and a real listing profile.',
        talking_point: 'My Latino List helps you discover local Latino-owned listings, jobs, and community resources.',
        cta: 'Search My Latino List and open a listing near you.',
      },
      {
        hook: name ? `A listing already on My Latino List: ${name}` : 'Your community directory is already live.',
        visual: 'Screen recording of a listing card, then jobs or a La Voz Latino resource.',
        talking_point: 'MLL is built for Latino-owned businesses and the people looking for them.',
        cta: 'Browse My Latino List and tap a business that matches what you need.',
      },
    ],
    bilingual_spotlight: {
      en: name
        ? `${name} is a ${cat} listing on My Latino List${loc ? ` in ${loc}` : ''}. Open the directory to discover this business and other Latino-owned listings nearby.`
        : 'My Latino List helps you discover Latino-owned businesses, jobs, marketplace items, and La Voz Latino resources in one place.',
      es: name
        ? `${name} aparece en My Latino List como un negocio de ${cat.toLowerCase()}${loc ? ` en ${loc}` : ''}. Entra al directorio para descubrir este y otros negocios de dueños latinos cerca de ti.`
        : 'My Latino List te ayuda a descubrir negocios de dueños latinos, empleos, el marketplace y recursos de La Voz Latino en un solo lugar.',
    },
    la_voz_idea: {
      title: 'How to find a Latino-owned business on My Latino List this week',
      angle: 'Show readers how to search the directory, open a listing, then use jobs, marketplace, and La Voz Latino resources. No invented success stats.',
    },
    keywords: [
      'Latino-owned businesses near me',
      'My Latino List directory',
      'empleos para latinos',
      'La Voz Latino resources',
      'marketplace negocios latinos',
    ],
    newsletter: {
      subject: 'Find Latino-owned businesses on My Latino List',
      purpose: 'Invite readers to search the directory, check open jobs, and read La Voz Latino — linking only to real MLL pages.',
    },
    promote: [],
    grounded_resource_titles: resources.map((r) => r.title).slice(0, 8),
    auto_post: false,
    fallback: true,
    disclaimer: 'Drafts only. Review before publishing. No performance claims.',
  }
}

export function buildMarketingPackPrompt(input: {
  candidates: PromotionCandidate[]
  resources: Array<{ title: string; category?: string }>
}): string {
  const grounded = {
    promote_these_only: input.candidates.map((c) => ({
      name: c.name,
      slug: c.slug,
      category: c.category,
      city: c.city,
      state: c.state,
    })),
    resources: input.resources.slice(0, 6).map((r) => ({ title: r.title, category: r.category || '' })),
    mll_capabilities: [
      'discovering Latino-owned businesses',
      'business listings',
      'jobs',
      'marketplace',
      'La Voz Latino',
      'community resources',
      'local community discovery',
    ],
  }
  return [
    'You generate DRAFT marketing copy for My Latino List (MLL), operated by AP Optix.',
    'MLL is a directory where people discover Latino-owned businesses, jobs, marketplace items, La Voz Latino, and community resources.',
    'Write specifically about My Latino List. Be useful, action oriented, and natural — not corporate slogans.',
    'Encourage real MLL discovery: search the directory, open a listing, check jobs, marketplace, or La Voz Latino.',
    'Do not write generic lines like “¡Vive la diversidad y la inclusión!” or “The power of community-driven initiatives.”',
    'Quality direction (do not copy verbatim): a post that asks people to find a Latino-owned restaurant, contractor, or professional on My Latino List.',
    'Return ONLY JSON with keys: facebook_posts, instagram_captions, tiktok_concepts, bilingual_spotlight, la_voz_idea, keywords, newsletter, promote.',
    'Platform rules:',
    '- facebook_posts: 3 conversational, community-focused strings with a clear CTA. Mention My Latino List.',
    '- instagram_captions: 3 short, visually oriented strings with useful hashtags and a discovery CTA.',
    '- tiktok_concepts: 2 objects {hook, visual, talking_point, cta}. Not a topic title only.',
    '- bilingual_spotlight: {en, es} same core message. Spanish must be natural Latin American Spanish, culturally appropriate, independently written rather than a literal English translation, grammatically correct, and concise.',
    '- la_voz_idea: {title, angle} a useful article idea with a specific title and short description, not a generic business-growth phrase.',
    '- newsletter: {subject, purpose} subject/concept plus a short purpose/angle.',
    '- keywords: 5 MLL discovery phrases.',
    '- promote: copy only the supplied listings (name, slug, category, reason). Never invent a business.',
    'Rules:',
    '- Do not fabricate businesses, stats, testimonials, traffic, rankings, followers, reviews, sales, or results.',
    '- Only reference businesses/resources supplied in grounded context.',
    '- Never fabricate customers, revenue, growth percentages, awards, partnerships, locations, services, or promotions unless supplied.',
    '- Avoid unsupported superlatives such as best, #1, leading, or top-rated unless grounded.',
    '- Produce English and Spanish in bilingual_spotlight.',
    '- Generate marketing drafts, not factual performance claims.',
    '- Nothing auto-posts. Drafts require human approval.',
    'Grounded context: ' + JSON.stringify(grounded),
  ].join('\n')
}

async function requireAdmin(request: Request, env: Env): Promise<{ ok: true; email: string; userId: string } | { ok: false; response: Response }> {
  const auth = await withAuth(request, env)
  if (!auth.ok) return { ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!isAdmin(auth.email)) return { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  return { ok: true, email: auth.email || '', userId: auth.userId }
}

async function readCampaigns(env: Env): Promise<Campaign[]> {
  const raw = await env.SESSION_CACHE.get(CAMPAIGN_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Campaign[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeCampaigns(env: Env, rows: Campaign[]): Promise<void> {
  await env.SESSION_CACHE.put(CAMPAIGN_KEY, JSON.stringify(rows.slice(0, MAX_CAMPAIGNS)))
}

async function readPacks(env: Env): Promise<Array<Record<string, unknown>>> {
  const raw = await env.SESSION_CACHE.get(PACK_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function loadDirectory(env: Env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const [biz, resources, profiles, leads, jobs, products] = await Promise.all([
    supabase.from('businesses').select('id,name,slug,category,city,state,description,phone,website,logo_url,plan,is_featured,social_links,status').eq('status', 'active'),
    supabase.from('resources').select('id,title,category,created_at,status').eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])
  const listings = (biz.data || []) as ListingRow[]
  const resourceRows = resources.data || []
  let recentResourceDays: number | null = null
  if (resourceRows[0]?.created_at) {
    recentResourceDays = Math.floor((Date.now() - new Date(resourceRows[0].created_at).getTime()) / 86400000)
  }
  const incompleteListings = listings.filter((b) => !b.description || !b.phone || !b.website || !b.logo_url).length
  return {
    listings,
    resourceRows,
    profileCount: profiles.count || 0,
    leadCount: leads.count || 0,
    hasJobOrProduct: (jobs.count || 0) + (products.count || 0) > 0,
    incompleteListings,
    recentResourceDays,
  }
}

async function footprintInput(env: Env): Promise<{ input: FootprintInput; baselineStarted: string | null; events: Record<string, number> }> {
  const dir = await loadDirectory(env)
  const baseline = await readBaseline(env)
  const events = baseline ? await sumEventsSince(env, baseline.started_at, 30) : {}
  const trafficEvents = Object.values(events).reduce((s, n) => s + Number(n || 0), 0)
  const input: FootprintInput = {
    activeListings: dir.listings.length,
    withDescription: dir.listings.filter((b) => !!String(b.description || '').trim()).length,
    withCityState: dir.listings.filter((b) => !!b.city && !!b.state).length,
    withFacebook: dir.listings.filter((b) => hasSocial(b.social_links, 'facebook')).length,
    withInstagram: dir.listings.filter((b) => hasSocial(b.social_links, 'instagram')).length,
    resourceCount: dir.resourceRows.length,
    recentResourceDays: dir.recentResourceDays,
    hasJobOrProduct: dir.hasJobOrProduct,
    hasSitemap: true,
    hasSiteMeta: true,
    trafficEvents,
    homepageViews: Number(events.homepage_view || 0),
    directoryViews: Number(events.directory_view || 0),
    profileViews: Number(events.business_profile_view || 0),
    trafficConnected: trafficEvents > 0,
    profileCount: dir.profileCount,
    paidPlanCount: dir.listings.filter((b) => b.plan && !['free', 'admin'].includes(String(b.plan))).length,
    leadCount: dir.leadCount,
  }
  return { input, baselineStarted: baseline?.started_at || null, events }
}

async function snapshotScore(env: Env, total: number): Promise<void> {
  const day = utcDate()
  const key = SCORE_PREFIX + day
  const existing = await env.SESSION_CACHE.get(key)
  if (existing) return
  await env.SESSION_CACHE.put(key, JSON.stringify({ total, captured_at: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 45 })
}

async function firstScoreSnapshot(env: Env): Promise<{ total: number; captured_at: string } | null> {
  const today = new Date()
  for (let i = 40; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i))
    const raw = await env.SESSION_CACHE.get(SCORE_PREFIX + utcDate(d))
    if (!raw) continue
    try {
      return JSON.parse(raw) as { total: number; captured_at: string }
    } catch { /* next */ }
  }
  return null
}

async function packRateLimited(env: Env): Promise<string | null> {
  const burst = await env.SESSION_CACHE.get(PACK_RATE_KEY)
  if (burst) {
    try {
      const ts = Number(JSON.parse(burst).t) || 0
      if (Date.now() - ts < PACK_BURST_MS) return 'rate_limited'
    } catch {
      return 'rate_limited'
    }
  }
  const dayKey = PACK_DAY_PREFIX + utcDate()
  const dayRaw = await env.SESSION_CACHE.get(dayKey)
  const used = dayRaw ? Number(JSON.parse(dayRaw).count || 0) : 0
  if (used >= PACK_DAY_LIMIT) return 'daily_limit'
  await env.SESSION_CACHE.put(PACK_RATE_KEY, JSON.stringify({ t: Date.now() }), { expirationTtl: 60 })
  await env.SESSION_CACHE.put(dayKey, JSON.stringify({ count: used + 1 }), { expirationTtl: 60 * 60 * 26 })
  return null
}

function persistPack(env: Env, email: string, pack: Record<string, unknown>, fallback: boolean) {
  return {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    created_by: email,
    model: MLL_AI_MODEL,
    auto_post: false,
    fallback,
    pack,
  }
}

async function storePack(env: Env, stored: Record<string, unknown>): Promise<number> {
  const packs = await readPacks(env)
  packs.unshift(stored)
  const next = packs.slice(0, MAX_PACKS)
  await env.SESSION_CACHE.put(PACK_KEY, JSON.stringify(next))
  await trackMarketingEvent(env, { event: 'ai_marketing_pack_generated' })
  return next.length
}

async function generatePack(env: Env, email: string) {
  if (!env.AI) return { error: 'ai_unavailable', status: 503 as const }
  const limited = await packRateLimited(env)
  if (limited) return { error: limited, status: 429 as const }
  const dir = await loadDirectory(env)
  const candidates = selectPromotionCandidates(dir.listings, 3)
  const resources = dir.resourceRows.slice(0, 8)
  const prompt = buildMarketingPackPrompt({ candidates, resources })

  const result = await env.AI.run(MLL_AI_MODEL, {
    messages: [
      { role: 'system', content: 'Return valid JSON only. Never invent listings or metrics. One JSON object.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1100,
  }) as { response?: string }

  const text = typeof result === 'string' ? result : String(result?.response || '')
  const parsed = parseMarketingPack(text)
  const groundedListings = candidates.length ? candidates : dir.listings
  let pack: Record<string, unknown>
  let fallback = false
  if (parsed) {
    pack = normalizePackShape(parsed)
  } else {
    pack = normalizePackShape(buildFallbackPack(candidates, resources))
    fallback = true
  }
  applyDeterministicPromote(pack, candidates)
  filterPackToGrounded(pack, groundedListings, resources)
  if (!Array.isArray(pack.promote) || pack.promote.length === 0) {
    pack.promote = []
    pack.promote_empty_message = EMPTY_PROMOTE_MESSAGE
  }
  const stored = persistPack(env, email, pack, fallback)
  const stored_count = await storePack(env, stored)
  return { stored, stored_count }
}

export async function handleMarketing(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const admin = await requireAdmin(request, env)
  if (!admin.ok) return admin.response

  if (path === '/api/admin/marketing/summary' && request.method === 'GET') {
    const { input, baselineStarted, events } = await footprintInput(env)
    const score = buildFootprintScore(input)
    await snapshotScore(env, score.total)
    const campaigns = await readCampaigns(env)
    const packs = await readPacks(env)
    const dir = await loadDirectory(env)
    const opportunities = buildOpportunities({
      ...input,
      campaignCount: campaigns.length,
      packCount: packs.length,
      incompleteListings: dir.incompleteListings,
    })
    return Response.json({
      brand: { product: 'MLL Marketing Command Center', powered_by: 'AP Optix' },
      score,
      activity: {
        website: input.trafficConnected ? (input.homepageViews + input.directoryViews + input.profileViews) : null,
        signups: input.profileCount,
        ai_search: Number(events.ai_search || 0),
        conversion: input.paidPlanCount + input.leadCount,
        traffic_status: input.trafficConnected ? 'recorded' : 'collecting',
      },
      baseline: baselineStarted
        ? { started_at: baselineStarted, message: null }
        : { started_at: null, message: 'Baseline collection in progress.' },
      opportunities,
      campaigns: campaigns.slice(0, 20),
      latest_pack: packs[0] || null,
      collection_note: input.trafficConnected
        ? null
        : 'Analytics collection started — results will appear as traffic is recorded.',
    })
  }

  if (path === '/api/admin/marketing/score' && request.method === 'GET') {
    const { input, baselineStarted } = await footprintInput(env)
    const score = buildFootprintScore(input)
    await snapshotScore(env, score.total)
    return Response.json({ score, baseline: baselineStarted })
  }

  if (path === '/api/admin/marketing/opportunities' && request.method === 'GET') {
    const { input } = await footprintInput(env)
    const campaigns = await readCampaigns(env)
    const packs = await readPacks(env)
    const dir = await loadDirectory(env)
    return Response.json({
      opportunities: buildOpportunities({
        ...input,
        campaignCount: campaigns.length,
        packCount: packs.length,
        incompleteListings: dir.incompleteListings,
      }),
    })
  }

  if (path === '/api/admin/marketing/report' && request.method === 'GET') {
    const { input, baselineStarted, events } = await footprintInput(env)
    const score = buildFootprintScore(input)
    await snapshotScore(env, score.total)
    const first = await firstScoreSnapshot(env)
    const campaigns = await readCampaigns(env)
    const packs = await readPacks(env)
    const change = first ? score.total - first.total : null
    return Response.json({
      window_days: 30,
      collection: baselineStarted
        ? { started_at: baselineStarted, message: first ? null : 'Baseline collection in progress.' }
        : { started_at: null, message: 'Baseline collection in progress.' },
      current: {
        footprint_score: score.total,
        traffic_activity: input.trafficConnected ? input.homepageViews + input.directoryViews + input.profileViews : null,
        profile_discovery: input.profileViews,
        signups: input.profileCount,
        conversion_activity: input.paidPlanCount + input.leadCount,
        ai_search: Number(events.ai_search || 0),
        campaigns_created: campaigns.length,
        content_generated: packs.length,
      },
      baseline: first ? { footprint_score: first.total, captured_at: first.captured_at } : null,
      change: change === null ? null : { footprint_score: change },
    })
  }

  if (path === '/api/admin/marketing/campaigns' && request.method === 'GET') {
    return Response.json({ campaigns: await readCampaigns(env) })
  }

  if (path === '/api/admin/marketing/campaigns' && request.method === 'POST') {
    let body: unknown
    try { body = await request.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }
    const parsed = validateCampaignInput(body, false)
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })
    const now = new Date().toISOString()
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      name: String(parsed.value.name),
      channel: parsed.value.channel as Campaign['channel'],
      objective: String(parsed.value.objective),
      status: (parsed.value.status as Campaign['status']) || 'draft',
      start_date: (parsed.value.start_date as string | null) ?? null,
      end_date: (parsed.value.end_date as string | null) ?? null,
      destination_url: (parsed.value.destination_url as string | null) ?? null,
      notes: String(parsed.value.notes || ''),
      created_by: admin.email,
      created_at: now,
      updated_at: now,
    }
    const rows = await readCampaigns(env)
    rows.unshift(campaign)
    await writeCampaigns(env, rows)
    return Response.json({ campaign }, { status: 201 })
  }

  const patchMatch = path.match(/^\/api\/admin\/marketing\/campaigns\/([0-9a-f-]{36})$/i)
  if (patchMatch && request.method === 'PATCH') {
    let body: unknown
    try { body = await request.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }
    const parsed = validateCampaignInput(body, true)
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })
    const rows = await readCampaigns(env)
    const idx = rows.findIndex((c) => c.id === patchMatch[1])
    if (idx < 0) return Response.json({ error: 'not_found' }, { status: 404 })
    rows[idx] = { ...rows[idx], ...parsed.value, updated_at: new Date().toISOString() } as Campaign
    await writeCampaigns(env, rows)
    return Response.json({ campaign: rows[idx] })
  }

  if (path === '/api/admin/marketing/packs' && request.method === 'GET') {
    return Response.json({ packs: await readPacks(env) })
  }

  if (path === '/api/admin/marketing/pack' && request.method === 'POST') {
    const result = await generatePack(env, admin.email)
    if ('error' in result) {
      return Response.json({ error: result.error, message: 'Marketing pack unavailable. Public MLL AI search is unchanged.' }, { status: result.status })
    }
    return Response.json({ pack: result.stored, stored_count: result.stored_count, auto_post: false })
  }

  if (path === '/api/admin/marketing/collect' && request.method === 'POST') {
    const baseline = await ensureBaseline(env)
    return Response.json({ baseline })
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}
