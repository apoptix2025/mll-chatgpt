# MLL production release — Marketing Command Center V1

Release date: 2026-09-07  
Status: SUCCESS  
Release tag: `mll-v2.2.0`  
Production git branch: `mll-v2-dev`  
Feature source: `feature/mll-marketing-command-center`  
Pages production environment alias: `main` (Cloudflare Pages production; git has no `main` branch)

## Identifiers

| Item | Before | After |
| --- | --- | --- |
| Git commit | `e2072fb3bdbad0c9e2fda2eef9abd4cdb68c5af0` (`mll-v2.1.0`) / docs `2846bfd` | `9a01e343c4ab6e1d94b6c304865405e657553dcb` |
| Feature HEAD merged | — | `f12046cfe775b2832eb3deabe68afed0047e6a53` (`fix: polish marketing pack report presentation`) |
| Release tag | `mll-v2.1.0` | `mll-v2.2.0` |
| Worker | `mll-api` `50e155ab-a90e-41eb-b329-fb9b83f54e63` | `mll-api` `4eddf94d-19f7-475a-8cf8-b945d4cd18c8` |
| Pages | `mll-cloudflare` `e49694ae-60ce-4b4d-a64b-fb334b513f16` | `mll-cloudflare` `edd53fb7-0e7c-4536-b610-c4b0d33859a6` |

Production URLs:

- https://mylatinolist.io
- https://www.mylatinolist.io
- https://api.mylatinolist.io
- Marketing Command Center: https://mylatinolist.io/pages/marketing-command-center.html

Verified feature ancestry before merge:

- `fadceb18fae56e7debe2d0597b442709559831dc` — staging verification docs
- `8c19157f26f72c4ce8bc48f80846ef0fc91d33db` — grounded pack quality
- `f12046cfe775b2832eb3deabe68afed0047e6a53` — Marketing Pack report-card UI (final feature commit; not guessed)

## What shipped

- MLL Marketing Command Center V1, Powered by AP Optix
- Digital Footprint Score from measurable production MLL data
- Growth Opportunities
- AI Marketing Pack (one Workers AI call, draft-only, grounded listings)
- Deterministic promotion candidates from real active directory listings
- Platform-specific Facebook / Instagram / TikTok content
- Structured TikTok/Reel, La Voz, and email/newsletter concepts
- Professional report-card UI with standardized Copy/Copied
- Unsupported-superlative guardrails
- Campaign Tracker
- Latest Growth Activity
- 30-Day Progress
- Marketing Pack persistence and counters in production KV
- Admin-only authorization (`info@apoptix.io`)
- Mobile-responsive Command Center presentation

## Production config (unchanged resources)

- Worker: `mll-api` (`wrangler deploy --env production`)
- Binding: `AI`
- Flag: `MLL_AI_ENABLED=true` under `[env.production]` only
- Model: `@cf/meta/llama-3.2-3b-instruct`
- Quota store: production KV `SESSION_CACHE` `8934635b28204b7eb3b58566bd97af43`
- Public anonymous AI limit: 3/UTC day
- Public authenticated AI limit: 10/UTC day
- R2 unchanged: `mll-media`
- Supabase unchanged: `jhjdhmjkcnjtbojocjam`
- Frontend: `https://mylatinolist.io`
- Route unchanged: `api.mylatinolist.io/*`
- Cron unchanged: `0 10 * * *`, `0 9 * * 1`
- Staging remains isolated (`mll-api-staging`, mll-dev Supabase `bjtfrmkhishoadjtpzgg`, staging KV/R2)

No second database, second backend, new paid SaaS, new DNS, new Stripe products, or new subscription pricing.

## Marketing Pack architecture

- Admin-only `POST /api/admin/marketing/pack`
- One structured Workers AI generation per pack (`env.AI.run` once, `max_tokens: 1100`)
- Parse + normalize + deterministic promote + grounded filter
- Parse-fail fallback pack remains grounded
- Persisted to production KV `mkt:packs` (max 10)
- Draft-only; `auto_post: false`; nothing posts to social networks
- Public `/api/ai/search` quotas are unchanged and separate

## Grounding architecture

- Promotion candidates selected by `selectPromotionCandidates()` from real active listings
- Hallucinated names dropped by `filterPackToGrounded`
- Empty promote state: `No eligible grounded listings available for this pack.`
- QA slug `mll-qa-test-business` is never promoted
- Prompt forbids fabricated businesses, customers, revenue, rankings, and unsupported superlatives (`best`, `#1`, `leading`, `trusted`, `mejor`, `más confiable`, etc.)

## Admin security model

- Worker: `ADMIN_EMAILS = ['info@apoptix.io']` via existing `isAdmin`
- Frontend: same allow-list in `frontend/js/current-business.js`
- Logged-out Command Center shows sign-in/admin-required state and does not load protected APIs
- Unauthenticated `/api/admin/marketing/*` → 401
- Invalid token → 401
- Authenticated non-admin → 403 (source-verified; no production non-admin credential used)
- Page is `noindex,nofollow`
- Analytics helpers strip password/token/authorization fields
- No query-param admin bypass

## Production baseline behavior

Production did **not** inherit staging test data:

- No staging campaigns
- No staging Marketing Packs
- No staging counters
- No staging 47/100 score
- No staging Auth/KV copy

Digital Footprint Score is calculated from live production directory/content/conversion data on first admin load. Traffic stays `Not connected yet` / collection-started until first-party production page events accumulate in production KV. 30-Day Progress shows a truthful collection state until a prior production snapshot exists.

`workers/scripts/staging-admin-repair.ts` remains untracked staging-only repair tooling and was **not** included in this release. It was not run against production.

## Tests performed

Pre-deploy source/regression suite: PASS

- `scripts/test-marketing-command-center.mjs`
- `scripts/test-mll-ai-activation.mjs`
- `scripts/test-mll-ai-theme.mjs`
- `scripts/test-partners-navigation.mjs`
- `scripts/validate-frontend-static.mjs`
- `scripts/test-business-profile-layout.mjs`
- `scripts/test-dashboard-placeholders.mjs`
- `scripts/test-affiliate-join.mjs` (includes live public GET + unauthenticated join 401)
- `scripts/test-pricing.mjs`
- `scripts/test-dashboard-listing.mjs`
- `scripts/test-cors-health.mjs`
- `scripts/test-billing-business.mjs`
- `scripts/test-business-services-empty-state.mjs`

Worker `tsc --noEmit`: PASS  
Staging isolation check: PASS  
Production Worker dry-run bindings: PASS (`mll-api`, production KV/R2/Supabase/AI)

## Production smoke results

Worker (before Pages):

- `GET /api/health` → `healthy`
- `GET /api/ai/status` → `enabled=true`, `binding=true`, model set, allowance visitor 3 / auth 10
- `GET /api/businesses?q=Ramos` → grounded Ramos Law Group
- `GET /api/jobs`, `/api/marketplace`, `/api/resources` → 200
- All `/api/admin/marketing/*` unauthenticated GET/POST → 401 (including campaign create and pack generate; no production campaign or pack created)
- Invalid bearer token → 401
- `GET /api/admin/health` unauthenticated → 401

Controlled AI smoke (1 of max 3):

1. Find a Latino restaurant → `business_search` / La Cocina de Maria (DB id match)

No Marketing Pack was generated in production during this promotion.

HTTP on apex + www: homepage, directory, business profile, jobs, marketplace, La Voz, Partners, login, pricing, Command Center → 200  
Live Command Center JS includes report cards (`mcc-report-card`, REEL CONCEPT, PROMOTION CANDIDATE, Copied) and no `listStrings` bullet renderer  
Live config maps production hosts to `https://api.mylatinolist.io`  
Mobile header/hamburger/drawer and floating MLL AI script present on production homepage  
Pixel visual QA: MANUAL_REQUIRED (no browser screenshot tooling in this session)

## Not changed

- Production Supabase schema/data
- Production Auth users
- Stripe products/prices/subscriptions/billing flow
- DNS
- R2 object contents
- Public MLL AI quotas
- Secrets

## Incremental cost estimate

**Approximately $0 to $2 / month** (designed Phase 1 range $0–$5). Extra production KV writes for first-party events/campaigns/packs plus a few admin `llama-3.2-3b-instruct` Marketing Pack calls. No new vendor. Public AI quotas unchanged.

Live public AI smoke neuron usage this promotion: ~0.90 neurons for the one restaurant query.

## Known limitations

- Cloudflare Analytics Engine was unavailable / not enabled during Phase 1 (account error 10089). Phase 1 uses first-party KV counters (`mkt:events:{date}`, `mkt:baseline`). These are **not** equivalent to GA4 or full marketing attribution.
- Traffic category remains “Not connected yet” until production first-party page events accumulate.
- 30-day % improvements are not invented; the UI shows a collection-in-progress state until a prior production snapshot exists.
- Campaigns/packs are KV-backed, not Postgres.
- Marketing pack quality depends on the small instruct model plus grounded listing context.
- Nothing auto-posts to social networks.
- Pixel-level desktop/mobile visual QA still needs a manual pass in a real browser.

## Rollback

Do not delete deployments, branches, tags, or secrets. Do not force-push.

Worker rollback target captured immediately before this deployment:

```powershell
cd workers
npx wrangler rollback --env production
```

Or restore Worker version `50e155ab-a90e-41eb-b329-fb9b83f54e63`.

Frontend: in Cloudflare Pages project `mll-cloudflare`, restore deployment `e49694ae-60ce-4b4d-a64b-fb334b513f16`.

Git: `mll-v2-dev` / tag `mll-v2.1.0` commit `e2072fb3bdbad0c9e2fda2eef9abd4cdb68c5af0` as needed. Do not force-push.

See also `docs/PRODUCTION_ROLLBACK.md`.

## Next step

Sign in as the existing AP Optix admin on production, confirm the Command Center computes a first-party production score (not the staging 47/100), and perform a final manual desktop/mobile visual check. Do not copy staging campaigns or packs.
