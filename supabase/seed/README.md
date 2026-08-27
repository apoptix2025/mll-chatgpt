# Dev seed (mll-dev only)

Do **not** run this against production (`jhjdhmjkcnjtbojocjam`).

`businesses.owner_id` is `UUID NOT NULL REFERENCES auth.users(id)`. SQL cannot safely invent Auth users, so seeding is a two-part, schema-preserving process.

## 1. Apply schema alignment (once)

In the **mll-dev** Supabase SQL editor, run:

1. `supabase/migrations/004_worker_schema_align.sql` (if not already applied)
2. Optional later check: `supabase/validation/validate_dev.sql`

## 2. Preferred: Node seed script (creates Auth users + demo rows)

The service key is already stored as the Cloudflare staging secret `SUPABASE_SERVICE_KEY`. Do not paste it into source files.

From PowerShell, in the repo root (`mylatinolist.io.chatgpt-v2-dev`):

```powershell
$env:SUPABASE_URL = "https://bjtfrmkhishoadjtpzgg.supabase.co"
$env:SUPABASE_SERVICE_KEY = "<paste is not required in git — set from your password manager / Wrangler secret store>"
node .\supabase\seed\seed-dev.mjs
```

Required environment variables:

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Dedicated mll-dev URL only |
| `SUPABASE_SERVICE_KEY` | Staging service role / secret key |
| `DEMO_PASSWORD` | Optional. Shared password for demo owners |

The script **exits without writing** if `SUPABASE_URL` is production or not mll-dev.

Default demo password (staging only, fictional accounts): `MLL-Demo-2026!`

Demo owners:

- `maria.soto@demo.mylatinolist.io` — La Cocina de Maryland
- `diego.mendez@demo.mylatinolist.io` — Mendez Remodeling Co.
- `lucia.flores@demo.mylatinolist.io` — Flores Beauty Studio
- `andres.vega@demo.mylatinolist.io` — Vega Immigration Law
- `sofia.herrera@demo.mylatinolist.io` — Herrera Homes Realty
- `miguel.ortega@demo.mylatinolist.io` — Ortega Auto Care
- `ana.vargas@demo.mylatinolist.io` — Vargas Tax & Accounting
- `carmen.reyes@demo.mylatinolist.io` — Salud Latina Wellness

## 3. Alternate: SQL editor after users exist

If you create the eight demo users in **Authentication → Users** first (same emails), paste:

`supabase/seed/seed_dev.sql`

That file looks up `auth.users` by email. It will **raise an error** if any demo user is missing. It does not weaken RLS or make `owner_id` nullable.

Do not use `seed.sql` or `seed_businesses_v2.sql` on mll-dev — they omit `owner_id` and will fail the foreign key.

## Safety

- Never commit `.env`, `.dev.vars`, or secret values
- Never point `SUPABASE_URL` at production
- Re-running the Node script / SQL is idempotent for demo slugs, emails, and titles
