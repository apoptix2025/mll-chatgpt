import type { Env } from '../index'

export async function handleContact(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let body: { name?: string; email?: string; message?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, email, message } = body

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return Response.json({ error: 'Name, email, and message are required.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email address.' }, { status: 400 })
  }

  if (!env.RESEND_API_KEY) {
    return Response.json({ error: 'Email service not configured.' }, { status: 500 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MyLatinoList <noreply@mylatinolist.io>',
      to: 'info@mylatinolist.io',
      reply_to: email.trim(),
      subject: `New contact form message from ${name.trim()}`,
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
  <div style="background:#D85A30;padding:24px 32px;">
    <div style="font-size:20px;font-weight:700;color:#fff;">New contact form message</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">mylatinolist.io</div>
  </div>
  <div style="padding:32px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.05em;padding:8px 0 4px;">Name</td></tr>
      <tr><td style="font-size:15px;color:#1a1a1a;padding-bottom:16px;border-bottom:1px solid #eee;">${name.trim()}</td></tr>
      <tr><td style="font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.05em;padding:12px 0 4px;">Email</td></tr>
      <tr><td style="font-size:15px;color:#1a1a1a;padding-bottom:16px;border-bottom:1px solid #eee;"><a href="mailto:${email.trim()}" style="color:#D85A30;">${email.trim()}</a></td></tr>
      <tr><td style="font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.05em;padding:12px 0 4px;">Message</td></tr>
      <tr><td style="font-size:15px;color:#1a1a1a;line-height:1.6;padding-top:4px;">${message.trim().replace(/\n/g, '<br>')}</td></tr>
    </table>
    <a href="mailto:${email.trim()}" style="display:inline-block;background:#D85A30;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Reply to ${name.trim()} →</a>
  </div>
  <div style="background:#f8f8f8;padding:16px;text-align:center;font-size:11px;color:#999;">
    Sent via mylatinolist.io contact form
  </div>
</div>
</body></html>`,
    }),
  })

  if (!res.ok) {
    const err = await res.json() as { message?: string }
    console.error('Resend error:', err)
    return Response.json({ error: 'Failed to send message. Please try again.' }, { status: 500 })
  }

  return Response.json({ success: true })
}
