# MLL Marketing Command Center V1 — staging report

Date: 2026-09-07  
Status: PASS (staging only)

## Identifiers

- Branch: `feature/mll-marketing-command-center`
- Commit: `f00bad7f` (`fix: keep Phase 1 analytics on KV until Analytics Engine is enabled`; feature commit `1713f53`)
- Production changed: **NO**
- Production tag `mll-v2.1.0` / commit `e2072fb` untouched

## Deployments

- Staging Worker: `mll-api-staging` version `227e7ecb-33a7-40b5-9cb4-27e9ed517b46`
- Staging Pages: `mylatinolist-staging` `bbc8873b-11fb-45b4-b7eb-6952114eb2e3`
- Staging URL: https://mll-v2-dev.mylatinolist-staging.pages.dev
- Command Center: https://mll-v2-dev.mylatinolist-staging.pages.dev/pages/marketing-command-center.html
- Staging API: https://mll-api-staging.sparkling-hill-934f.workers.dev

Worker bindings (redacted): staging KV `878fc402…`, R2 `mll-media-dev`, AI, `ENVIRONMENT=staging`, staging Supabase `bjtfrmkhishoadjtpzgg`. No production KV/R2/DB.

## Migration

- Created: **NO**
- Applied: **NO**
- Campaigns, packs, baseline, and event counters use existing staging KV.

## Analytics Engine

- Status: **NOT REQUIRED** for Phase 1
- Account returned Cloudflare error 10089 (AE not enabled). Binding was not left in wrangler so staging/production deploys do not require a dashboard paid-feature toggle.
- First-party events write to KV (`mkt:events:{date}`). Optional `env.ANALYTICS?.writeDataPoint` is a no-op until AE exists.

## Tests

- New `scripts/test-marketing-command-center.mjs`: PASS
- Existing MLL regression suite (theme, AI, partners, static, profile, dashboard, pricing, CORS, billing): PASS
- Worker `tsc --noEmit`: PASS
- Staging safety isolation: PASS
- Wrangler `--env staging --dry-run`: PASS (staging resources only)

## Live staging checks

- Command center HTML loads
- Unauthenticated `/api/admin/marketing/*` → 401
- Analytics `homepage_view` accepted; sensitive `password` field → 400
- Public `/api/ai/status` still enabled (quotas 3/10 unchanged)
- Staging `/api/health` healthy
- Production `/api/health` healthy
- Production does not serve the Command Center generate-pack UI

Admin-authenticated pack generation and campaign create were not executed here (no admin password in session). Sign in as `info@apoptix.io` on staging to generate one pack and one draft campaign.

## Security

- Admin gate reuses `isAdmin(info@apoptix.io)`
- No query-param auth, no bypass tokens
- Analytics allowlist + sensitive key rejection
- Marketing AI prompt forbids fabricated businesses/stats; promote list is filtered to grounded listings

## Mobile QA

- Responsive CSS: KPI/grid stack; campaign table hidden under 640px in favor of cards
- Pixel visual: MANUAL_REQUIRED (no browser screenshot tooling)
- Existing homepage mobile header/hamburger/floating AI source unchanged

## Estimated incremental monthly cost

**~$0 to $2** (target $0–$5). Extra KV writes + a few admin llama-3.2-3b pack calls. No new vendor. Public AI quotas unchanged.

## Known limitations

- Traffic category stays “Not connected yet” until first-party page events accumulate
- 30-day % improvements are not invented; shows “Baseline collection in progress.” until a prior snapshot exists
- Campaigns/packs are KV-backed, not Postgres
- Analytics Engine not enabled on the Cloudflare account
- Marketing pack quality depends on the small instruct model and grounded listing context
- Nothing auto-posts to social networks

## Production promotion checklist

1. Admin live QA: score, empty/connecting copy, one pack, one campaign, mobile layout  
2. Confirm public homepage/AI/billing unchanged on staging  
3. Do **not** apply a production Supabase migration (none exists)  
4. Explicit production deploy authorization required  
5. Optional later: enable AE in the Cloudflare dashboard if desired  

## Rollback (staging only)

- Worker: restore previous `mll-api-staging` version (pre-`227e7ecb-…`)
- Pages: restore `bc791902-3b1b-464b-89d5-bac742103d64` (last staging homepage before this feature)
- Git: leave `mll-v2-dev` / production alone; delete or ignore this feature branch if abandoned

## Changed files

Plan, Command Center page/js/css, `mll-analytics.js`, nav + admin sidebar hook, Worker `marketing.ts` / `analytics.ts` / `marketing-score.ts`, index routes, light event hooks in AI/enroll/stripe, wrangler (no AE bind), tests.
