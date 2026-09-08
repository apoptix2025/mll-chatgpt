import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { authorizeMarketingPilot, buildCustomerPilotSummary, type PilotBusiness } from '../lib/marketing-pilot'
import { activateMarketingTrial, MarketingTrialStorageError, presentMarketingTrial } from '../lib/marketing-trial'
import {
  buildPackSummary,
  generateCustomerMarketingPack,
  generationEntitlement,
  groundedListingFromBusiness,
  incrementCopyEvents,
  loadCustomerPackUsage,
  MarketingPackStorageError,
  saveGeneratedPack,
} from '../lib/customer-marketing-pack'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

async function authorizedClient(env: Env, userId: string) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const access = await authorizeMarketingPilot(supabase, userId, env.MLL_MARKETING_PILOT_BUSINESS_IDS)
  return { supabase, access }
}

type WorkerDb = { from: (table: string) => any }

async function trialFor(supabase: WorkerDb, businessId: string) {
  const trialRow = await activateMarketingTrial(supabase, businessId)
  return presentMarketingTrial(trialRow)
}

export async function handleMarketingPilot(request: Request, env: Env, userId: string): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  const { supabase, access } = await authorizedClient(env, userId)
  if (!access.ok) {
    return json({ error: access.error, enabled: false }, access.status)
  }

  if (path === '/api/marketing/pilot/pack' && method === 'POST') {
    return generatePack(env, supabase, access.business)
  }

  if (path === '/api/marketing/pilot/pack/copy' && method === 'POST') {
    return recordCopy(supabase, access.business.id)
  }

  if (method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (path === '/api/marketing/pilot' || path === '/api/marketing/pilot/') {
    return json({
      enabled: true,
      business_id: access.business.id,
      name: access.business.name,
    })
  }

  if (path === '/api/marketing/pilot/summary') {
    try {
      const trial = await trialFor(supabase, access.business.id)
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', access.business.id)
      const leadCount = typeof count === 'number' ? count : 0
      const summary = buildCustomerPilotSummary(access.business, leadCount, trial)
      let pack
      try {
        const usage = await loadCustomerPackUsage(supabase, access.business.id)
        pack = buildPackSummary(trial.status, usage, 'ready')
      } catch (err) {
        if (err instanceof MarketingPackStorageError && err.code === 'unavailable') {
          pack = buildPackSummary(trial.status, {
            packs_generated: 0,
            last_pack_generated_at: null,
            last_pack: null,
            content_copy_events: 0,
            model: null,
            fallback: false,
          }, 'unavailable')
        } else {
          throw err
        }
      }
      return json({ ...summary, pack })
    } catch (err) {
      if (err instanceof MarketingTrialStorageError && err.code === 'unavailable') {
        return json({ error: err.message }, 503)
      }
      return json({ error: 'Could not load marketing trial.' }, 500)
    }
  }

  if (path === '/api/marketing/pilot/pack') {
    try {
      const trial = await trialFor(supabase, access.business.id)
      const usage = await loadCustomerPackUsage(supabase, access.business.id)
      return json({
        business_id: access.business.id,
        pack: buildPackSummary(trial.status, usage, 'ready'),
      })
    } catch (err) {
      if (err instanceof MarketingPackStorageError && err.code === 'unavailable') {
        return json({ error: err.message }, 503)
      }
      if (err instanceof MarketingTrialStorageError && err.code === 'unavailable') {
        return json({ error: err.message }, 503)
      }
      return json({ error: 'Could not load Marketing Pack.' }, 500)
    }
  }

  return json({ error: 'Not found' }, 404)
}

async function generatePack(
  env: Env,
  supabase: WorkerDb,
  business: PilotBusiness,
): Promise<Response> {
  if (!env.AI) return json({ error: 'ai_unavailable' }, 503)
  try {
    const trial = await trialFor(supabase, business.id)
    const usage = await loadCustomerPackUsage(supabase, business.id)
    const entitlement = generationEntitlement(trial.status, usage)
    if (!entitlement.allowed) {
      const status = entitlement.reason === 'cooldown' ? 429 : 403
      return json({
        error: entitlement.lock_message || 'Generation is not available.',
        reason: entitlement.reason,
        pack: buildPackSummary(trial.status, usage, 'ready'),
      }, status)
    }

    const listing = groundedListingFromBusiness(business)
    const generated = await generateCustomerMarketingPack({
      listing,
      runAi: (model, payload) => env.AI!.run(model, payload),
    })
    const stored = await saveGeneratedPack(
      supabase,
      business.id,
      generated.pack,
      generated.model,
      generated.fallback,
    )
    return json({
      generated: true,
      fallback: generated.fallback,
      model: generated.model,
      pack: buildPackSummary(trial.status, stored, 'ready'),
    })
  } catch (err) {
    if (err instanceof MarketingPackStorageError && err.code === 'unavailable') {
      return json({ error: err.message }, 503)
    }
    if (err instanceof MarketingTrialStorageError && err.code === 'unavailable') {
      return json({ error: err.message }, 503)
    }
    const message = err instanceof Error ? err.message : ''
    if (message === 'ai_timeout') return json({ error: 'AI generation timed out. Try again.' }, 504)
    if (message === 'ai_failed') return json({ error: 'AI generation failed. Try again.' }, 502)
    return json({ error: 'Could not generate Marketing Pack.' }, 500)
  }
}

async function recordCopy(supabase: WorkerDb, businessId: string): Promise<Response> {
  try {
    const content_copy_events = await incrementCopyEvents(supabase, businessId)
    return json({ ok: true, content_copy_events })
  } catch (err) {
    if (err instanceof MarketingPackStorageError && err.code === 'unavailable') {
      return json({ error: err.message }, 503)
    }
    return json({ error: 'Could not record copy event.' }, 500)
  }
}
