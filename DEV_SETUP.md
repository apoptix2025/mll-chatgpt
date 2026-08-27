# My Latino List 2.0 — Safe Dev Setup

This package has been prepared for a separate Cloudflare development/staging build. Production is intentionally left unchanged.

## Important safety behavior

- Frontend API URLs are centralized in `frontend/js/config.js`.
- `mylatinolist.io` uses `https://api.mylatinolist.io`.
- localhost uses `http://localhost:8787`.
- all other hosts use the staging Worker placeholder and will **not** fall back to production.
- `npm run deploy:staging` is guarded and will refuse to deploy while staging shares the production Supabase project or KV namespace.

## Cursor terminal

```powershell
cd "C:\Users\APLOGIXLLC\Desktop\AP Optix\Cloudflare\mylatinolist.io.chatgpt\workers"
npm install
npx wrangler login
npx wrangler whoami
```

Create isolated resources:

```powershell
npx wrangler kv namespace create SESSION_CACHE --env staging
npx wrangler r2 bucket create mll-media-dev
```

Create/use a separate development Supabase project, then update `[env.staging]` in `workers/wrangler.toml` with its URL and the new staging KV ID. Add staging secrets with `npx wrangler secret put <NAME> --env staging`. Use Stripe test keys only.

After the Worker is deployed, replace `REPLACE_WITH_WORKERS_SUBDOMAIN` in `frontend/js/config.js` with the workers.dev subdomain shown by Wrangler.

Validate before deployment:

```powershell
npm run type-check
npm run check:staging
npm run deploy:staging
```

Do not run `npm run deploy:production` during the MLL 2.0 build.
