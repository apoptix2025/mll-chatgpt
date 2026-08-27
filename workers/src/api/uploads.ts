import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { publicMediaUrl } from '../lib/media'

export async function handleUploads(
  request: Request,
  env: Env,
  userId: string,
  ctx?: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url)

  if (url.pathname === '/api/uploads/business-photo' && request.method === 'POST') {
    return uploadBusinessPhoto(request, env, userId)
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}

async function uploadBusinessPhoto(request: Request, env: Env, userId: string): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

  // Verify the user owns a business
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .single()

  if (bizError || !business) {
    return Response.json({ error: 'No business found for this account' }, { status: 404 })
  }

  const bizId = business.id

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const photo = formData.get('photo') as unknown as File
  if (!photo || typeof photo === 'string') {
    return Response.json({ error: 'No photo provided' }, { status: 400 })
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(photo.type)) {
    return Response.json({ error: 'File type not allowed. Use JPEG, PNG, or WebP.' }, { status: 400 })
  }

  if (photo.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'File too large. Max 5MB.' }, { status: 400 })
  }

  const ext = photo.type === 'image/jpeg' ? 'jpg' : photo.type === 'image/png' ? 'png' : 'webp'
  const key = `businesses/${bizId}/logo.${ext}`

  await env.MEDIA.put(key, photo.stream(), {
    httpMetadata: { contentType: photo.type },
  })

  const logoUrl = publicMediaUrl(env, key, request)

  const { error: updateError } = await supabase
    .from('businesses')
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq('id', bizId)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  return Response.json({ url: logoUrl })
}
