import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { notifyPlanUpgrade, notifyPlanCancellation } from './notify'

// ── Price IDs ─────────────────────────────────────────────────────────────────────
const PRICE_IDS: Record<string, string> = {
  basic:           'price_1TP11Q3lF9K8v3zheYUShWhQ',   // $19/mo
  pro:             'price_1TP15B3lF9K8v3zhBuK9PqyS',   // $49/mo
  featured:        'price_1TP15p3lF9K8v3zhXVXS4MHM',   // $99/mo
  agency:          'price_1TP16Q3lF9K8v3zhtR9LhB5k',   // $299/mo
  basic_annual:    'price_1TP18S3lF9K8v3zh2dyoMazn',   // $190/yr
  pro_annual:      'price_1TP1913lF9K8v3zhrfFmwRJQ',   // $490/yr
  featured_annual: 'price_1TP19V3lF9K8v3zhPits88OX',   // $990/yr
  agency_annual:   'price_1TP1A33lF9K8v3zhw2kTIwjd',   // $2990/yr
}

// ── Email helper via Resend ───────────────────────────────────────────────────────
async function sendEmail(env: Env, to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MyLatinoList <billing@mylatinolist.io>',
      to,
      subject,
      html,
    }),
  })
}

// ── Email templates ───────────────────────────────────────────────────────────────
function upgradeEmailHtml(firstName: string, businessName: string, plan: string, price: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
  <div style="background:#1A56DB;padding:32px;text-align:center;">
    <div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.02em;">my<strong>latino</strong>list</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">La plataforma del negocio latino</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">🎉 Welcome to ${plan.charAt(0).toUpperCase()+plan.slice(1)}, ${firstName}!</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 20px;">
      Your subscription for <strong>${businessName}</strong> has been activated. You now have access to all ${plan.charAt(0).toUpperCase()+plan.slice(1)} features.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:600;color:#166534;margin-bottom:8px;">Subscription details</div>
      <div style="font-size:13px;color:#555;">Plan: <strong>${plan.charAt(0).toUpperCase()+plan.slice(1)}</strong></div>
      <div style="font-size:13px;color:#555;">Amount: <strong>${price}/month</strong></div>
      <div style="font-size:13px;color:#555;margin-top:4px;">You can manage or cancel anytime from your billing page.</div>
    </div>
    <a href="https://mylatinolist.io/pages/dashboard.html" style="display:block;background:#D85A30;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-size:15px;font-weight:600;margin-bottom:20px;">Go to my dashboard →</a>
    <a href="https://mylatinolist.io/pages/billing.html" style="display:block;background:#f5f5f5;color:#555;text-decoration:none;padding:12px;border-radius:8px;text-align:center;font-size:13px;margin-bottom:20px;">Manage billing →</a>
    <p style="font-size:12px;color:#999;text-align:center;margin:0;">Questions? <a href="mailto:billing@mylatinolist.io" style="color:#D85A30;">billing@mylatinolist.io</a></p>
  </div>
  <div style="background:#f8f8f8;padding:16px;text-align:center;font-size:11px;color:#999;">
    © 2026 AP Optix LLC DBA MyLatinoList · <a href="https://mylatinolist.io" style="color:#999;">mylatinolist.io</a>
  </div>
</div></body></html>`
}

function cancellationEmailHtml(firstName: string, businessName: string, plan: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
  <div style="background:#1A56DB;padding:32px;text-align:center;">
    <div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.02em;">my<strong>latino</strong>list</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">La plataforma del negocio latino</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">Subscription cancelled</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 20px;">
      Hi ${firstName}, your <strong>${plan.charAt(0).toUpperCase()+plan.slice(1)}</strong> subscription for <strong>${businessName}</strong> has been cancelled. Your account has been moved to the Free plan.
    </p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:20px;margin-bottom:24px;">
      <div style="font-size:13px;color:#92400e;">You still have access to your free directory listing. Upgrade anytime to restore your Pro or Featured features.</div>
    </div>
    <a href="https://mylatinolist.io/pages/billing.html" style="display:block;background:#D85A30;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-size:15px;font-weight:600;margin-bottom:20px;">Reactivate my plan →</a>
    <p style="font-size:12px;color:#999;text-align:center;margin:0;">Questions? <a href="mailto:billing@mylatinolist.io" style="color:#D85A30;">billing@mylatinolist.io</a></p>
  </div>
  <div style="background:#f8f8f8;padding:16px;text-align:center;font-size:11px;color:#999;">
    © 2026 AP Optix LLC DBA MyLatinoList · <a href="https://mylatinolist.io" style="color:#999;">mylatinolist.io</a>
  </div>
</div></body></html>`
}

function paymentFailedEmailHtml(firstName: string, businessName: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
  <div style="background:#1A56DB;padding:32px;text-align:center;">
    <div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.02em;">my<strong>latino</strong>list</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">⚠️ Payment failed</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 20px;">
      Hi ${firstName}, we couldn't process your payment for <strong>${businessName}</strong>. Please update your payment method to keep your subscription active.
    </p>
    <a href="https://mylatinolist.io/pages/billing.html" style="display:block;background:#D85A30;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-size:15px;font-weight:600;margin-bottom:20px;">Update payment method →</a>
    <p style="font-size:12px;color:#999;text-align:center;margin:0;">Questions? <a href="mailto:billing@mylatinolist.io" style="color:#D85A30;">billing@mylatinolist.io</a></p>
  </div>
</div></body></html>`
}

// ── POST /api/stripe/create-checkout-session ─────────────────────────────────────
async function createCheckoutSession(request: Request, env: Env, userId: string): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

  const body = await request.json() as { plan: 'basic' | 'pro' | 'featured' | 'agency'; billing?: 'monthly' | 'annual' }
  const priceKey = body.billing === 'annual' ? `${body.plan}_annual` : body.plan
  const priceId = PRICE_IDS[priceKey]

  if (!priceId || priceId.includes('REPLACE_ME')) {
    return Response.json({ error: 'Plan not available yet' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stripe_customer_id')
    .eq('owner_id', userId)
    .single()

  if (!business) {
    return Response.json({ error: 'Business not found' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${env.FRONTEND_URL}/pages/billing.html?session_id={CHECKOUT_SESSION_ID}&upgraded=1`,
    cancel_url: `${env.FRONTEND_URL}/pages/billing.html?cancelled=1`,
    'metadata[business_id]': business.id,
    'metadata[user_id]': userId,
    'metadata[plan]': body.plan,
    'metadata[billing]': body.billing || 'monthly',
  })

  if (business.stripe_customer_id) {
    params.set('customer', business.stripe_customer_id)
  } else if (profile?.email) {
    params.set('customer_email', profile.email)
  }

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const session = await stripeRes.json() as { url?: string; error?: { message: string } }

  if (!stripeRes.ok || !session.url) {
    console.error('Stripe error:', session.error)
    return Response.json({ error: session.error?.message || 'Stripe error' }, { status: 500 })
  }

  return Response.json({ url: session.url })
}

// ── POST /api/stripe/webhook ──────────────────────────────────────────────────────
async function handleWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 400 })
  }

  const rawBody = await request.text()

  const isValid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(rawBody)
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

  // ── checkout.session.completed ────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session    = event.data.object
    const businessId = session.metadata?.business_id
    const plan       = session.metadata?.plan
    const customerId = session.customer

    if (!businessId || !plan) return Response.json({ received: true })

    // Update business plan
    await supabase
      .from('businesses')
      .update({ plan, stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', businessId)

    // Get profile for email
    const { data: business } = await supabase
      .from('businesses')
      .select('name, owner_id')
      .eq('id', businessId)
      .single()

    if (business) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', business.owner_id)
        .single()

      if (profile?.email) {
        const priceMap: Record<string, string> = { basic:'$19', pro:'$49', featured:'$99', agency:'$299' }
        const price = priceMap[plan] || '$49'
        await sendEmail(
          env,
          profile.email,
          `🎉 Your ${plan.charAt(0).toUpperCase()+plan.slice(1)} plan is now active — MyLatinoList`,
          upgradeEmailHtml(profile.first_name || 'there', business.name, plan, price)
        )
        ctx.waitUntil(notifyPlanUpgrade(env, {
          businessName: business.name,
          email:        profile.email,
          oldPlan:      'free',
          newPlan:      plan,
        }).catch(e => console.error('notify upgrade failed:', e)))
      }
    }

    // Give referral credit to referrer if this business was referred
    const { data: upgradedBiz } = await supabase
      .from('businesses')
      .select('referred_by')
      .eq('id', businessId)
      .single()

    if (upgradedBiz?.referred_by) {
      const { data: referrer } = await supabase
        .from('businesses')
        .select('id, referral_credits')
        .eq('referral_code', upgradedBiz.referred_by)
        .single()
      if (referrer) {
        await supabase
          .from('businesses')
          .update({ referral_credits: (referrer.referral_credits || 0) + 1 })
          .eq('id', referrer.id)
      }
    }

    console.log(`✅ Plan updated: business=${businessId} plan=${plan}`)
  }

  // ── customer.subscription.deleted ────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const customerId = event.data.object.customer

    const { data: business } = await supabase
      .from('businesses')
      .select('name, owner_id, plan')
      .eq('stripe_customer_id', customerId)
      .single()

    await supabase
      .from('businesses')
      .update({ plan: 'free', updated_at: new Date().toISOString() })
      .eq('stripe_customer_id', customerId)

    if (business) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', business.owner_id)
        .single()

      if (profile?.email) {
        await sendEmail(
          env,
          profile.email,
          'Your MyLatinoList subscription has been cancelled',
          cancellationEmailHtml(profile.first_name || 'there', business.name, business.plan)
        )
        ctx.waitUntil(notifyPlanCancellation(env, {
          businessName: business.name,
          email:        profile.email,
          plan:         business.plan,
        }).catch(e => console.error('notify cancel failed:', e)))
      }
    }

    console.log(`⚠️ Subscription cancelled for customer=${customerId}`)
  }

  // ── invoice.payment_failed ────────────────────────────────
  if (event.type === 'invoice.payment_failed') {
    const customerId = event.data.object.customer

    const { data: business } = await supabase
      .from('businesses')
      .select('name, owner_id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (business) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', business.owner_id)
        .single()

      if (profile?.email) {
        await sendEmail(
          env,
          profile.email,
          '⚠️ Payment failed — update your payment method',
          paymentFailedEmailHtml(profile.first_name || 'there', business.name)
        )
      }
    }

    console.warn(`❌ Payment failed for customer=${customerId}`)
  }

  return Response.json({ received: true })
}

// ── POST /api/stripe/create-portal-session ───────────────────────────────────────
async function createPortalSession(request: Request, env: Env, userId: string): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

  const { data: business } = await supabase
    .from('businesses')
    .select('stripe_customer_id')
    .eq('owner_id', userId)
    .single()

  if (!business?.stripe_customer_id) {
    return Response.json({ error: 'No billing account found' }, { status: 404 })
  }

  const params = new URLSearchParams({
    customer: business.stripe_customer_id,
    return_url: `${env.FRONTEND_URL}/pages/billing.html`,
  })

  const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const portal = await portalRes.json() as { url?: string; error?: { message: string } }

  if (!portalRes.ok || !portal.url) {
    return Response.json({ error: portal.error?.message || 'Portal error' }, { status: 500 })
  }

  return Response.json({ url: portal.url })
}

// ── Stripe webhook signature verification ────────────────────────────────────────
async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))
    const timestamp = parts['t']
    const sig = parts['v1']
    const signedPayload = `${timestamp}.${payload}`
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const computed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
    const computedHex = Array.from(new Uint8Array(computed)).map(b => b.toString(16).padStart(2, '0')).join('')
    return computedHex === sig
  } catch {
    return false
  }
}

// ── Main router ───────────────────────────────────────────────────────────────────
export async function handleStripe(request: Request, env: Env, ctx: ExecutionContext, userId?: string): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  if (path === '/api/stripe/webhook' && request.method === 'POST') {
    return handleWebhook(request, env, ctx)
  }

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (path === '/api/stripe/create-checkout-session' && request.method === 'POST') {
    return createCheckoutSession(request, env, userId)
  }

  if (path === '/api/stripe/create-portal-session' && request.method === 'POST') {
    return createPortalSession(request, env, userId)
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}
