/**
 * Stripe → MLL billing sync helpers.
 * Authoritative entitlement remains businesses.plan after verified webhook processing.
 * Never trusts client-submitted plan values or URL flags.
 */

export const STRIPE_PRICE_IDS = {
  basic: 'price_1TP11Q3lF9K8v3zheYUShWhQ',
  pro: 'price_1TP15B3lF9K8v3zhBuK9PqyS',
  featured: 'price_1TP15p3lF9K8v3zhXVXS4MHM',
  agency: 'price_1TP16Q3lF9K8v3zhtR9LhB5k',
  basic_annual: 'price_1TP18S3lF9K8v3zh2dyoMazn',
  pro_annual: 'price_1TP1913lF9K8v3zhrfFmwRJQ',
  featured_annual: 'price_1TP19V3lF9K8v3zhPits88OX',
  agency_annual: 'price_1TP1A33lF9K8v3zhw2kTIwjd',
} as const

export type PaidPlan = 'basic' | 'pro' | 'featured' | 'agency'

const PRICE_TO_PLAN: Record<string, PaidPlan> = {
  [STRIPE_PRICE_IDS.basic]: 'basic',
  [STRIPE_PRICE_IDS.pro]: 'pro',
  [STRIPE_PRICE_IDS.featured]: 'featured',
  [STRIPE_PRICE_IDS.agency]: 'agency',
  [STRIPE_PRICE_IDS.basic_annual]: 'basic',
  [STRIPE_PRICE_IDS.pro_annual]: 'pro',
  [STRIPE_PRICE_IDS.featured_annual]: 'featured',
  [STRIPE_PRICE_IDS.agency_annual]: 'agency',
}

export const PAID_PLAN_SET = new Set<string>(['basic', 'pro', 'featured', 'agency'])
const PAID_PLANS = PAID_PLAN_SET

export type StripeSubscriptionLike = {
  id?: string | null
  customer?: string | null
  status?: string | null
  cancel_at_period_end?: boolean | null
  current_period_start?: number | null
  current_period_end?: number | null
  items?: { data?: Array<{ price?: { id?: string | null } | null }> } | null
  metadata?: Record<string, string | undefined> | null
}

export type CheckoutSessionLike = {
  id?: string | null
  mode?: string | null
  customer?: string | null
  subscription?: string | null
  payment_status?: string | null
  status?: string | null
  metadata?: Record<string, string | undefined> | null
}

export type SyncResult =
  | { ok: true; action: string; business_id: string; plan: string; details?: Record<string, unknown> }
  | { ok: false; action: string; reason: string; details?: Record<string, unknown> }

type DbClient = { from: (table: string) => any }

export function planFromStripePriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null
  return PRICE_TO_PLAN[priceId] || null
}

export function planFromMetadata(raw: string | null | undefined): PaidPlan | null {
  const plan = String(raw || '').trim().toLowerCase()
  return PAID_PLANS.has(plan) ? (plan as PaidPlan) : null
}

export function primaryPriceIdFromSubscription(sub: StripeSubscriptionLike | null | undefined): string | null {
  const id = sub?.items?.data?.[0]?.price?.id
  return id ? String(id) : null
}

export function resolvePaidPlan(opts: {
  metadataPlan?: string | null
  priceId?: string | null
}): { plan: PaidPlan | null; source: 'price' | 'metadata' | 'none'; unknown_price: boolean } {
  const fromPrice = planFromStripePriceId(opts.priceId)
  if (opts.priceId && !fromPrice) {
    return { plan: null, source: 'none', unknown_price: true }
  }
  if (fromPrice) return { plan: fromPrice, source: 'price', unknown_price: false }
  const fromMeta = planFromMetadata(opts.metadataPlan)
  if (fromMeta) return { plan: fromMeta, source: 'metadata', unknown_price: false }
  return { plan: null, source: 'none', unknown_price: false }
}

/** Active paid access while cancel_at_period_end is pending through the paid period. */
export function shouldPreservePaidAccess(sub: StripeSubscriptionLike): boolean {
  const status = String(sub.status || '').toLowerCase()
  if (status === 'active' || status === 'trialing') return true
  if (status === 'past_due') return true // do not immediately destroy entitlement on one failure
  return false
}

export function shouldTerminatePaidAccess(sub: StripeSubscriptionLike): boolean {
  const status = String(sub.status || '').toLowerCase()
  return status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired'
}

function tsFromUnix(sec: number | null | undefined): string | null {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null
  return new Date(sec * 1000).toISOString()
}

export async function upsertSubscriptionLedger(
  supabase: DbClient,
  row: {
    business_id: string
    plan: string
    stripe_subscription_id: string | null
    stripe_customer_id: string | null
    status: string
    current_period_start?: string | null
    current_period_end?: string | null
  },
): Promise<void> {
  const now = new Date().toISOString()
  let existingId: string | null = null

  if (row.stripe_subscription_id) {
    const { data } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', row.stripe_subscription_id)
      .maybeSingle()
    if (data?.id) existingId = String(data.id)
  }

  if (!existingId) {
    const { data } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('business_id', row.business_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.id) existingId = String(data.id)
  }

  const payload = {
    business_id: row.business_id,
    plan: row.plan,
    stripe_subscription_id: row.stripe_subscription_id,
    stripe_customer_id: row.stripe_customer_id,
    status: row.status,
    current_period_start: row.current_period_start || null,
    current_period_end: row.current_period_end || null,
    updated_at: now,
  }

  if (existingId) {
    await supabase.from('subscriptions').update(payload).eq('id', existingId)
  } else {
    await supabase.from('subscriptions').insert({ ...payload, created_at: now })
  }
}

export async function applyPaidPlanToBusiness(
  supabase: DbClient,
  opts: {
    business_id: string
    plan: PaidPlan
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
  },
): Promise<void> {
  const updates: Record<string, unknown> = {
    plan: opts.plan,
    updated_at: new Date().toISOString(),
  }
  if (opts.stripe_customer_id) updates.stripe_customer_id = opts.stripe_customer_id
  if (opts.stripe_subscription_id) updates.stripe_subscription_id = opts.stripe_subscription_id

  await supabase.from('businesses').update(updates).eq('id', opts.business_id)
}

export async function syncCheckoutSessionCompleted(
  supabase: DbClient,
  session: CheckoutSessionLike,
  subscription?: StripeSubscriptionLike | null,
): Promise<SyncResult> {
  const businessId = String(session.metadata?.business_id || '').trim()
  if (!businessId) {
    return { ok: false, action: 'checkout.session.completed', reason: 'missing_business_id' }
  }

  const mode = String(session.mode || 'subscription').toLowerCase()
  if (mode !== 'subscription') {
    return {
      ok: false,
      action: 'checkout.session.completed',
      reason: 'checkout_mode_not_subscription',
      details: { mode },
    }
  }

  const paymentStatus = String(session.payment_status || '').toLowerCase()
  if (paymentStatus && paymentStatus !== 'paid' && paymentStatus !== 'no_payment_required') {
    return {
      ok: false,
      action: 'checkout.session.completed',
      reason: 'payment_not_completed',
      details: { payment_status: paymentStatus, status: session.status || null },
    }
  }

  const { data: bizRow } = await supabase
    .from('businesses')
    .select('id, stripe_customer_id')
    .eq('id', businessId)
    .maybeSingle()
  if (!bizRow?.id) {
    return { ok: false, action: 'checkout.session.completed', reason: 'business_not_found' }
  }

  if (!subscription?.id && !session.subscription) {
    return { ok: false, action: 'checkout.session.completed', reason: 'missing_subscription' }
  }

  const priceId = primaryPriceIdFromSubscription(subscription)
  // Price mapping is authoritative — do not grant from client metadata alone.
  if (!priceId) {
    return { ok: false, action: 'checkout.session.completed', reason: 'missing_stripe_price' }
  }
  const plan = planFromStripePriceId(priceId)
  if (!plan) {
    return {
      ok: false,
      action: 'checkout.session.completed',
      reason: 'unknown_stripe_price',
      details: { price_id: priceId },
    }
  }

  const customerId = session.customer
    ? String(session.customer)
    : (subscription?.customer ? String(subscription.customer) : null)
  const subscriptionId = session.subscription
    ? String(session.subscription)
    : (subscription?.id ? String(subscription.id) : null)

  if (
    bizRow.stripe_customer_id
    && customerId
    && String(bizRow.stripe_customer_id) !== customerId
  ) {
    return {
      ok: false,
      action: 'checkout.session.completed',
      reason: 'customer_mismatch',
      details: { business_id: businessId },
    }
  }

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
    status: String(subscription?.status || 'active'),
    current_period_start: tsFromUnix(subscription?.current_period_start),
    current_period_end: tsFromUnix(subscription?.current_period_end),
  })

  return {
    ok: true,
    action: 'checkout.session.completed',
    business_id: businessId,
    plan,
    details: {
      source: 'price',
      stripe_customer_id_set: !!customerId,
      stripe_subscription_id_set: !!subscriptionId,
    },
  }
}

export async function syncSubscriptionEvent(
  supabase: DbClient,
  sub: StripeSubscriptionLike,
  eventType: string,
): Promise<SyncResult> {
  const subscriptionId = sub.id ? String(sub.id) : null
  if (!subscriptionId) {
    return { ok: false, action: eventType, reason: 'missing_subscription_id' }
  }

  const customerId = sub.customer ? String(sub.customer) : null
  const priceId = primaryPriceIdFromSubscription(sub)
  const resolved = resolvePaidPlan({
    metadataPlan: sub.metadata?.plan,
    priceId,
  })

  let businessId: string | null = null
  {
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
    return { ok: false, action: eventType, reason: 'business_not_found' }
  }

  if (shouldTerminatePaidAccess(sub) || eventType === 'customer.subscription.deleted') {
    await supabase
      .from('businesses')
      .update({
        plan: 'free',
        updated_at: new Date().toISOString(),
      })
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

    return {
      ok: true,
      action: eventType,
      business_id: businessId,
      plan: 'free',
      details: { terminated: true, cancel_at_period_end: !!sub.cancel_at_period_end },
    }
  }

  if (resolved.unknown_price) {
    return {
      ok: false,
      action: eventType,
      reason: 'unknown_stripe_price',
      details: { price_id: priceId, business_id: businessId },
    }
  }

  if (shouldPreservePaidAccess(sub)) {
    const priceIdForPlan = priceId
    if (!priceIdForPlan) {
      return { ok: false, action: eventType, reason: 'missing_stripe_price', details: { business_id: businessId } }
    }
    if (resolved.unknown_price || !resolved.plan) {
      return {
        ok: false,
        action: eventType,
        reason: resolved.unknown_price ? 'unknown_stripe_price' : 'unresolved_plan',
        details: { price_id: priceId, business_id: businessId },
      }
    }

    await applyPaidPlanToBusiness(supabase, {
      business_id: businessId,
      plan: resolved.plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    })

    await upsertSubscriptionLedger(supabase, {
      business_id: businessId,
      plan: resolved.plan,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      status: String(sub.status || 'active'),
      current_period_start: tsFromUnix(sub.current_period_start),
      current_period_end: tsFromUnix(sub.current_period_end),
    })

    return {
      ok: true,
      action: eventType,
      business_id: businessId,
      plan: resolved.plan,
      details: {
        preserved: true,
        cancel_at_period_end: !!sub.cancel_at_period_end,
        status: sub.status || null,
      },
    }
  }

  await upsertSubscriptionLedger(supabase, {
    business_id: businessId,
    plan: resolved.plan || 'free',
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    status: String(sub.status || 'unknown'),
    current_period_start: tsFromUnix(sub.current_period_start),
    current_period_end: tsFromUnix(sub.current_period_end),
  })

  return {
    ok: true,
    action: eventType,
    business_id: businessId,
    plan: resolved.plan || 'unchanged',
    details: { ledger_only: true, status: sub.status || null },
  }
}

/** Customer-facing upgrade confirmation from authoritative plan only. */
export function upgradeBannerState(opts: {
  expectedPaidHint?: string | null
  authoritativePlan: string | null | undefined
}): 'confirmed' | 'pending' | 'none' {
  const plan = String(opts.authoritativePlan || 'free').toLowerCase()
  if (plan === 'admin') return 'none'
  if (PAID_PLANS.has(plan)) return 'confirmed'
  if (opts.expectedPaidHint) return 'pending'
  return 'none'
}
