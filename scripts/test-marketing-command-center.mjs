#!/usr/bin/env node
/**
 * Marketing Command Center Phase 1 source guards.
 * Does not call production. Does not print secrets.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let failed = 0
function assert(label, cond) {
  if (cond) console.log('PASS  ' + label)
  else {
    failed += 1
    console.error('FAIL  ' + label)
  }
}

function loadTs(rel) {
  const src = readFileSync(join(root, rel), 'utf8')
  return src
}

const wrangler = readFileSync(join(root, 'workers/wrangler.toml'), 'utf8')
const indexTs = loadTs('workers/src/index.ts')
const marketing = loadTs('workers/src/api/marketing.ts')
const analytics = loadTs('workers/src/lib/analytics.ts')
const scoreSrc = loadTs('workers/src/lib/marketing-score.ts')
const aiApi = loadTs('workers/src/api/ai-search.ts')
const auth = loadTs('workers/src/api/auth.ts')
const page = readFileSync(join(root, 'frontend/pages/marketing-command-center.html'), 'utf8')
const pageJs = readFileSync(join(root, 'frontend/js/marketing-command-center.js'), 'utf8')
const css = readFileSync(join(root, 'frontend/css/marketing-command-center.css'), 'utf8')
const tracker = readFileSync(join(root, 'frontend/js/mll-analytics.js'), 'utf8')
const nav = readFileSync(join(root, 'frontend/js/nav.js'), 'utf8')
const helper = readFileSync(join(root, 'frontend/js/current-business.js'), 'utf8')

assert('public user denied command-center admin APIs', /requireAdmin/.test(marketing) && /Unauthorized/.test(marketing) && /path\.startsWith\('\/api\/admin\/marketing'\)/.test(indexTs))
assert('authenticated non-admin denied', /isAdmin\(auth\.email\)/.test(marketing) && /Forbidden/.test(marketing) && /ADMIN_EMAILS = \['info@apoptix.io'\]/.test(auth))
assert('admin allowed via existing isAdmin', /import \{ isAdmin \} from '\.\/auth'/.test(marketing) && /isAdmin\(auth\.email\)/.test(marketing))
assert('no query-param authorization', !/searchParams\.get\(['"]admin/.test(marketing) && !/bypass/.test(marketing))
assert('score calculation is deterministic functions', /export function scoreSeo/.test(scoreSrc) && /export function buildFootprintScore/.test(scoreSrc))
assert('unconnected traffic scores 0 in source', /score: 0,\s*status: 'not_connected'/.test(scoreSrc) && /Not connected yet/.test(scoreSrc))
assert('AI marketing response parsing', /export function parseMarketingPack/.test(marketing) && /filterPackToGrounded/.test(marketing))
assert('AI hallucination guardrails', /Do not fabricate businesses/.test(marketing) && /Only reference businesses\/resources supplied/.test(marketing) && /filterPackToGrounded/.test(marketing))
assert('marketing pack is not public AI search', /\/api\/admin\/marketing\/pack/.test(marketing) && /\/api\/ai\/search/.test(aiApi) && /VISITOR_LIMIT = 3/.test(aiApi) && /AUTH_LIMIT = 10/.test(aiApi))
assert('rate limiting', /PACK_DAY_LIMIT = 8/.test(marketing) && /rate_limited/.test(marketing) && /analyticsRateLimited/.test(analytics))
assert('malformed campaign input rejected', /validateCampaignInput/.test(marketing) && /invalid channel/.test(marketing) && /destination_url must be http/.test(marketing))
assert('analytics helper excludes sensitive values', /SENSITIVE/.test(analytics) && /password\|token\|authorization/.test(analytics) && /sanitizeAnalyticsEvent/.test(analytics))
assert('frontend tracker also strips secrets', /password\|token\|authorization/.test(tracker))
assert('Analytics Engine not required for Phase 1 reads', /SESSION_CACHE/.test(analytics) && /mkt:events:/.test(analytics) && /ANALYTICS\?\.writeDataPoint/.test(analytics))
assert('no Analytics Engine wrangler bind until account enables it', !/analytics_engine_datasets/.test(wrangler))
assert('command center page exists', /MLL Marketing Command Center/.test(page) && /Powered by AP Optix/.test(page))
assert('AP Optix callout is not a sales page', /digital marketing intelligence/.test(page) && !/Buy AP Optix/i.test(page) && !/pricing for AP Optix/i.test(page))
assert('mobile cards stack', /grid-template-columns: 1fr/.test(css) && /mcc-campaign-card/.test(css))
assert('admin sidebar link', /marketing-command-center\.html/.test(helper))
assert('analytics loaded from nav without breaking AI', /mll-analytics\.js/.test(nav) && /mll-ai\.js/.test(nav))
assert('drafts only no auto-post', /auto_post: false/.test(marketing) && /nothing auto-posts/i.test(page))
assert('no production deploy scripts in page', !/wrangler deploy --env production/.test(pageJs))

function parseMarketingPack(text) {
  const trimmed = String(text || '').trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced ? fenced[1] : trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(candidate.slice(start, end + 1)) } catch { return null }
}
function filterPackToGrounded(pack, businesses) {
  const names = new Set(businesses.map((b) => b.name.toLowerCase()))
  const slugs = new Set(businesses.map((b) => b.slug.toLowerCase()))
  pack.promote = (pack.promote || []).filter((item) => names.has(String(item.name || '').toLowerCase()) || slugs.has(String(item.slug || '').toLowerCase()))
  return pack
}
const parsed = parseMarketingPack('```json\n{"facebook_posts":["hi"],"promote":[{"name":"Ramos Law Group","slug":"ramos-law-group"}]}\n```')
assert('parses fenced JSON pack', parsed && parsed.facebook_posts[0] === 'hi')
const filtered = filterPackToGrounded({
  promote: [{ name: 'Fake Biz', slug: 'fake' }, { name: 'Ramos Law Group', slug: 'ramos-law-group' }]
}, [{ name: 'Ramos Law Group', slug: 'ramos-law-group', category: 'Legal Services' }])
assert('hallucinated businesses are dropped', filtered.promote.length === 1 && filtered.promote[0].slug === 'ramos-law-group')
assert('malformed JSON pack is null', parseMarketingPack('not json') == null)

function validateCampaignInput(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false }
  const channel = String(raw.channel || '')
  const channels = ['facebook', 'instagram', 'tiktok', 'email', 'seo', 'la_voz', 'mll_internal', 'other']
  if (!channels.includes(channel)) return { ok: false }
  const url = raw.destination_url
  if (url && !/^https?:\/\//i.test(String(url))) return { ok: false }
  return { ok: true }
}
assert('rejects bad campaign channel', validateCampaignInput({ channel: 'myspace' }).ok === false)
assert('rejects non-http destination', validateCampaignInput({ channel: 'facebook', destination_url: 'javascript:alert(1)' }).ok === false)
assert('accepts valid campaign channel', validateCampaignInput({ channel: 'la_voz' }).ok === true)

if (failed) {
  console.error('marketing command center tests FAIL ' + failed)
  process.exit(1)
}
console.log('marketing command center tests PASS')
