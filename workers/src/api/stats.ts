import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'

export async function handleStats(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('businesses')
    .select('state')
    .eq('status', 'active')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const businesses = data?.length ?? 0
  const states = new Set(data?.map(b => b.state).filter(Boolean)).size

  return Response.json({ businesses, states })
}
