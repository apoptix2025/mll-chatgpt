const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PilotBusiness = {
  id: string
  name: string
  description: string | null
  website: string | null
  phone: string | null
  city: string | null
  state: string | null
  social_links: Record<string, string> | null
}

export type PilotAccess =
  | { ok: true; business: PilotBusiness }
  | { ok: false; status: 403; error: string }

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
    .select('id, name, description, website, phone, city, state, social_links, owner_id')
    .eq('id', assignedId)
    .eq('owner_id', userId)
    .maybeSingle()

  if (!businessRow?.id) return denied

  return {
    ok: true,
    business: {
      id: String(businessRow.id),
      name: String(businessRow.name ?? ''),
      description: (businessRow.description as string | null) ?? null,
      website: (businessRow.website as string | null) ?? null,
      phone: (businessRow.phone as string | null) ?? null,
      city: (businessRow.city as string | null) ?? null,
      state: (businessRow.state as string | null) ?? null,
      social_links: (businessRow.social_links as Record<string, string> | null) ?? null,
    },
  }
}
