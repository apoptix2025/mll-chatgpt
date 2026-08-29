# MLL 2.0 clean production relaunch

Approved HEAD: `6543b06736f739db8cb1a9b4e9b6d5fadb126e94`  
Branch: `mll-v2-dev`  
Staging visual baseline: https://mll-v2-dev.mylatinolist-staging.pages.dev

Keep infrastructure (Worker, Supabase project, KV, R2 `mll-media`, Stripe/Resend secrets, DNS).  
Reset **application content** only, then promote the approved frontend.

Do not copy mll-dev (`bjtfrmkhishoadjtpzgg`) into production.

---

## 1. Verify backups

- [ ] Private GitHub `mll-backup`
- [ ] Tag `mll-v2-pre-production`
- [ ] `.local-backups/prod-release-20260827-173804/` dump, schema, auth, 4 media files
- [ ] R2 `mll-media-backup-20260827` SHA256 verified

## 2. Freeze/tag final release

Confirm `git rev-parse HEAD` is the approved commit (or a newer commit created for this relaunch). Move `mll-v2-pre-production` locally if needed. Push the tag only when approved.

## 3. Verify production DB URL

`$env:PROD_DB_URL` must contain `jhjdhmjkcnjtbojocjam` and must not contain `bjtfrmkhishoadjtpzgg`. Do not print the URI.

## 4. Take one final DB backup

`pg_dump` production public + `auth.users`/`auth.identities` into a new timestamped folder under `.local-backups/` (gitignored).

## 5. Run reset SQL in ROLLBACK mode

`scripts/reset-production-for-mll-v2.sql` — leave `ROLLBACK;`

### STOP GATE — database reset

Do not change `ROLLBACK` to `COMMIT` until counts are reviewed.

## 6. Review affected row counts

Compare pre/post SELECT output in the same transaction (ROLLBACK run).

## 7. Change reset transaction to COMMIT only after approval

Manual edit of the last line only.

## 8. Apply required schema migrations

Required: `007_prod_business_status_expired.sql`  
Do **not** apply `005` on production.  
`006` is optional (NEEDS_REVIEW).

### STOP GATE — migration execution

## 9. Apply production launch seed

`scripts/seed-production-mll-v2.sql` — ROLLBACK first, then COMMIT after approval.

## 10. Verify admin login data exists

See `docs/PRODUCTION_ADMIN_RECOVERY.md`. Auth user `info@apoptix.io` + profile + `ap-optix-llc`.

## 11. Worker production dry-run

```powershell
cd workers
npm run type-check
npx wrangler deploy --env production --dry-run
```

Confirm route `api.mylatinolist.io/*`, KV production, R2 `mll-media`, Supabase production, `FRONTEND_URL=https://mylatinolist.io`.

## 12. Deploy production Worker

```powershell
npx wrangler deploy --env production
```

### STOP GATE — Worker deploy

## 13. Test production API

Read-only GETs on https://api.mylatinolist.io (`/api/health`, businesses, jobs, marketplace, resources, affiliates, stats).

## 14. Deploy approved MLL 2.0 frontend

Pages project that serves `mylatinolist.io` / `www`. Do not deploy staging project onto production custom domains.

### STOP GATE — frontend deploy

## 15–28. Verify site, public/auth/admin/integrations/mobile

See `docs/MLL_V2_PRODUCTION_QA.md`.

## 29. Final signoff

Rollback: `docs/PRODUCTION_ROLLBACK.md`
