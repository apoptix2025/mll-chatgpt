export type ScoreStatus = 'scored' | 'partial' | 'not_connected'

export type CategoryScore = {
  key: 'seo' | 'social' | 'content' | 'traffic' | 'conversion'
  label: string
  max: 20
  score: number
  status: ScoreStatus
  reasons: string[]
}

export type FootprintInput = {
  activeListings: number
  withDescription: number
  withCityState: number
  withFacebook: number
  withInstagram: number
  resourceCount: number
  recentResourceDays: number | null
  hasJobOrProduct: boolean
  hasSitemap: boolean
  hasSiteMeta: boolean
  trafficEvents: number
  homepageViews: number
  directoryViews: number
  profileViews: number
  trafficConnected: boolean
  profileCount: number
  paidPlanCount: number
  leadCount: number
}

export type Opportunity = {
  id: string
  title: string
  detail: string
  source: 'directory' | 'content' | 'traffic' | 'conversion' | 'campaigns' | 'social'
}

function clamp(n: number, max: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(max, Math.round(n))
}

function share(part: number, total: number, max: number): number {
  if (total <= 0) return 0
  return clamp((part / total) * max, max)
}

export function scoreSeo(input: FootprintInput): CategoryScore {
  const reasons: string[] = []
  let score = 0
  if (input.hasSiteMeta) {
    score += 4
    reasons.push('+4 Homepage title and meta description are present in the shipped site.')
  } else {
    reasons.push('+0 Homepage meta is not confirmed.')
  }
  if (input.hasSitemap) {
    score += 4
    reasons.push('+4 Sitemap endpoint is available.')
  } else {
    reasons.push('+0 Sitemap endpoint is missing.')
  }
  if (input.activeListings > 0) {
    score += 4
    reasons.push(`+4 ${input.activeListings} active listing(s) with slugs.`)
  } else {
    reasons.push('+0 No active listings to index.')
  }
  const desc = share(input.withDescription, input.activeListings, 4)
  score += desc
  reasons.push(`+${desc} Description coverage ${input.withDescription}/${input.activeListings || 0}.`)
  const loc = share(input.withCityState, input.activeListings, 4)
  score += loc
  reasons.push(`+${loc} City/state coverage ${input.withCityState}/${input.activeListings || 0}.`)
  reasons.push('Google rankings and search impressions are not connected yet.')
  return { key: 'seo', label: 'SEO', max: 20, score: clamp(score, 20), status: 'partial', reasons }
}

export function scoreSocial(input: FootprintInput): CategoryScore {
  const fb = share(input.withFacebook, input.activeListings, 8)
  const ig = share(input.withInstagram, input.activeListings, 8)
  const reasons = [
    `+${fb} Facebook URL on ${input.withFacebook}/${input.activeListings || 0} listings.`,
    `+${ig} Instagram URL on ${input.withInstagram}/${input.activeListings || 0} listings.`,
    'Followers, reach, and engagement are not connected yet (no social APIs in Phase 1).',
  ]
  return {
    key: 'social',
    label: 'Social',
    max: 20,
    score: clamp(fb + ig, 16),
    status: 'partial',
    reasons,
  }
}

export function scoreContent(input: FootprintInput): CategoryScore {
  const resourcePts = clamp(input.resourceCount, 8)
  const recent = input.recentResourceDays != null && input.recentResourceDays <= 30 ? 6 : 0
  const inventory = input.hasJobOrProduct ? 6 : 0
  const reasons = [
    `+${resourcePts} La Voz Latino resources (${input.resourceCount} live).`,
    recent
      ? `+6 Newest resource is ${input.recentResourceDays} day(s) old.`
      : '+0 No La Voz resource in the last 30 days.',
    inventory ? '+6 Jobs or marketplace inventory is live.' : '+0 No active jobs or products.',
  ]
  return { key: 'content', label: 'Content', max: 20, score: clamp(resourcePts + recent + inventory, 20), status: 'scored', reasons }
}

export function scoreTraffic(input: FootprintInput): CategoryScore {
  if (!input.trafficConnected) {
    return {
      key: 'traffic',
      label: 'Traffic',
      max: 20,
      score: 0,
      status: 'not_connected',
      reasons: ['Not connected yet. Analytics collection started — results will appear as traffic is recorded.'],
    }
  }
  const home = clamp(Math.min(8, input.homepageViews), 8)
  const dir = clamp(Math.min(6, input.directoryViews), 6)
  const profile = clamp(Math.min(6, input.profileViews), 6)
  return {
    key: 'traffic',
    label: 'Traffic',
    max: 20,
    score: clamp(home + dir + profile, 20),
    status: 'partial',
    reasons: [
      `+${home} Homepage views recorded: ${input.homepageViews}.`,
      `+${dir} Directory views recorded: ${input.directoryViews}.`,
      `+${profile} Business profile views recorded: ${input.profileViews}.`,
      'These are first-party MLL events only. GA4 rankings are not imported.',
    ],
  }
}

export function scoreConversion(input: FootprintInput): CategoryScore {
  const signups = clamp(Math.min(8, input.profileCount), 8)
  const paid = clamp(Math.min(6, input.paidPlanCount * 2), 6)
  const leads = clamp(Math.min(6, input.leadCount), 6)
  return {
    key: 'conversion',
    label: 'Conversion',
    max: 20,
    score: clamp(signups + paid + leads, 20),
    status: 'scored',
    reasons: [
      `+${signups} Account/profile records: ${input.profileCount}.`,
      `+${paid} Paid-plan listings (excluding free/admin): ${input.paidPlanCount}.`,
      `+${leads} Directory leads: ${input.leadCount}.`,
      'Conversion rate percentages are not invented; only counted records are used.',
    ],
  }
}

export function buildFootprintScore(input: FootprintInput): {
  total: number
  max: 100
  categories: CategoryScore[]
} {
  const categories = [
    scoreSeo(input),
    scoreSocial(input),
    scoreContent(input),
    scoreTraffic(input),
    scoreConversion(input),
  ]
  const total = categories.reduce((sum, c) => sum + c.score, 0)
  return { total: clamp(total, 100), max: 100, categories }
}

export function buildOpportunities(
  input: FootprintInput & { campaignCount: number; packCount: number; incompleteListings: number }
): Opportunity[] {
  const out: Opportunity[] = []
  if (input.incompleteListings > 0) {
    out.push({
      id: 'incomplete-profiles',
      title: 'Complete listing profiles',
      detail: `${input.incompleteListings} active listing(s) are missing a description, phone, website, or logo.`,
      source: 'directory',
    })
  }
  if (input.activeListings > 0 && input.withFacebook + input.withInstagram === 0) {
    out.push({
      id: 'missing-social',
      title: 'Add social links to listings',
      detail: 'No active listing has a Facebook or Instagram URL in social_links.',
      source: 'social',
    })
  }
  if (input.recentResourceDays == null || input.recentResourceDays > 30) {
    out.push({
      id: 'stale-voz',
      title: 'Publish a La Voz Latino update',
      detail: 'No resource in the last 30 days. A fresh article idea is included in the AI Marketing Pack.',
      source: 'content',
    })
  }
  if (!input.trafficConnected) {
    out.push({
      id: 'traffic-connecting',
      title: 'First-party traffic collection is starting',
      detail: 'Website activity will appear after homepage, directory, and profile events are recorded.',
      source: 'traffic',
    })
  }
  if (input.paidPlanCount === 0) {
    out.push({
      id: 'no-paid',
      title: 'No paid subscriptions counted',
      detail: 'Conversion activity currently reflects free/admin listings only. No rates are inferred.',
      source: 'conversion',
    })
  }
  if (input.campaignCount === 0) {
    out.push({
      id: 'no-campaigns',
      title: 'Track the first campaign',
      detail: 'Create a draft campaign so weekly work is visible in the 30-day report.',
      source: 'campaigns',
    })
  }
  if (input.packCount === 0) {
    out.push({
      id: 'no-pack',
      title: 'Generate this week’s marketing pack',
      detail: 'Drafts only. Nothing auto-posts. Approve or copy before publishing anywhere.',
      source: 'campaigns',
    })
  }
  return out
}
