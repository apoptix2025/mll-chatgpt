# MLL Infrastructure & App Mode Cost Audit

Date: 2026-08-30  
Scope: read-only repository + Wrangler inventory. No code, database, or production changes.  
Secrets, keys, tokens, and hashes are not recorded here.

Label key:

- **VERIFIED** — confirmed in repo, Wrangler, or live public config
- **ESTIMATED** — public list pricing applied to current small-scale usage
- **UNKNOWN / NEEDS BILLING DASHBOARD** — plan/tier or invoice not visible from CLI

---

## 1. Executive Summary

MLL already runs as a single-domain web app: Cloudflare Pages (static HTML/CSS/JS), one production Worker API, Supabase Auth + Postgres, R2 media, Stripe checkout, and Resend email. Search is Postgres `ILIKE` in the Worker, not Algolia. Saved businesses already live in `localStorage`. A mobile bottom nav (Home / Search / Add / Saved / Profile) already injects on public pages.

**Website / App Mode can be a frontend UI state on the same site.** It does not need a second backend, second database, App Store, or Google Play for Phase 1.

| Question | Answer |
| --- | --- |
| Current estimated monthly infrastructure cost | **$5–$30** ESTIMATED (likely nearer the low end if Cloudflare/Supabase are still on free tiers) |
| Estimated monthly cost after Website/App Mode toggle | **$5–$32** ESTIMATED |
| Estimated incremental increase | **$0–$2 / month** ESTIMATED at current traffic |
| Second backend needed? | **NO** |
| Second database needed? | **NO** |
| Apple / Google store fees now? | **NO** |
| Overall recommendation | **Proceed with Phase 1** (frontend toggle on staging, existing infra). Defer PWA, then native apps. |

Exact invoices cannot be verified from this session. Confirm Cloudflare Workers plan, Supabase plan(s), Resend plan, and `.io` renewal in the billing dashboards.

---

## 2. Current Architecture

```
Users (browser)
  |
  +-- https://mylatinolist.io
  +-- https://www.mylatinolist.io
  |
Cloudflare Pages  (project: mll-cloudflare)
  static HTML / CSS / JS   — no React bundler
  |
  +-- Google Analytics (GA4, free)
  +-- Google Fonts
  |
https://api.mylatinolist.io
  |
Cloudflare Worker  mll-api
  |
  +-- Supabase Postgres + Auth     (prod ref jhjdhmjkcnjtbojocjam)
  +-- R2  mll-media  → https://media.mylatinolist.io
  +-- KV  SESSION_CACHE (bound; no current reads/writes found)
  +-- Stripe  checkout / portal / webhook
  +-- Resend  enroll / contact / drip / expiry email
  +-- Facebook Page token  (optional enroll notify; not core UX)
  +-- Cron  daily 10:00 UTC + Monday 09:00 UTC

Staging (separate):
  Pages: staging.mylatinolist.pages.dev  /  mylatinolist-staging
  Worker: mll-api-staging
  Supabase: mll-dev (bjtfrmkhishoadjtpzgg)
  R2: mll-media-dev
  KV: staging-SESSION_CACHE
```

Stack **VERIFIED**:

- Frontend: static files under `frontend/`. No root `package.json`, no Vite/Next/React Native.
- Worker: TypeScript (`workers/`), `@supabase/supabase-js`, `stripe`.
- Deploy (manual, used in this project):  
  `npx wrangler pages deploy frontend --project-name=mll-cloudflare --branch=main`  
  `npx wrangler deploy --env production` from `workers/`
- Staging Worker: `npm run deploy:staging`
- GitHub Actions `.github/workflows/deploy.yml` can deploy Pages + Worker on `main` / `staging` / `dev` (token-gated; not used for the recent manual Pages deploys)

---

## 3. Current Cloudflare Resources

| Resource | Name | Environment | Purpose | Cost Driver | Verified? |
| --- | --- | --- | --- | --- | --- |
| Account | Info@apoptix.io's Account `d7f5a3255e1ec52241dbeebb5d53bb1d` | shared | CF account | plan (Free vs Workers Paid) | VERIFIED (whoami) |
| Pages | `mll-cloudflare` | production | Site + custom domains | requests, bandwidth | VERIFIED |
| Pages domains | `mylatinolist.io`, `www.mylatinolist.io`, `mll-cloudflare.pages.dev` | production | Public site | included with Pages | VERIFIED |
| Pages | `mylatinolist-staging` | staging | Staging UI | requests | VERIFIED |
| Worker | `mll-api` | production | API + cron | requests, CPU, cron | VERIFIED; latest version `98f19604-…` (2026-08-29) |
| Worker route | `api.mylatinolist.io/*` | production | API hostname | Worker requests | VERIFIED (`wrangler.toml`) |
| Worker | `mll-api-staging` | staging | Staging API | requests | VERIFIED (`*.workers.dev`) |
| KV | `SESSION_CACHE` `8934635b-…` | production | bound as session cache | reads/writes | VERIFIED binding; **no `env.SESSION_CACHE` usage found in current Worker source** |
| KV | `staging-SESSION_CACHE` `878fc402-…` | staging | staging cache | reads/writes | VERIFIED |
| KV | `SESSION_CACHE_preview` | wrangler preview | local/preview | unused in prod | VERIFIED |
| KV | `RATE_LIMIT` | account | not bound in MLL wrangler | unused by MLL | VERIFIED list only |
| R2 | `mll-media` | production | business photos | storage + Class A/B ops | VERIFIED |
| R2 public | `media.mylatinolist.io` | production | public media host | bandwidth | VERIFIED (`workers/src/lib/media.ts`) |
| R2 | `mll-media-dev` | staging | staging uploads | storage | VERIFIED |
| R2 | `mll-media-backup-20260827` | backup | cutover backup | storage | VERIFIED (account list) |
| DNS / zone | `mylatinolist.io` | production | apex, www, api, media | domain + CF DNS | VERIFIED (routes/domains) |
| Cron | `0 10 * * *` | production | drip + listing expiry emails | Worker cron + Resend | VERIFIED |
| Cron | `0 9 * * 1` | production | weekly admin report + newsletter | Worker cron + Resend | VERIFIED |
| Caching | Pages/CDN default | production | static HTML/CSS/JS/assets | bandwidth | VERIFIED (static site) |

**Not in MLL Worker config (account may have them for other products):** D1, Queues, AI bindings. Other Pages on this account (`jrp`, `aplogix-site`, `totherescue`) and R2 `docker-files` / `jrp-media` are **not MLL operating cost**.

**App Mode Cloudflare impact (ESTIMATED):** no new Pages project, Worker, KV, R2, or DNS. Slightly more HTML/CSS/JS bytes and the same API paths. Incremental CF cost at current scale: **~$0**.

---

## 4. Supabase Resources

| Item | Production | Staging | Verified? |
| --- | --- | --- | --- |
| Project | `jhjdhmjkcnjtbojocjam` | `bjtfrmkhishoadjtpzgg` (mll-dev) | VERIFIED (`wrangler.toml`, `config.js`) |
| Auth | email/password via Worker `/api/auth`, `/api/enroll` | same pattern | VERIFIED |
| Postgres | public tables below | clone/dev | VERIFIED (migrations + prod inventory docs) |
| Storage (Supabase) | **not used** for listing images | not used | VERIFIED (uploads go to R2) |
| Realtime | no client/Worker subscription found | — | VERIFIED absent |
| Edge Functions | none in repo | — | VERIFIED absent |
| Vector / AI | none | — | VERIFIED absent |

Public tables **VERIFIED** in schema / inventory:

`profiles`, `businesses`, `products`, `jobs`, `reviews`, `leads`, `orders`, `subscriptions`, `resources`, `affiliate_programs`, `affiliate_enrollments`, `job_applications`

Last documented production scale (2026-08-27 inventory, **VERIFIED** in `docs/PRODUCTION_DATA_INVENTORY.md`): ~12 auth users, ~32 businesses, 9 products, 10 jobs, 6 resources, 6 affiliate programs. Still tiny.

Search **VERIFIED** in `workers/src/api/businesses.ts`: `q` / `category` / `city` via Postgres `ilike`. No Algolia index.

**App Mode:**

- Same users, Auth, DB, API: **YES**
- Extra queries per session: **ESTIMATED** modest (same directory/marketplace/jobs/resources endpoints if the App shell fetches more cards). At current catalog size this is negligible.
- Saved businesses: **already client-side** (`localStorage` key `mll_saved` in `frontend/js/media.js`). Phase 1 needs **no new table**.
- Cloud-synced Saved later: optional `saved_listings` table — small row growth, not a new project.
- Storage growth: photos stay on R2; App Mode does not add a new store.

Supabase plan (Free vs Pro $25/project) is **UNKNOWN / NEEDS BILLING DASHBOARD**. Two projects can still fit the Free allowance.

---

## 5. Stripe

**VERIFIED** usage:

- Worker: `POST /api/stripe/create-checkout-session`, portal, webhook
- Frontend: `billing.html`, `pricing.html` (no checkout on the public pricing page)
- Plans: Starter $0; Basic $19 / $190; Pro $49 / $490; Featured $99 / $990; Agency $299 / $2,990 (Agency is mailto, not checkout)
- Live checkout is **transaction-based**. Stripe charges ~2.9% + $0.30 per successful card charge (US). **No Stripe SaaS subscription is required** for Checkout + Customer Portal.

**App Mode:** no new Stripe products or monthly platform fee. Billing remains the existing dashboard/pricing flow.

Do not treat Stripe processing fees as “infrastructure.” They scale only when customers pay.

---

## 6. Other Third-Party Services

| Service | Used? | Prod vs placeholder | Likely free tier | App Mode cost | Optional for launch? |
| --- | --- | --- | --- | --- | --- |
| **Resend** | YES — enroll, contact, drip (day 3/7/14/30), expiry, weekly newsletter | production secret `RESEND_API_KEY` | Free ~3,000 emails/mo typical | only if engagement increases email volume | already in use |
| **Algolia** | **NO runtime use** — only `Env` types + wrangler secret comments | placeholder / unused | N/A | **$0** unless wired later | yes — do not add for App Mode |
| **Google Analytics 4** | YES — `G-YB4TE3JXR7` on pages | production | free | $0 | already in use |
| **Google Fonts** | YES — Plus Jakarta Sans / DM Sans | production | free | $0 | already in use |
| **Facebook Graph** | optional enroll notify via `FB_PAGE_ACCESS_TOKEN` | production-capable, not UX-critical | free API | $0 | yes |
| **Stripe** | YES — paid plans | production | no monthly platform fee | $0 extra | already in use |
| **Maps / Mapbox / Google Maps** | **not present** | — | — | $0 now | yes — do not add for Phase 1 |
| **Twilio / SMS** | **not present** | — | — | $0 | yes |
| **SendGrid** | **not present** (Resend used) | — | — | $0 | — |
| **Sentry / PostHog / CF Web Analytics** | **not found** in frontend/Worker | — | — | $0 | optional later |
| **OpenAI / Anthropic** | **not present** | — | — | $0 | yes |
| **GitHub Actions** | workflow exists | minutes if used | free for private small usage | $0 for Phase 1 | optional |

Secret **names** only (values not printed):  
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_KEY`, `FB_PAGE_ACCESS_TOKEN`, `ADMIN_TEST_TOKEN`

Vars **names**: `ENVIRONMENT`, `FRONTEND_URL`, `SUPABASE_URL`

---

## 7. Existing Mobile Capabilities

**VERIFIED** in `frontend/js/nav.js`, `frontend/css/components.css`, `frontend/css/responsive.css`, `frontend/css/v2-visual.css`:

| Proposed App Mode item | Already exists? | Notes |
| --- | --- | --- |
| Responsive website | YES | Breakpoints 1024 / 768 / 480; hamburger at ≤1100px |
| Bottom nav Home / Search / Add / Saved / Profile | YES | `.mll-bottom-nav` injected on most pages at ≤768px |
| Central Add sheet | YES | List business / product / job |
| Search + location | PARTIAL | Homepage/directory search + city filter; **no GPS/maps** |
| Category shortcuts | YES | Directory / homepage tiles |
| Featured business cards | YES | Homepage + directory cards; heart save |
| Saved businesses | YES | `localStorage` `mll_saved`; `#saved` on directory |
| Profile / account | YES | login → dashboard |
| My Listing / dashboard | YES | existing pages |
| Jobs / Marketplace / La Voz / Partners | YES | existing routes |
| List Your Business | YES | enroll |
| EN/ES | YES | `nav.js` + `localStorage` `mll_lang` |
| Website vs App Mode toggle | **NO** | not implemented |
| PWA / install prompt | **NO** | no `manifest.json`, no service worker |
| Native iOS/Android | **NO** | — |

**Answers:**

- App Mode is mainly a **frontend/UI state** (layout chrome + persistence of the toggle).
- Website Mode and App Mode **share the same routes and APIs**.
- **No React Native required** initially.
- It can stay on **mylatinolist.io**.
- Phase 1 is **responsive web / app-shell CSS**, not a second app.
- **No second frontend deployment** (same `mll-cloudflare` project).
- **No second backend**.

Largest gap vs the mock: a dedicated App-shell homepage (search pinned, denser cards, hide marketing hero) — still the same APIs.

---

## 8. Proposed Website/App Mode Architecture

```
MyLatinoList.io   (same Pages project)
     |
     +-- Website Mode     current responsive layout
     |
     +-- App Mode         CSS/JS chrome: bottom nav, compact header, toggle
     |
     +---- shared Worker API  api.mylatinolist.io
     +---- shared Supabase    Auth + Postgres
     +---- shared R2          mll-media
     +---- shared Stripe / Resend
```

Suggested persistence (implementation later, not done here): `localStorage` e.g. `mll_view_mode=website|app`, default Website on desktop and App on small screens if desired.

---

## 9. Cost Comparison

Public list prices used below are **ESTIMATED** (Cloudflare Workers Paid ~$5/mo, Supabase Pro ~$25/project, Resend free then ~$20, `.io` domain ~$3–5/mo amortized). **Plan selection is UNKNOWN**.

| Category | Current | With App Mode | Increment | Notes |
| --- | --- | --- | --- | --- |
| Cloudflare Pages | $0 typical | $0 | $0 | static; same project |
| Cloudflare Worker | $0–$5 | $0–$5 | ~$0 | cron already exists; App Mode is HTML |
| KV | ~$0 | ~$0 | $0 | bound, unused in current source |
| R2 + media CDN | ~$0 at current volume | ~$0 | ~$0 | same photos |
| DNS / custom domains | $0 on CF | $0 | $0 | |
| Domain `mylatinolist.io` | ~$3–$5 amortized | same | $0 | UNKNOWN renewal price |
| Supabase (prod + staging) | $0–$50 | $0–$50 | $0 | same projects |
| Resend | $0 on free tier likely | $0–$1 | $0–$1 | only if email volume rises |
| Algolia | $0 unused | $0 | $0 | do not enable for App Mode |
| Google Analytics / Fonts | $0 | $0 | $0 | |
| Stripe platform | $0 | $0 | $0 | fees only on paid upgrades |
| Maps / SMS / AI | $0 | $0 | $0 | out of Phase 1 |
| App Store / Play | $0 | $0 | $0 | not submitting |
| **Est. total** | **$5–$30** | **$5–$32** | **$0–$2** | |

**Bottom line (ESTIMATED):**

- Current estimated total: **$5–$30 / month**
- App Mode estimated total: **$5–$32 / month**
- Expected increase: **$0–$2 / month**

If both Cloudflare and Supabase are confirmed Free and email stays under Resend’s free quota, current cash cost may be **domain-only (~$3–$5/month amortized)**. Confirm in billing.

**One-time setup cost for App Mode:** engineering time only. No new paid resource.

---

## 10. Growth Cost Scenarios

Usage metrics (Worker requests/day, R2 GB, email count) were **not available** from CLI. Ranges assume App Mode stays a web shell on the same API.

### 1,000 MAU — ESTIMATED **$5–$40 / month**

Still fits typical free/cheap tiers. Worker Free (100k req/day) is usually enough. Resend free may still hold if drip/newsletter stay small. No maps/SMS/AI.

### 10,000 MAU — ESTIMATED **$15–$80 / month**

Likely: Workers Paid **$5** if request volume or cron reliability matters. Resend paid **~$20** if newsletters scale. Supabase Free still possible; Pro **$25** if connections/storage grow. R2 still small unless heavy photo uploads. Postgres `ILIKE` search remains OK until listing count is large.

### 100,000 MAU — ESTIMATED **$80–$400+ / month** (wide band)

Cost triggers: Supabase Pro (or higher), Worker requests, R2 Class B reads for images, Resend volume, optional Algolia ($0–$99+), optional maps ($50–$300+), optional SMS. Native apps add **store fees** (below), not hosting.

Do not treat these as invoices. **NEEDS BILLING DASHBOARD + analytics** (GA4 or Worker metrics) before budgeting at 10k+.

---

## 11. Optional Future Features

| Feature | Phase 1? | Cost type | Notes |
| --- | --- | --- | --- |
| GPS / `navigator.geolocation` | optional later | **free/near-free** | browser permission; no vendor |
| Maps / geocoding | later | **usage-based** | Mapbox/Google; keep city text filter first |
| Push notifications | Phase 2 PWA | **free then usage** | Web Push is cheap; native push needs stores |
| SMS | later | **usage-based** | Twilio etc.; avoid for launch |
| High-volume email | already started | **usage-based** | Resend after free quota |
| Image uploads | exists | **usage-based** | R2; App Mode does not add a new pipeline |
| Reviews | exists | **near-free** | same DB + API |
| Saved businesses | exists (local) | **free** | sync table later if needed |
| Messaging / appointments | stubs today | **dev + later infra** | not required for App Mode |
| AI recommendations | none | **recurring usage** | do not add for launch |
| Native iOS | Phase 3 | **store + eng** | Apple Developer **$99/year** |
| Native Android | Phase 3 | **store + eng** | Play **$25 one-time** |

---

## 12. Risks / Cost Triggers

1. **Worker request volume** if App Mode chatters (polling, duplicate fetches). Mitigate: reuse current page loads; cache directory JSON briefly in memory/session.
2. **Postgres `ILIKE` at large catalog size** — add indexes or Algolia only when search latency is a real problem.
3. **R2 image growth** if every business uploads large photos — compress on upload (already a product concern, not App Mode-specific).
4. **Resend weekly newsletter** (`0 9 * * 1`) — cost scales with business count, not with the toggle.
5. **Maps / SMS / AI** — do not attach to Phase 1.
6. **Native store fees and review cycles** — Phase 3 only.
7. **Accidental new environments** — do not create a third Supabase or second production Worker for App Mode.

---

## 13. Recommendation

**PHASE 1 — YES, proceed (after a separate implementation approval):**  
Website / App Mode **frontend toggle** on staging, same Pages project, same `mll-api`, same Supabase, same R2. Reuse `.mll-bottom-nav`, directory search, `mll_saved`, dashboard/listing, Jobs, Marketplace, La Voz, Partners. No Algolia, maps, SMS, AI, or store submission.

**PHASE 2:** PWA (`manifest` + service worker) for “Add to Home Screen.” Still one domain and one backend. Small engineering cost; infrastructure still ~$0 extra.

**PHASE 3:** React Native / Expo iOS/Android **later**, calling the **same** `api.mylatinolist.io`. Budget Apple $99/year + Play $25 once, plus engineering — not a new MLL database.

---

## Appendix — Environment variable names (no values)

Worker vars: `ENVIRONMENT`, `FRONTEND_URL`, `SUPABASE_URL`  
Worker secrets (names only): `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_KEY`, `FB_PAGE_ACCESS_TOKEN`, `ADMIN_TEST_TOKEN`

This audit did not deploy, migrate, seed, or modify production.
