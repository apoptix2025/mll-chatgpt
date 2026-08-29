# Production rollback

Use this if MLL 2.0 cutover fails. Prefer frontend/Worker rollback before touching the database.

Verified backup set:

- `.local-backups/prod-release-20260827-173804/`
  - `prod-public.dump`
  - `prod-public-schema.sql`
  - `prod-auth-users-identities.sql`
  - `mll-media/` (4 objects)
- Cloud R2: `mll-media-backup-20260827`
- Git tag: `mll-v2-pre-production`
- Private GitHub backup repo

Never restore mll-dev (`bjtfrmkhishoadjtpzgg`) onto production.

---

## Frontend rollback

In Cloudflare Pages, restore the previous production deployment for the project bound to `mylatinolist.io` / `www.mylatinolist.io`. Confirm `frontend/js/config.js` on that build still maps those hosts to `https://api.mylatinolist.io`.

## Worker rollback

```powershell
cd workers
npx wrangler rollback --env production
```

Or redeploy the last known good version of `mll-api-production`. Confirm the route `api.mylatinolist.io/*` still points at that Worker. Do not deploy `--env staging` onto production routes.

## Database restore

Only if application data was reset or migrated incorrectly.

1. Confirm `$env:PROD_DB_URL` is production (`jhjdhmjkcnjtbojocjam`).
2. Restore public data from `prod-public.dump` with `pg_restore` (data-only or full, matching how the dump was taken).
3. If schema was changed, review `prod-public-schema.sql` before applying anything.

Do not `DROP DATABASE`. Restore into the existing production project.

## Auth restore

`prod-auth-users-identities.sql` is users + identities only.

Restoring Auth SQL can duplicate keys if users still exist. Prefer:

1. Leave the preserved admin (`info@apoptix.io`) in place
2. Re-create missing users from the dump only after a conflict review
3. Do not `UPDATE auth.users` passwords in git-tracked SQL

If GoTrue is out of sync, use the production Auth dashboard rather than ad-hoc SQL.

## R2 restore

Production bucket `mll-media` was not deleted as part of this relaunch prep.

If objects were overwritten, copy **from** `mll-media-backup-20260827` **to** `mll-media` with Wrangler `r2 object get` then `r2 object put`, key-for-key. Never empty `mll-media` first without a written plan.

Keys:

```
businesses/33123b04-1175-435c-929d-ea118b9c7ce7/logo.jpg
businesses/92d46ebe-86a7-4142-826b-80c0a3140e2c/logo.png
businesses/a152d64d-6fcc-4d91-9104-8ba897e36e1b/logo.png
businesses/def157c4-5a52-4fa4-8669-2062596ec963/logo.jpg
```

## Git release tag

```powershell
git checkout mll-v2-pre-production
```

Rebuild/redeploy that commit’s `frontend/` and `workers/` if needed. Do not force-push tags unless explicitly requested.
