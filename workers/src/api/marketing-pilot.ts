import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { authorizeMarketingPilot, buildCustomerPilotSummary } from '../lib/marketing-pilot'
import { activateMarketingTrial, MarketingTrialStorageError, presentMarketingTrial } from '../lib/marketing-trial'

export async function handleMarketingPilot(request: Request, env: Env, userId: string): Promise<Response> {
  const url = new URL(request.url)
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const access = await authorizeMarketingPilot(supabase, userId, env.MLL_MARKETING_PILOT_BUSINESS_IDS)
  if (!access.ok) {
    return Response.json({ error: access.error, enabled: false }, { status: access.status })
  }

  if (url.pathname === '/api/marketing/pilot' || url.pathname === '/api/marketing/pilot/') {
    return Response.json({
      enabled: true,
      business_id: access.business.id,
      name: access.business.name,
    })
  }

  if (url.pathname === '/api/marketing/pilot/summary') {
    try {
      const trialRow = await activateMarketingTrial(supabase, access.business.id)
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', access.business.id)
      const leadCount = typeof count === 'number' ? count : 0
      return Response.json(buildCustomerPilotSummary(
        access.business,
        leadCount,
        presentMarketingTrial(trialRow),
      ))
    } catch (err) {
      if (err instanceof MarketingTrialStorageError && err.code === 'unavailable') {
        return Response.json({ error: err.message }, { status: 503 })
      }
      return Response.json({ error: 'Could not load marketing trial.' }, { status: 500 })
    }
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}
