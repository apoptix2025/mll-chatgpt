/**
 * Billing always follows the authenticated profile's assigned business
 * (profiles.business_id → businesses.id), never owner_id + .single().
 */

export type BillingBusiness = {
  id: string
  name: string
  stripe_customer_id: string | null
  plan?: string | null
}

export type BillingProfile = {
  business_id: string | null
  email?: string | null
}

export type ResolveAssignedBusinessResult =
  | { ok: true; business: BillingBusiness; profile: BillingProfile }
  | { ok: false; status: number; error: string }

export async function resolveAssignedBusiness(
  supabase: { from: (table: string) => any },
  userId: string,
  select = 'id, name, stripe_customer_id, plan',
): Promise<ResolveAssignedBusinessResult> {
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('business_id, email')
    .eq('id', userId)
    .maybeSingle()

  if (!profileRow) {
    return { ok: false, status: 404, error: 'Profile not found' }
  }

  const profile: BillingProfile = {
    business_id: (profileRow.business_id as string | null) ?? null,
    email: (profileRow.email as string | null) ?? null,
  }

  if (!profile.business_id) {
    return { ok: false, status: 400, error: 'No business assigned to this account' }
  }

  const { data: businessRow } = await supabase
    .from('businesses')
    .select(select)
    .eq('id', profile.business_id)
    .maybeSingle()

  if (!businessRow?.id) {
    return { ok: false, status: 404, error: 'Business not found' }
  }

  return {
    ok: true,
    profile,
    business: {
      id: String(businessRow.id),
      name: String(businessRow.name ?? ''),
      stripe_customer_id: (businessRow.stripe_customer_id as string | null) ?? null,
      plan: (businessRow.plan as string | null) ?? null,
    },
  }
}
