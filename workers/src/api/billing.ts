/**
 * Authenticated billing status + optional post-checkout confirmation.
 * Resolves the caller's assigned business server-side. Never exposes secrets/card data.
 */

import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { resolveAssignedBusiness } from '../lib/billing-business'
import { buildSafeBillingStatus } from '../lib/billing-entitlement'
import {
  confirmCheckoutSessionForBusiness,
  reconcileBusinessFromSubscription,
  stripeGetJson,
} from '../lib/billing-reconcile'

export async function handleBilling(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  if (path === '/api/billing/status' && request.method === 'GET') {
    return getBillingStatus(request, env, userId)
  }

  if (path === '/api/billing/confirm-checkout' && request.method === 'POST') {
    return confirmCheckout(request, env, userId)
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}

async function getBillingStatus(request: Request, env: Env, userId: string): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const url = new URL(request.url)
  const confirmationHint = url.searchParams.get('confirming') === '1'
  const reconcileHint = url.searchParams.get('reconcile') === '1'

  const resolved = await resolveAssignedBusiness(
    supabase,
    userId,
    'id, name, plan, stripe_customer_id, stripe_subscription_id',
  )
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status })
  }

  const biz = resolved.business as {
    id: string
    plan?: string | null
    stripe_customer_id?: string | null
    stripe_subscription_id?: string | null
  }

  // Bounded self-heal when returning from checkout and DB still free but Stripe IDs exist.
  if (
    reconcileHint
    && env.STRIPE_SECRET_KEY
    && String(biz.plan || 'free').toLowerCase() === 'free'
    && (biz.stripe_subscription_id || biz.stripe_customer_id)
  ) {
    try {
      let subBody: any = null
      if (biz.stripe_subscription_id) {
        const res = await stripeGetJson(
          env.STRIPE_SECRET_KEY,
          `/subscriptions/${biz.stripe_subscription_id}`,
        )
        if (res.ok) subBody = res.body
      }
      if (subBody) {
        await reconcileBusinessFromSubscription(supabase, subBody, { business_id: biz.id })
        const refreshed = await resolveAssignedBusiness(
          supabase,
          userId,
          'id, name, plan, stripe_customer_id, stripe_subscription_id',
        )
        if (refreshed.ok) {
          Object.assign(biz, refreshed.business)
        }
      }
    } catch (e) {
      console.error('billing status reconcile failed:', e)
    }
  }

  const { data: ledger } = await supabase
    .from('subscriptions')
    .select('status, cancel_at_period_end, current_period_end, plan')
    .eq('business_id', biz.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // cancel_at_period_end may not exist on ledger — derive from status naming only if present
  const cancelAtPeriodEnd = !!(ledger as any)?.cancel_at_period_end

  const status = buildSafeBillingStatus({
    plan: biz.plan,
    subscription_status: ledger?.status || null,
    cancel_at_period_end: cancelAtPeriodEnd,
    current_period_end: ledger?.current_period_end || null,
    confirmation_pending: confirmationHint && String(biz.plan || 'free').toLowerCase() === 'free',
  })

  return Response.json({
    business_id: biz.id,
    ...status,
  })
}

async function confirmCheckout(request: Request, env: Env, userId: string): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const resolved = await resolveAssignedBusiness(supabase, userId, 'id, plan, stripe_customer_id, stripe_subscription_id')
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status })
  }

  let body: { session_id?: string } = {}
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sessionId = String(body.session_id || '').trim()
  if (!sessionId) {
    return Response.json({ error: 'session_id required' }, { status: 400 })
  }

  if (!env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Billing confirm unavailable' }, { status: 503 })
  }

  const result = await confirmCheckoutSessionForBusiness(supabase, {
    secretKey: env.STRIPE_SECRET_KEY,
    businessId: resolved.business.id,
    sessionId,
  })

  const refreshed = await resolveAssignedBusiness(
    supabase,
    userId,
    'id, plan, stripe_customer_id, stripe_subscription_id',
  )
  const plan = refreshed.ok ? refreshed.business.plan : resolved.business.plan
  const status = buildSafeBillingStatus({
    plan,
    confirmation_pending: !result.ok || String(plan || 'free').toLowerCase() === 'free',
  })

  return Response.json({
    ok: result.ok,
    reason: result.ok ? undefined : ('reason' in result ? result.reason : 'failed'),
    business_id: resolved.business.id,
    ...status,
  })
}
