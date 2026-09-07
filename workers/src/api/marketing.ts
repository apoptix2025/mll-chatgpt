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
  social_links: Record<string, string> | null
}

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
    supabase.from('businesses').select('id,name,slug,category,city,state,description,phone,website,logo_url,plan,social_links,status').eq('status', 'active'),
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

function groundedContext(listings: ListingRow[], resources: Array<{ title: string; category: string }>) {
  return {
    businesses: listings.slice(0, 12).map((b) => ({
      name: b.name,
      slug: b.slug,
      category: b.category,
      city: b.city,
      state: b.state,
    })),
    resources: resources.slice(0, 8).map((r) => ({ title: r.title, category: r.category })),
  }
}

async function generatePack(env: Env, email: string) {
  if (!env.AI) return { error: 'ai_unavailable', status: 503 as const }
  const limited = await packRateLimited(env)
  if (limited) return { error: limited, status: 429 as const }
  const dir = await loadDirectory(env)
  const context = groundedContext(dir.listings, dir.resourceRows)
  const prompt = [
    'You generate DRAFT marketing copy for My Latino List (MLL), operated by AP Optix.',
    'Return ONLY JSON with keys: facebook_posts (3 strings), instagram_captions (3 strings), tiktok_concepts (2 strings), bilingual_spotlight (object with en, es), la_voz_idea (string), keywords (5 strings), newsletter (string), promote (up to 3 objects with name, slug, category, reason).',
    'Rules:',
    '- Do not fabricate businesses, stats, testimonials, traffic, rankings, followers, reviews, sales, or results.',
    '- Only reference businesses/resources supplied in grounded context.',
    '- Produce English and Spanish in bilingual_spotlight.',
    '- Generate marketing drafts, not factual performance claims.',
    '- Nothing auto-posts. Drafts require human approval.',
    'Grounded context: ' + JSON.stringify(context),
  ].join('\n')

  const result = await env.AI.run(MLL_AI_MODEL, {
    messages: [
      { role: 'system', content: 'Return valid JSON only. Never invent listings or metrics.' },
      { role: 'user', content: prompt.slice(0, 4000) },
    ],
    max_tokens: 900,
  }) as { response?: string }

  const text = typeof result === 'string' ? result : String(result?.response || '')
  const parsed = parseMarketingPack(text)
  if (!parsed) return { error: 'pack_parse_failed', status: 503 as const }
  const pack = filterPackToGrounded(parsed, context.businesses, context.resources)
  const stored = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    created_by: email,
    model: MLL_AI_MODEL,
    auto_post: false,
    pack,
  }
  const packs = await readPacks(env)
  packs.unshift(stored)
  await env.SESSION_CACHE.put(PACK_KEY, JSON.stringify(packs.slice(0, MAX_PACKS)))
  await trackMarketingEvent(env, { event: 'ai_marketing_pack_generated' })
  return { stored }
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
    return Response.json({ pack: result.stored, auto_post: false })
  }

  if (path === '/api/admin/marketing/collect' && request.method === 'POST') {
    const baseline = await ensureBaseline(env)
    return Response.json({ baseline })
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}
