import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { authorizeMarketingPilot, type PilotBusiness } from '../lib/marketing-pilot'

function hasHttp(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url)
}

function social(links: Record<string, string> | null, key: string): boolean {
  const value = links && typeof links === 'object' ? String(links[key] || links[key.toLowerCase()] || '') : ''
  return hasHttp(value)
}

function listingSnapshot(biz: PilotBusiness) {
  const hasDescription = String(biz.description || '').trim().length > 20
  const hasWebsite = hasHttp(biz.website)
  const hasPhone = String(biz.phone || '').trim().length > 6
  const hasLocation = !!(biz.city && biz.state)
  const hasFacebook = social(biz.social_links, 'facebook')
  const hasInstagram = social(biz.social_links, 'instagram')
  const opportunities: Array<{ id: string; title: string; detail: string }> = []
  if (!hasDescription) opportunities.push({ id: 'description', title: 'Add a fuller listing description', detail: 'A clear description helps customers and MLL search understand what you offer.' })
  if (!hasWebsite) opportunities.push({ id: 'website', title: 'Add a website', detail: 'A website link strengthens your digital footprint on My Latino List.' })
  if (!hasPhone) opportunities.push({ id: 'phone', title: 'Add a phone number', detail: 'Make it easy for customers to contact you from your listing.' })
  if (!hasLocation) opportunities.push({ id: 'location', title: 'Add city and state', detail: 'Location helps local customers find you in directory search.' })
  if (!hasFacebook) opportunities.push({ id: 'facebook', title: 'Connect Facebook', detail: 'Add your Facebook URL in listing social links when you are ready.' })
  if (!hasInstagram) opportunities.push({ id: 'instagram', title: 'Connect Instagram', detail: 'Add your Instagram URL in listing social links when you are ready.' })
  return {
    has_description: hasDescription,
    has_website: hasWebsite,
    has_phone: hasPhone,
    has_city_state: hasLocation,
    has_facebook: hasFacebook,
    has_instagram: hasInstagram,
    opportunities,
  }
}

export async function handleMarketingPilot(request: Request, env: Env, userId: string): Promise<Response> {
  const url = new URL(request.url)
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const access = await authorizeMarketingPilot(supabase, userId, env.MLL_MARKETING_PILOT_BUSINESS_IDS)
  if (!access.ok) {
    return Response.json({ error: access.error, enabled: false }, { status: access.status })
  }

  if (url.pathname === '/api/marketing/pilot' || url.pathname === '/api/marketing/pilot/') {
    return Response.json({
      enabled: true,
      business_id: access.business.id,
      name: access.business.name,
    })
  }

  if (url.pathname === '/api/marketing/pilot/summary') {
    return Response.json({
      business: { id: access.business.id, name: access.business.name },
      listing: listingSnapshot(access.business),
    })
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}
