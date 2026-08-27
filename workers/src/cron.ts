import { createClient } from '@supabase/supabase-js'
import type { Env } from './index'
import { notifyExpiryWarning, notifyExpired, notifyExpiredAdmin } from './api/notify'

async function getOwnerEmails(
  supabase: ReturnType<typeof createClient>,
  ownerIds: string[]
): Promise<Record<string, string>> {
  if (!ownerIds.length) return {}
  const { data } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', ownerIds)
  const map: Record<string, string> = {}
  for (const p of (data || []) as { id: string; email: string }[]) map[p.id] = p.email
  return map
}

export async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<void> {
  if (!env.RESEND_API_KEY) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'MyLatinoList <hello@mylatinolist.io>', to, subject, html }),
  })
}

// ── Email drip templates ─────────────────────────────────────────────────────

export function dripDay3Html(firstName: string, bizName: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
  <div style="background:#1A56DB;padding:28px 32px;text-align:center;">
    <div style="font-size:22px;font-weight:700;color:#fff;">my<strong>latino</strong>list</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 12px;">📸 ${firstName}, your listing needs a photo!</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px;">
      Businesses with photos get <strong>3× more views</strong> than those without. Add a logo or cover photo to <strong>${bizName}</strong> and start attracting more customers today.
    </p>
    <a href="https://mylatinolist.io/pages/listing.html" style="display:block;background:#D85A30;color:#fff;text-decoration:none;padding:13px;border-radius:8px;text-align:center;font-size:14px;font-weight:600;margin-bottom:16px;">Add my photo now →</a>
    <p style="font-size:11px;color:#999;text-align:center;margin:0;">You're receiving this because you enrolled on MyLatinoList.</p>
  </div>
</div></body></html>`
}

export function dripDay7Html(firstName: string, bizName: string, slug: string) {
  const url = `https://mylatinolist.io/pages/business.html?id=${slug}`
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
  <div style="background:#1A56DB;padding:28px 32px;text-align:center;">
    <div style="font-size:22px;font-weight:700;color:#fff;">my<strong>latino</strong>list</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 12px;">🎉 Your listing is live — week 1 recap</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px;">
      <strong>${bizName}</strong> has been live on MyLatinoList for 7 days. Customers in your community can already find you in our directory!
    </p>
    <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:8px;">Share your listing</div>
      <div style="font-size:13px;color:#555;word-break:break-all;font-family:monospace;background:#fff;padding:8px 10px;border-radius:6px;border:1px solid #e8e8e8;">${url}</div>
    </div>
    <a href="${url}" style="display:block;background:#D85A30;color:#fff;text-decoration:none;padding:13px;border-radius:8px;text-align:center;font-size:14px;font-weight:600;margin-bottom:12px;">View my listing →</a>
    <a href="https://mylatinolist.io/pages/dashboard.html" style="display:block;background:#f5f5f5;color:#555;text-decoration:none;padding:11px;border-radius:8px;text-align:center;font-size:13px;margin-bottom:16px;">Go to dashboard →</a>
    <p style="font-size:11px;color:#999;text-align:center;margin:0;">You're receiving this because you enrolled on MyLatinoList.</p>
  </div>
</div></body></html>`
}

export function dripDay14Html(firstName: string, bizName: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
  <div style="background:#1A56DB;padding:28px 32px;text-align:center;">
    <div style="font-size:22px;font-weight:700;color:#fff;">my<strong>latino</strong>list</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 12px;">🚀 Ready to grow faster, ${firstName}?</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px;">
      <strong>${bizName}</strong> has been live for 2 weeks — great start! Pro plan members grow <strong>5× faster</strong> with priority placement, analytics, and the full marketplace.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:600;color:#166534;margin-bottom:8px;">Pro plan — $49/month</div>
      <div style="font-size:13px;color:#555;">✓ Priority listing placement</div>
      <div style="font-size:13px;color:#555;">✓ Analytics dashboard</div>
      <div style="font-size:13px;color:#555;">✓ Marketplace & jobs board</div>
      <div style="font-size:13px;color:#555;">✓ Social media marketing kit</div>
      <div style="font-size:13px;color:#555;">✓ Affiliate program access</div>
    </div>
    <a href="https://mylatinolist.io/pages/billing.html?plan=pro" style="display:block;background:#D85A30;color:#fff;text-decoration:none;padding:13px;border-radius:8px;text-align:center;font-size:14px;font-weight:600;margin-bottom:16px;">Upgrade to Pro →</a>
    <p style="font-size:11px;color:#999;text-align:center;margin:0;">You're receiving this because you enrolled on MyLatinoList.</p>
  </div>
</div></body></html>`
}

export function dripDay30Html(firstName: string, bizName: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
  <div style="background:#1A56DB;padding:28px 32px;text-align:center;">
    <div style="font-size:22px;font-weight:700;color:#fff;">my<strong>latino</strong>list</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 12px;">📅 30-day check-in — how's it going?</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px;">
      Hi ${firstName}! It's been a month since <strong>${bizName}</strong> joined MyLatinoList. We wanted to check in and remind you of some quick wins to boost your visibility.
    </p>
    <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:10px;">Quick wins for this month:</div>
      <div style="font-size:13px;color:#555;margin-bottom:6px;">⭐ Ask your top 3 customers for a review</div>
      <div style="font-size:13px;color:#555;margin-bottom:6px;">📸 Add 3+ photos to your listing</div>
      <div style="font-size:13px;color:#555;margin-bottom:6px;">🕐 Make sure your hours are up to date</div>
      <div style="font-size:13px;color:#555;">🔗 Share your listing on your social media</div>
    </div>
    <a href="https://mylatinolist.io/pages/dashboard.html" style="display:block;background:#D85A30;color:#fff;text-decoration:none;padding:13px;border-radius:8px;text-align:center;font-size:14px;font-weight:600;margin-bottom:12px;">View my dashboard →</a>
    <a href="https://mylatinolist.io/pages/billing.html" style="display:block;background:#f5f5f5;color:#555;text-decoration:none;padding:11px;border-radius:8px;text-align:center;font-size:13px;margin-bottom:16px;">Explore upgrade options →</a>
    <p style="font-size:11px;color:#999;text-align:center;margin:0;">You're receiving this because you enrolled on MyLatinoList.</p>
  </div>
</div></body></html>`
}

// ── Email drip campaigns ──────────────────────────────────────────────────────

async function sendDripEmails(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) return

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const now = new Date()

  const day3Cut  = new Date(now.getTime() -  3 * 24 * 60 * 60 * 1000).toISOString()
  const day7Cut  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()
  const day14Cut = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const day30Cut = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [d3Res, d7Res, d14Res, d30Res] = await Promise.all([
    supabase.from('businesses').select('id, name, slug, owner_id')
      .eq('status', 'active').eq('notified_day3', false)
      .is('logo_url', null).lte('created_at', day3Cut),
    supabase.from('businesses').select('id, name, slug, owner_id')
      .eq('status', 'active').eq('notified_day7', false)
      .lte('created_at', day7Cut),
    supabase.from('businesses').select('id, name, slug, owner_id')
      .eq('status', 'active').eq('notified_day14', false).eq('plan', 'free')
      .lte('created_at', day14Cut),
    supabase.from('businesses').select('id, name, slug, owner_id')
      .eq('status', 'active').eq('notified_day30', false)
      .lte('created_at', day30Cut),
  ])

  const allOwnerIds = [
    ...(d3Res.data  || []),
    ...(d7Res.data  || []),
    ...(d14Res.data || []),
    ...(d30Res.data || []),
  ].map(b => b.owner_id)

  const emails = await getOwnerEmails(supabase as any, [...new Set(allOwnerIds)])

  const getProfile = async (ownerId: string) => {
    const { data } = await supabase.from('profiles').select('first_name').eq('id', ownerId).single()
    return (data as any)?.first_name || 'there'
  }

  // Day 3 — add photos
  for (const biz of (d3Res.data || [])) {
    const email = emails[biz.owner_id]
    if (!email) continue
    const firstName = await getProfile(biz.owner_id)
    await sendEmail(env, email, `📸 ${biz.name}, your listing needs a photo!`, dripDay3Html(firstName, biz.name))
    await supabase.from('businesses').update({ notified_day3: true }).eq('id', biz.id)
  }

  // Day 7 — listing is live
  for (const biz of (d7Res.data || [])) {
    const email = emails[biz.owner_id]
    if (!email) continue
    const firstName = await getProfile(biz.owner_id)
    await sendEmail(env, email, `🎉 ${biz.name} has been live for 1 week!`, dripDay7Html(firstName, biz.name, biz.slug))
    await supabase.from('businesses').update({ notified_day7: true }).eq('id', biz.id)
  }

  // Day 14 — upgrade to Pro (free plan only)
  for (const biz of (d14Res.data || [])) {
    const email = emails[biz.owner_id]
    if (!email) continue
    const firstName = await getProfile(biz.owner_id)
    await sendEmail(env, email, `🚀 Ready to grow ${biz.name} faster?`, dripDay14Html(firstName, biz.name))
    await supabase.from('businesses').update({ notified_day14: true }).eq('id', biz.id)
  }

  // Day 30 — check-in
  for (const biz of (d30Res.data || [])) {
    const email = emails[biz.owner_id]
    if (!email) continue
    const firstName = await getProfile(biz.owner_id)
    await sendEmail(env, email, `📅 30-day check-in — ${biz.name}`, dripDay30Html(firstName, biz.name))
    await supabase.from('businesses').update({ notified_day30: true }).eq('id', biz.id)
  }

  console.log(`Drip: day3=${d3Res.data?.length||0} day7=${d7Res.data?.length||0} day14=${d14Res.data?.length||0} day30=${d30Res.data?.length||0}`)
}

// ── Weekly newsletter to all enrolled businesses ──────────────────────────────

async function sendWeeklyNewsletter(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) return

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const now    = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [totalRes, newRes, bizListRes] = await Promise.all([
    supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('businesses').select('id, name, city, state, category')
      .eq('status', 'active').gte('created_at', weekAgo).order('created_at', { ascending: false }).limit(5),
    supabase.from('businesses').select('id, name, plan, owner_id').eq('status', 'active').limit(2000),
  ])

  const totalBiz  = totalRes.count || 0
  const newThisWeek = newRes.data || []
  const newCount  = newThisWeek.length
  const allBiz    = bizListRes.data || []

  if (!allBiz.length) return

  const ownerIds = allBiz.map(b => b.owner_id)
  const emails   = await getOwnerEmails(supabase as any, ownerIds)

  const weekNum = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
  const tips = [
    'Add your business hours — customers are 40% more likely to contact businesses with complete hours listed.',
    'Ask your best customers for a review this week. One authentic review can double your listing views.',
    'Share your MyLatinoList profile link on your WhatsApp status — it takes 10 seconds and reaches everyone you know.',
    'Add a photo to your listing today. Listings with photos get 3× more profile views.',
    'Update your business description with the services customers ask about most.',
    'Use the referral program — earn 1 month free for every business you refer that upgrades.',
    'Reply to your customer reviews to show you care. It builds trust with future customers.',
    'Add your business to your email signature with your MyLatinoList link.',
    'Post in local Facebook groups with your listing link to drive traffic.',
    'Set your service areas in your listing so nearby customers can find you.',
    'Download your QR code from the dashboard and display it at your location.',
    'Complete your profile to 100% — it takes less than 5 minutes and boosts your ranking.',
  ]
  const tip = tips[weekNum % tips.length]

  const newBizHtml = newThisWeek.length
    ? newThisWeek.map(b =>
        `<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">
          🏢 <strong>${b.name}</strong> — ${b.city}, ${b.state}
         </div>`).join('')
    : '<div style="font-size:13px;color:#6b7280;padding:8px 0;">No new businesses this week — invite a friend!</div>'

  const subject = `MyLatinoList Weekly — ${newCount} new business${newCount === 1 ? '' : 'es'} joined!`

  let sent = 0
  for (const biz of allBiz) {
    const email = emails[biz.owner_id]
    if (!email) continue

    const upgradeCta = biz.plan === 'free'
      ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-bottom:20px;">
           <div style="font-size:13px;font-weight:600;color:#9a3412;margin-bottom:6px;">🚀 Grow faster with Pro</div>
           <div style="font-size:12px;color:#9a3412;margin-bottom:10px;">Unlock analytics, marketplace, jobs board and more for just $49/mo.</div>
           <a href="https://mylatinolist.io/pages/billing.html?plan=pro" style="display:inline-block;background:#D85A30;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;">Upgrade now →</a>
         </div>`
      : ''

    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
  <div style="background:linear-gradient(135deg,#c0392b,#e74c3c);padding:28px 32px;text-align:center;">
    <div style="font-size:22px;font-weight:700;color:#fff;">my<strong>latino</strong>list</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;">Weekly Community Update</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 6px;">${subject}</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">${now.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>

    <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:10px;">Platform stats this week</div>
      <div style="display:flex;gap:16px;">
        <div style="flex:1;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#D85A30;">${totalBiz}</div>
          <div style="font-size:11px;color:#6b7280;">Total businesses</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#10b981;">+${newCount}</div>
          <div style="font-size:11px;color:#6b7280;">New this week</div>
        </div>
      </div>
    </div>

    ${newCount > 0 ? `<div style="margin-bottom:20px;">
      <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:10px;">New businesses this week</div>
      ${newBizHtml}
    </div>` : ''}

    <div style="background:#EBF2FF;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:600;color:#1e40af;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Tip of the week</div>
      <div style="font-size:13px;color:#1e3a8a;line-height:1.6;">💡 ${tip}</div>
    </div>

    ${upgradeCta}

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:600;color:#166534;margin-bottom:6px;">Community spotlight</div>
      <div style="font-size:13px;color:#166534;line-height:1.6;">Refer a fellow Latino business owner and earn 1 free month when they upgrade. Share your referral link from your dashboard!</div>
      <a href="https://mylatinolist.io/pages/dashboard.html" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;margin-top:10px;">Get my referral link →</a>
    </div>

    <a href="https://mylatinolist.io/pages/dashboard.html" style="display:block;background:#D85A30;color:#fff;text-decoration:none;padding:12px;border-radius:8px;text-align:center;font-size:14px;font-weight:600;margin-bottom:16px;">View my dashboard →</a>
    <p style="font-size:11px;color:#999;text-align:center;margin:0;">You're receiving this because ${biz.name} is listed on MyLatinoList.</p>
  </div>
  <div style="background:#f8f8f8;padding:14px;text-align:center;font-size:11px;color:#999;">
    © 2026 AP Optix LLC DBA MyLatinoList · <a href="https://mylatinolist.io" style="color:#999;">mylatinolist.io</a>
  </div>
</div></body></html>`

    await sendEmail(env, email, subject, html)
    sent++
  }

  console.log(`Weekly newsletter sent to ${sent} businesses`)
}

// ── Admin weekly report ───────────────────────────────────────────────────────

async function sendWeeklyReport(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) return

  const sb      = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const now     = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    totalBizRes, totalProfRes, totalRevRes, totalLeadRes,
    newBizRes, newProfRes, newRevRes, newLeadRes,
    proRes, featuredRes,
  ] = await Promise.all([
    sb.from('businesses').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*',   { count: 'exact', head: true }),
    sb.from('reviews').select('*',    { count: 'exact', head: true }),
    sb.from('leads').select('*',      { count: 'exact', head: true }),
    sb.from('businesses').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    sb.from('profiles').select('*',   { count: 'exact', head: true }).gte('created_at', weekAgo),
    sb.from('reviews').select('*',    { count: 'exact', head: true }).gte('created_at', weekAgo),
    sb.from('leads').select('*',      { count: 'exact', head: true }).gte('created_at', weekAgo),
    sb.from('businesses').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
    sb.from('businesses').select('*', { count: 'exact', head: true }).eq('plan', 'featured'),
  ])

  const proCount      = proRes.count ?? 0
  const featuredCount = featuredRes.count ?? 0
  const mrr           = proCount * 39 + featuredCount * 89
  const baseCost      = 7.25
  const net           = mrr - baseCost

  const weekStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const metricRow = (label: string, total: number | null, newCount: number | null) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;">${label}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;color:#111827;text-align:right;">${total ?? '—'}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right;color:${(newCount ?? 0) > 0 ? '#10b981' : '#6b7280'};">+${newCount ?? 0} this week</td>
    </tr>`

  const warningBadge = (msg: string) => `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;margin:4px 0;font-size:13px;color:#92400e;">${msg}</div>`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#c0392b,#e74c3c);border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.02em;">MyLatinoList</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Weekly Report · Week of ${weekStr}</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;padding:24px 32px;border-top:none;">
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">MRR</div>
          <div style="font-size:26px;font-weight:700;color:#15803d;">$${mrr.toFixed(2)}</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#991b1b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">COST/MO</div>
          <div style="font-size:26px;font-weight:700;color:#dc2626;">$${baseCost.toFixed(2)}</div>
        </div>
        <div style="flex:1;min-width:120px;background:${net >= 0 ? '#f0fdf4' : '#fef2f2'};border:1px solid ${net >= 0 ? '#bbf7d0' : '#fecaca'};border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:${net >= 0 ? '#166534' : '#991b1b'};font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">NET</div>
          <div style="font-size:26px;font-weight:700;color:${net >= 0 ? '#15803d' : '#dc2626'};">${net >= 0 ? '+' : ''}$${net.toFixed(2)}</div>
        </div>
      </div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:20px 32px;">
      <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;">Revenue Breakdown</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f9fafb;">
          <td style="padding:8px 12px;font-size:13px;color:#6b7280;">Pro plan (×${proCount})</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#111827;text-align:right;">$${(proCount * 39).toFixed(2)}/mo</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-size:13px;color:#6b7280;">Featured plan (×${featuredCount})</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#111827;text-align:right;">$${(featuredCount * 89).toFixed(2)}/mo</td>
        </tr>
      </table>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:20px 32px;">
      <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;">Platform Metrics</div>
      <table style="width:100%;border-collapse:collapse;">
        ${metricRow('Businesses', totalBizRes.count, newBizRes.count)}
        ${metricRow('Registered users', totalProfRes.count, newProfRes.count)}
        ${metricRow('Reviews', totalRevRes.count, newRevRes.count)}
        ${metricRow('Leads', totalLeadRes.count, newLeadRes.count)}
      </table>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px 32px;">
      <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em;">Alerts</div>
      ${mrr > 0
        ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 12px;margin:4px 0;font-size:13px;color:#166534;">🟢 Platform is revenue-positive — MRR $${mrr}</div>`
        : `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;margin:4px 0;font-size:13px;color:#92400e;">🟡 No paid plans active yet — focus on conversions</div>`
      }
      ${(newProfRes.count ?? 0) === 0 ? warningBadge('🟡 No new user signups this week') : ''}
      ${(newBizRes.count ?? 0) === 0 ? warningBadge('🟡 No new business enrollments this week') : ''}
    </div>
    <div style="text-align:center;padding:24px 0;font-size:11px;color:#9ca3af;">
      MyLatinoList · api.mylatinolist.io · Auto-generated weekly report<br>
      <a href="https://mylatinolist.io/pages/health.html" style="color:#e74c3c;text-decoration:none;">View live health dashboard →</a>
    </div>
  </div>
</body>
</html>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'MyLatinoList Reports <noreply@mylatinolist.io>',
      to:      ['info@mylatinolist.io'],
      subject: `MyLatinoList Weekly Report — Week of ${weekStr}`,
      html,
    }),
  })
}

export async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  // Monday 9am UTC — admin report + newsletter to all businesses
  if (event.cron === '0 9 * * 1') {
    await sendWeeklyReport(env).catch(e => console.error('Weekly report failed:', e))
    await sendWeeklyNewsletter(env).catch(e => console.error('Weekly newsletter failed:', e))
    return
  }

  // Daily 10am UTC — expiry checks + drip emails
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const now = new Date()

  ctx.waitUntil(sendDripEmails(env).catch(e => console.error('Drip emails failed:', e)))

  // 1. 75-day warning — expires in ≤ 15 days, not yet notified
  const date15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString()
  const { data: warn1 } = await supabase
    .from('businesses')
    .select('id, name, owner_id, expires_at')
    .eq('plan', 'free')
    .eq('status', 'active')
    .eq('expired_notified_75', false)
    .lte('expires_at', date15)
    .not('expires_at', 'is', null)

  if (warn1?.length) {
    const emails = await getOwnerEmails(supabase as any, warn1.map(b => b.owner_id))
    for (const biz of warn1) {
      const daysLeft = Math.ceil((new Date(biz.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const email = emails[biz.owner_id]
      if (email) {
        ctx.waitUntil(
          notifyExpiryWarning(env, { businessName: biz.name, email, daysLeft })
            .catch(e => console.error('notify expiry warning failed:', e))
        )
      }
      await supabase.from('businesses').update({ expired_notified_75: true }).eq('id', biz.id)
    }
  }

  // 2. 82-day warning — expires in ≤ 8 days, not yet notified
  const date8 = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString()
  const { data: warn2 } = await supabase
    .from('businesses')
    .select('id, name, owner_id, expires_at')
    .eq('plan', 'free')
    .eq('status', 'active')
    .eq('expired_notified_82', false)
    .lte('expires_at', date8)
    .not('expires_at', 'is', null)

  if (warn2?.length) {
    const emails = await getOwnerEmails(supabase as any, warn2.map(b => b.owner_id))
    for (const biz of warn2) {
      const daysLeft = Math.ceil((new Date(biz.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const email = emails[biz.owner_id]
      if (email) {
        ctx.waitUntil(
          notifyExpiryWarning(env, { businessName: biz.name, email, daysLeft })
            .catch(e => console.error('notify expiry warning (urgent) failed:', e))
        )
      }
      await supabase.from('businesses').update({ expired_notified_82: true }).eq('id', biz.id)
    }
  }

  // 3. Expired — expires_at <= now, still active
  const { data: expired } = await supabase
    .from('businesses')
    .select('id, name, owner_id, expires_at')
    .eq('plan', 'free')
    .eq('status', 'active')
    .lte('expires_at', now.toISOString())
    .not('expires_at', 'is', null)

  if (expired?.length) {
    const emails = await getOwnerEmails(supabase as any, expired.map(b => b.owner_id))
    for (const biz of expired) {
      await supabase.from('businesses').update({ status: 'expired' }).eq('id', biz.id)
      const email = emails[biz.owner_id]
      if (email) {
        ctx.waitUntil(
          notifyExpired(env, { businessName: biz.name, email })
            .catch(e => console.error('notify expired failed:', e))
        )
      }
      ctx.waitUntil(
        notifyExpiredAdmin(env, { businessName: biz.name, email: email || 'unknown', expiresAt: biz.expires_at })
          .catch(e => console.error('notify expired admin failed:', e))
      )
    }
  }

  console.log(`Cron: ${warn1?.length || 0} 75-day warnings, ${warn2?.length || 0} 82-day warnings, ${expired?.length || 0} expirations`)
}
