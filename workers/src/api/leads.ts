import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'

export async function handleLeads(request: Request, env: Env): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const url      = new URL(request.url)

  // GET /api/leads?business_id=xxx
  if (request.method === 'GET') {
    const bizId = url.searchParams.get('business_id')
    if (!bizId) return Response.json({ error: 'business_id required' }, { status: 400 })

    const page   = parseInt(url.searchParams.get('page') || '1')
    const limit  = 20
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('leads')
      .select('id, action, created_at', { count: 'exact' })
      .eq('business_id', bizId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ leads: data || [], total: count ?? 0, page, limit })
  }

  // POST /api/leads — track a directory interaction (call/email/directions/website)
  if (request.method === 'POST') {
    let body: { business_id: string; action: string; name?: string; email?: string; message?: string }
    try { body = await request.json() as typeof body }
    catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const { business_id, action } = body
    if (!business_id) return Response.json({ error: 'business_id required' }, { status: 400 })

    const validActions = ['call', 'email', 'directions', 'website']
    if (!action || !validActions.includes(action)) {
      return Response.json({ error: `action must be one of: ${validActions.join(', ')}` }, { status: 400 })
    }

    const { error } = await supabase.from('leads').insert({
      business_id,
      action,
      name:    body.name?.trim()    || null,
      email:   body.email?.trim()   || null,
      message: body.message?.trim() || null,
    })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true }, { status: 201 })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
