import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'

export async function handleReferral(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const url  = new URL(request.url)
  const code = url.pathname.split('/').pop()?.toUpperCase()
  if (!code) return Response.json({ error: 'Missing referral code' }, { status: 400 })

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const { data } = await supabase
    .from('businesses')
    .select('id, name, city, state')
    .eq('referral_code', code)
    .eq('status', 'active')
    .single()

  if (!data) return Response.json({ error: 'Invalid referral code' }, { status: 404 })

  return Response.json({ valid: true, business: data })
}
