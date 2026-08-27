# MLL 2.0 staging API test results

Date: 2026-08-27  
Worker: `mll-api-staging`  
URL: https://mll-api-staging.sparkling-hill-934f.workers.dev  
Environment: staging only. Production was not deployed or called.

## Safety checks before deploy

| Binding | Staging value | Production avoided |
| --- | --- | --- |
| Worker name | mll-api-staging | not mll-api-production |
| SESSION_CACHE | 878fc40235fe4681a940a82a72042481 | not 8934635b28204b7eb3b58566bd97af43 |
| MEDIA | mll-media-dev | not mll-media |
| ENVIRONMENT | staging | not production |
| FRONTEND_URL | https://staging.mylatinolist.pages.dev | not https://mylatinolist.io |
| SUPABASE_URL | https://bjtfrmkhishoadjtpzgg.supabase.co | not https://jhjdhmjkcnjtbojocjam.supabase.co |

`npx wrangler deploy --env staging --dry-run` confirmed the same bindings.  
First live deploy failed because staging inherited the top-level `api.mylatinolist.io/*` route. That route was **not** unassigned. Staging was given `routes = []` so it publishes only to workers.dev.

## Health

Exact route in `src/index.ts`: **GET `/api/health`** (not `/health`).

```
GET https://mll-api-staging.sparkling-hill-934f.workers.dev/api/health
```

| Service | Result |
| --- | --- |
| worker | healthy |
| supabase | healthy (8 businesses, 8 profiles, 13 reviews, 5 leads) |
| r2 | healthy |
| resend | degraded/down — `RESEND_API_KEY` not set on staging |
| stripe | degraded/down — `STRIPE_SECRET_KEY` not set on staging (do not add LIVE keys) |
| ga4 | degraded — FRONTEND_URL is staging, not production |

Staging health treats missing Resend/Stripe as **degraded** so the Worker itself is not reported as fully down. Production behavior is unchanged (missing keys still count as down).

To add email/billing later, set these **staging** secret names only, with test credentials:

- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY` (Stripe **test** mode)
- `STRIPE_WEBHOOK_SECRET`

## Public GET endpoints (no Stripe charges)

| Endpoint | HTTP | Notes |
| --- | --- | --- |
| GET /api/health | 207 | Core worker/Supabase/R2 healthy. Resend/Stripe/GA4 degraded on staging (secrets not set). |
| GET /api/businesses | 200 | 8 seeded DMV businesses |
| GET /api/jobs | 200 | 5 jobs |
| GET /api/marketplace | 200 | 4 products |
| GET /api/resources | 200 | 8 La Voz resources |
| GET /api/affiliates | 200 | 6 programs |
| GET /api/stats | 200 | live counts |

Not tested (by design): Stripe checkout, production APIs, writes to production data.

## Frontend staging

Cloudflare Pages project **mylatinolist-staging** was created and deployed. Production Pages project `mll-cloudflare` (`mylatinolist.io`) was not used.

- Preview: https://14016f89.mylatinolist-staging.pages.dev
- Branch alias: https://mll-v2-dev.mylatinolist-staging.pages.dev
- Project URL: https://mylatinolist-staging.pages.dev

`frontend/js/config.js` points that host at the staging Worker. Production `mylatinolist.io` still uses `https://api.mylatinolist.io`.

To attach `https://staging.mylatinolist.pages.dev`, add it in the Pages dashboard for **mylatinolist-staging** only.

## Schema note

Enrollment writes `businesses.expires_at`. Apply `supabase/migrations/004_worker_schema_align.sql` in the **mll-dev** SQL editor so enroll + cron expiry columns exist. Seed completed without that column by omitting it.
