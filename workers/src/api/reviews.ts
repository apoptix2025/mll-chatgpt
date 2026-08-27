import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { notifyReview } from './notify'

export async function handleReviews(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const url      = new URL(request.url)
  const path     = url.pathname

  // GET /api/reviews?business_id=xxx — fetch reviews for a business
  if (request.method === 'GET') {
    const bizId = url.searchParams.get('business_id')
    if (!bizId) return Response.json({ error: 'business_id required' }, { status: 400 })

    const { data, error } = await supabase
      .from('reviews')
      .select('id, reviewer_name, rating, body, created_at')
      .eq('business_id', bizId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ reviews: data })
  }

  // POST /api/reviews — submit a new review
  if (request.method === 'POST') {
    let body: any
    try { body = await request.json() }
    catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const { business_id, reviewer_name, reviewer_email, rating, body: reviewBody } = body

    // Validate
    if (!business_id)    return Response.json({ error: 'business_id is required' }, { status: 400 })
    if (!reviewer_name)  return Response.json({ error: 'Your name is required' }, { status: 400 })
    if (!rating || rating < 1 || rating > 5)
                         return Response.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    if (!reviewBody?.trim()) return Response.json({ error: 'Review text is required' }, { status: 400 })

    // Basic spam check — no URLs in review body
    const urlPattern = /https?:\/\/|www\./i
    if (urlPattern.test(reviewBody)) {
      return Response.json({ error: 'Reviews cannot contain links' }, { status: 400 })
    }

    // Check business exists
    const { data: biz } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', business_id)
      .single()

    if (!biz) return Response.json({ error: 'Business not found' }, { status: 404 })

    // Duplicate check — same email + same business in last 24h
    if (reviewer_email) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('business_id', business_id)
        .eq('reviewer_email', reviewer_email)
        .gte('created_at', since)
        .limit(1)

      if (existing?.length) {
        return Response.json({ error: 'You already submitted a review for this business recently' }, { status: 429 })
      }
    }

    // Insert review — auto-published, trigger updates business rating
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        business_id,
        reviewer_name: reviewer_name.trim(),
        reviewer_email: reviewer_email?.trim() || null,
        rating: parseInt(rating),
        body: reviewBody.trim(),
        status: 'published',
      })
      .select('id, reviewer_name, rating, body, created_at')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    ctx.waitUntil(notifyReview(env, {
      businessName: biz.name,
      businessId:   business_id,
      reviewerName: reviewer_name.trim(),
      rating:       parseInt(rating),
      body:         reviewBody.trim(),
    }).catch((e) => console.error('notify review failed:', e)))

    return Response.json({
      success: true,
      message: 'Review submitted successfully',
      review,
    }, { status: 201 })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
