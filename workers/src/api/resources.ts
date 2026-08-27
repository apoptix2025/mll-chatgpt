import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'

export async function handleResources(request: Request, env: Env): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const url = new URL(request.url)
  const category = url.searchParams.get('category') || ''

  let query = supabase
    .from('resources')
    .select('*')
    .order('sort_order', { ascending: true })

  if (category) query = query.eq('category', category)

  const { data, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ resources: data })
}
