import type { Env } from '../index'
import { sendEmail, dripDay3Html, dripDay7Html, dripDay14Html, dripDay30Html } from '../cron'

export async function handleTestDrip(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization') || ''
  if (!env.ADMIN_TEST_TOKEN || auth !== `Bearer ${env.ADMIN_TEST_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let body: any
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const day = body.day
  const to = body.to
  const businessName = body.businessName || 'Test Business'
  const firstName = body.firstName || 'Adrian'
  const slug = body.slug || 'test-business'

  if (![3, 7, 14, 30].includes(day)) {
    return Response.json({ error: 'day must be 3, 7, 14, or 30' }, { status: 400 })
  }
  if (!to || typeof to !== 'string') {
    return Response.json({ error: 'to (email) is required' }, { status: 400 })
  }

  let subject: string
  let html: string

  switch (day) {
    case 3:
      subject = `í³¸ ${businessName}, your listing needs a photo!`
      html = dripDay3Html(firstName, businessName)
      break
    case 7:
      subject = `í¾‰ ${businessName} has been live for 1 week!`
      html = dripDay7Html(firstName, businessName, slug)
      break
    case 14:
      subject = `íº€ Ready to grow ${businessName} faster?`
      html = dripDay14Html(firstName, businessName)
      break
    case 30:
      subject = `í³… 30-day check-in â€” ${businessName}`
      html = dripDay30Html(firstName, businessName)
      break
    default:
      return Response.json({ error: 'invalid day' }, { status: 400 })
  }

  await sendEmail(env, to, subject, html)
  return Response.json({ ok: true, day, to, subject })
}
