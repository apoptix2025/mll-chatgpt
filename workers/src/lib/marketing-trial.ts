const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY_MS = 24 * 60 * 60 * 1000

/** Duration used only when writing ends_at on first activation. Days remaining is derived from ends_at. */
export const MARKETING_TRIAL_DURATION_DAYS = 30
export const MARKETING_TRIAL_DURATION_MS = MARKETING_TRIAL_DURATION_DAYS * DAY_MS

export type MarketingTrialStatus = 'active' | 'expired' | 'cancelled' | 'converted'

export type MarketingTrialRow = {
  business_id: string
  started_at: string
  ends_at: string
  status: string
}

export type MarketingTrialView = {
  title: '30-Day Free Growth Trial'
  status: MarketingTrialStatus
  started_at: string
  ends_at: string
  days_remaining: number
}

export class MarketingTrialStorageError extends Error {
  readonly code: 'unavailable' | 'failed'
  constructor(code: 'unavailable' | 'failed', message: string) {
    super(message)
    this.name = 'MarketingTrialStorageError'
    this.code = code
  }
}

type TrialClient = {
  from: (table: string) => any
}

export function trialEndsAt(startedAtMs: number): number {
  return startedAtMs + MARKETING_TRIAL_DURATION_MS
}

export function daysRemainingFromEnd(endsAt: string, now = Date.now()): number {
  const endMs = Date.parse(endsAt)
  if (!Number.isFinite(endMs) || now >= endMs) return 0
  return Math.max(0, Math.ceil((endMs - now) / DAY_MS))
}

export function deriveTrialStatus(row: MarketingTrialRow, now = Date.now()): MarketingTrialStatus {
  const stored = String(row.status || '').toLowerCase()
  if (stored === 'cancelled' || stored === 'converted') return stored
  const endMs = Date.parse(row.ends_at)
  if (!Number.isFinite(endMs) || now >= endMs) return 'expired'
  return 'active'
}

export function presentMarketingTrial(row: MarketingTrialRow, now = Date.now()): MarketingTrialView {
  const status = deriveTrialStatus(row, now)
  return {
    title: '30-Day Free Growth Trial',
    status,
    started_at: row.started_at,
    ends_at: row.ends_at,
    days_remaining: status === 'active' ? daysRemainingFromEnd(row.ends_at, now) : 0,
  }
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01' || code === 'PGRST205' || (message.includes('marketing_trials') && message.includes('schema cache'))
}

function isUniqueConflict(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || '')
  return code === '23505' || code === '409'
}

async function loadMarketingTrial(supabase: TrialClient, businessId: string): Promise<MarketingTrialRow | null> {
  const { data, error } = await supabase
    .from('marketing_trials')
    .select('business_id, started_at, ends_at, status')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error && isMissingTable(error)) {
    throw new MarketingTrialStorageError('unavailable', 'Marketing trial storage is not available.')
  }
  if (error) {
    throw new MarketingTrialStorageError('failed', 'Could not load marketing trial.')
  }
  if (!data?.business_id || !data.started_at || !data.ends_at) return null
  return {
    business_id: String(data.business_id),
    started_at: String(data.started_at),
    ends_at: String(data.ends_at),
    status: String(data.status || 'active'),
  }
}

/**
 * Idempotent marketing trial activation.
 * First call stores started_at / ends_at.
 * Later calls, refreshes, logins, and deploys must not change started_at.
 * Does not use account, business, or profile created_at.
 */
export async function activateMarketingTrial(
  supabase: TrialClient,
  businessId: string,
  now = Date.now(),
): Promise<MarketingTrialRow> {
  if (!businessId || !UUID_RE.test(businessId)) {
    throw new MarketingTrialStorageError('failed', 'Invalid business id.')
  }

  const existing = await loadMarketingTrial(supabase, businessId)
  if (existing) return existing

  const startedAt = new Date(now).toISOString()
  const endsAt = new Date(trialEndsAt(now)).toISOString()
  const { error } = await supabase.from('marketing_trials').insert({
    business_id: businessId,
    started_at: startedAt,
    ends_at: endsAt,
    status: 'active',
  })

  if (error && isMissingTable(error)) {
    throw new MarketingTrialStorageError('unavailable', 'Marketing trial storage is not available.')
  }
  if (error && !isUniqueConflict(error)) {
    throw new MarketingTrialStorageError('failed', 'Could not activate marketing trial.')
  }

  const row = await loadMarketingTrial(supabase, businessId)
  if (!row) {
    throw new MarketingTrialStorageError('failed', 'Could not activate marketing trial.')
  }
  return row
}
