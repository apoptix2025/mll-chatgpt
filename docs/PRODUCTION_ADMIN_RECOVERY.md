# Production admin recovery

Admin login is **email allow-list**, not a database role.

Worker: `workers/src/api/auth.ts`

```
ADMIN_EMAILS = ['info@apoptix.io']
```

`GET /api/auth/me` forces `plan: 'admin'` for that email. `POST /api/admin/*` returns 403 unless the JWT email matches.

Do not print passwords or service-role keys.

---

## Preserve (preferred)

`scripts/reset-production-for-mll-v2.sql` **keeps** `auth.users` / `auth.identities` for `info@apoptix.io` and keeps that profile row.

After reset, run `scripts/seed-production-mll-v2.sql` to:

1. Upsert `public.profiles` for the admin Auth id
2. Recreate the operator listing **AP Optix LLC** (`slug=ap-optix-llc`, `plan=admin`, tag `mll-operator`)
3. Point `profiles.business_id` at that listing

Existing password stays whatever is already in production Auth. It is not reset by SQL.

---

## Recreate if Auth user is missing

1. In the **production** Supabase project (`jhjdhmjkcnjtbojocjam`) Auth dashboard, create user `info@apoptix.io` and set a new password (do not store it in git).
2. Confirm email.
3. Note the new `auth.users.id`.
4. Run the launch seed (it looks up the user by email).
5. If seed was already applied against an old id, update `profiles.id` / `businesses.owner_id` to the new Auth id with a reviewed SQL patch — do not guess UUIDs from staging.

Do **not** copy the mll-dev QA user (`qa.owner@demo.mylatinolist.io`) into production.

---

## Login verification

1. Open https://mylatinolist.io/pages/login.html
2. Sign in as `info@apoptix.io`
3. Confirm Network `GET https://api.mylatinolist.io/api/auth/me` is 200
4. Dashboard shows admin plan; **Admin panel** link appears
5. https://mylatinolist.io/pages/admin.html loads (403 for any other user)

---

## Recovery path

| Symptom | Action |
| --- | --- |
| Forgot password | Use in-app reset; Resend must be the production key. Confirm redirect `https://mylatinolist.io/pages/reset-password.html` |
| User deleted | Recreate in production Auth dashboard, then re-run seed (ROLLBACK first) |
| Profile missing | Seed upserts profile by Auth id |
| Business missing | Seed inserts `ap-optix-llc` |
| 403 on admin routes | Email must be exactly `info@apoptix.io` |
