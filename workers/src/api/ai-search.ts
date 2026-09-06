import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'

const MAX_QUERY = 240
const VISITOR_LIMIT = 3
const SAFE_BIZ = 'id,name,slug,category,city,state,rating,review_count,is_featured,tags,phone'
const SAFE_JOB = 'id,title,company_name,city,state,job_type,salary_range'
const SAFE_RES = 'id,title,description,category,url,tag'

type Intent = {
  intent: 'business_search' | 'job_search' | 'resource_search'
  category: string
  location: string
  language: string
  q: string
}

function aiEnabled(env: Env): boolean {
  if (String(env.MLL_AI_ENABLED || '').toLowerCase() !== 'true') return false
  return true
}

function hasWorkersAi(env: Env): boolean {
  return !!(env as Env & { AI?: unknown }).AI
}

export function parseIntentDeterministic(query: string): Intent {
  const raw = query.trim().slice(0, MAX_QUERY)
  const q = raw.toLowerCase()
  let intent: Intent['intent'] = 'business_search'
  if (/\b(job|jobs|empleo|hiring|career|vacante)\b/.test(q)) intent = 'job_search'
  if (/\b(immigration|daca|sba|grant|resource|license|tax|legal aid)\b/.test(q)) intent = 'resource_search'

  let category = ''
  if (/restaurant|comida|food|dining/.test(q)) category = 'Food & Dining'
  else if (/contractor|construction|remodel/.test(q)) category = 'Construction'
  else if (/salon|hair|beauty|barber/.test(q)) category = 'Beauty & Salon'
  else if (/attorney|lawyer|legal/.test(q)) category = 'Legal Services'
  else if (/auto|repair|mechanic/.test(q)) category = 'Auto & Repair'
  else if (/health|wellness|clinic/.test(q)) category = 'Health & Wellness'

  let location = ''
  const near = raw.match(/\b(?:near|in|around)\s+([A-Za-z][A-Za-z\s.]{1,40})$/i)
  if (near) location = near[1].trim()
  if (/silver spring/i.test(raw)) location = 'Silver Spring'

  const language = /spanish|español|espanol/i.test(raw) ? 'Spanish' : ''
  return { intent, category, location, language, q: raw }
}

async function extractIntent(env: Env, query: string): Promise<Intent> {
  const fallback = parseIntentDeterministic(query)
  const ai = (env as Env & { AI?: { run: Function } }).AI
  if (!ai || !hasWorkersAi(env)) return fallback
  try {
    const result = await Promise.race([
      ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'Extract search intent for a Latino business directory. Return ONLY JSON: {"intent":"business_search|job_search|resource_search","category":"","location":"","language":""}. Never invent businesses.',
          },
          { role: 'user', content: query.slice(0, MAX_QUERY) },
        ],
        max_tokens: 120,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]) as { response?: string }
    const text = String(result?.response || '')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    const parsed = JSON.parse(match[0]) as Partial<Intent>
    return {
      intent: parsed.intent === 'job_search' || parsed.intent === 'resource_search' ? parsed.intent : 'business_search',
      category: String(parsed.category || fallback.category).slice(0, 80),
      location: String(parsed.location || fallback.location).slice(0, 80),
      language: String(parsed.language || fallback.language).slice(0, 40),
      q: fallback.q,
    }
  } catch {
    return fallback
  }
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
  if (Number(row.review_count) > 0 && row.rating != null) {
    out.rating = row.rating
    out.review_count = row.review_count
  }
  if (row.phone) out.phone = row.phone
  return out
}

export async function handleAiSearch(request: Request, env: Env, userId?: string): Promise<Response> {
  const url = new URL(request.url)
  const enabled = aiEnabled(env)

  if (request.method === 'GET' && (url.pathname === '/api/ai/status' || url.pathname === '/api/ai/search')) {
    return Response.json({
      enabled,
      remaining: VISITOR_LIMIT,
      allowance: { visitor: VISITOR_LIMIT, free: 10, basic: 25, pro: 60, featured: 100, agency: 200 },
      binding: hasWorkersAi(env),
    })
  }

  if (request.method !== 'POST' || url.pathname !== '/api/ai/search') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (!enabled) {
    return Response.json({ enabled: false, message: 'MLL AI is coming soon.' })
  }

  let body: { query?: string }
  try {
    body = await request.json() as { query?: string }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const query = String(body.query || '').trim().slice(0, MAX_QUERY)
  if (!query) return Response.json({ error: 'query required' }, { status: 400 })

  const intent = await extractIntent(env, query)
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

  const results: { businesses: unknown[]; jobs: unknown[]; resources: unknown[] } = {
    businesses: [],
    jobs: [],
    resources: [],
  }

  if (intent.intent === 'job_search') {
    let q = supabase.from('jobs').select(SAFE_JOB).eq('status', 'active').limit(6)
    if (intent.location) q = q.ilike('city', `%${intent.location}%`)
    const { data } = await q
    results.jobs = data || []
  } else if (intent.intent === 'resource_search') {
    let q = supabase.from('resources').select(SAFE_RES).limit(6)
    if (/immigration|daca/.test(intent.q.toLowerCase())) q = q.eq('category', 'immigration')
    const { data } = await q
    results.resources = data || []
  } else {
    let q = supabase
      .from('businesses')
      .select(SAFE_BIZ)
      .eq('status', 'active')
      .neq('name', 'Test')
      .limit(6)
    if (intent.category) q = q.ilike('category', intent.category)
    else if (intent.q) q = q.ilike('name', `%${intent.q.split(' ').slice(0, 3).join(' ')}%`)
    if (intent.location) q = q.ilike('city', `%${intent.location.split(',')[0].trim()}%`)
    const { data } = await q
    results.businesses = (data || []).map((row) => publicBusiness(row as Record<string, unknown>))
  }

  const empty = !results.businesses.length && !results.jobs.length && !results.resources.length
  return Response.json({
    enabled: true,
    intent: intent.intent,
    category: intent.category,
    location: intent.location,
    language: intent.language,
    remaining: userId ? 10 : VISITOR_LIMIT,
    plan_hint: userId ? 'free' : 'visitor',
    results,
    message: empty
      ? 'No matching listings on My Latino List yet. Try another search or browse the directory.'
      : 'Here are real listings from My Latino List.',
  })
}
