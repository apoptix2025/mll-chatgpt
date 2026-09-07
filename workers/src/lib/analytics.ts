import type { Env } from '../index'

export const MARKETING_EVENTS = [
  'homepage_view',
  'directory_view',
  'business_profile_view',
  'business_website_click',
  'phone_click',
  'signup_started',
  'signup_completed',
  'pricing_view',
  'checkout_started',
  'paid_subscription_created',
  'ai_search',
  'ai_marketing_pack_generated',
] as const

export type MarketingEventName = (typeof MARKETING_EVENTS)[number]

const ALLOWED = new Set<string>(MARKETING_EVENTS)
const SENSITIVE = /password|token|authorization|stripe|card|cvv|prompt|email|message|secret|cookie/i
const EVENT_TTL_SEC = 60 * 60 * 24 * 42
const RATE_TTL_SEC = 60
const RATE_WINDOW_MS = 1500
const BASELINE_KEY = 'mkt:baseline'

export type SanitizedAnalyticsEvent = {
  event: MarketingEventName
  path?: string
  slug?: string
}

export function sanitizeAnalyticsEvent(raw: unknown): SanitizedAnalyticsEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  for (const key of Object.keys(body)) {
    if (SENSITIVE.test(key)) return null
  }
  const event = String(body.event || '')
  if (!ALLOWED.has(event)) return null
  const out: SanitizedAnalyticsEvent = { event: event as MarketingEventName }
  if (typeof body.path === 'string' && body.path && !SENSITIVE.test(body.path)) {
    out.path = body.path.replace(/[?#].*$/, '').slice(0, 80)
  }
  if (typeof body.slug === 'string' && body.slug && !SENSITIVE.test(body.slug)) {
    out.slug = body.slug.replace(/[^a-z0-9-]/gi, '').slice(0, 80)
  }
  return out
}

export function utcDate(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export async function ensureBaseline(env: Env): Promise<{ started_at: string }> {
  const existing = await env.SESSION_CACHE.get(BASELINE_KEY)
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as { started_at?: string }
      if (parsed.started_at) return { started_at: parsed.started_at }
    } catch { /* replace */ }
  }
  const started_at = new Date().toISOString()
  await env.SESSION_CACHE.put(BASELINE_KEY, JSON.stringify({ started_at }))
  return { started_at }
}

export async function readBaseline(env: Env): Promise<{ started_at: string } | null> {
  const existing = await env.SESSION_CACHE.get(BASELINE_KEY)
  if (!existing) return null
  try {
    const parsed = JSON.parse(existing) as { started_at?: string }
    return parsed.started_at ? { started_at: parsed.started_at } : null
  } catch {
    return null
  }
}

export async function trackMarketingEvent(env: Env, raw: unknown): Promise<boolean> {
  const event = sanitizeAnalyticsEvent(raw)
  if (!event) return false
  try {
    await ensureBaseline(env)
    const day = utcDate()
    const key = `mkt:events:${day}`
    const current = await readDayEvents(env, day)
    current[event.event] = Number(current[event.event] || 0) + 1
    await env.SESSION_CACHE.put(key, JSON.stringify(current), { expirationTtl: EVENT_TTL_SEC })
    env.ANALYTICS?.writeDataPoint({
      indexes: [event.event],
      blobs: [event.event, env.ENVIRONMENT || '', event.path || '', event.slug || ''],
    })
    return true
  } catch {
    return false
  }
}

export async function readDayEvents(env: Env, day: string): Promise<Record<string, number>> {
  const raw = await env.SESSION_CACHE.get(`mkt:events:${day}`)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function sumEventsSince(env: Env, startedAt: string, days = 30): Promise<Record<string, number>> {
  const totals: Record<string, number> = {}
  const start = new Date(startedAt)
  if (Number.isNaN(start.getTime())) return totals
  const today = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i))
    if (d < new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))) break
    const day = utcDate(d)
    const counts = await readDayEvents(env, day)
    for (const [k, v] of Object.entries(counts)) totals[k] = Number(totals[k] || 0) + Number(v || 0)
  }
  return totals
}

async function hashedIp(request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'anon'
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mkt-evt:' + ip))
  return Array.from(new Uint8Array(bytes)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function analyticsRateLimited(env: Env, request: Request): Promise<boolean> {
  const id = await hashedIp(request)
  const key = `mktrate:${id}`
  const existing = await env.SESSION_CACHE.get(key)
  if (existing) {
    try {
      const ts = Number(JSON.parse(existing).t) || 0
      if (Date.now() - ts < RATE_WINDOW_MS) return true
    } catch {
      return true
    }
  }
  await env.SESSION_CACHE.put(key, JSON.stringify({ t: Date.now() }), { expirationTtl: RATE_TTL_SEC })
  return false
}

export async function handleAnalyticsEvent(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  if (await analyticsRateLimited(env, request)) {
    return Response.json({ ok: true, dropped: 'rate_limited' }, { status: 202 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }
  const ok = await trackMarketingEvent(env, body)
  if (!ok) return Response.json({ error: 'invalid_event' }, { status: 400 })
  return Response.json({ ok: true })
}
