import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { handleDetailedHealth } from './health'
import { authorizeMarketingPilot } from '../lib/marketing-pilot'

export const ADMIN_EMAILS = ['info@apoptix.io']

export function isAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.includes(email ?? '')
}

export async function handleAuth(request: Request, env: Env): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
  const url = new URL(request.url)

  // POST /api/auth/login
  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const { email, password } = await request.json() as { email: string; password: string }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) return Response.json({ error: 'Invalid email or password' }, { status: 401 })

    return Response.json({
      access_token: data.session?.access_token,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        first_name: data.user?.user_metadata?.first_name,
        last_name: data.user?.user_metadata?.last_name,
      },
    })
  }

  // POST /api/auth/logout
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    await supabase.auth.signOut()
    return Response.json({ success: true })
  }

  // POST /api/auth/reset-password
  if (url.pathname === '/api/auth/reset-password' && request.method === 'POST') {
    const { email } = await request.json() as { email: string }
    const redirectBase = env.ENVIRONMENT === 'production'
      ? 'https://mylatinolist.io'
      : 'https://mylatinolist.io'
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectBase}/pages/reset-password.html`,
    })
    // Always return success to prevent email enumeration
    return Response.json({ success: true, message: 'If this email exists, a reset link was sent.' })
  }

  // GET /api/auth/me — get current user profile
  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return Response.json({ error: 'No token' }, { status: 401 })

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return Response.json({ error: 'Invalid token' }, { status: 401 })

    // Get their business profile too
    const serviceSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('*, businesses(*)')
      .eq('id', user.id)
      .single()

    const pilot = await authorizeMarketingPilot(serviceSupabase, user.id, env.MLL_MARKETING_PILOT_BUSINESS_IDS)
    const marketing_pilot = { enabled: pilot.ok }

    // Force admin plan for root admin email regardless of DB state
    if (isAdmin(user.email) && profile) {
      const bizArr = Array.isArray(profile.businesses)
        ? profile.businesses
        : profile.businesses ? [profile.businesses] : []
      const adminBiz = bizArr.map((b: Record<string, unknown>) => ({
        ...b, plan: 'admin', expires_at: null, status: 'active',
      }))
      return Response.json({ user, profile: { ...profile, plan: 'admin', businesses: adminBiz }, marketing_pilot })
    }

    return Response.json({ user, profile, marketing_pilot })
  }

  // POST /api/auth/update-password — set new password after reset
  if (url.pathname === '/api/auth/update-password' && request.method === 'POST') {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return Response.json({ error: 'No token' }, { status: 401 })

    const { password } = await request.json() as { password: string }
    if (!password || password.length < 8)
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

    // Use service key to update password by verifying the OTP token
    const serviceSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

    // First get the user from the access token
    const anonSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const { data: { user }, error: userError } = await anonSupabase.auth.getUser(token)

    if (userError || !user) {
      return Response.json({ error: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 })
    }

    // Update password using admin API
    const { error } = await serviceSupabase.auth.admin.updateUserById(user.id, { password })
    if (error) return Response.json({ error: error.message }, { status: 400 })

    return Response.json({ success: true })
  }

  // PATCH /api/auth/me — update profile name
  if (url.pathname === '/api/auth/me' && request.method === 'PATCH') {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return Response.json({ error: 'No token' }, { status: 401 })

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return Response.json({ error: 'Invalid token' }, { status: 401 })

    const body = await request.json() as { first_name?: string; last_name?: string }
    const serviceSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

    await serviceSupabase
      .from('profiles')
      .update({ first_name: body.first_name, last_name: body.last_name })
      .eq('id', user.id)

    return Response.json({ success: true })
  }

  // ── Admin-only routes ──────────────────────────────────────
  if (url.pathname.startsWith('/api/admin')) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const anonSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const { data: { user }, error: userError } = await anonSupabase.auth.getUser(token)
    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin(user.email)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

    // GET /api/admin/health
    if (url.pathname === '/api/admin/health' && request.method === 'GET') {
      return handleDetailedHealth(env)
    }

    // POST /api/admin/set-plan
    if (url.pathname === '/api/admin/set-plan' && request.method === 'POST') {
      const body = await request.json() as {
        business_id: string
        plan: 'free' | 'pro' | 'featured' | 'admin'
        expires_at?: string
      }
      if (!body.business_id || !body.plan) {
        return Response.json({ error: 'business_id and plan are required' }, { status: 400 })
      }
      const updates: Record<string, unknown> = { plan: body.plan, updated_at: new Date().toISOString() }
      if (body.expires_at !== undefined) updates.expires_at = body.expires_at || null
      const { data, error } = await serviceSupabase
        .from('businesses')
        .update(updates)
        .eq('id', body.business_id)
        .select()
        .single()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ success: true, business: data })
    }

    // GET /api/admin/businesses
    if (url.pathname === '/api/admin/businesses' && request.method === 'GET') {
      const { data, error } = await serviceSupabase
        .from('businesses')
        .select('*, profiles(email, first_name, last_name)')
        .order('created_at', { ascending: false })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ businesses: data })
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}
