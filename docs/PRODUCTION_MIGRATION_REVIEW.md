# Production migration review (not executed)

Date: 2026-08-27  
Compared: `supabase/migrations/` vs production schema dump  
`.local-backups/prod-release-20260827-173804/prod-public-schema.sql`  
and Worker usage in `workers/src/`.

**No migrations were applied.**

Production already contains the public tables the app uses: `profiles`, `businesses`, `products`, `jobs`, `reviews`, `leads`, `orders`, `subscriptions`, `resources`, `affiliate_programs`, `job_applications`, `affiliate_enrollments`.

---

## 005_prod_schema_align.sql — NOT_REQUIRED

File purpose (header): **DEV / STAGING ONLY** — add `businesses.stripe_subscription_id` and `businesses.plan_expires_at` so mll-dev can restore production dumps.

Production schema dump already has both columns (and indexes on Stripe customer/subscription IDs).

Worker `stripe.ts` writes `stripe_customer_id` and `plan`; it does not require 005 to be applied on production.

**Do not run 005 on production.** It is a staging alignment migration. `IF NOT EXISTS` would be a no-op, but it does not belong in the production cutover.

---

## 006_schema_qualify_rating_trigger.sql — NEEDS_REVIEW

Production already has `public.update_business_rating()` and the reviews trigger.

Dumped production body uses **unqualified** names:

```sql
UPDATE businesses
...
FROM reviews WHERE business_id = NEW.business_id AND status = 'published'
```

006 replaces that with `public.businesses` / `public.reviews`.

Live production has 1 published review, so the current trigger is functioning under today’s `search_path`.

Apply 006 on production **only** if you want defense against an empty `search_path`. It is not required to make MLL 2.0 boot. Prefer a production-specific review of the function rather than copying the staging file blindly.

---

## Related schema gaps (not 005/006)

These are **not** solved by 005 or 006. Flag before Worker cutover:

| Topic | Production today | App expectation | Verdict |
| --- | --- | --- | --- |
| `businesses.status` CHECK | `active`, `pending`, `suspended`, `inactive` | `cron.ts` sets `status = 'expired'` | **NEEDS_REVIEW** — cron expire step will fail until CHECK includes `expired` |
| `businesses.expires_at` / notify flags | already present | enroll + cron | already aligned |
| `subscriptions.plan` CHECK | `free`, `pro`, `featured` | Stripe Worker also uses `basic`, `agency` | **NEEDS_REVIEW** if those plans are sold |
| `businesses.plan` CHECK | includes `basic`, `agency`, `admin` | Worker plans | already aligned (002-style) |

`004_worker_schema_align.sql` is labeled **Do NOT run against production**. Do not apply the whole file. If `expired` status is needed, write a **production-specific** one-statement CHECK change after approval.

---

## Cutover recommendation

1. Do **not** apply 005 on production.
2. Leave 006 optional (NEEDS_REVIEW); not a launch blocker.
3. Decide separately whether to allow `expired` on `businesses.status` before relying on production cron expiry.
4. No other numbered migration is required for the current 32-row production dataset to keep serving public GETs.
