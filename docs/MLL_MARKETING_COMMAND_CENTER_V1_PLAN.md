# MLL Marketing Command Center — Phase 1 plan

Date: 2026-09-07  
Base branch: `mll-v2-dev` @ `2846bfd` (docs after tagged production `e2072fb` / `mll-v2.1.0`)  
Feature branch: `feature/mll-marketing-command-center`  
Production: **do not deploy, migrate, or mutate**

## Audit summary

| Area | Finding |
| --- | --- |
| Git | Clean working tree. Production branch `mll-v2-dev`. No existing marketing-command-center branch. |
| Admin auth | Worker `isAdmin()` and frontend `ADMIN_EMAILS` are `info@apoptix.io`. `/api/admin/*` returns 401 without token, 403 for non-admin. Reuse this. |
| Public MLL AI | `/api/ai/search` + quotas 3/10. **Do not change.** New marketing pack uses a separate admin endpoint. |
| Analytics | GA4 `G-YB4TE3JXR7` page tags exist. No first-party event pipeline. **Analytics Engine is not in wrangler.toml.** Dashboard analytics page is honest “coming soon”. |
| Measurable data today | Supabase: businesses, profiles, resources, leads, jobs, products, subscriptions, `social_links` JSON, `profile_completion`. Worker KV AI metrics (`aimetrics:`). Sitemap route exists. Homepage already has title/description/OG tags. |
| Not measurable (do not invent) | Google rankings, social followers, impressions, GA4 numbers inside our Worker, conversion %, traffic quality. |
| Schema | Latest migration `007`. `003` is drip/referral columns only. No marketing_campaigns tables. |
| Cost | Existing Workers + AI + KV + R2. No new paid SaaS. |

No destructive/unexpected issue found. Proceed.

## Reusable infrastructure

- Auth: `workers/src/api/auth.ts` `isAdmin`, `workers/src/middleware/auth.ts` `withAuth`, `frontend/js/current-business.js`
- AI: existing `[env.staging.ai]` / `[env.production.ai]` binding `AI`, model `@cf/meta/llama-3.2-3b-instruct`
- KV: staging `878fc402…`, production `8934635b…` (do not mix)
- CORS: existing allowlist including `*.mylatinolist-staging.pages.dev`
- UI: dashboard/admin cards, coral/navy tokens, Plus Jakarta Sans
- Staging Worker `mll-api-staging`, Pages `mylatinolist-staging`

## Data model (Phase 1: **no Supabase migration**)

Campaigns, packs, baseline timestamp, and daily event counters live in **existing Worker KV** (`SESSION_CACHE`).

Why not new tables yet:

- Volume is admin-only and tiny.
- Avoids staging-apply uncertainty and any production schema risk.
- No RLS weakening.
- Can promote to Postgres later without changing the API shape.

Keys:

- `mkt:baseline` → `{ started_at }`
- `mkt:events:{YYYY-MM-DD}` → `{ homepage_view: n, … }`
- `mkt:campaigns` → campaign array (max 100)
- `mkt:packs` → last 10 generated packs
- `mkt:score:{YYYY-MM-DD}` → daily score snapshot (first write is baseline)
- `mktrate:` / `mktpack:` rate-limit keys

**DATABASE MIGRATION CREATED: NO** for Phase 1.

## Analytics Engine

Add dataset binding `ANALYTICS` → `mll_marketing_events` on **staging and production config**.

- Writes: `writeDataPoint` (blobs = event name + optional public path/slug).
- Reads: **not** via Cloudflare GraphQL (would need a new API token). Dashboard reads **KV daily counters** written by the same helper.
- Traffic category remains `not_connected` until at least one first-party event is stored.

Incremental cost: ~$0 at this volume on the existing Workers plan (Analytics Engine writes are not a new vendor).

## API routes

Public (allowlisted events only, rate-limited, no PII):

- `POST /api/analytics/event`

Admin (`isAdmin` after Bearer token; 401/403 otherwise):

- `GET /api/admin/marketing/summary`
- `GET /api/admin/marketing/score`
- `GET /api/admin/marketing/opportunities`
- `GET /api/admin/marketing/report`
- `GET/POST /api/admin/marketing/campaigns`
- `PATCH /api/admin/marketing/campaigns/:id`
- `POST /api/admin/marketing/pack`
- `GET /api/admin/marketing/packs`

Do not add query-param auth. Do not change `/api/ai/search`.

## Frontend

- `/pages/marketing-command-center.html` (also usable as `/pages/marketing-command-center`)
- `frontend/js/marketing-command-center.js`
- `frontend/css/marketing-command-center.css`
- `frontend/js/mll-analytics.js` loaded from existing `nav.js` (same pattern as MLL AI)
- Admin sidebar link via `injectAdminSidebarLinks`

Page is client-gated like `admin.html`, then APIs re-enforce admin.

## Scoring methodology (0–100, 20 each)

Transparent partial scoring. Missing third-party metrics = `not_connected`, not invented points.

**SEO (20)** — system + directory quality

- Site title/description present (known shipped homepage meta): 4
- Sitemap endpoint present: 4
- ≥1 active listing with slug: 4
- Share of listings with description: up to 4
- Share of listings with city+state: up to 4

**Social (20)**

- Share with Facebook URL in `social_links`: up to 8
- Share with Instagram URL: up to 8
- Followers/reach: 4 points **Not connected yet**

**Content (20)**

- La Voz resource count (1 pt each, cap 8)
- Resource published in last 30 days: 6 else 0
- Active job or marketplace product: 6 else 0

**Traffic (20)**

- 0 and `not_connected` until first-party events exist
- Then scaled from homepage / directory / profile view counts (capped)

**Conversion (20)**

- Profile/signup count (cap 8)
- Paid plans excluding free/admin (cap 6)
- Lead count (cap 6)

## Events (no secrets / no prompt text / no emails)

`homepage_view`, `directory_view`, `business_profile_view`, `business_website_click`, `phone_click`, `signup_started`, `signup_completed`, `pricing_view`, `checkout_started`, `paid_subscription_created`, `ai_search`, `ai_marketing_pack_generated`

## Security

- Command Center HTML is not a public API.
- All mutating/admin GET APIs require `isAdmin(email)`.
- Campaign fields validated (enums, URL, length).
- Analytics helper drops unknown keys and sensitive names (`password`, `token`, `authorization`, `stripe`, `card`, `prompt`, `email`, `message`).
- Marketing AI prompt forbids fabricated stats/businesses; grounded context is SAFE listing/resource fields only.
- Pack generation rate-limited (burst + daily). Separate from public AI quotas.

## Expected incremental monthly cost

**$0–$5**, typically **~$0**:

- Extra KV reads/writes: negligible
- Analytics Engine points: well under included volume
- Admin marketing-pack AI: a few llama-3.2-3b calls/week (~1 neuron/call class)

No Umami/listmonk/n8n. No new Stripe products.

## Risks

- Traffic scores stay empty until staging/production receive real pageviews
- AE SQL explorer not wired (KV is source of truth for the dashboard)
- KV is not a relational campaign DB (acceptable for Phase 1)
- Staging Pages deploy to `mylatinolist-staging` overwrites the current staging frontend with this branch (includes existing MLL pages)

## Rollback

- Staging Worker: previous `mll-api-staging` version
- Staging Pages: previous `mylatinolist-staging` deployment
- Git: leave `mll-v2-dev` / `mll-v2.1.0` untouched
- No production rollback needed (production not deployed)

## Production promotion checklist (later, not this task)

1. Staging QA signed off  
2. Confirm no production wrangler/Pages deploy in this PR beyond config added under `[env.production]`  
3. Optional: add Postgres tables if campaign volume grows  
4. Authorized production Worker + Pages deploy only after explicit request  
