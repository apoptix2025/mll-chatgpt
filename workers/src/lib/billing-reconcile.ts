/**
 * Bounded Stripe → MLL billing reconciliation.
 * Repairs only when Stripe subscription evidence is verified and business association is deterministic.
 * Never manufactures subscriptions. Never upgrades from checkout URL/selection alone.
 */

import {
  applyPaidPlanToBusiness,
  planFromStripePriceId,
  primaryPriceIdFromSubscription,
  shouldPreservePaidAccess,
  shouldTerminatePaidAccess,
  syncCheckoutSessionCompleted,
  upsertSubscriptionLedger,
  type CheckoutSessionLike,
  type StripeSubscriptionLike,
  type SyncResult,
} from './stripe-billing-sync'
import { isPaidPlan, logBillingEvent } from './billing-entitlement'

type DbClient = { from: (table: string) => any }

export type ConsistencyIssue = {
  code:
    | 'db_paid_stripe_missing'
    | 'stripe_active_db_free'
    | 'wrong_plan_for_price'
    | 'missing_ledger'
    | 'subscription_id_mismatch'
  business_id: string
  details?: Record<string, unknown>
}

export type ReconcileSummary = {
  scanned: number
  repaired: number
  failed: number
  skipped: number
  issues: ConsistencyIssue[]
}

function tsFromUnix(sec: number | null | undefined): string | null {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null
  return new Date(sec * 1000).toISOString()
}

export async function stripeGetJson(
  secretKey: string,
  path: string,
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

/** Detect local consistency issues without calling Stripe. */
export function detectLocalConsistencyIssues(row: {
  business_id: string
  plan: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  ledger?: {
    stripe_subscription_id: string | null
    plan: string | null
    status: string | null
  } | null
}): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = []
  const plan = String(row.plan || 'free').toLowerCase()
  const paid = isPaidPlan(plan)

  if (paid && !row.stripe_subscription_id) {
    issues.push({ code: 'db_paid_stripe_missing', business_id: row.business_id })
  }
  if (row.stripe_subscription_id && !row.ledger) {
    issues.push({ code: 'missing_ledger', business_id: row.business_id })
  }
  if (
    row.stripe_subscription_id
    && row.ledger?.stripe_subscription_id
    && row.ledger.stripe_subscription_id !== row.stripe_subscription_id
  ) {
    issues.push({
      code: 'subscription_id_mismatch',
      business_id: row.business_id,
      details: { detected: true },
    })
  }
  if (
    row.ledger?.plan
    && isPaidPlan(plan)
    && String(row.ledger.plan).toLowerCase() !== plan
  ) {
    issues.push({
      code: 'wrong_plan_for_price',
      business_id: row.business_id,
      details: { db_plan: plan, ledger_plan: row.ledger.plan },
    })
  }
  return issues
}

export async function reconcileBusinessFromSubscription(
  supabase: DbClient,
  sub: StripeSubscriptionLike,
  opts?: { business_id?: string },
): Promise<SyncResult & { repaired?: boolean }> {
  const subscriptionId = sub.id ? String(sub.id) : ''
  if (!subscriptionId) {
    return { ok: false, action: 'reconcile', reason: 'missing_subscription_id' }
  }

  const customerId = sub.customer ? String(sub.customer) : null
  let businessId = opts?.business_id ? String(opts.business_id) : null

  if (!businessId) {
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle()
    if (data?.id) businessId = String(data.id)
  }
  if (!businessId && customerId) {
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (data?.id) businessId = String(data.id)
  }
  if (!businessId && sub.metadata?.business_id) {
    businessId = String(sub.metadata.business_id)
  }
  if (!businessId) {
    return { ok: false, action: 'reconcile', reason: 'business_not_found' }
  }

  const { data: biz } = await supabase
    .from('businesses')
    .select('id, plan, stripe_customer_id, stripe_subscription_id')
    .eq('id', businessId)
    .maybeSingle()
  if (!biz?.id) {
    return { ok: false, action: 'reconcile', reason: 'business_not_found' }
  }

  if (
    biz.stripe_subscription_id
    && biz.stripe_subscription_id !== subscriptionId
    && shouldPreservePaidAccess(sub)
  ) {
    logBillingEvent('billing_sync_failed', {
      business_id: businessId,
      reason: 'subscription_id_mismatch',
    })
    return {
      ok: false,
      action: 'reconcile',
      reason: 'subscription_id_mismatch',
      details: { business_id: businessId },
    }
  }

  if (shouldTerminatePaidAccess(sub)) {
    const wasPaid = isPaidPlan(biz.plan)
    await supabase
      .from('businesses')
      .update({ plan: 'free', updated_at: new Date().toISOString() })
      .eq('id', businessId)
    await upsertSubscriptionLedger(supabase, {
      business_id: businessId,
      plan: 'free',
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      status: String(sub.status || 'canceled'),
      current_period_start: tsFromUnix(sub.current_period_start),
      current_period_end: tsFromUnix(sub.current_period_end),
    })
    logBillingEvent('subscription_terminated', { business_id: businessId, plan: 'free' })
    return {
      ok: true,
      action: 'reconcile',
      business_id: businessId,
      plan: 'free',
      repaired: wasPaid,
      details: { terminated: true },
    }
  }

  if (!shouldPreservePaidAccess(sub)) {
    return {
      ok: false,
      action: 'reconcile',
      reason: 'subscription_not_qualifying',
      details: { status: sub.status || null, business_id: businessId },
    }
  }

  const priceId = primaryPriceIdFromSubscription(sub)
  if (!priceId) {
    return { ok: false, action: 'reconcile', reason: 'missing_stripe_price', details: { business_id: businessId } }
  }
  const plan = planFromStripePriceId(priceId)
  if (!plan) {
    logBillingEvent('unknown_price', { business_id: businessId, price_id: priceId })
    return {
      ok: false,
      action: 'reconcile',
      reason: 'unknown_stripe_price',
      details: { price_id: priceId, business_id: businessId },
    }
  }

  const needsRepair =
    String(biz.plan || '').toLowerCase() !== plan
    || biz.stripe_subscription_id !== subscriptionId
    || (!!customerId && biz.stripe_customer_id !== customerId)

  await applyPaidPlanToBusiness(supabase, {
    business_id: businessId,
    plan,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
  })
  await upsertSubscriptionLedger(supabase, {
    business_id: businessId,
    plan,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    status: String(sub.status || 'active'),
    current_period_start: tsFromUnix(sub.current_period_start),
    current_period_end: tsFromUnix(sub.current_period_end),
  })

  if (needsRepair) {
    logBillingEvent('billing_sync_repaired', {
      business_id: businessId,
      plan,
      status: sub.status || null,
    })
  } else {
    logBillingEvent('billing_sync_success', {
      business_id: businessId,
      plan,
      status: sub.status || null,
    })
  }

  return {
    ok: true,
    action: 'reconcile',
    business_id: businessId,
    plan,
    repaired: needsRepair,
  }
}

/** Confirm a completed Checkout Session for an authenticated business only. */
export async function confirmCheckoutSessionForBusiness(
  supabase: DbClient,
  opts: {
    secretKey: string
    businessId: string
    sessionId: string
  },
): Promise<SyncResult> {
  const sessionId = String(opts.sessionId || '').trim()
  if (!sessionId.startsWith('cs_')) {
    return { ok: false, action: 'confirm_checkout', reason: 'invalid_session_id' }
  }

  const fetched = await stripeGetJson(opts.secretKey, `/checkout/sessions/${sessionId}`)
  if (!fetched.ok) {
    return { ok: false, action: 'confirm_checkout', reason: 'session_fetch_failed' }
  }
  const session = fetched.body as CheckoutSessionLike
  const metaBiz = String(session.metadata?.business_id || '').trim()
  if (!metaBiz || metaBiz !== opts.businessId) {
    logBillingEvent('billing_sync_failed', {
      business_id: opts.businessId,
      reason: 'wrong_business_metadata',
    })
    return { ok: false, action: 'confirm_checkout', reason: 'wrong_business_metadata' }
  }

  let subscription: StripeSubscriptionLike | null = null
  const subId = session.subscription ? String(session.subscription) : ''
  if (subId) {
    const subRes = await stripeGetJson(opts.secretKey, `/subscriptions/${subId}`)
    if (subRes.ok) subscription = subRes.body as StripeSubscriptionLike
    else subscription = { id: subId, customer: session.customer, status: 'active' }
  }

  const result = await syncCheckoutSessionCompleted(supabase, session, subscription)
  if (result.ok) {
    logBillingEvent('billing_sync_repaired', {
      business_id: result.business_id,
      plan: result.plan,
      via: 'confirm_checkout',
    })
  } else if (result.reason === 'payment_not_completed') {
    logBillingEvent('billing_sync_pending', {
      business_id: opts.businessId,
      reason: result.reason,
    })
  } else {
    logBillingEvent('billing_sync_failed', {
      business_id: opts.businessId,
      reason: result.reason,
    })
  }
  return result
}

/**
 * Daily reconciler: only businesses with known Stripe customer/subscription IDs.
 * Bounded scan — never enumerates unrelated Stripe customers.
 */
export async function runBillingReconciliation(
  supabase: DbClient,
  secretKey: string,
  opts?: { limit?: number },
): Promise<ReconcileSummary> {
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100)
  const summary: ReconcileSummary = {
    scanned: 0,
    repaired: 0,
    failed: 0,
    skipped: 0,
    issues: [],
  }

  if (!secretKey) {
    summary.skipped = 1
    return summary
  }

  const { data: rows } = await supabase
    .from('businesses')
    .select('id, plan, stripe_customer_id, stripe_subscription_id')
    .or('stripe_subscription_id.not.is.null,stripe_customer_id.not.is.null')
    .neq('plan', 'admin')
    .limit(limit)

  const businesses = Array.isArray(rows) ? rows : []

  for (const biz of businesses) {
    summary.scanned += 1
    const businessId = String(biz.id)
    const subId = biz.stripe_subscription_id ? String(biz.stripe_subscription_id) : ''
    const custId = biz.stripe_customer_id ? String(biz.stripe_customer_id) : ''

    const { data: ledger } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, plan, status')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    summary.issues.push(
      ...detectLocalConsistencyIssues({
        business_id: businessId,
        plan: biz.plan,
        stripe_subscription_id: biz.stripe_subscription_id,
        stripe_customer_id: biz.stripe_customer_id,
        ledger: ledger || null,
      }),
    )

    let sub: StripeSubscriptionLike | null = null
    if (subId) {
      const res = await stripeGetJson(secretKey, `/subscriptions/${subId}`)
      if (res.ok) sub = res.body as StripeSubscriptionLike
    } else if (custId) {
      const res = await stripeGetJson(
        secretKey,
        `/subscriptions?customer=${encodeURIComponent(custId)}&status=all&limit=5`,
      )
      const list = Array.isArray(res.body?.data) ? res.body.data : []
      sub =
        list.find((s: StripeSubscriptionLike) => shouldPreservePaidAccess(s))
        || list[0]
        || null
      // Only use list entry when metadata.business_id matches or single deterministic customer link
      if (sub && sub.metadata?.business_id && String(sub.metadata.business_id) !== businessId) {
        summary.failed += 1
        logBillingEvent('billing_sync_failed', {
          business_id: businessId,
          reason: 'wrong_business_metadata',
        })
        continue
      }
    }

    if (!sub?.id) {
      if (isPaidPlan(biz.plan)) {
        summary.issues.push({ code: 'db_paid_stripe_missing', business_id: businessId })
      }
      summary.skipped += 1
      continue
    }

    const result = await reconcileBusinessFromSubscription(supabase, sub, { business_id: businessId })
    if (result.ok && (result as any).repaired) summary.repaired += 1
    else if (result.ok) summary.skipped += 1
    else summary.failed += 1

    if (result.ok && isPaidPlan(result.plan) && String(biz.plan || '').toLowerCase() === 'free') {
      summary.issues.push({ code: 'stripe_active_db_free', business_id: businessId })
    }
  }

  return summary
}
