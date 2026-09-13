import {
  AUTOMATION_EVENT_TABLE,
  AUTOMATION_MILESTONES,
  MILESTONE_DAY_OFFSET,
  isMilestoneDue,
  type AutomationEventRow,
  type AutomationMilestone,
  MarketingAutomationError,
} from './marketing-trial-automation'
import {
  deriveTrialStatus,
  getMarketingTrial,
  MarketingTrialStorageError,
  presentMarketingTrial,
  type MarketingTrialRow,
  type MarketingTrialStatus,
  type MarketingTrialView,
} from './marketing-trial'

export type CustomerMilestoneUiStatus =
  | 'completed'
  | 'available'
  | 'upcoming'
  | 'in_progress'
  | 'unavailable'
  | 'skipped'

export const CUSTOMER_MILESTONE_LABELS: Record<AutomationMilestone, string> = {
  DAY_0_BASELINE: 'Starting Point',
  DAY_1_ANALYSIS: 'Business Profile Analysis',
  DAY_2_MARKETING_PACK: 'AI Marketing Pack',
  DAY_7_RECOMMENDATIONS: 'Week 1 Growth Recommendations',
  DAY_14_MID_TRIAL_REPORT: 'Mid-Trial Progress Report',
  DAY_21_RECOMMENDATIONS: 'Week 3 Growth Recommendations',
  DAY_25_UPGRADE_RECOMMENDATION: 'Continue Your Growth',
  DAY_28_ENDING_REMINDER: 'Trial Ending Soon',
  DAY_30_FINAL_REPORT: '30-Day Growth Report',
}

export const CUSTOMER_MILESTONE_BLURBS: Record<AutomationMilestone, string> = {
  DAY_0_BASELINE: 'Capture your listing starting point for the free growth trial.',
  DAY_1_ANALYSIS: 'Review grounded profile gaps and top listing improvements.',
  DAY_2_MARKETING_PACK: 'A Marketing Pack recommendation is ready when you want to generate one.',
  DAY_7_RECOMMENDATIONS: 'Compare progress from your starting point and next actions.',
  DAY_14_MID_TRIAL_REPORT: 'A mid-trial progress summary based on measurable listing data.',
  DAY_21_RECOMMENDATIONS: 'Refreshed grounded recommendations for the rest of your trial.',
  DAY_25_UPGRADE_RECOMMENDATION: 'Review plans if you want to keep growing after the trial.',
  DAY_28_ENDING_REMINDER: 'Your free growth trial is ending soon.',
  DAY_30_FINAL_REPORT: 'A final comparison of your 30-day growth trial.',
}

type DbClient = { from: (table: string) => any }

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (message.includes(AUTOMATION_EVENT_TABLE) && message.includes('schema cache'))
  )
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
    status: String(raw.status || 'pending') as AutomationEventRow['status'],
    scheduled_for: String(raw.scheduled_for),
    executed_at: raw.executed_at ? String(raw.executed_at) : null,
    attempt_count: Math.max(0, Number(raw.attempt_count) || 0),
    last_error: raw.last_error ? String(raw.last_error) : null,
    result: raw.result && typeof raw.result === 'object' ? (raw.result as Record<string, unknown>) : null,
    created_at: raw.created_at ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at ? String(raw.updated_at) : undefined,
  }
}

/** Read-only event load. Never inserts, updates, or claims. */
export async function loadAutomationEventsReadOnly(
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

export function mapCustomerMilestoneStatus(
  event: Pick<AutomationEventRow, 'status' | 'scheduled_for'>,
  now = Date.now(),
): CustomerMilestoneUiStatus {
  const status = String(event.status || '').toLowerCase()
  if (status === 'completed') return 'completed'
  if (status === 'skipped') return 'skipped'
  if (status === 'processing') return 'in_progress'
  if (status === 'failed') return 'unavailable'
  if (status === 'pending') {
    return isMilestoneDue(event.scheduled_for, now) ? 'available' : 'upcoming'
  }
  return 'upcoming'
}

/** Strip internal fields before returning result JSON to customers. */
export function sanitizeCustomerMilestoneResult(
  milestone: AutomationMilestone,
  result: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!result || typeof result !== 'object') return null
  const banned = new Set([
    'last_error',
    'attempt_count',
    'id',
    'business_id',
    'claim',
    'service_role',
    'model',
    'prompt',
    'raw',
  ])
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(result)) {
    if (banned.has(key)) continue
    if (key.endsWith('_error') || key.startsWith('internal_')) continue
    out[key] = value
  }
  out.milestone = milestone
  if (out.result_version == null) out.result_version = 1
  return out
}

export type CustomerAutomationMilestoneView = {
  code: AutomationMilestone
  day: number
  label: string
  blurb: string
  status: CustomerMilestoneUiStatus
  scheduled_for: string | null
  executed_at: string | null
  result: Record<string, unknown> | null
}

export type CustomerAutomationView = {
  enabled_for_customer_ui: true
  ready: boolean
  message: string | null
  trial_started_at: string | null
  trial_ends_at: string | null
  trial_status: MarketingTrialStatus | null
  days_remaining: number | null
  milestones: CustomerAutomationMilestoneView[]
  current_milestone: CustomerAutomationMilestoneView | null
  next_milestone: CustomerAutomationMilestoneView | null
  baseline: Record<string, unknown> | null
  latest_report: Record<string, unknown> | null
}

function emptyAutomationView(message: string, trial?: MarketingTrialView | null): CustomerAutomationView {
  return {
    enabled_for_customer_ui: true,
    ready: false,
    message,
    trial_started_at: trial?.started_at ?? null,
    trial_ends_at: trial?.ends_at ?? null,
    trial_status: trial?.status ?? null,
    days_remaining: trial?.days_remaining ?? null,
    milestones: [],
    current_milestone: null,
    next_milestone: null,
    baseline: null,
    latest_report: null,
  }
}

function pickCurrent(milestones: CustomerAutomationMilestoneView[]): CustomerAutomationMilestoneView | null {
  return (
    milestones.find((m) => m.status === 'in_progress') ||
    milestones.find((m) => m.status === 'available') ||
    null
  )
}

function pickNext(milestones: CustomerAutomationMilestoneView[]): CustomerAutomationMilestoneView | null {
  return milestones.find((m) => m.status === 'upcoming') || null
}

/**
 * Build customer-facing automation timeline.
 * READ ONLY — never creates events, never claims, never executes milestones.
 */
export async function buildCustomerAutomationView(
  supabase: DbClient,
  businessId: string,
  now = Date.now(),
): Promise<CustomerAutomationView> {
  let trial: MarketingTrialRow | null
  try {
    trial = await getMarketingTrial(supabase, businessId)
  } catch (err) {
    if (err instanceof MarketingTrialStorageError && err.code === 'unavailable') {
      return emptyAutomationView('Your marketing growth timeline will appear here as milestones are completed.')
    }
    throw err
  }

  if (!trial) {
    return emptyAutomationView('Your 30-Day Marketing Growth journey is ready to begin.')
  }

  const trialView = presentMarketingTrial(trial, now)
  let events: AutomationEventRow[]
  try {
    events = await loadAutomationEventsReadOnly(supabase, businessId, trial.started_at)
  } catch (err) {
    if (err instanceof MarketingAutomationError && err.code === 'unavailable') {
      return emptyAutomationView(
        'Your marketing growth timeline will appear here as milestones are completed.',
        trialView,
      )
    }
    throw err
  }

  if (!events.length) {
    return emptyAutomationView(
      'Your marketing growth timeline will appear here as milestones are completed.',
      trialView,
    )
  }

  const byCode = new Map(events.map((e) => [e.milestone, e]))
  const milestones: CustomerAutomationMilestoneView[] = AUTOMATION_MILESTONES.map((code) => {
    const event = byCode.get(code)
    if (!event) {
      return {
        code,
        day: MILESTONE_DAY_OFFSET[code],
        label: CUSTOMER_MILESTONE_LABELS[code],
        blurb: CUSTOMER_MILESTONE_BLURBS[code],
        status: 'upcoming' as const,
        scheduled_for: null,
        executed_at: null,
        result: null,
      }
    }
    return {
      code,
      day: MILESTONE_DAY_OFFSET[code],
      label: CUSTOMER_MILESTONE_LABELS[code],
      blurb: CUSTOMER_MILESTONE_BLURBS[code],
      status: mapCustomerMilestoneStatus(event, now),
      scheduled_for: event.scheduled_for,
      executed_at: event.executed_at,
      result: sanitizeCustomerMilestoneResult(code, event.result),
    }
  })

  // Trial lifecycle messaging for cancelled/converted
  let message: string | null = null
  const status = deriveTrialStatus(trial, now)
  if (status === 'cancelled') {
    message = 'This marketing growth trial was cancelled. Completed milestones remain available below.'
  } else if (status === 'converted') {
    message = 'Your listing continues on a paid plan. Completed trial milestones remain available below.'
  } else if (status === 'expired') {
    message = 'Your free Growth Trial is complete.'
  }

  const day0 = milestones.find((m) => m.code === 'DAY_0_BASELINE' && m.status === 'completed')
  const reports = milestones
    .filter((m) => m.status === 'completed' && m.result && (m.code === 'DAY_14_MID_TRIAL_REPORT' || m.code === 'DAY_30_FINAL_REPORT'))
    .sort((a, b) => a.day - b.day)
  const latest = reports[reports.length - 1] || milestones.filter((m) => m.status === 'completed' && m.result).slice(-1)[0]

  return {
    enabled_for_customer_ui: true,
    ready: true,
    message,
    trial_started_at: trialView.started_at,
    trial_ends_at: trialView.ends_at,
    trial_status: trialView.status,
    days_remaining: trialView.days_remaining,
    milestones,
    current_milestone: pickCurrent(milestones),
    next_milestone: pickNext(milestones),
    baseline: day0?.result ?? null,
    latest_report: latest?.result ?? null,
  }
}
