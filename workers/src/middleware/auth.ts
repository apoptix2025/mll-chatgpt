import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'

interface AuthResult {
  ok: boolean
  userId: string
  email?: string
  role?: string
}

export async function withAuth(request: Request, env: Env): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, userId: '' }
  }

  const token = authHeader.replace('Bearer ', '').trim()

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return { ok: false, userId: '' }
    }

    return {
      ok: true,
      userId: user.id,
      email: user.email,
      role: user.user_metadata?.role || 'owner',
    }
  } catch {
    return { ok: false, userId: '' }
  }
}
