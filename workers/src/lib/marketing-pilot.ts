import { MARKETING_TRIAL_DURATION_DAYS, type MarketingTrialView } from './marketing-trial'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PilotBusiness = {
  id: string
  name: string
  slug: string | null
  category: string | null
  description: string | null
  website: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  tags: string[] | null
  social_links: Record<string, string> | null
  plan: string | null
  status: string | null
}

export type PilotAccess =
  | { ok: true; business: PilotBusiness }
  | { ok: false; status: 403; error: string }

export type ListingFootprint = {
  has_description: boolean
  has_website: boolean
  has_phone: boolean
  has_city_state: boolean
  has_facebook: boolean
  has_instagram: boolean
  opportunities: Array<{ id: string; title: string; detail: string }>
}

/** Accepts comma-separated business UUIDs only. Slugs are ignored. */
export function parsePilotBusinessIds(raw?: string | null): Set<string> {
  const ids = new Set<string>()
  for (const part of String(raw || '').split(',')) {
    const id = part.trim().toLowerCase()
    if (UUID_RE.test(id)) ids.add(id)
  }
  return ids
}

export function isPilotBusinessId(rawFlag: string | null | undefined, businessId: string | null | undefined): boolean {
  if (!businessId || !UUID_RE.test(businessId)) return false
  return parsePilotBusinessIds(rawFlag).has(businessId.toLowerCase())
}

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(n)))
}

function hasHttp(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url)
}

function social(links: Record<string, string> | null, key: string): boolean {
  const value = links && typeof links === 'object' ? String(links[key] || links[key.toLowerCase()] || '') : ''
  return hasHttp(value)
}

export function listingFootprint(biz: PilotBusiness): ListingFootprint {
  const hasDescription = String(biz.description || '').trim().length > 20
  const hasWebsite = hasHttp(biz.website)
  const hasPhone = String(biz.phone || '').trim().length > 6
  const hasLocation = !!(biz.city && biz.state)
  const hasFacebook = social(biz.social_links, 'facebook')
  const hasInstagram = social(biz.social_links, 'instagram')
  const opportunities: ListingFootprint['opportunities'] = []
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

export function buildListingScore(biz: PilotBusiness, leadCount: number) {
  const listing = listingFootprint(biz)
  const seo = (listing.has_description ? 8 : 0) + (listing.has_website ? 6 : 0) + (listing.has_city_state ? 4 : 0) + (listing.has_phone ? 2 : 0)
  const socialScore = (listing.has_facebook ? 10 : 0) + (listing.has_instagram ? 10 : 0)
  const checks = [
    listing.has_description,
    listing.has_website,
    listing.has_phone,
    listing.has_city_state,
    listing.has_facebook,
    listing.has_instagram,
  ]
  const content = clamp((checks.filter(Boolean).length / checks.length) * 20, 20)
  const plan = String(biz.plan || 'free').toLowerCase()
  const paid = plan !== 'free' && plan !== 'admin' && plan !== ''
  const conversion = (paid ? 10 : 0) + clamp(leadCount, 10)
  const categories = [
    {
      key: 'seo',
      label: 'SEO',
      max: 20,
      score: clamp(seo, 20),
      status: 'scored',
      reasons: [
        listing.has_description ? '+8 Listing description is present.' : '+0 Listing description is missing or too short.',
        listing.has_website ? '+6 Website URL is present.' : '+0 No website URL on this listing.',
        listing.has_city_state ? '+4 City and state are present.' : '+0 City and state are missing.',
        listing.has_phone ? '+2 Phone number is present.' : '+0 Phone number is missing.',
      ],
    },
    {
      key: 'social',
      label: 'Social',
      max: 20,
      score: clamp(socialScore, 20),
      status: listing.has_facebook || listing.has_instagram ? 'scored' : 'partial',
      reasons: [
        listing.has_facebook ? '+10 Facebook URL on this listing.' : '+0 No Facebook URL on this listing.',
        listing.has_instagram ? '+10 Instagram URL on this listing.' : '+0 No Instagram URL on this listing.',
      ],
    },
    {
      key: 'content',
      label: 'Content',
      max: 20,
      score: content,
      status: 'scored',
      reasons: [`${checks.filter(Boolean).length}/${checks.length} listing fields are complete for this business.`],
    },
    {
      key: 'traffic',
      label: 'Traffic',
      max: 20,
      score: 0,
      status: 'not_connected',
      reasons: ['Not connected yet for this listing. Profile traffic will appear after first-party views are recorded.'],
    },
    {
      key: 'conversion',
      label: 'Conversion',
      max: 20,
      score: clamp(conversion, 20),
      status: 'scored',
      reasons: [
        paid ? '+10 Current plan is paid.' : '+0 Current plan is free.',
        `+${clamp(leadCount, 10)} Directory leads counted for this listing only (${leadCount}).`,
      ],
    },
  ]
  const total = categories.reduce((sum, c) => sum + c.score, 0)
  return { total: clamp(total, 100), max: 100 as const, categories }
}

export function buildProgress(listing: ListingFootprint, trial: MarketingTrialView, leadCount: number) {
  const items = [
    { id: 'description', label: 'Listing description', done: listing.has_description },
    { id: 'website', label: 'Website', done: listing.has_website },
    { id: 'phone', label: 'Phone', done: listing.has_phone },
    { id: 'location', label: 'City and state', done: listing.has_city_state },
    { id: 'facebook', label: 'Facebook', done: listing.has_facebook },
    { id: 'instagram', label: 'Instagram', done: listing.has_instagram },
  ]
  return {
    window_days: MARKETING_TRIAL_DURATION_DAYS,
    completed: items.filter((item) => item.done).length,
    total: items.length,
    items,
    trial_days_remaining: trial.days_remaining,
    listing_leads: leadCount,
  }
}

export function buildUpgrade(plan: string | null) {
  const current = String(plan || 'free').toLowerCase() || 'free'
  return {
    current_plan: current,
    headline: 'Keep Growing After Your Free Trial',
    detail: current === 'free'
      ? 'Upgrade to keep your listing promoted and unlock more customer tools. Billing stays on your existing My Latino List plans.'
      : 'Your current paid plan stays in place. Review billing anytime from your workspace.',
    billing_path: '/pages/billing.html',
    cta_label: 'View Plans',
  }
}

export function buildCustomerPilotSummary(biz: PilotBusiness, leadCount: number, trial: MarketingTrialView) {
  const listing = listingFootprint(biz)
  const score = buildListingScore(biz, leadCount)
  const progress = buildProgress(listing, trial, leadCount)
  const upgrade = buildUpgrade(biz.plan)
  return {
    business: { id: biz.id, name: biz.name },
    listing,
    trial,
    score,
    opportunities: listing.opportunities,
    progress,
    upgrade,
  }
}

/**
 * Authorize the Marketing & AI Growth pilot.
 * Requires an authenticated userId, profiles.business_id ownership, and a
 * business_id feature flag. Never uses listing slug or query params.
 */
export async function authorizeMarketingPilot(
  supabase: { from: (table: string) => any },
  userId: string,
  flagRaw?: string | null,
): Promise<PilotAccess> {
  const denied: PilotAccess = { ok: false, status: 403, error: 'Marketing & AI Growth is not enabled for this account.' }
  if (!userId) return denied

  const allowed = parsePilotBusinessIds(flagRaw)
  if (!allowed.size) return denied

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', userId)
    .maybeSingle()

  const assignedId = profileRow?.business_id ? String(profileRow.business_id) : ''
  if (!assignedId || !allowed.has(assignedId.toLowerCase())) return denied

  const { data: businessRow } = await supabase
    .from('businesses')
    .select('id, name, slug, category, description, website, phone, email, address, city, state, zip, tags, social_links, owner_id, plan, status')
    .eq('id', assignedId)
    .eq('owner_id', userId)
    .maybeSingle()

  if (!businessRow?.id) return denied

  return {
    ok: true,
    business: {
      id: String(businessRow.id),
      name: String(businessRow.name ?? ''),
      slug: (businessRow.slug as string | null) ?? null,
      category: (businessRow.category as string | null) ?? null,
      description: (businessRow.description as string | null) ?? null,
      website: (businessRow.website as string | null) ?? null,
      phone: (businessRow.phone as string | null) ?? null,
      email: (businessRow.email as string | null) ?? null,
      address: (businessRow.address as string | null) ?? null,
      city: (businessRow.city as string | null) ?? null,
      state: (businessRow.state as string | null) ?? null,
      zip: (businessRow.zip as string | null) ?? null,
      tags: Array.isArray(businessRow.tags) ? (businessRow.tags as string[]) : null,
      social_links: (businessRow.social_links as Record<string, string> | null) ?? null,
      plan: (businessRow.plan as string | null) ?? null,
      status: (businessRow.status as string | null) ?? null,
    },
  }
}
