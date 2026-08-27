# Production → mll-dev clone (do not run until approved)

**Status:** tooling only. The restore is **not** authorized until an operator types `CLONE PROD TO MLL-DEV` after explicit chat approval.

Production must never be modified. Staging must keep project ref `bjtfrmkhishoadjtpzgg`.

| Role | Project | Ref | URL |
| --- | --- | --- | --- |
| Production (source, read-only) | production | `jhjdhmjkcnjtbojocjam` | `https://jhjdhmjkcnjtbojocjam.supabase.co` |
| Destination | mll-dev | `bjtfrmkhishoadjtpzgg` | `https://bjtfrmkhishoadjtpzgg.supabase.co` |

---

## Clone method selected: Option B (CLI dump → restore into mll-dev)

### Option A — native “Restore to a New Project” (not used)

Supabase Dashboard can clone a paid project by restoring a backup into a **new** project:

1. Open the **production** project (`jhjdhmjkcnjtbojocjam`) — never click Restore on production in a way that overwrites production.
2. Go to [Database → Backups → Restore to a New Project](https://supabase.com/dashboard/project/jhjdhmjkcnjtbojocjam/database/backups/restore-to-new-project).
3. Choose a backup or PITR timestamp.
4. Confirm. Supabase **creates a new project**. It does **not** write into existing mll-dev.

That is the safest native clone, but it would produce a **third** project ref. Staging Worker `[env.staging]` is already bound to mll-dev (`bjtfrmkhishoadjtpzgg`). Re-pointing staging at a new clone would replace the mll-dev URL, which this workstream forbids.

Do **not** use Dashboard → Restore on the **production** project to restore in place.

### Option B — `supabase db dump` into existing mll-dev (selected)

Keeps the staging project ref. Overwrites **data** in mll-dev only (schema/RLS remain). Uses the official dump format (`supabase db dump --data-only --use-copy`).

CLI on this machine: Supabase CLI **v2.90.0** (`scoop` shim). If missing later:

```powershell
scoop install supabase
# or: npm install -g supabase
```

Restore also needs `psql`. If missing:

```powershell
scoop install postgresql
```

Docker Desktop is recommended by Supabase for some CLI dump paths.

---

## What the script does

`scripts/clone-prod-to-dev.ps1`

1. Requires `PROD_DB_URL` and `DEV_DB_URL` from the environment (never from git).
2. Refuses to run if:
   - the URLs are identical
   - destination contains `jhjdhmjkcnjtbojocjam`
   - source does not contain `jhjdhmjkcnjtbojocjam`
   - destination does not contain `bjtfrmkhishoadjtpzgg`
   - source contains `bjtfrmkhishoadjtpzgg`
3. Prints `SOURCE = production` and `DESTINATION = mll-dev`.
4. Without `-Execute`: plan only (no dump, no restore).
5. With `-Execute`: requires typed confirmation `CLONE PROD TO MLL-DEV`.
6. Writes dated dumps under `.local-backups/` (gitignored).
7. Backs up current mll-dev, then dumps production `public` + `auth` data.
8. Restores **only** into mll-dev (truncate destination, then `psql`).

Passwords are redacted in console output.

Use **session pooler** URIs from each project’s Connect panel. Direct `db.<ref>.supabase.co` also works if IPv6/IPv4 add-on is available. Do not reset production DB passwords unless you intend to.

`supabase db dump --db-url` requires a **percent-encoded** URI. Encode `@`, `#`, `%`, and other reserved characters in the password.

Auth dumps exclude `auth.sessions`, `auth.refresh_tokens`, and `auth.audit_log_entries` so staging does not inherit live sessions or auth audit PII. Users and identities are included so UUIDs survive.

---

## After restore (required)

1. Run `scripts/sanitize-dev.sql` in the **mll-dev** SQL editor.
2. Run `node scripts/sanitize-dev-auth.mjs` with mll-dev `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.
3. Re-apply `supabase/migrations/004_worker_schema_align.sql` on mll-dev if worker columns are missing (production may not have `expires_at` / `expired` status).
4. Run `scripts/validate-clone.sql` (read-only).
5. Re-run `powershell -File .\scripts\test-staging-api.ps1`.

### Auth emails

Do **not** `UPDATE auth.users` in SQL. Identities and GoTrue get out of sync.

Keep UUIDs. Rewrite emails with the Admin API script to `dev+<short-id>@example.test`.

Cloned production passwords will not match staging demo passwords. After sanitize, use **password recovery** on staging (with Resend off or a test recipient override) or set a known password via Admin API for a small set of QA accounts. Do not email real production users.

---

## Schema drift risk

mll-dev already has migrations `001`–`004` and demo seed (8 businesses). A production data restore **replaces that demo data**.

If production is missing columns that the Worker expects (`expires_at`, drip flags, expanded plans), apply `004` on mll-dev **after** restore. Do not apply `004` to production.

---

## Exact execute command (after approval only)

```powershell
cd "mylatinolist.io.chatgpt-v2-dev"

$env:PROD_DB_URL = "<production session-pooler URI from dashboard Connect>"
$env:DEV_DB_URL  = "<mll-dev session-pooler URI from dashboard Connect>"

powershell -File .\scripts\clone-prod-to-dev.ps1 -Execute
```

When prompted, type:

```
CLONE PROD TO MLL-DEV
```

Dump-only (still reads production; still requires `-Execute` + phrase):

```powershell
powershell -File .\scripts\clone-prod-to-dev.ps1 -Execute -SkipRestore
```

Plan only (authorized now):

```powershell
powershell -File .\scripts\clone-prod-to-dev.ps1
```

---

## R2 / media (do not copy automatically)

Production media lives in R2 bucket `mll-media`. Staging is `mll-media-dev`.

`scripts/copy-r2-prod-to-dev.ps1` is optional. Default is list/dry-run only. It refuses identical buckets and will not delete objects. **Do not execute a full copy** until separately approved.

| Approach | Pros | Cons |
| --- | --- | --- |
| Keep local `frontend/assets/businesses/` and current staging uploads | Fast, no production object copy, enough for layout/QA | Cloned `logo_url` values that pointed at `media.mylatinolist.io` are nulled or ignored by `frontend/js/media.js` |
| Selective copy of a prefix (logos only) | Real thumbnails for directory QA | Needs explicit approval; can overwrite same keys in `mll-media-dev` |
| Full bucket copy | Pixel-complete listings | Large, slow, easy to confuse with production; not needed for first functional QA |

Worker upload handlers still *record* `https://media.mylatinolist.io/...` URLs even on staging. Objects go to the bound bucket (`mll-media-dev`). Treat that hostname mismatch as a known staging limitation unless a later change introduces a staging media host.

---

## Rollback of mll-dev

`.local-backups/mll-dev-public-<stamp>.sql` and `mll-dev-auth-<stamp>.sql` are the pre-clone copies. Restoring those files is a separate, mll-dev-only operation. Production dumps in the same folder must never be applied to production.
