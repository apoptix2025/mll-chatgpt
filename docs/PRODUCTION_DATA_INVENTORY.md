# Production data inventory (read-only)

Date: 2026-08-27  
Source: production public dump `prod-release-20260827-173804` plus live GET of public production APIs.  
Live SQL was **not** run: `$env:PROD_DB_URL` was unset. Staging `SUPABASE_URL` was not used.

Production ref: `jhjdhmjkcnjtbojocjam`  
No production rows were updated or deleted.

Emails and connection strings are not recorded here.

---

## Counts

| Entity | Count | Notes |
| --- | --- | --- |
| auth.users | 12 | From auth backup SQL (INSERT count) |
| auth.identities | 11 | Seed user likely has no identity row |
| profiles | 12 | Dump + live `/api/health` |
| businesses | 32 | Dump + live health/directory/`/api/stats` |
| products | 9 | All `active`; matches public marketplace `total` |
| jobs | 10 | All `active`; matches public jobs `total` |
| reviews | 1 | `published` |
| leads | 0 | |
| orders | 0 | |
| subscriptions | 0 | |
| resources | 6 | All `active` |
| affiliate_programs | 6 | All `active` |
| affiliate_enrollments | 0 | |
| job_applications | 0 | |

### Businesses by status

| status | n |
| --- | --- |
| active | 32 |

### Businesses by plan

| plan | n |
| --- | --- |
| free | 13 |
| pro | 13 |
| featured | 5 |
| admin | 1 |

### Stripe presence

| Check | n |
| --- | --- |
| businesses.stripe_customer_id set | 0 |
| businesses.stripe_subscription_id set | 0 |
| subscriptions with Stripe IDs | 0 |
| orders.stripe_payment_id set | 0 |

Live `/api/health` reported Stripe and Resend **healthy** (keys present). That is not the same as stored customer/subscription IDs.

### Test / demo / mock pattern counts

| Pattern | n |
| --- | --- |
| auth emails matching `seed@` | 1 |
| auth/profile `@example.test` / `@demo.mylatinolist.io` / QA | 0 |
| businesses matching test/demo/qa/seed in name, slug, or email | 0 |
| businesses owned by seed UUID `00000000-0000-0000-0000-000000000001` | 21 |

---

## Classification (no deletes)

### KEEP — 11 businesses + 11 non-seed auth users

Likely legitimate owner-linked listings (owner_id is not the seed UUID). All currently `active`. Includes the operator `admin` plan listing.

Do not delete these.

### ARCHIVE — 0

No inactive, pending, suspended, or expired businesses in the dump. Nothing to archive on status alone.

### DELETE_CANDIDATE — 1 auth user + 1 profile

Clear seed/mock identity:

- auth user / profile email matching `seed@…`
- special owner UUID `00000000-0000-0000-0000-000000000001`

**Do not delete this user until the 21 seed-owned businesses are reassigned or explicitly approved.** Deleting the seed user without a keep/reassign plan would orphan or cascade those listings.

No QA / `@example.test` / `@demo.mylatinolist.io` rows were found in production.

### NEEDS_REVIEW — 21 businesses

Active directory listings owned by the seed UUID. They did **not** match test/demo/qa name patterns. They look like real public listings that were never attached to individual owner accounts.

Decision required before any cleanup:

- KEEP listings and later attach real owners, or
- KEEP as-is under a dedicated operator account, or
- ARCHIVE only after a named review of each listing

Related rows (jobs, products, the one review) hang off these businesses and must follow the same decision.

---

## Estimates for the cutover plan

| Bucket | Estimate |
| --- | --- |
| KEEP | 11 businesses, 11 users, catalog rows (jobs/products/resources/affiliates) |
| ARCHIVE | 0 |
| DELETE_CANDIDATE | 1 seed user/profile (not the 21 listings) |
| NEEDS_REVIEW | 21 seed-owned businesses + dependent jobs/products |

Nothing in this file authorizes a production write.
