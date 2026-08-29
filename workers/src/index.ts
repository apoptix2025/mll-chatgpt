import { handleBusinesses } from './api/businesses'
import { handleEnroll } from './api/enroll'
import { handleAuth } from './api/auth'
import { handleMarketplace } from './api/marketplace'
import { handleJobs } from './api/jobs'
import { handleAffiliates } from './api/affiliates'
import { handleUploads } from './api/uploads'
import { handleResources } from './api/resources'
import { handleReviews } from './api/reviews'
import { handleLeads } from './api/leads'
import { handleStripe } from './api/stripe'
import { handleStats } from './api/stats'
import { handleContact } from './api/contact'
import { handleHealth } from './api/health'
import { handleReferral } from './api/referral'
import { handleSitemap } from './api/sitemap'
import { handleTestDrip } from './api/admin-test'
import { withCors } from './middleware/cors'
import { withAuth } from './middleware/auth'
import { handleScheduled } from './cron'
import { handlePublicMedia } from './lib/media'

export interface Env {
  // KV
  SESSION_CACHE: KVNamespace
  // R2
  MEDIA: R2Bucket
  // Secrets
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  RESEND_API_KEY: string
  ALGOLIA_APP_ID: string
  ALGOLIA_ADMIN_KEY: string
  FB_PAGE_ACCESS_TOKEN: string
  ADMIN_TEST_TOKEN: string
  // Vars
  ENVIRONMENT: string
  FRONTEND_URL: string
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env, ctx))
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request)
    }

    try {
      let response: Response

      // ── Stripe webhook — MUST be before auth, needs raw body ──
      if (path === '/api/stripe/webhook' && request.method === 'POST') {
        response = await handleStripe(request, env, ctx)
        return withCors(response, request)
      }

      // ── Admin routes (auth enforced inside handler) ────────
      if (path === '/api/admin/test-drip' && request.method === 'POST') {
        response = await handleTestDrip(request, env)
        return withCors(response, request)
      }
      if (path.startsWith('/api/admin'))         response = await handleAuth(request, env)

      // ── Public routes (no auth required) ──────────────────
      else if (path.startsWith('/api/auth'))     response = await handleAuth(request, env)
      else if (path.startsWith('/api/enroll'))   response = await handleEnroll(request, env, ctx)
      else if (path.startsWith('/api/businesses') && request.method === 'GET')
                                                  response = await handleBusinesses(request, env)
      else if (path.startsWith('/api/jobs') && request.method === 'GET')
                                                  response = await handleJobs(request, env)
      else if (path.startsWith('/api/marketplace') && request.method === 'GET')
                                                  response = await handleMarketplace(request, env)
      else if (path.startsWith('/api/affiliates') && request.method === 'GET')
                                                  response = await handleAffiliates(request, env)
      else if (path.startsWith('/api/resources') && request.method === 'GET')
                                                  response = await handleResources(request, env)
      else if (path.startsWith('/api/reviews'))   response = await handleReviews(request, env, ctx)
      else if (path.startsWith('/api/leads') && request.method === 'POST')
                                                  response = await handleLeads(request, env)
      else if (path.startsWith('/api/media/'))    response = await handlePublicMedia(request, env)
      else if (path === '/api/stats' && request.method === 'GET')
                                                  response = await handleStats(request, env)
      else if (path === '/api/contact' && request.method === 'POST')
                                                  response = await handleContact(request, env)
      else if (path === '/api/health' && request.method === 'GET')
                                                  response = await handleHealth(request, env)
      else if (path.startsWith('/api/referral') && request.method === 'GET')
                                                  response = await handleReferral(request, env)
      else if (path === '/api/sitemap' && request.method === 'GET')
                                                  response = await handleSitemap(request, env)

      // ── Protected routes (auth required) ──────────────────
      else {
        const authResult = await withAuth(request, env)
        if (!authResult.ok) {
          return withCors(
            Response.json({ error: 'Unauthorized' }, { status: 401 }),
            request
          )
        }

        if (path.startsWith('/api/businesses'))      response = await handleBusinesses(request, env, authResult.userId, ctx)
        else if (path.startsWith('/api/jobs'))        response = await handleJobs(request, env, authResult.userId)
        else if (path.startsWith('/api/marketplace')) response = await handleMarketplace(request, env, authResult.userId)
        else if (path.startsWith('/api/affiliates'))  response = await handleAffiliates(request, env, authResult.userId)
        else if (path.startsWith('/api/leads'))       response = await handleLeads(request, env, authResult.userId)
        else if (path.startsWith('/api/uploads'))     response = await handleUploads(request, env, authResult.userId, ctx)
        else if (path.startsWith('/api/stripe'))      response = await handleStripe(request, env, ctx, authResult.userId)
        else response = Response.json({ error: 'Not found' }, { status: 404 })
      }

      return withCors(response, request)

    } catch (err) {
      console.error('Worker error:', err)
      return withCors(
        Response.json({ error: 'Internal server error' }, { status: 500 }),
        request
      )
    }
  }
}
