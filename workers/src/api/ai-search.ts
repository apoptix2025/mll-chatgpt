import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { withAuth } from '../middleware/auth'

/** Small instruct model: cheap bilingual JSON intent extraction. Never used to invent listings. */
export const MLL_AI_MODEL = '@cf/meta/llama-3.2-3b-instruct'

const MAX_QUERY = 300
const AI_TIMEOUT_MS = 5000
const AI_MAX_TOKENS = 80
const VISITOR_LIMIT = 3
const AUTH_LIMIT = 10
const RATE_TTL_SEC = 4
const QUOTA_TTL_SEC = 60 * 60 * 26
const METRICS_TTL_SEC = 60 * 60 * 48

const SAFE_BIZ = 'id,name,slug,category,city,state,logo_url,phone,tags,rating,review_count'
const SAFE_JOB = 'id,title,company_name,city,state,job_type,salary_range'
const SAFE_RES = 'id,title,description,category,url,tag'

type SearchIntent = 'business_search' | 'job_search' | 'resource_search' | 'unsupported'
type ReplyLang = 'en' | 'es'

type Intent = {
  intent: SearchIntent
  category: string
  location: string
  language: string
  q: string
  replyLang: ReplyLang
}

type QuotaState = { used: number; limit: number; remaining: number; hashedId: string; dateKey: string }

const ALLOWED_CATEGORIES = [
  'Food & Dining',
  'Construction',
  'Beauty & Salon',
  'Legal Services',
  'Auto & Repair',
  'Health & Wellness',
  'Real Estate',
  'Finance',
] as const

function aiEnabled(env: Env): boolean {
  return String(env.MLL_AI_ENABLED || '').toLowerCase() === 'true'
}

function hasWorkersAi(env: Env): boolean {
  return !!env.AI
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function safeLike(value: string): string {
  return value.replace(/[%_,."'()\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)
}

function detectReplyLang(query: string): ReplyLang {
  if (/[áéíóúñ¿¡]|^\s*(necesito|busco|hola|encuentra|ayúdame|ayudame|cerca de)\b/i.test(query)) return 'es'
  return 'en'
}

function mapCategory(raw: string): string {
  const q = raw.toLowerCase()
  if (/restaurant|restaurante|comida|food|dining/.test(q)) return 'Food & Dining'
  if (/contractor|construction|remodel|contratista|construcci[oó]n/.test(q)) return 'Construction'
  if (/salon|hair|beauty|barber|sal[oó]n|peluquer/.test(q)) return 'Beauty & Salon'
  if (/attorney|lawyer|legal|abogado/.test(q)) return 'Legal Services'
  if (/auto|repair|mechanic|taller|mec[aá]nico/.test(q)) return 'Auto & Repair'
  if (/health|wellness|clinic|salud|cl[ií]nica/.test(q)) return 'Health & Wellness'
  if (/real estate|realtor|realty|inmuebles/.test(q)) return 'Real Estate'
  if (/tax|account|finance|impuesto|contador/.test(q)) return 'Finance'
  const exact = ALLOWED_CATEGORIES.find((c) => c.toLowerCase() === q)
  return exact || ''
}

function isOffTopic(q: string): boolean {
  return /^(hi|hello|hey|hola|thanks|gracias|what is|who is|write |poem|weather|capital of|tell me a joke)\b/i.test(q.trim())
    && !/\b(business|job|empleo|restaurant|abogado|resource|recurso)\b/i.test(q)
}

export function parseIntentDeterministic(query: string): Intent {
  const raw = query.trim().slice(0, MAX_QUERY)
  const q = raw.toLowerCase()
  const replyLang = detectReplyLang(raw)

  let intent: SearchIntent = 'business_search'
  if (isOffTopic(raw)) intent = 'unsupported'
  else if (/\b(job|jobs|empleo|empleos|trabajo|trabajos|hiring|career|vacante|vacantes)\b/.test(q)) intent = 'job_search'
  else if (/\b(immigration|inmigraci[oó]n|inmigracion|daca|sba|grant|resource|resources|recurso|recursos|license|tax|legal aid)\b/.test(q)) {
    intent = 'resource_search'
  }

  const category = mapCategory(q)

  let location = ''
  const near = raw.match(/\b(?:near|in|around|cerca de|en)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\s.]{1,40})$/i)
  if (near) location = near[1].trim()
  if (/silver spring/i.test(raw)) location = 'Silver Spring'
  if (/^(me|m[ií]|aqui|aquí)$/i.test(location)) location = ''

  const language = /spanish|espa[nñ]ol|espanol|hable espa[nñ]ol/i.test(raw) ? 'Spanish' : ''
  return { intent, category, location, language, q: raw, replyLang }
}

function mergeIntent(parsed: Partial<Intent>, fallback: Intent): Intent {
  const rawIntent = String(parsed.intent || '')
  const intent: SearchIntent =
    rawIntent === 'job_search' || rawIntent === 'resource_search' || rawIntent === 'unsupported'
      ? rawIntent
      : rawIntent === 'business_search'
        ? 'business_search'
        : fallback.intent
  const category = mapCategory(String(parsed.category || '')) || fallback.category
  const location = safeLike(String(parsed.location || fallback.location))
  const language = /spanish|espa[nñ]ol/i.test(String(parsed.language || fallback.language)) ? 'Spanish' : fallback.language
  return { intent, category, location, language, q: fallback.q, replyLang: fallback.replyLang }
}

async function extractIntent(env: Env, query: string): Promise<{ intent: Intent; parsed: boolean; usage?: { prompt_tokens?: number; completion_tokens?: number } }> {
  const fallback = parseIntentDeterministic(query)
  const ai = env.AI
  if (!ai) return { intent: fallback, parsed: false }
  try {
    const result = await Promise.race([
      ai.run(MLL_AI_MODEL, {
        messages: [
          {
            role: 'system',
            content:
              'Extract search intent for My Latino List. Return ONLY JSON: {"intent":"business_search|job_search|resource_search|unsupported","category":"","location":"","language":""}. Use unsupported for general chat. Never invent businesses, phones, addresses, or ratings.',
          },
          { role: 'user', content: query.slice(0, MAX_QUERY) },
        ],
        max_tokens: AI_MAX_TOKENS,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), AI_TIMEOUT_MS)),
    ]) as { response?: string; result?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    const usage = result?.usage
    const text = String(result?.response || result?.result || '')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return { intent: fallback, parsed: false, usage }
    const parsed = JSON.parse(match[0]) as Partial<Intent>
    return { intent: mergeIntent(parsed, fallback), parsed: true, usage }
  } catch {
    return { intent: fallback, parsed: false }
  }
}

function isVerified(row: Record<string, unknown>): boolean {
  if (row.is_verified === true) return true
  const tags = row.tags
  if (Array.isArray(tags)) return tags.some((t) => String(t).toLowerCase() === 'verified')
  return false
}

function publicBusiness(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    city: row.city,
    state: row.state,
  }
  if (typeof row.logo_url === 'string' && /^https?:/i.test(row.logo_url)) out.image = row.logo_url
  if (row.phone) out.phone = row.phone
  if (isVerified(row)) out.verified = true
  return out
}

function publicJob(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    company_name: row.company_name,
    city: row.city,
    state: row.state,
    job_type: row.job_type,
    href: `/pages/jobs.html?id=${encodeURIComponent(String(row.id || ''))}`,
  }
}

function publicResource(row: Record<string, unknown>) {
  const url = typeof row.url === 'string' && /^https?:/i.test(row.url) ? row.url : '/pages/voz.html'
  return {
    id: row.id,
    title: row.title,
    category: row.category || row.tag,
    description: row.description,
    href: url,
  }
}

async function sha24(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

function clientIpHint(request: Request): string {
  const cf = request.headers.get('CF-Connecting-IP')
  const fwd = (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim()
  return cf || fwd || 'unknown'
}

async function identifier(request: Request, userId?: string): Promise<string> {
  if (userId) return sha24(`user:${userId}`)
  return sha24(`anon:${clientIpHint(request)}`)
}

async function readQuota(env: Env, hashedId: string, limit: number): Promise<QuotaState> {
  const dateKey = utcDate()
  const raw = await env.SESSION_CACHE.get(`aiquota:${hashedId}:${dateKey}`)
  let used = 0
  if (raw) {
    try { used = Math.max(0, Number(JSON.parse(raw).count) || 0) } catch { used = 0 }
  }
  return { used, limit, remaining: Math.max(0, limit - used), hashedId, dateKey }
}

async function consumeQuota(env: Env, state: QuotaState): Promise<QuotaState> {
  const used = state.used + 1
  await env.SESSION_CACHE.put(
    `aiquota:${state.hashedId}:${state.dateKey}`,
    JSON.stringify({ count: used, expiry: state.dateKey }),
    { expirationTtl: QUOTA_TTL_SEC }
  )
  return { ...state, used, remaining: Math.max(0, state.limit - used) }
}

async function rateLimited(env: Env, hashedId: string): Promise<boolean> {
  const key = `airate:${hashedId}`
  const existing = await env.SESSION_CACHE.get(key)
  if (existing) return true
  await env.SESSION_CACHE.put(key, '1', { expirationTtl: RATE_TTL_SEC })
  return false
}

async function bumpMetric(env: Env, field: string): Promise<void> {
  try {
    const key = `aimetrics:${utcDate()}`
    const raw = await env.SESSION_CACHE.get(key)
    const next = raw ? JSON.parse(raw) as Record<string, number> : {}
    next[field] = Number(next[field] || 0) + 1
    if (field === 'requests') next.total = Number(next.total || 0) + 1
    await env.SESSION_CACHE.put(key, JSON.stringify(next), { expirationTtl: METRICS_TTL_SEC })
  } catch {
    // Metrics must never break search.
  }
}

function msg(lang: ReplyLang, key: string): string {
  const en: Record<string, string> = {
    coming_soon: 'MLL AI is coming soon.',
    invalid: 'Enter a short search (up to 300 characters).',
    rate: 'Please wait a few seconds and try again.',
    quota: "You've used your free MLL AI searches.",
    unavailable: 'MLL AI is temporarily unavailable. Try regular search.',
    unsupported: 'I can help you find businesses, jobs, or La Voz Latino resources on My Latino List.',
    empty: "I couldn't find a matching MLL business yet.",
    empty_job: 'No matching jobs found yet.',
    empty_res: 'No matching La Voz Latino resources found yet.',
    found: 'Here are real listings from My Latino List.',
  }
  const es: Record<string, string> = {
    coming_soon: 'MLL AI estará disponible pronto.',
    invalid: 'Escribe una búsqueda corta (máximo 300 caracteres).',
    rate: 'Espera unos segundos e inténtalo de nuevo.',
    quota: 'Ya usaste tus búsquedas gratis de MLL AI.',
    unavailable: 'MLL AI no está disponible por ahora. Usa la búsqueda normal.',
    unsupported: 'Puedo ayudarte a encontrar negocios, empleos o recursos de La Voz Latino en My Latino List.',
    empty: 'No encontré un negocio de MLL que coincida todavía.',
    empty_job: 'No encontré empleos que coincidan todavía.',
    empty_res: 'No encontré recursos de La Voz Latino que coincidan todavía.',
    found: 'Estos son listados reales de My Latino List.',
  }
  return (lang === 'es' ? es : en)[key] || en[key]
}

async function searchGrounded(env: Env, intent: Intent) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const results: unknown[] = []

  if (intent.intent === 'job_search') {
    let q = supabase.from('jobs').select(SAFE_JOB).eq('status', 'active').limit(6)
    const loc = safeLike(intent.location)
    if (loc) q = q.ilike('city', `%${loc}%`)
    const kw = /\b(it|software|developer|programad|tecnolog)/i.test(intent.q) ? 'IT' : ''
    if (kw) q = q.or(`title.ilike.%${kw}%,title.ilike.%software%,title.ilike.%developer%`)
    const { data, error } = await q
    if (error) throw error
    results.push(...(data || []).map((row) => publicJob(row as Record<string, unknown>)))
    return results
  }

  if (intent.intent === 'resource_search') {
    let q = supabase.from('resources').select(SAFE_RES).limit(6)
    if (/immigration|inmigraci|daca/i.test(intent.q + intent.category)) {
      q = q.or('category.ilike.%immigr%,category.ilike.%daca%,title.ilike.%immigr%,title.ilike.%daca%,title.ilike.%inmigr%')
    }
    const { data, error } = await q
    if (error) throw error
    results.push(...(data || []).map((row) => publicResource(row as Record<string, unknown>)))
    return results
  }

  let q = supabase
    .from('businesses')
    .select(SAFE_BIZ)
    .eq('status', 'active')
    .neq('name', 'Test')
    .order('is_featured', { ascending: false })
    .limit(6)
  if (intent.category) q = q.ilike('category', intent.category)
  const loc = safeLike(intent.location)
  if (loc) q = q.ilike('city', `%${loc.split(',')[0].trim()}%`)
  if (!intent.category && !loc) {
    const tokens = intent.q
      .toLowerCase()
      .replace(/[^a-záéíóúñ0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !/^(find|show|help|near|with|that|habl|espan|spani|necesito|busco|cerca|latino)/i.test(w))
    if (tokens[0]) q = q.or(`name.ilike.%${safeLike(tokens[0])}%,category.ilike.%${safeLike(tokens[0])}%`)
    else return []
  }
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((row) => publicBusiness(row as Record<string, unknown>))
}

export async function handleAiSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const enabled = aiEnabled(env)
  const auth = await withAuth(request, env)
  const userId = auth.ok ? auth.userId : undefined
  const limit = userId ? AUTH_LIMIT : VISITOR_LIMIT
  const hashedId = await identifier(request, userId)
  const quota = await readQuota(env, hashedId, limit)

  if (request.method === 'GET' && (url.pathname === '/api/ai/status' || url.pathname === '/api/ai/search')) {
    return Response.json({
      enabled,
      remaining: quota.remaining,
      allowance: { visitor: VISITOR_LIMIT, auth: AUTH_LIMIT },
      binding: hasWorkersAi(env),
      model: enabled && hasWorkersAi(env) ? MLL_AI_MODEL : null,
    })
  }

  if (request.method !== 'POST' || url.pathname !== '/api/ai/search') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (!enabled) {
    return Response.json({ enabled: false, message: msg('en', 'coming_soon') })
  }

  let body: { query?: string }
  try {
    body = await request.json() as { query?: string }
  } catch {
    return Response.json({ error: 'invalid_json', message: msg('en', 'invalid') }, { status: 400 })
  }

  const query = String(body.query || '').trim()
  const replyLang = detectReplyLang(query)
  if (!query || query.length > MAX_QUERY) {
    return Response.json({ error: 'invalid_input', message: msg(replyLang, 'invalid') }, { status: 400 })
  }

  if (await rateLimited(env, hashedId)) {
    return Response.json({ error: 'rate_limited', message: msg(replyLang, 'rate'), remaining: quota.remaining }, { status: 429 })
  }

  if (quota.remaining <= 0) {
    return Response.json({
      error: 'quota_exceeded',
      message: msg(replyLang, 'quota'),
      remaining: 0,
      cta: { create_account: '/pages/login.html', view_plans: '/pages/pricing.html' },
    }, { status: 429 })
  }

  await bumpMetric(env, 'requests')
  const reserved = await consumeQuota(env, quota)

  try {
    const extracted = await extractIntent(env, query)
    if (extracted.parsed) await bumpMetric(env, 'parses')
    const intent = extracted.intent
    const usage = extracted.usage ? { model: MLL_AI_MODEL, ...extracted.usage } : { model: MLL_AI_MODEL }

    if (intent.intent === 'unsupported') {
      await bumpMetric(env, 'errors')
      return Response.json({
        enabled: true,
        intent: 'unsupported',
        query,
        remaining: reserved.remaining,
        results: [],
        message: msg(replyLang, 'unsupported'),
        usage,
      })
    }

    const results = await searchGrounded(env, intent)
    if (intent.intent === 'business_search') await bumpMetric(env, 'business')
    if (intent.intent === 'job_search') await bumpMetric(env, 'job')
    if (intent.intent === 'resource_search') await bumpMetric(env, 'resource')
    if (!results.length) await bumpMetric(env, 'empty')

    const emptyKey = intent.intent === 'job_search' ? 'empty_job' : intent.intent === 'resource_search' ? 'empty_res' : 'empty'
    return Response.json({
      enabled: true,
      intent: intent.intent,
      query,
      category: intent.category || undefined,
      location: intent.location || undefined,
      language: intent.language || undefined,
      remaining: reserved.remaining,
      results,
      message: results.length ? msg(replyLang, 'found') : msg(replyLang, emptyKey),
      usage,
    })
  } catch (err) {
    await bumpMetric(env, 'errors')
    console.error('MLL AI search failed', err instanceof Error ? err.message : 'error')
    return Response.json({
      enabled: true,
      error: 'unavailable',
      message: msg(replyLang, 'unavailable'),
      remaining: reserved.remaining,
      results: [],
    }, { status: 503 })
  }
}
