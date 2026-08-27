import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { publicMediaUrl } from '../lib/media'

const PRODUCT_ID_PATH = /^\/api\/marketplace\/([0-9a-f-]{36})$/i
const JOB_ID_PATH = /^\/api\/jobs\/([0-9a-f-]{36})$/i

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '23505' || /duplicate key|unique constraint/i.test(error.message || '')
}

async function assertProductOwner(
  supabase: any,
  productId: string,
  userId: string
): Promise<{ ok: true; product: { id: string; business_id: string } } | { ok: false; status: number; error: string }> {
  const { data: product } = await supabase
    .from('products')
    .select('id, business_id')
    .eq('id', productId)
    .maybeSingle()
  if (!product) return { ok: false, status: 404, error: 'Not found' }
  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', product.business_id)
    .maybeSingle()
  if (!biz || biz.owner_id !== userId) return { ok: false, status: 403, error: 'Forbidden' }
  return { ok: true, product }
}

async function assertJobOwner(
  supabase: any,
  jobId: string,
  userId: string
): Promise<{ ok: true; job: { id: string; business_id: string } } | { ok: false; status: number; error: string }> {
  const { data: job } = await supabase
    .from('jobs')
    .select('id, business_id')
    .eq('id', jobId)
    .maybeSingle()
  if (!job) return { ok: false, status: 404, error: 'Not found' }
  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', job.business_id)
    .maybeSingle()
  if (!biz || biz.owner_id !== userId) return { ok: false, status: 403, error: 'Forbidden' }
  return { ok: true, job }
}

// ── MARKETPLACE ───────────────────────────────────────────────────────────────
export async function handleMarketplace(request: Request, env: Env, userId?: string): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const url = new URL(request.url)
  const method = request.method

  // GET /api/marketplace — list products
  if (method === 'GET' && url.pathname === '/api/marketplace') {
    const page  = parseInt(url.searchParams.get('page') || '1')
    const limit = 12
    const offset = (page - 1) * limit
    const category = url.searchParams.get('category') || ''

    let query = supabase
      .from('products')
      .select('id,name,price,emoji,bg_color,rating,seller_name,business_id', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) query = query.eq('category', category)

    const { data, error, count } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ products: data, total: count, page, limit })
  }

  // POST /api/marketplace — create product (auth required)
  if (method === 'POST' && userId) {
    const body = await request.json() as Record<string, unknown>

    // Verify user owns a business
    const { data: biz } = await supabase
      .from('businesses')
      .select('id,name')
      .eq('owner_id', userId)
      .single()

    if (!biz) return Response.json({ error: 'No business found for this user' }, { status: 403 })

    const { data, error } = await supabase
      .from('products')
      .insert({
        ...body,
        business_id: biz.id,
        seller_name: biz.name,
        status: 'active',
      })
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ product: data }, { status: 201 })
  }

  // PATCH /api/marketplace/:id — update own product
  const productPatch = url.pathname.match(PRODUCT_ID_PATH)
  if (method === 'PATCH' && userId && productPatch) {
    const owned = await assertProductOwner(supabase, productPatch[1], userId)
    if (!owned.ok) return Response.json({ error: owned.error }, { status: owned.status })

    const body = await request.json() as Record<string, unknown>
    const allowed = ['name', 'description', 'price', 'category', 'emoji', 'bg_color', 'inventory', 'status', 'images']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', owned.product.id)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ product: data })
  }

  // DELETE /api/marketplace/:id — soft-delete (status=inactive)
  if (method === 'DELETE' && userId && productPatch) {
    const owned = await assertProductOwner(supabase, productPatch[1], userId)
    if (!owned.ok) return Response.json({ error: owned.error }, { status: owned.status })

    const { data, error } = await supabase
      .from('products')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', owned.product.id)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, product: data })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}

// ── JOBS ──────────────────────────────────────────────────────────────────────
export async function handleJobs(request: Request, env: Env, userId?: string): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const url = new URL(request.url)
  const method = request.method

  // GET /api/jobs — list jobs
  if (method === 'GET' && url.pathname === '/api/jobs') {
    const page   = parseInt(url.searchParams.get('page') || '1')
    const limit  = 10
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('jobs')
      .select('id,title,company_name,city,state,salary_range,job_type,emoji,emoji_bg,posted_at', { count: 'exact' })
      .eq('status', 'active')
      .order('posted_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ jobs: data, total: count, page, limit })
  }

  // POST /api/jobs — post a job (auth required)
  if (method === 'POST' && userId) {
    const body = await request.json() as Record<string, unknown>

    const { data: biz } = await supabase
      .from('businesses')
      .select('id,name,city,state')
      .eq('owner_id', userId)
      .single()

    if (!biz) return Response.json({ error: 'No business found' }, { status: 403 })

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        ...body,
        business_id: biz.id,
        company_name: biz.name,
        city: biz.city,
        state: biz.state,
        status: 'active',
        posted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ job: data }, { status: 201 })
  }

  const jobMatch = url.pathname.match(JOB_ID_PATH)

  // PATCH /api/jobs/:id — update own job (including status)
  if (method === 'PATCH' && userId && jobMatch) {
    const owned = await assertJobOwner(supabase, jobMatch[1], userId)
    if (!owned.ok) return Response.json({ error: owned.error }, { status: owned.status })

    const body = await request.json() as Record<string, unknown>
    const allowed = ['title', 'description', 'requirements', 'salary_range', 'job_type', 'status', 'bilingual_required']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }
    if ('status' in updates) {
      const status = String(updates.status)
      if (!['active', 'filled', 'closed', 'draft'].includes(status)) {
        return Response.json({ error: 'Invalid job status' }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', owned.job.id)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ job: data })
  }

  // DELETE /api/jobs/:id — close the listing (status=closed)
  if (method === 'DELETE' && userId && jobMatch) {
    const owned = await assertJobOwner(supabase, jobMatch[1], userId)
    if (!owned.ok) return Response.json({ error: owned.error }, { status: owned.status })

    const { data, error } = await supabase
      .from('jobs')
      .update({ status: 'closed' })
      .eq('id', owned.job.id)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, job: data })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}

// ── AFFILIATES ────────────────────────────────────────────────────────────────
export async function handleAffiliates(request: Request, env: Env, userId?: string): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const url = new URL(request.url)

  // GET /api/affiliates — list affiliate programs
  if (request.method === 'GET' && url.pathname === '/api/affiliates') {
    const { data, error } = await supabase
      .from('affiliate_programs')
      .select('id,name,category,emoji,bg_color,description,commission_text,badge_bg,badge_color')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ affiliates: data })
  }

  // POST /api/affiliates/join — join a program (auth required)
  if (request.method === 'POST' && url.pathname === '/api/affiliates/join' && userId) {
    const { program_id } = await request.json() as { program_id: string }
    if (!program_id) return Response.json({ error: 'program_id required' }, { status: 400 })

    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .single()

    if (!biz) return Response.json({ error: 'No business found' }, { status: 403 })

    const { data: existing } = await supabase
      .from('affiliate_enrollments')
      .select('id')
      .eq('business_id', biz.id)
      .eq('program_id', program_id)
      .maybeSingle()

    if (existing) {
      return Response.json({ error: 'Already enrolled' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('affiliate_enrollments')
      .insert({ business_id: biz.id, program_id, status: 'active', joined_at: new Date().toISOString() })
      .select()
      .single()

    if (isUniqueViolation(error)) {
      return Response.json({ error: 'Already enrolled' }, { status: 409 })
    }
    if (error) return Response.json({ error: 'Unable to enroll' }, { status: 500 })
    return Response.json({ enrollment: data }, { status: 201 })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}

// ── UPLOADS ───────────────────────────────────────────────────────────────────
export async function handleUploads(request: Request, env: Env, userId: string): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as unknown as File
  const type = formData.get('type') as string || 'general' // 'logo' | 'product' | 'general'

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: 'File type not allowed. Use JPEG, PNG, or WebP.' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'File too large. Max 5MB.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const key = `${type}/${userId}/${Date.now()}.${ext}`

  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  const publicUrl = publicMediaUrl(env, key, request)

  return Response.json({ url: publicUrl, key }, { status: 201 })
}
