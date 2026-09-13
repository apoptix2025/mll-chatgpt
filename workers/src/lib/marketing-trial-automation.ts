import {
  CUSTOMER_PACK_COOLDOWN_MS,
  CUSTOMER_PACK_PILOT_LIMIT,
} from './customer-marketing-pack'
import {
  buildListingScore,
  listingFootprint,
  type ListingFootprint,
  type PilotBusiness,
} from './marketing-pilot'
import {
  daysRemainingFromEnd,
  deriveTrialStatus,
  type MarketingTrialRow,
  type MarketingTrialStatus,
} from './marketing-trial'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY_MS = 24 * 60 * 60 * 1000

export const AUTOMATION_EVENT_TABLE = 'marketing_trial_automation_events'
export const AUTOMATION_MAX_ATTEMPTS = 5
export const AUTOMATION_STALE_PROCESSING_MS = 30 * 60 * 1000
export const AUTOMATION_RESULT_VERSION = 1

/** Re-export pack limits so callers can assert V1 automation does not change them. */
export { CUSTOMER_PACK_PILOT_LIMIT, CUSTOMER_PACK_COOLDOWN_MS }

export const AUTOMATION_MILESTONES = [
  'DAY_0_BASELINE',
  'DAY_1_ANALYSIS',
  'DAY_2_MARKETING_PACK',
  'DAY_7_RECOMMENDATIONS',
  'DAY_14_MID_TRIAL_REPORT',
  'DAY_21_RECOMMENDATIONS',
  'DAY_25_UPGRADE_RECOMMENDATION',
  'DAY_28_ENDING_REMINDER',
  'DAY_30_FINAL_REPORT',
] as const

export type AutomationMilestone = (typeof AUTOMATION_MILESTONES)[number]

export const MILESTONE_DAY_OFFSET: Record<AutomationMilestone, number> = {
  DAY_0_BASELINE: 0,
  DAY_1_ANALYSIS: 1,
  DAY_2_MARKETING_PACK: 2,
  DAY_7_RECOMMENDATIONS: 7,
  DAY_14_MID_TRIAL_REPORT: 14,
  DAY_21_RECOMMENDATIONS: 21,
  DAY_25_UPGRADE_RECOMMENDATION: 25,
  DAY_28_ENDING_REMINDER: 28,
  DAY_30_FINAL_REPORT: 30,
}

export type AutomationEventStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'

export type AutomationEventRow = {
  id: string
  business_id: string
  trial_started_at: string
  milestone: AutomationMilestone
  status: AutomationEventStatus
  scheduled_for: string
  executed_at: string | null
  attempt_count: number
  last_error: string | null
  result: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export type PackUsageSnapshot = {
  packs_generated: number
  content_copy_events: number
  last_pack_generated_at: string | null
}

export type TrialStateSnapshot = {
  result_version: typeof AUTOMATION_RESULT_VERSION
  captured_at: string
  business: {
    id: string
    name: string
    category: string | null
    plan: string | null
  }
  trial: {
    started_at: string
    ends_at: string
    status: MarketingTrialStatus
    days_remaining: number
  }
  listing: {
    description_present: boolean
    website_present: boolean
    phone_present: boolean
    city_state_present: boolean
    facebook_present: boolean
    instagram_present: boolean
  }
  score: {
    total: number
    max: number
    categories: Array<{ key: string; label: string; score: number; max: number; status: string }>
  }
  progress_items: Array<{ id: string; label: string; done: boolean }>
  packs_generated: number
  packs_remaining: number
  content_copy_events: number
  listing_leads: number
  opportunities: Array<{ id: string; title: string; detail: string }>
}

type DbClient = { from: (table: string) => any }

export class MarketingAutomationError extends Error {
  readonly code: 'unavailable' | 'failed' | 'not_allowed'
  constructor(code: 'unavailable' | 'failed' | 'not_allowed', message: string) {
    super(message)
    this.name = 'MarketingAutomationError'
    this.code = code
  }
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (message.includes(AUTOMATION_EVENT_TABLE) && message.includes('schema cache'))
  )
}

function isUniqueConflict(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || '')
  return code === '23505' || code === '409'
}

function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'unknown_error')
  return raw
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, '[redacted]')
    .replace(/sk_(live|test)_[A-Za-z0-9]+/gi, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]')
    .slice(0, 500)
}

/** Accepts comma-separated business UUIDs only. Slugs ignored. Does NOT use pilot flag. */
export function parseAutomationBusinessIds(raw?: string | null): Set<string> {
  const ids = new Set<string>()
  for (const part of String(raw || '').split(',')) {
    const id = part.trim().toLowerCase()
    if (UUID_RE.test(id)) ids.add(id)
  }
  return ids
}

export function isAutomationBusinessId(
  rawFlag: string | null | undefined,
  businessId: string | null | undefined,
): boolean {
  if (!businessId || !UUID_RE.test(businessId)) return false
  return parseAutomationBusinessIds(rawFlag).has(businessId.toLowerCase())
}

export function milestoneScheduledFor(startedAt: string, milestone: AutomationMilestone): string {
  const startMs = Date.parse(startedAt)
  if (!Number.isFinite(startMs)) {
    throw new MarketingAutomationError('failed', 'Invalid trial started_at.')
  }
  const offsetDays = MILESTONE_DAY_OFFSET[milestone]
  return new Date(startMs + offsetDays * DAY_MS).toISOString()
}

export function isMilestoneDue(scheduledFor: string, now = Date.now()): boolean {
  const dueMs = Date.parse(scheduledFor)
  return Number.isFinite(dueMs) && now >= dueMs
}

export function elapsedTrialDays(startedAt: string, now = Date.now()): number {
  const startMs = Date.parse(startedAt)
  if (!Number.isFinite(startMs) || now < startMs) return 0
  return Math.floor((now - startMs) / DAY_MS)
}

function progressItems(listing: ListingFootprint) {
  return [
    { id: 'description', label: 'Listing description', done: listing.has_description },
    { id: 'website', label: 'Website', done: listing.has_website },
    { id: 'phone', label: 'Phone', done: listing.has_phone },
    { id: 'location', label: 'City and state', done: listing.has_city_state },
    { id: 'facebook', label: 'Facebook', done: listing.has_facebook },
    { id: 'instagram', label: 'Instagram', done: listing.has_instagram },
  ]
}

export function buildTrialStateSnapshot(input: {
  business: PilotBusiness
  trial: MarketingTrialRow
  pack: PackUsageSnapshot
  leadCount: number
  now?: number
}): TrialStateSnapshot {
  const now = input.now ?? Date.now()
  const status = deriveTrialStatus(input.trial, now)
  const listing = listingFootprint(input.business)
  const score = buildListingScore(input.business, input.leadCount)
  const packsGenerated = Math.max(0, Number(input.pack.packs_generated) || 0)
  return {
    result_version: AUTOMATION_RESULT_VERSION,
    captured_at: new Date(now).toISOString(),
    business: {
      id: input.business.id,
      name: input.business.name,
      category: input.business.category,
      plan: input.business.plan,
    },
    trial: {
      started_at: input.trial.started_at,
      ends_at: input.trial.ends_at,
      status,
      days_remaining: status === 'active' ? daysRemainingFromEnd(input.trial.ends_at, now) : 0,
    },
    listing: {
      description_present: listing.has_description,
      website_present: listing.has_website,
      phone_present: listing.has_phone,
      city_state_present: listing.has_city_state,
      facebook_present: listing.has_facebook,
      instagram_present: listing.has_instagram,
    },
    score: {
      total: score.total,
      max: score.max,
      categories: score.categories.map((c) => ({
        key: c.key,
        label: c.label,
        score: c.score,
        max: c.max,
        status: c.status,
      })),
    },
    progress_items: progressItems(listing),
    packs_generated: packsGenerated,
    packs_remaining: Math.max(0, CUSTOMER_PACK_PILOT_LIMIT - packsGenerated),
    content_copy_events: Math.max(0, Number(input.pack.content_copy_events) || 0),
    listing_leads: Math.max(0, Number(input.leadCount) || 0),
    opportunities: listing.opportunities,
  }
}

function listingImprovements(baseline: TrialStateSnapshot, current: TrialStateSnapshot) {
  const out: string[] = []
  for (const item of current.progress_items) {
    const before = baseline.progress_items.find((b) => b.id === item.id)
    if (item.done && before && !before.done) out.push(item.label)
  }
  return out
}

function remainingActions(current: TrialStateSnapshot) {
  return current.opportunities.map((o) => ({ id: o.id, title: o.title, detail: o.detail }))
}

export function buildMilestoneResult(
  milestone: AutomationMilestone,
  current: TrialStateSnapshot,
  baseline: TrialStateSnapshot | null,
): Record<string, unknown> {
  const base = {
    result_version: AUTOMATION_RESULT_VERSION,
    milestone,
    captured_at: current.captured_at,
    ai_calls: 0,
    email_sent: false,
    stripe_called: false,
    pack_generated: false,
  }

  if (milestone === 'DAY_0_BASELINE') {
    return { ...base, ...current, kind: 'baseline' }
  }

  if (milestone === 'DAY_1_ANALYSIS') {
    const missing = current.progress_items.filter((i) => !i.done)
    return {
      ...base,
      kind: 'analysis',
      current_score: current.score.total,
      completed_items: current.progress_items.filter((i) => i.done).map((i) => i.label),
      missing_items: missing.map((i) => i.label),
      top_actions: remainingActions(current).slice(0, 3),
    }
  }

  if (milestone === 'DAY_2_MARKETING_PACK') {
    return {
      ...base,
      kind: 'marketing_pack_recommendation',
      marketing_pack_available: true,
      packs_generated: current.packs_generated,
      packs_remaining: current.packs_remaining,
      pack_limit: CUSTOMER_PACK_PILOT_LIMIT,
      cooldown_ms: CUSTOMER_PACK_COOLDOWN_MS,
      recommendation:
        current.packs_remaining > 0
          ? 'Generate a Marketing Pack manually from Marketing & AI Growth when you are ready. Drafts only — nothing auto-posts.'
          : 'Pilot Marketing Pack generations for this trial are used. Review your existing pack drafts.',
    }
  }

  if (milestone === 'DAY_7_RECOMMENDATIONS' || milestone === 'DAY_21_RECOMMENDATIONS') {
    const improvements = baseline ? listingImprovements(baseline, current) : []
    return {
      ...base,
      kind: 'recommendations',
      current_score: current.score.total,
      baseline_score: baseline?.score.total ?? null,
      improvements_completed: improvements,
      remaining_opportunities: remainingActions(current),
      recommended_actions: remainingActions(current).slice(0, 3),
    }
  }

  if (milestone === 'DAY_14_MID_TRIAL_REPORT') {
    const baselineScore = baseline?.score.total ?? current.score.total
    return {
      ...base,
      kind: 'mid_trial_report',
      baseline_score: baselineScore,
      current_score: current.score.total,
      score_change: current.score.total - baselineScore,
      listing_improvements: baseline ? listingImprovements(baseline, current) : [],
      packs_generated: current.packs_generated,
      content_copy_events: current.content_copy_events,
      lead_count: current.listing_leads,
      remaining_actions: remainingActions(current),
      days_remaining: current.trial.days_remaining,
      causality_claimed: false,
      roi_claimed: false,
    }
  }

  if (milestone === 'DAY_25_UPGRADE_RECOMMENDATION') {
    return {
      ...base,
      kind: 'upgrade_recommendation',
      trial_nearing_completion: true,
      current_plan: String(current.business.plan || 'free').toLowerCase() || 'free',
      measurable_value: {
        listing_score: current.score.total,
        packs_generated: current.packs_generated,
        content_copy_events: current.content_copy_events,
        listing_leads: current.listing_leads,
        completed_listing_items: current.progress_items.filter((i) => i.done).length,
      },
      recommended_next_step: 'Review My Latino List plans to keep growing after the free trial.',
      view_plans: true,
      billing_path: '/pages/billing.html',
      checkout_created: false,
      charged: false,
      converted: false,
    }
  }

  if (milestone === 'DAY_28_ENDING_REMINDER') {
    return {
      ...base,
      kind: 'ending_reminder',
      trial_ending_soon: true,
      ends_at: current.trial.ends_at,
      days_remaining: current.trial.days_remaining,
      view_plans: true,
      billing_path: '/pages/billing.html',
      email_sent: false,
    }
  }

  // DAY_30_FINAL_REPORT
  const baselineScore = baseline?.score.total ?? current.score.total
  return {
    ...base,
    kind: 'final_report',
    baseline_score: baselineScore,
    final_score: current.score.total,
    score_change: current.score.total - baselineScore,
    listing_improvements: baseline ? listingImprovements(baseline, current) : [],
    packs_generated: current.packs_generated,
    content_copy_events: current.content_copy_events,
    lead_count: current.listing_leads,
    remaining_opportunities: remainingActions(current),
    trial_completed: true,
    view_plans: true,
    billing_path: '/pages/billing.html',
    charged: false,
    converted: false,
    extended: false,
    traffic_growth_claimed: false,
    google_rankings_claimed: false,
    social_engagement_claimed: false,
    campaign_attribution_claimed: false,
    roi_claimed: false,
  }
}

function asEventRow(raw: any): AutomationEventRow | null {
  if (!raw?.id || !raw.business_id || !raw.milestone || !raw.trial_started_at) return null
  const milestone = String(raw.milestone) as AutomationMilestone
  if (!AUTOMATION_MILESTONES.includes(milestone)) return null
  return {
    id: String(raw.id),
    business_id: String(raw.business_id),
    trial_started_at: String(raw.trial_started_at),
    milestone,
    status: String(raw.status || 'pending') as AutomationEventStatus,
    scheduled_for: String(raw.scheduled_for),
    executed_at: raw.executed_at ? String(raw.executed_at) : null,
    attempt_count: Math.max(0, Number(raw.attempt_count) || 0),
    last_error: raw.last_error ? String(raw.last_error) : null,
    result: raw.result && typeof raw.result === 'object' ? (raw.result as Record<string, unknown>) : null,
    created_at: raw.created_at ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at ? String(raw.updated_at) : undefined,
  }
}

export async function loadAutomationEvents(
  supabase: DbClient,
  businessId: string,
  trialStartedAt: string,
): Promise<AutomationEventRow[]> {
  const { data, error } = await supabase
    .from(AUTOMATION_EVENT_TABLE)
    .select(
      'id, business_id, trial_started_at, milestone, status, scheduled_for, executed_at, attempt_count, last_error, result, created_at, updated_at',
    )
    .eq('business_id', businessId)
    .eq('trial_started_at', trialStartedAt)

  if (error && isMissingTable(error)) {
    throw new MarketingAutomationError('unavailable', 'Marketing trial automation storage is not available.')
  }
  if (error) throw new MarketingAutomationError('failed', 'Could not load automation events.')
  return ((data || []) as unknown[])
    .map((row) => asEventRow(row))
    .filter((row): row is AutomationEventRow => !!row)
}

/**
 * Idempotent: insert missing milestone rows for this trial.
 * Never resets completed events, attempt_count, results, or executed_at.
 */
export async function ensureAutomationEvents(
  supabase: DbClient,
  trial: Pick<MarketingTrialRow, 'business_id' | 'started_at'>,
): Promise<AutomationEventRow[]> {
  if (!trial.business_id || !UUID_RE.test(trial.business_id)) {
    throw new MarketingAutomationError('failed', 'Invalid business id.')
  }
  const existing = await loadAutomationEvents(supabase, trial.business_id, trial.started_at)
  const have = new Set(existing.map((e) => e.milestone))

  for (const milestone of AUTOMATION_MILESTONES) {
    if (have.has(milestone)) continue
    const row = {
      business_id: trial.business_id,
      trial_started_at: trial.started_at,
      milestone,
      status: 'pending' as const,
      scheduled_for: milestoneScheduledFor(trial.started_at, milestone),
      executed_at: null,
      attempt_count: 0,
      last_error: null,
      result: null,
    }
    const { error } = await supabase.from(AUTOMATION_EVENT_TABLE).insert(row)
    if (error && isMissingTable(error)) {
      throw new MarketingAutomationError('unavailable', 'Marketing trial automation storage is not available.')
    }
    if (error && !isUniqueConflict(error)) {
      throw new MarketingAutomationError('failed', 'Could not initialize automation events.')
    }
  }

  return loadAutomationEvents(supabase, trial.business_id, trial.started_at)
}

export async function skipFutureAutomationEvents(
  supabase: DbClient,
  events: AutomationEventRow[],
  now = Date.now(),
): Promise<AutomationEventRow[]> {
  const nowIso = new Date(now).toISOString()
  for (const event of events) {
    if (event.status === 'completed' || event.status === 'skipped') continue
    const { error } = await supabase
      .from(AUTOMATION_EVENT_TABLE)
      .update({
        status: 'skipped',
        executed_at: nowIso,
        updated_at: nowIso,
        last_error: null,
      })
      .eq('id', event.id)
      .neq('status', 'completed')
    if (error && isMissingTable(error)) {
      throw new MarketingAutomationError('unavailable', 'Marketing trial automation storage is not available.')
    }
    if (error) throw new MarketingAutomationError('failed', 'Could not skip automation events.')
  }
  if (!events.length) return events
  return loadAutomationEvents(supabase, events[0].business_id, events[0].trial_started_at)
}

/**
 * Atomically claim a due event for processing.
 * Returns null if another worker won the race or the event is not claimable.
 */
export async function claimAutomationEvent(
  supabase: DbClient,
  event: AutomationEventRow,
  now = Date.now(),
): Promise<AutomationEventRow | null> {
  if (event.status === 'completed' || event.status === 'skipped') return null
  if (event.attempt_count >= AUTOMATION_MAX_ATTEMPTS && event.status === 'failed') return null
  if (!isMilestoneDue(event.scheduled_for, now)) return null

  const nowIso = new Date(now).toISOString()
  const nextAttempt = event.attempt_count + 1
  if (nextAttempt > AUTOMATION_MAX_ATTEMPTS) return null

  const staleCutoff = new Date(now - AUTOMATION_STALE_PROCESSING_MS).toISOString()

  // Prefer pending / retryable failed
  if (event.status === 'pending' || event.status === 'failed') {
    const { data, error } = await supabase
      .from(AUTOMATION_EVENT_TABLE)
      .update({
        status: 'processing',
        attempt_count: nextAttempt,
        updated_at: nowIso,
        last_error: null,
      })
      .eq('id', event.id)
      .eq('status', event.status)
      .eq('attempt_count', event.attempt_count)
      .select(
        'id, business_id, trial_started_at, milestone, status, scheduled_for, executed_at, attempt_count, last_error, result, created_at, updated_at',
      )
      .maybeSingle()

    if (error && isMissingTable(error)) {
      throw new MarketingAutomationError('unavailable', 'Marketing trial automation storage is not available.')
    }
    if (error) throw new MarketingAutomationError('failed', 'Could not claim automation event.')
    return asEventRow(data)
  }

  // Stale processing reclaim
  if (event.status === 'processing') {
    const updatedAt = event.updated_at ? Date.parse(event.updated_at) : NaN
    if (!Number.isFinite(updatedAt) || now - updatedAt < AUTOMATION_STALE_PROCESSING_MS) return null
    if (event.attempt_count >= AUTOMATION_MAX_ATTEMPTS) return null

    const { data, error } = await supabase
      .from(AUTOMATION_EVENT_TABLE)
      .update({
        status: 'processing',
        attempt_count: nextAttempt,
        updated_at: nowIso,
        last_error: null,
      })
      .eq('id', event.id)
      .eq('status', 'processing')
      .lte('updated_at', staleCutoff)
      .eq('attempt_count', event.attempt_count)
      .select(
        'id, business_id, trial_started_at, milestone, status, scheduled_for, executed_at, attempt_count, last_error, result, created_at, updated_at',
      )
      .maybeSingle()

    if (error && isMissingTable(error)) {
      throw new MarketingAutomationError('unavailable', 'Marketing trial automation storage is not available.')
    }
    if (error) throw new MarketingAutomationError('failed', 'Could not reclaim automation event.')
    return asEventRow(data)
  }

  return null
}

export async function completeAutomationEvent(
  supabase: DbClient,
  eventId: string,
  result: Record<string, unknown>,
  now = Date.now(),
): Promise<void> {
  const nowIso = new Date(now).toISOString()
  const { error } = await supabase
    .from(AUTOMATION_EVENT_TABLE)
    .update({
      status: 'completed',
      result,
      executed_at: nowIso,
      updated_at: nowIso,
      last_error: null,
    })
    .eq('id', eventId)
    .eq('status', 'processing')
  if (error && isMissingTable(error)) {
    throw new MarketingAutomationError('unavailable', 'Marketing trial automation storage is not available.')
  }
  if (error) throw new MarketingAutomationError('failed', 'Could not complete automation event.')
}

export async function failAutomationEvent(
  supabase: DbClient,
  event: AutomationEventRow,
  err: unknown,
  now = Date.now(),
): Promise<void> {
  const nowIso = new Date(now).toISOString()
  const attempts = Math.max(event.attempt_count, 1)
  const terminal = attempts >= AUTOMATION_MAX_ATTEMPTS
  const { error } = await supabase
    .from(AUTOMATION_EVENT_TABLE)
    .update({
      status: terminal ? 'failed' : 'pending',
      last_error: sanitizeError(err),
      updated_at: nowIso,
      executed_at: terminal ? nowIso : null,
    })
    .eq('id', event.id)
    .eq('status', 'processing')
  if (error && isMissingTable(error)) {
    throw new MarketingAutomationError('unavailable', 'Marketing trial automation storage is not available.')
  }
  if (error) throw new MarketingAutomationError('failed', 'Could not record automation failure.')
}

async function loadTrial(supabase: DbClient, businessId: string): Promise<MarketingTrialRow | null> {
  const { data, error } = await supabase
    .from('marketing_trials')
    .select('business_id, started_at, ends_at, status')
    .eq('business_id', businessId)
    .maybeSingle()
  if (error && isMissingTable(error)) {
    throw new MarketingAutomationError('unavailable', 'Marketing trial storage is not available.')
  }
  if (error) throw new MarketingAutomationError('failed', 'Could not load marketing trial.')
  if (!data?.business_id || !data.started_at || !data.ends_at) return null
  return {
    business_id: String(data.business_id),
    started_at: String(data.started_at),
    ends_at: String(data.ends_at),
    status: String(data.status || 'active'),
  }
}

async function loadBusiness(supabase: DbClient, businessId: string): Promise<PilotBusiness | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, slug, category, description, website, phone, email, address, city, state, zip, tags, social_links, plan, status')
    .eq('id', businessId)
    .maybeSingle()
  if (error) throw new MarketingAutomationError('failed', 'Could not load business.')
  if (!data?.id) return null
  return {
    id: String(data.id),
    name: String(data.name ?? ''),
    slug: (data.slug as string | null) ?? null,
    category: (data.category as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    website: (data.website as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    address: (data.address as string | null) ?? null,
    city: (data.city as string | null) ?? null,
    state: (data.state as string | null) ?? null,
    zip: (data.zip as string | null) ?? null,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : null,
    social_links: (data.social_links as Record<string, string> | null) ?? null,
    plan: (data.plan as string | null) ?? null,
    status: (data.status as string | null) ?? null,
  }
}

async function loadPackUsage(supabase: DbClient, businessId: string): Promise<PackUsageSnapshot> {
  const { data, error } = await supabase
    .from('customer_marketing_packs')
    .select('packs_generated, content_copy_events, last_pack_generated_at')
    .eq('business_id', businessId)
    .maybeSingle()
  if (error && isMissingTable(error)) {
    return { packs_generated: 0, content_copy_events: 0, last_pack_generated_at: null }
  }
  if (error) throw new MarketingAutomationError('failed', 'Could not load pack usage.')
  return {
    packs_generated: Math.max(0, Number(data?.packs_generated) || 0),
    content_copy_events: Math.max(0, Number(data?.content_copy_events) || 0),
    last_pack_generated_at: data?.last_pack_generated_at ? String(data.last_pack_generated_at) : null,
  }
}

async function loadLeadCount(supabase: DbClient, businessId: string): Promise<number> {
  const { count, error } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
  if (error) return 0
  return typeof count === 'number' ? count : 0
}

function baselineFromEvents(events: AutomationEventRow[]): TrialStateSnapshot | null {
  const day0 = events.find((e) => e.milestone === 'DAY_0_BASELINE' && e.status === 'completed' && e.result)
  if (!day0?.result) return null
  return day0.result as unknown as TrialStateSnapshot
}

export type ProcessBusinessAutomationResult = {
  business_id: string
  processed: number
  skipped: number
  failed: number
  status: MarketingTrialStatus | 'missing_trial' | 'not_allowed'
}

/**
 * Process due automation milestones for one allowlisted business.
 * Deterministic only — never calls Workers AI, Stripe, Resend, or pack generation.
 */
export async function processBusinessAutomation(
  supabase: DbClient,
  automationFlagRaw: string | null | undefined,
  businessId: string,
  now = Date.now(),
): Promise<ProcessBusinessAutomationResult> {
  if (!isAutomationBusinessId(automationFlagRaw, businessId)) {
    return { business_id: businessId, processed: 0, skipped: 0, failed: 0, status: 'not_allowed' }
  }

  const trial = await loadTrial(supabase, businessId)
  if (!trial) {
    return { business_id: businessId, processed: 0, skipped: 0, failed: 0, status: 'missing_trial' }
  }

  let events = await ensureAutomationEvents(supabase, trial)
  const trialStatus = deriveTrialStatus(trial, now)

  if (trialStatus === 'cancelled' || trialStatus === 'converted') {
    events = await skipFutureAutomationEvents(supabase, events, now)
    return { business_id: businessId, processed: 0, skipped: events.filter((e) => e.status === 'skipped').length, failed: 0, status: trialStatus }
  }

  // active or expired — expired may still complete Day 30
  const business = await loadBusiness(supabase, businessId)
  if (!business) {
    return { business_id: businessId, processed: 0, skipped: 0, failed: 0, status: trialStatus }
  }

  let processed = 0
  let failed = 0
  const pack = await loadPackUsage(supabase, businessId)
  const leadCount = await loadLeadCount(supabase, businessId)
  const current = buildTrialStateSnapshot({ business, trial, pack, leadCount, now })
  let baseline = baselineFromEvents(events)

  // Process in milestone order. Expired trials may still complete Day 30 (and any due catch-up).
  const ordered = [...events].sort(
    (a, b) => MILESTONE_DAY_OFFSET[a.milestone] - MILESTONE_DAY_OFFSET[b.milestone],
  )

  for (const event of ordered) {
    if (event.status === 'completed' || event.status === 'skipped') continue
    if (!isMilestoneDue(event.scheduled_for, now)) continue

    const claimed = await claimAutomationEvent(supabase, event, now)
    if (!claimed) continue

    try {
      const result = buildMilestoneResult(claimed.milestone, current, baseline)
      // Hard guarantees for V1
      result.ai_calls = 0
      result.email_sent = false
      result.stripe_called = false
      result.pack_generated = false
      await completeAutomationEvent(supabase, claimed.id, result, now)
      processed += 1
      if (claimed.milestone === 'DAY_0_BASELINE') {
        events = await loadAutomationEvents(supabase, businessId, trial.started_at)
        baseline = baselineFromEvents(events)
      }
    } catch (err) {
      await failAutomationEvent(supabase, claimed, err, now)
      failed += 1
    }
  }

  return { business_id: businessId, processed, skipped: 0, failed, status: trialStatus }
}

/**
 * Future cron entrypoint. Not wired to cron.ts in Phase A+B.
 * Empty/unset allowlist = automation OFF.
 */
export async function processMarketingTrialAutomation(
  supabase: DbClient,
  automationFlagRaw: string | null | undefined,
  now = Date.now(),
): Promise<{ allowlist_size: number; results: ProcessBusinessAutomationResult[] }> {
  const allowlist = [...parseAutomationBusinessIds(automationFlagRaw)]
  if (!allowlist.length) {
    return { allowlist_size: 0, results: [] }
  }
  const results: ProcessBusinessAutomationResult[] = []
  for (const businessId of allowlist) {
    results.push(await processBusinessAutomation(supabase, automationFlagRaw, businessId, now))
  }
  return { allowlist_size: allowlist.length, results }
}
