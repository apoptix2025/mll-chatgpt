# MLL 2.0 production cutover plan

Approved working branch: `mll-v2-dev`  
Approved tag at preflight: `mll-v2-pre-production` → `9dfdae1`  
HEAD at preflight: `6543b06` (`fix: close authenticated staging QA gaps`)

**HEAD and the tag do not match.** Resolve that before deploy.

Production frontend: https://mylatinolist.io  
Production API: https://api.mylatinolist.io  
Production Supabase: `jhjdhmjkcnjtbojocjam`  
Production R2: `mll-media`  
Backup R2: `mll-media-backup-20260827`

Do not skip STOP gates. Do not run cleanup or migrations until approved.

---

## 1. Confirm backups

- [ ] GitHub private `mll-backup` repository present
- [ ] Tag `mll-v2-pre-production` points at the **intended** release commit
- [ ] `.local-backups/prod-release-20260827-173804/prod-public.dump`
- [ ] `.local-backups/prod-release-20260827-173804/prod-public-schema.sql`
- [ ] `.local-backups/prod-release-20260827-173804/prod-auth-users-identities.sql`
- [ ] Local R2 copy: 4 objects under `mll-media/businesses/`
- [ ] Cloud R2 backup bucket `mll-media-backup-20260827` (4 objects, SHA256 verified)

---

## 2. Confirm inventory

- [ ] `docs/PRODUCTION_DATA_INVENTORY.md` reviewed
- [ ] Optional: set `$env:PROD_DB_URL` (production ref only) and run `scripts/inventory-production.sql` read-only
- [ ] Live public API still matches expected counts (32 businesses at preflight)

---

## 3. Decide KEEP / ARCHIVE / DELETE

| Bucket | Preflight estimate | Decision |
| --- | --- | --- |
| KEEP | 11 businesses, 11 users | |
| ARCHIVE | 0 | |
| DELETE_CANDIDATE | 1 seed user/profile | |
| NEEDS_REVIEW | 21 seed-owned businesses | |

Do not delete the seed user while it still owns 21 listings.

---

## 4. Create cleanup SQL but DO NOT run it

Already drafted: `scripts/cleanup-production-preview.sql`  
It previews counts, uses `BEGIN`/`ROLLBACK`, and omits deletes of NEEDS_REVIEW listings.

### STOP GATE — cleanup

Do not execute cleanup SQL until KEEP / ARCHIVE / DELETE is signed.

---

## 5. Apply only required migrations

See `docs/PRODUCTION_MIGRATION_REVIEW.md`.

- 005: **NOT_REQUIRED** (do not apply on production)
- 006: **NEEDS_REVIEW** (optional trigger schema-qualify)
- Separate review: `expired` status CHECK vs `cron.ts`; `subscriptions.plan` CHECK vs Stripe `basic`/`agency`

### STOP GATE — migration

Do not run any migration until this review is approved in writing. 005 is not in that set.

---

## 6. Production Worker dry-run

```powershell
cd workers
npm run type-check
npx wrangler deploy --env production --dry-run
```

Preflight dry-run (2026-08-27): type-check pass; dry-run used KV `8934635b28204b7eb3b58566bd97af43`, R2 `mll-media`, `ENVIRONMENT=production`, `FRONTEND_URL=https://mylatinolist.io`, Supabase ref `jhjdhmjkcnjtbojocjam`. **No deploy.**

**Config gap:** `[env.production]` has **no routes**. Top-level `api.mylatinolist.io/*` belongs to the default worker name `mll-api`. Before deploying `mll-api-production`, add production routes in wrangler (edit + review, then deploy). Do not bind staging R2 or mll-dev.

---

## 7. Production Worker deploy

Only after the route gap is fixed and dry-run shows the production route:

```powershell
npx wrangler deploy --env production
```

Never `wrangler deploy` without `--env production` if that would publish the default worker unexpectedly. Never `--env staging` onto production routes.

### STOP GATE — Worker deploy

Do not deploy until: backups confirmed, inventory signed, migrations decided, routes present on `[env.production]`, dry-run reviewed.

---

## 8. API health test

Read-only:

- GET https://api.mylatinolist.io/api/health
- GET https://api.mylatinolist.io/api/businesses
- GET https://api.mylatinolist.io/api/jobs
- GET https://api.mylatinolist.io/api/marketplace
- GET https://api.mylatinolist.io/api/resources
- GET https://api.mylatinolist.io/api/affiliates
- GET https://api.mylatinolist.io/api/stats

Expect 2xx. Do not POST leads/reviews/enroll during this step unless doing later public QA.

---

## 9. Production frontend deploy

Deploy the MLL 2.0 Pages project that serves `mylatinolist.io` / `www.mylatinolist.io` only after API health is green.

`frontend/js/config.js` must keep:

- `mylatinolist.io` / `www.mylatinolist.io` → `https://api.mylatinolist.io`
- staging hosts → staging Worker

### STOP GATE — frontend deploy

Do not deploy Pages until Worker API health on `api.mylatinolist.io` is confirmed.

---

## 10. Domain verification

- [ ] https://mylatinolist.io serves the new frontend
- [ ] https://www.mylatinolist.io same
- [ ] Browser network: API calls go to `https://api.mylatinolist.io` only
- [ ] DNS / Cloudflare routes unchanged except the approved Worker/Pages deploy

---

## 11. Public QA

Directory, jobs, marketplace, resources, affiliates, listing pages, enroll **read** paths. Use synthetic data only if a write is required.

---

## 12. Authenticated QA

Use a **production-safe** owner account (not the staging QA user). Do not use `qa.owner@demo.mylatinolist.io` against production.

---

## 13. Mobile QA

~390px login, nav, listing, dashboard.

---

## 14. Stripe verification

Checkout/portal with **live** keys already on production. Confirm no staging test keys were copied. Production dump had **zero** stored Stripe customer IDs — billing QA may be first-time attach, not portal-on-existing-customer.

---

## 15. Resend verification

Send only to an approved inbox. Do not mail the full member list.

---

## 16. Final signoff

- [ ] Public QA
- [ ] Authenticated QA
- [ ] Mobile QA
- [ ] Stripe
- [ ] Resend
- [ ] No production data cleanup unless separately approved

---

## 17. Rollback

1. **Frontend:** restore previous Pages deployment for the production project.
2. **Worker:** `wrangler rollback` / redeploy the last known good `mll-api-production` version. Confirm `api.mylatinolist.io` route still points at that Worker.
3. **Database:** do not restore dumps unless data was mutated. Prefer Worker/frontend rollback first. If a migration was applied, restore from `prod-public.dump` + schema dump only with a written restore plan.
4. **R2:** production bucket `mll-media` was not modified at preflight. Restore objects from `mll-media-backup-20260827` only if production objects were changed.
5. **Do not** point production DNS at staging (`mll-api-staging`, `bjtfrmkhishoadjtpzgg`, `mll-media-dev`).
