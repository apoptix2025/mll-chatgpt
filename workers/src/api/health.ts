import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'

const VERSION = '1.0.0'

// Free tier limits
const LIMITS = {
  supabase_db_mb:    500,
  supabase_mau:      50_000,
  resend_emails_mo:  3_000,
  r2_storage_gb:     10,
  workers_req_day:   100_000,
}

const BASE_COST = 7.25   // Google Workspace $6 + domain $1.25

interface ServiceResult {
  status: 'healthy' | 'degraded' | 'down'
  latency_ms?: number
  detail?: string
}

interface CostEstimate {
  base_monthly:          number
  current_monthly_cost:  number
  mrr:                   number | null
  mrr_available:         boolean
  paid_subscriptions:    number
  net_monthly:           number | null
  plans: {
    free:     number
    pro:      number
    featured: number
  }
  usage: {
    supabase_db_mb_est:    number
    supabase_db_limit_mb:  number
    supabase_mau:          number
    supabase_mau_limit:    number
    r2_storage_gb_est:     number
    r2_storage_limit_gb:   number
    resend_emails_est:     number
    resend_emails_limit:   number
    workers_req_day_est:   number
    workers_req_day_limit: number
  }
  warnings:      string[]
  budget_status: 'healthy' | 'caution' | 'warning' | 'critical'
}

interface HealthResponse {
  status:    'healthy' | 'degraded' | 'down'
  timestamp: string
  version:   string
  services: {
    worker:   ServiceResult
    supabase: ServiceResult
    r2:       ServiceResult
    resend:   ServiceResult
    stripe:   ServiceResult
    ga4:      ServiceResult
  }
  stats: {
    businesses: number | null
    profiles:   number | null
    reviews:    number | null
    leads:      number | null
  }
  cost_estimate: CostEstimate
  env_vars: Record<string, boolean>
}

export async function handleHealth(request: Request, _env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: VERSION,
  })
}

export async function handleDetailedHealth(env: Env): Promise<Response> {
  const t0 = Date.now()

  // ── Worker ───────────────────────────────────────────────
  const worker: ServiceResult = { status: 'healthy', latency_ms: 0 }

  // ── Supabase ─────────────────────────────────────────────
  let supabase: ServiceResult = { status: 'down', detail: 'Not checked' }
  const stats = {
    businesses: null as number | null,
    profiles:   null as number | null,
    reviews:    null as number | null,
    leads:      null as number | null,
  }
  let planCounts = { free: 0, pro: 0, featured: 0 }
  let paidSubscriptions = 0

  try {
    const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
    const st = Date.now()

    const { error: pingErr } = await sb.from('businesses').select('id', { count: 'exact', head: true })
    const latency = Date.now() - st

    if (pingErr) {
      supabase = { status: 'down', latency_ms: latency, detail: pingErr.message }
    } else {
      supabase = { status: 'healthy', latency_ms: latency }

      const [bizRes, profRes, revRes, leadRes, proRes, featuredRes, paidRes] = await Promise.all([
        sb.from('businesses').select('*', { count: 'exact', head: true }),
        sb.from('profiles').select('*',   { count: 'exact', head: true }),
        sb.from('reviews').select('*',    { count: 'exact', head: true }),
        sb.from('leads').select('*',      { count: 'exact', head: true }),
        sb.from('businesses').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
        sb.from('businesses').select('*', { count: 'exact', head: true }).eq('plan', 'featured'),
        sb.from('businesses').select('*', { count: 'exact', head: true }).not('stripe_subscription_id', 'is', null),
      ])

      stats.businesses = bizRes.count  ?? null
      stats.profiles   = profRes.count ?? null
      stats.reviews    = revRes.count  ?? null
      stats.leads      = leadRes.count ?? null

      const totalBiz = bizRes.count ?? 0
      const pro      = proRes.count ?? 0
      const featured = featuredRes.count ?? 0
      planCounts = { pro, featured, free: totalBiz - pro - featured }
      paidSubscriptions = paidRes.count ?? 0
    }
  } catch (e) {
    supabase = { status: 'down', detail: String(e) }
  }

  // ── R2 ───────────────────────────────────────────────────
  let r2: ServiceResult = { status: 'down', detail: 'Not checked' }
  try {
    const rt = Date.now()
    await env.MEDIA.head('__health__')
    r2 = { status: 'healthy', latency_ms: Date.now() - rt }
  } catch (e) {
    r2 = { status: 'down', detail: String(e) }
  }

  // ── Resend ───────────────────────────────────────────────
  let resend: ServiceResult
  const isStaging = env.ENVIRONMENT === 'staging'
  if (!env.RESEND_API_KEY) {
    resend = { status: isStaging ? 'degraded' : 'down', detail: 'RESEND_API_KEY not set' }
  } else if (env.RESEND_API_KEY.startsWith('re_')) {
    resend = { status: 'healthy', detail: 'API key present' }
  } else {
    resend = { status: 'degraded', detail: 'API key format unexpected' }
  }

  // ── Stripe ───────────────────────────────────────────────
  let stripe: ServiceResult
  if (!env.STRIPE_SECRET_KEY) {
    stripe = { status: isStaging ? 'degraded' : 'down', detail: 'STRIPE_SECRET_KEY not set' }
  } else {
    try {
      const rt = Date.now()
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
      })
      stripe = res.ok
        ? { status: 'healthy', latency_ms: Date.now() - rt }
        : { status: 'degraded', latency_ms: Date.now() - rt, detail: `HTTP ${res.status}` }
    } catch (e) {
      stripe = { status: 'down', detail: String(e) }
    }
  }

  worker.latency_ms = Date.now() - t0

  // ── GA4 ──────────────────────────────────────────────────
  const ga4: ServiceResult = env.FRONTEND_URL?.includes('mylatinolist.io')
    ? { status: 'healthy', detail: 'Measurement ID G-YB4TE3JXR7 active' }
    : { status: 'degraded', detail: 'FRONTEND_URL not pointing to production' }

  // ── Cost estimate ─────────────────────────────────────────
  const bizCount  = stats.businesses ?? 0
  const profCount = stats.profiles   ?? 0
  const revCount  = stats.reviews    ?? 0
  const leadCount = stats.leads      ?? 0

  // DB size: ~2KB/business, ~1KB/profile, ~0.5KB/review, ~0.5KB/lead
  const dbSizeKB  = bizCount * 2 + profCount * 1 + revCount * 0.5 + leadCount * 0.5
  const dbSizeMB  = Math.round(dbSizeKB / 1024 * 10) / 10

  // R2: ~150KB avg logo per business
  const r2GbEst   = Math.round(bizCount * 0.00015 * 100) / 100

  // Resend: rough monthly estimate = (leads + expiry warnings) / 12
  const resendEst = Math.max(1, Math.round((leadCount + bizCount * 0.2) / 12))

  // Workers: ~10 req/user/day estimate
  const workersEst = profCount * 10

  const currentCost = BASE_COST
  const mrrAvailable = false
  const mrr: number | null = null
  const netMonthly: number | null = null

  const warnings: string[] = []
  const dbPct      = dbSizeMB  / LIMITS.supabase_db_mb
  const mauPct     = profCount / LIMITS.supabase_mau
  const r2Pct      = r2GbEst   / LIMITS.r2_storage_gb
  const resendPct  = resendEst / LIMITS.resend_emails_mo
  const workersPct = workersEst / LIMITS.workers_req_day

  const checkLimit = (pct: number, label: string) => {
    if (pct > 0.8) warnings.push(`🔴 ${label} above 80% of free tier`)
    else if (pct > 0.6) warnings.push(`🟡 ${label} above 60% of free tier`)
  }
  checkLimit(dbPct,      'Supabase DB')
  checkLimit(mauPct,     'Supabase MAU')
  checkLimit(r2Pct,      'R2 Storage')
  checkLimit(resendPct,  'Resend Emails')
  checkLimit(workersPct, 'Workers Requests')
  if (currentCost > 100) warnings.push('🔴 Monthly cost exceeds $100 budget')
  else if (currentCost > 80) warnings.push('🟠 Monthly cost approaching $100 budget')

  const budgetStatus: CostEstimate['budget_status'] =
    currentCost > 100       ? 'critical' :
    currentCost > 80        ? 'warning'  :
    warnings.length > 0     ? 'caution'  : 'healthy'

  const cost_estimate: CostEstimate = {
    base_monthly:         BASE_COST,
    current_monthly_cost: currentCost,
    mrr,
    mrr_available:        mrrAvailable,
    paid_subscriptions:   paidSubscriptions,
    net_monthly:          netMonthly,
    plans:                planCounts,
    usage: {
      supabase_db_mb_est:    dbSizeMB,
      supabase_db_limit_mb:  LIMITS.supabase_db_mb,
      supabase_mau:          profCount,
      supabase_mau_limit:    LIMITS.supabase_mau,
      r2_storage_gb_est:     r2GbEst,
      r2_storage_limit_gb:   LIMITS.r2_storage_gb,
      resend_emails_est:     resendEst,
      resend_emails_limit:   LIMITS.resend_emails_mo,
      workers_req_day_est:   workersEst,
      workers_req_day_limit: LIMITS.workers_req_day,
    },
    warnings,
    budget_status: budgetStatus,
  }

  // ── Env vars present ─────────────────────────────────────
  const env_vars: Record<string, boolean> = {
    SUPABASE_URL:          !!env.SUPABASE_URL,
    SUPABASE_ANON_KEY:     !!env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY:  !!env.SUPABASE_SERVICE_KEY,
    STRIPE_SECRET_KEY:     !!env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: !!env.STRIPE_WEBHOOK_SECRET,
    RESEND_API_KEY:        !!env.RESEND_API_KEY,
    FRONTEND_URL:          !!env.FRONTEND_URL,
  }

  // ── Overall status ───────────────────────────────────────
  const statuses = [supabase.status, r2.status, resend.status, stripe.status]
  const overall: 'healthy' | 'degraded' | 'down' =
    statuses.every(s => s === 'healthy') ? 'healthy' :
    statuses.some(s => s === 'down')     ? 'down'    : 'degraded'

  const body: HealthResponse = {
    status: overall,
    timestamp: new Date().toISOString(),
    version: VERSION,
    services: { worker, supabase, r2, resend, stripe, ga4 },
    stats,
    cost_estimate,
    env_vars,
  }

  const httpStatus = overall === 'down' ? 503 : overall === 'degraded' ? 207 : 200
  return Response.json(body, { status: httpStatus })
}
