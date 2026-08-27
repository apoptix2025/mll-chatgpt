# Staging integration safety

Staging Worker: `mll-api-staging`  
Staging API: `https://mll-api-staging.sparkling-hill-934f.workers.dev`  
Staging frontend: `https://mll-v2-dev.mylatinolist-staging.pages.dev`  
Supabase: mll-dev `bjtfrmkhishoadjtpzgg`  
KV: `878fc40235fe4681a940a82a72042481`  
R2: `mll-media-dev`

Production Stripe, Resend, Auth, Storage, and Cloudflare resources must not be used here.

---

## Rule: Stripe live mode is forbidden on staging

If `STRIPE_SECRET_KEY` is set on `[env.staging]`, it **must** be a Stripe **test** key (`sk_test_...`). Live keys (`sk_live_...`) must never be stored as the staging secret.

After a production-data clone, all copied Stripe IDs are nulled by `scripts/sanitize-dev.sql`:

- `businesses.stripe_customer_id`
- `subscriptions.stripe_subscription_id`
- `subscriptions.stripe_customer_id`
- `orders.stripe_payment_id`

Using live customer/subscription IDs against test keys fails. Using them against live keys could charge real cards. Both are unacceptable; IDs are stripped instead.

---

## Current staging secret status (from GET /api/health)

Observed 2026-08-27 (boolean presence only; values are not logged):

| Secret / var | Staging present? | Required for first QA? | Mode |
| --- | --- | --- | --- |
| `SUPABASE_URL` | yes (mll-dev) | yes | mll-dev only |
| `SUPABASE_ANON_KEY` | yes | yes | mll-dev anon |
| `SUPABASE_SERVICE_KEY` | yes | yes | mll-dev service role |
| `STRIPE_SECRET_KEY` | **no** | only for checkout QA | **test key only** if added |
| `STRIPE_WEBHOOK_SECRET` | **no** | only for webhook QA | test webhook signing secret |
| `RESEND_API_KEY` | **no** | no | keep unset, or a test account + recipient override |
| `ALGOLIA_APP_ID` | not in health payload | no | omit or use a staging index |
| `ALGOLIA_ADMIN_KEY` | not in health payload | no | omit |
| `FB_PAGE_ACCESS_TOKEN` | not in health payload | no | omit (do not post to the live Page) |
| `ADMIN_TEST_TOKEN` | not in health payload | optional | staging-only token |

Health currently reports Resend and Stripe as **degraded** because keys are unset. That is the safe default: enroll/contact/cron/notify skip sending when Resend is missing; checkout cannot charge when Stripe is missing.

---

## Integration matrix

| Integration | Staging status | Notes |
| --- | --- | --- |
| Supabase Auth / DB | **enabled** (mll-dev) | After clone, sanitize emails before turning Resend on |
| Cloudflare KV session cache | **enabled** (staging namespace) | Not production KV |
| Cloudflare R2 | **enabled** (`mll-media-dev`) | No custom public domain. Staging upload URLs are `{Worker origin}/api/media/{key}` (`ENVIRONMENT=staging`). Production stays `https://media.mylatinolist.io` + `mll-media`. Do not bind `mll-media` here. |
| Stripe Billing / Checkout | **disabled** until a **test** key is added | Never live mode |
| Resend email | **disabled** (key unset) | Do not send to cloned production addresses |
| Algolia | **disabled / unused** unless staging secrets are set | Do not write to the production index |
| Facebook Page posts | **disabled** unless token set | Do not use the production Page token |
| GA4 | degraded on purpose (`FRONTEND_URL` is staging) | Fine |
| Affiliate partner URLs | public catalog data | Prefer not clicking through to live partner enroll during QA |

---

## Email safety

Worker paths that send mail when `RESEND_API_KEY` is set:

- enroll confirmation
- contact form
- cron expiry / drip (`notified_day3` …)
- notify / Stripe receipt helpers

Until Auth emails are rewritten to `@example.test` **and** a recipient override exists:

1. Leave `RESEND_API_KEY` unset on staging, or
2. Use a Resend test domain and only allow `@example.test` / a shared QA inbox.

Do not email real production users from staging.

---

## After clone checklist (integrations)

- [ ] Stripe IDs nulled (`validate-clone.sql` counts = 0)
- [ ] Auth emails rewritten (`sanitize-dev-auth.mjs`)
- [ ] Staging Stripe secret is test-mode or still unset
- [ ] Resend still unset **or** test-only
- [ ] Facebook / Algolia production tokens not copied to staging
- [ ] R2 still `mll-media-dev`
- [ ] Staging upload JSON `url` is `/api/media/...` on the staging Worker, never `media.mylatinolist.io`
- [ ] Frontend still uses `window.MLL_CONFIG.API_URL` (staging Worker on Pages)

---

## Secrets that remain required

Always required for staging API:

- mll-dev `SUPABASE_ANON_KEY`
- mll-dev `SUPABASE_SERVICE_KEY`

Optional for later QA (test/sandbox only):

- Stripe **test** secret + webhook secret
- Resend test key
- Staging-only `ADMIN_TEST_TOKEN`
