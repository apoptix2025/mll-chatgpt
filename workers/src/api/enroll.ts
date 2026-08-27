import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { notifyEnrollment } from './notify'

// ── Price IDs (must match stripe.ts) ─────────────────────────────────────────────
const PRICE_IDS: Record<string, string> = {
  basic:           'price_1TP11Q3lF9K8v3zheYUShWhQ',
  pro:             'price_1TP15B3lF9K8v3zhBuK9PqyS',
  featured:        'price_1TP15p3lF9K8v3zhXVXS4MHM',
  agency:          'price_1TP16Q3lF9K8v3zhtR9LhB5k',
  basic_annual:    'price_1TP18S3lF9K8v3zh2dyoMazn',
  pro_annual:      'price_1TP1913lF9K8v3zhrfFmwRJQ',
  featured_annual: 'price_1TP19V3lF9K8v3zhPits88OX',
  agency_annual:   'price_1TP1A33lF9K8v3zhw2kTIwjd',
}

function normalizeUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return 'https://' + url
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

async function postToFacebook(env: Env, businessName: string, slug: string): Promise<void> {
  if (!(env as any).FB_PAGE_ACCESS_TOKEN) return
  const message = `🎉 Welcome ${businessName} to MyLatinoList!\nFind them at mylatinolist.io/pages/business.html?id=${slug}\n#MyLatinoList #LatinoBusinesses`
  await fetch('https://graph.facebook.com/me/feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: (env as any).FB_PAGE_ACCESS_TOKEN }),
  }).catch(e => console.error('FB post failed:', e))
}

export async function handleEnroll(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

  try {
    const body = await request.json() as {
      email: string
      password: string
      first_name: string
      last_name: string
      language: string
      business_name: string
      phone: string
      city: string
      state: string
      zip: string
      website?: string
      description: string
      category: string
      modules: string[]
      plan: 'free' | 'basic' | 'pro' | 'featured' | 'agency'
      referred_by?: string
    }

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        first_name: body.first_name,
        last_name: body.last_name,
        language: body.language,
        role: 'owner',
      },
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return Response.json({ error: 'An account with this email already exists.' }, { status: 409 })
      }
      return Response.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Generate slug with duplicate check
    const baseSlug = body.business_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    let slug = baseSlug
    let attempt = 1
    while (true) {
      const { data: existing } = await supabase
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .single()
      if (!existing) break
      slug = `${baseSlug}-${++attempt}`
    }

    // 3. Insert business — use 'free' initially for paid plans (upgraded after payment)
    const initialPlan   = body.plan === 'free' ? 'free' : 'free' // always start free, Stripe webhook upgrades
    const referralCode  = generateReferralCode()
    const referredBy    = body.referred_by?.toUpperCase() || null

    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .insert({
        owner_id: userId,
        name: body.business_name,
        slug,
        phone: body.phone,
        city: body.city,
        state: body.state,
        zip: body.zip,
        website: normalizeUrl(body.website || null),
        description: body.description,
        category: body.category,
        status: 'active',
        plan: initialPlan,
        modules: body.modules,
        profile_completion: 72,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        referral_code: referralCode,
        referred_by: referredBy,
      })
      .select()
      .single()

    if (bizError) {
      await supabase.auth.admin.deleteUser(userId)
      return Response.json({ error: bizError.message }, { status: 500 })
    }

    // 4. Create owner profile
    await supabase.from('profiles').insert({
      id: userId,
      email: body.email,
      first_name: body.first_name,
      last_name: body.last_name,
      language: body.language,
      business_id: business.id,
    })

    // 5. Send welcome email via Resend
    if (env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'MyLatinoList <welcome@mylatinolist.io>',
          to: body.email,
          subject: `¡Bienvenido! ${body.business_name} is now live on MyLatinoList`,
          html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
  <div style="background:#1A56DB;padding:32px;text-align:center;">
    <div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.02em;">my<strong>latino</strong>list</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">La plataforma del negocio latino</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">¡Bienvenido, ${body.first_name}! 🎉</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 20px;">
      <strong>${body.business_name}</strong> is now live in the MyLatinoList directory. Customers in your community can already find you.
    </p>
    <div style="background:#f8f8f8;border-radius:8px;padding:20px;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:12px;">Your next steps:</div>
      <div style="font-size:13px;color:#555;display:flex;flex-direction:column;gap:8px;">
        <div>📸 <strong>Add photos</strong> to attract more customers</div>
        <div>🕐 <strong>Set your hours</strong> so customers know when you're open</div>
        <div>📱 <strong>Download your QR code</strong> and print it on your door</div>
        <div>🎨 <strong>Get your marketing kit</strong> for social media</div>
      </div>
    </div>
    <a href="https://mylatinolist.io/pages/dashboard.html" style="display:block;background:#D85A30;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-size:15px;font-weight:600;margin-bottom:20px;">Go to my dashboard →</a>
    <p style="font-size:12px;color:#999;text-align:center;margin:0;">
      Questions? Reply to this email or contact us at <a href="mailto:support@mylatinolist.io" style="color:#D85A30;">support@mylatinolist.io</a>
    </p>
  </div>
  <div style="background:#f8f8f8;padding:16px;text-align:center;font-size:11px;color:#999;">
    © 2026 AP Optix LLC DBA MyLatinoList · <a href="https://mylatinolist.io" style="color:#999;">mylatinolist.io</a>
  </div>
</div>
</body></html>`,
        }),
      })
    }

    // 5b. Auto-post to Facebook (fire-and-forget)
    ctx.waitUntil(
      postToFacebook(env, business.name, business.slug)
        .catch(e => console.error('FB post failed:', e))
    )

    // 5c. Notify admin of new enrollment (fire-and-forget)
    ctx.waitUntil(notifyEnrollment(env, {
      businessName: business.name,
      ownerEmail:   body.email,
      plan:         body.plan,
      city:         body.city,
      state:        body.state,
      slug:         business.slug,
    }).catch((e) => console.error('notify enrollment failed:', e)))

    // 6. If paid plan selected → create Stripe checkout session and return URL
    if (body.plan === 'pro' || body.plan === 'featured') {
      const priceId = PRICE_IDS[body.plan]
      const params = new URLSearchParams({
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: `${env.FRONTEND_URL}/pages/dashboard.html?enrolled=1&upgraded=1`,
        cancel_url: `${env.FRONTEND_URL}/pages/billing.html`,
        customer_email: body.email,
        'metadata[business_id]': business.id,
        'metadata[user_id]': userId,
        'metadata[plan]': body.plan,
      })

      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      const session = await stripeRes.json() as { url?: string; error?: { message: string } }

      if (stripeRes.ok && session.url) {
        return Response.json({
          success: true,
          business_id: business.id,
          slug: business.slug,
          checkout_url: session.url, // ← frontend redirects here
          message: 'Account created — redirecting to payment',
        }, { status: 201 })
      }
      // If Stripe fails, still let them in on free plan
      console.error('Stripe checkout error during enroll:', session.error)
    }

    // 7. Free plan — return normally
    return Response.json({
      success: true,
      business_id: business.id,
      slug: business.slug,
      message: 'Enrollment complete',
    }, { status: 201 })

  } catch (err) {
    console.error('Enroll error:', err)
    return Response.json({ error: 'Enrollment failed. Please try again.' }, { status: 500 })
  }
}
