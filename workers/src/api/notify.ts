import type { Env } from '../index'

const ADMIN_EMAIL = 'info@mylatinolist.io'
const FROM        = 'MyLatinoList <welcome@mylatinolist.io>'

async function send(env: Env, subject: string, html: string, to?: string): Promise<void> {
  if (!env.RESEND_API_KEY) return
  const recipient = to || ADMIN_EMAIL
  console.log('notify: sending to', recipient, 'subject:', subject)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: recipient, subject, html }),
  })
  const txt = await res.text()
  console.log('notify: Resend response', res.status, txt)
}

export async function notifyEnrollment(
  env: Env,
  opts: { businessName: string; ownerEmail: string; plan: string; city: string; state: string; slug: string }
): Promise<void> {
  await send(
    env,
    `New enrollment: ${opts.businessName} (${opts.plan})`,
    `<p><strong>${opts.businessName}</strong> just enrolled on the <strong>${opts.plan}</strong> plan.</p>
     <ul>
       <li>Owner: ${opts.ownerEmail}</li>
       <li>Location: ${opts.city}, ${opts.state}</li>
       <li>Slug: ${opts.slug}</li>
     </ul>
     <p><a href="https://mylatinolist.io/pages/business.html?slug=${opts.slug}">View listing</a></p>`
  )
}

export async function notifyReview(
  env: Env,
  opts: { businessName: string; businessId: string; reviewerName: string; rating: number; body: string }
): Promise<void> {
  await send(
    env,
    `New ${opts.rating}★ review for ${opts.businessName}`,
    `<p><strong>${opts.reviewerName}</strong> left a <strong>${opts.rating}/5</strong> review for <strong>${opts.businessName}</strong>.</p>
     <blockquote>${opts.body}</blockquote>
     <p><a href="https://mylatinolist.io/pages/business.html?id=${opts.businessId}">View business</a></p>`
  )
}

export async function notifyPlanUpgrade(
  env: Env,
  opts: { businessName: string; email: string; oldPlan: string; newPlan: string }
): Promise<void> {
  await send(
    env,
    `💰 Plan upgrade: ${opts.businessName} → ${opts.newPlan}`,
    `<p><strong>${opts.businessName}</strong> upgraded from <strong>${opts.oldPlan}</strong> to <strong>${opts.newPlan}</strong>.</p>
     <p>Owner: ${opts.email}</p>`
  )
}

export async function notifyPlanCancellation(
  env: Env,
  opts: { businessName: string; email: string; plan: string }
): Promise<void> {
  await send(
    env,
    `❌ Cancellation: ${opts.businessName} downgraded from ${opts.plan}`,
    `<p><strong>${opts.businessName}</strong> was downgraded from <strong>${opts.plan}</strong> to free.</p>
     <p>Owner: ${opts.email}</p>`
  )
}

export async function notifyExpiryWarning(
  env: Env,
  opts: { businessName: string; email: string; daysLeft: number }
): Promise<void> {
  const urgent = opts.daysLeft <= 8
  await send(
    env,
    `${urgent ? '🚨 Urgent' : '⚠️ Reminder'}: ${opts.businessName} expires in ${opts.daysLeft} day${opts.daysLeft === 1 ? '' : 's'}`,
    `<p>Your free listing for <strong>${opts.businessName}</strong> will expire in <strong>${opts.daysLeft} day${opts.daysLeft === 1 ? '' : 's'}</strong>.</p>
     <p>Upgrade to Pro ($39/mo) to keep your listing active and unlock analytics, marketplace, jobs board, and more.</p>
     <p><a href="https://mylatinolist.io/pages/billing.html" style="display:inline-block;background:#D85A30;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Upgrade now →</a></p>`,
    opts.email
  )
}

export async function notifyExpired(
  env: Env,
  opts: { businessName: string; email: string }
): Promise<void> {
  await send(
    env,
    `Your MyLatinoList listing has expired — ${opts.businessName}`,
    `<p>Your free listing for <strong>${opts.businessName}</strong> has expired and is no longer visible in the directory.</p>
     <p>Upgrade to Pro ($39/mo) or Featured ($89/mo) to reactivate your listing today.</p>
     <p><a href="https://mylatinolist.io/pages/billing.html" style="display:inline-block;background:#D85A30;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Reactivate now →</a></p>`,
    opts.email
  )
}

export async function notifyExpiredAdmin(
  env: Env,
  opts: { businessName: string; email: string; expiresAt: string }
): Promise<void> {
  await send(
    env,
    `❌ Listing expired: ${opts.businessName}`,
    `<p><strong>${opts.businessName}</strong> (${opts.email}) free listing has expired.</p>
     <p>Expired at: ${opts.expiresAt}</p>`
  )
}

export async function notifyProfileUpdate(
  env: Env,
  opts: { businessName: string; businessId: string; userId: string; fields: string[] }
): Promise<void> {
  await send(
    env,
    `Profile updated: ${opts.businessName}`,
    `<p><strong>${opts.businessName}</strong> updated their listing.</p>
     <p>Changed fields: ${opts.fields.join(', ')}</p>
     <p>User ID: ${opts.userId}</p>
     <p><a href="https://mylatinolist.io/pages/business.html?id=${opts.businessId}">View listing</a></p>`
  )
}
