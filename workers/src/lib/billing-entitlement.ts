/**
 * Server-side paid entitlement + checkout state machine.
 * Paid plans activate only from verified Stripe subscription state — never URL/client hints.
 */

import {
  planFromStripePriceId,
  primaryPriceIdFromSubscription,
  shouldPreservePaidAccess,
  shouldTerminatePaidAccess,
  type PaidPlan,
  type StripeSubscriptionLike,
  PAID_PLAN_SET,
} from './stripe-billing-sync'

export type BillingState =
  | 'FREE'
  | 'CHECKOUT_PENDING'
  | 'PAID_ACTIVE'
  | 'PAID_CANCEL_AT_PERIOD_END'
  | 'PAST_DUE'
  | 'TERMINATED'

export type SafeBillingStatus = {
  plan: string
  subscription_status: string | null
  billing_state: BillingState
  cancel_at_period_end: boolean
  current_period_end: string | null
  confirmation_pending: boolean
  is_paid: boolean
}

export function isPaidPlan(plan: string | null | undefined): boolean {
  return PAID_PLAN_SET.has(String(plan || '').toLowerCase())
}

/** Authoritative customer entitlement from DB plan only (after sync). */
export function resolveEntitlementFromPlan(plan: string | null | undefined): {
  plan: string
  is_paid: boolean
} {
  const normalized = String(plan || 'free').toLowerCase() || 'free'
  if (normalized === 'admin') return { plan: 'admin', is_paid: false }
  if (isPaidPlan(normalized)) return { plan: normalized, is_paid: true }
  return { plan: 'free', is_paid: false }
}

export function deriveBillingState(opts: {
  plan: string | null | undefined
  subscription_status?: string | null
  cancel_at_period_end?: boolean | null
  confirmation_pending?: boolean
}): BillingState {
  const plan = String(opts.plan || 'free').toLowerCase()
  const status = String(opts.subscription_status || '').toLowerCase()
  const cancelAtPeriodEnd = !!opts.cancel_at_period_end

  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    return 'TERMINATED'
  }
  if (status === 'past_due' && isPaidPlan(plan)) return 'PAST_DUE'
  if ((status === 'active' || status === 'trialing') && cancelAtPeriodEnd && isPaidPlan(plan)) {
    return 'PAID_CANCEL_AT_PERIOD_END'
  }
  if ((status === 'active' || status === 'trialing') && isPaidPlan(plan)) return 'PAID_ACTIVE'
  if (isPaidPlan(plan)) return 'PAID_ACTIVE'
  if (opts.confirmation_pending) return 'CHECKOUT_PENDING'
  return 'FREE'
}

export function buildSafeBillingStatus(opts: {
  plan: string | null | undefined
  subscription_status?: string | null
  cancel_at_period_end?: boolean | null
  current_period_end?: string | null
  confirmation_pending?: boolean
}): SafeBillingStatus {
  const entitlement = resolveEntitlementFromPlan(opts.plan)
  const confirmation_pending = !!opts.confirmation_pending && !entitlement.is_paid
  return {
    plan: entitlement.plan,
    subscription_status: opts.subscription_status ? String(opts.subscription_status) : null,
    billing_state: deriveBillingState({
      plan: entitlement.plan,
      subscription_status: opts.subscription_status,
      cancel_at_period_end: opts.cancel_at_period_end,
      confirmation_pending,
    }),
    cancel_at_period_end: !!opts.cancel_at_period_end,
    current_period_end: opts.current_period_end || null,
    confirmation_pending,
    is_paid: entitlement.is_paid,
  }
}

/** Activation gate: subscription checkout + paid + known price + valid business context. */
export function canActivatePaidSubscription(opts: {
  checkoutMode?: string | null
  paymentStatus?: string | null
  sessionStatus?: string | null
  businessId?: string | null
  businessExists?: boolean
  subscription?: StripeSubscriptionLike | null
  expectedCustomerId?: string | null
}): { ok: true; plan: PaidPlan; price_id: string } | { ok: false; reason: string } {
  const mode = String(opts.checkoutMode || 'subscription').toLowerCase()
  if (mode && mode !== 'subscription') {
    return { ok: false, reason: 'checkout_mode_not_subscription' }
  }

  const payment = String(opts.paymentStatus || '').toLowerCase()
  if (payment && payment !== 'paid' && payment !== 'no_payment_required') {
    return { ok: false, reason: 'payment_not_completed' }
  }

  const businessId = String(opts.businessId || '').trim()
  if (!businessId) return { ok: false, reason: 'missing_business_id' }
  if (opts.businessExists === false) return { ok: false, reason: 'business_not_found' }

  const sub = opts.subscription
  if (!sub?.id) return { ok: false, reason: 'missing_subscription' }

  if (shouldTerminatePaidAccess(sub)) {
    return { ok: false, reason: 'subscription_not_active' }
  }
  if (!shouldPreservePaidAccess(sub) && String(sub.status || '').toLowerCase() !== 'incomplete') {
    // incomplete may complete via invoice; do not activate yet
    if (String(sub.status || '').toLowerCase() !== 'active' && String(sub.status || '').toLowerCase() !== 'trialing') {
      return { ok: false, reason: 'subscription_not_qualifying' }
    }
  }

  const priceId = primaryPriceIdFromSubscription(sub)
  if (!priceId) return { ok: false, reason: 'missing_stripe_price' }
  const plan = planFromStripePriceId(priceId)
  if (!plan) return { ok: false, reason: 'unknown_stripe_price' }

  if (opts.expectedCustomerId && sub.customer && String(sub.customer) !== String(opts.expectedCustomerId)) {
    return { ok: false, reason: 'customer_mismatch' }
  }

  return { ok: true, plan, price_id: priceId }
}

export function logBillingEvent(
  event:
    | 'billing_sync_success'
    | 'billing_sync_pending'
    | 'billing_sync_repaired'
    | 'billing_sync_failed'
    | 'unknown_price'
    | 'subscription_terminated',
  fields: Record<string, unknown>,
): void {
  const safe: Record<string, unknown> = { event }
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'secret' || /key|token|card|payment_method/i.test(k)) continue
    if (typeof v === 'string' && v.length > 200) continue
    safe[k] = v
  }
  console.log(JSON.stringify(safe))
}
