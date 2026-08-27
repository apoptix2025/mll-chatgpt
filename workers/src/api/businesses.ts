import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { notifyProfileUpdate, notifyPlanUpgrade, notifyPlanCancellation } from './notify'

function normalizeUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return 'https://' + url
}

export async function handleBusinesses(
  request: Request,
  env: Env,
  userId?: string,
  ctx?: ExecutionContext
): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const url = new URL(request.url)
  const method = request.method

  // GET /api/businesses — public directory listing
  if (method === 'GET' && url.pathname === '/api/businesses') {
    const search   = url.searchParams.get('q') || ''
    const category = url.searchParams.get('category') || ''
    const city     = url.searchParams.get('city') || ''
    const page     = parseInt(url.searchParams.get('page') || '1')
    const limit    = 12
    const offset   = (page - 1) * limit

    let query = supabase
      .from('businesses')
      .select('id,name,slug,category,city,state,description,emoji,logo_url,rating,review_count,is_featured,tags', { count: 'exact' })
      .eq('status', 'active')
      .neq('status', 'expired')
      .neq('name', 'Test')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1)

    if (search)   query = query.ilike('name', `%${search}%`)
    if (category) query = query.ilike('category', category)
    if (city)     query = query.ilike('city', `%${city}%`)

    const { data, error, count } = await query

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ businesses: data, total: count, page, limit })
  }

  // GET /api/businesses/:id — single business
  if (method === 'GET' && url.pathname.match(/^\/api\/businesses\/[\w-]+$/)) {
    const id = url.pathname.split('/').pop()

    // Determine if id is a UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')

    let query = supabase.from('businesses').select('*').eq('status', 'active')
    if (isUUID) { query = query.eq('id', id) }
    else        { query = query.eq('slug', id) }

    const { data, error } = await query.single()

    if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
    data.website = normalizeUrl(data.website)
    return Response.json({ business: data })
  }

  // PUT /api/businesses/:id — update own business (auth required)
  if (method === 'PUT' && userId) {
    const id   = url.pathname.split('/').pop()
    const body = await request.json() as Record<string, unknown>

    // Ensure owner can only update their own business
    const { data: existing } = await supabase
      .from('businesses')
      .select('owner_id, plan, name')
      .eq('id', id)
      .single()

    if (!existing || existing.owner_id !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const allowed = ['name','description','phone','website','address','city','state',
                     'zip','hours','tags','emoji','social_links','plan']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }
    if ('website' in updates) updates.website = normalizeUrl(updates.website as string | null)
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    const ownerEmail = (body as Record<string, unknown>).email as string | undefined

    if (ctx && 'plan' in updates && updates.plan !== existing.plan) {
      const planOrder: Record<string, number> = { free: 0, pro: 1, featured: 2 }
      const oldPlan = existing.plan as string
      const newPlan = updates.plan as string
      if ((planOrder[newPlan] ?? 0) > (planOrder[oldPlan] ?? 0)) {
        notifyPlanUpgrade(env, { businessName: data.name, email: ownerEmail ?? '', oldPlan, newPlan })
      } else {
        notifyPlanCancellation(env, { businessName: data.name, email: ownerEmail ?? '', plan: oldPlan })
      }
    }

    ctx?.waitUntil(notifyProfileUpdate(env, {
      businessName: data.name,
      businessId:   data.id,
      userId,
      fields:       Object.keys(updates).filter(k => k !== 'updated_at'),
    }).catch((e) => console.error('notify profile update failed:', e)))

    return Response.json({ business: data })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
