# MLL production release — MLL AI experience

Release date: 2026-09-06  
Status: SUCCESS  
Release tag: `mll-v2.1.0`  
Production git branch: `mll-v2-dev`  
Feature source: `feature/mll-ai-theme`  
Pages production environment alias: `main` (Cloudflare Pages production; git has no `main` branch)

## Identifiers

| Item | Before | After |
| --- | --- | --- |
| Git commit | `bdc02098d6ea2ef45bfe0b6c2872f8b3785c93a7` (previous Pages production source) | `e2072fb3bdbad0c9e2fda2eef9abd4cdb68c5af0` |
| Release tag | `mll-v2.0.2` | `mll-v2.1.0` |
| Worker | `mll-api` `98f19604-3c1c-4782-b9ac-c55be97edbbe` | `mll-api` `50e155ab-a90e-41eb-b329-fb9b83f54e63` |
| Pages | `mll-cloudflare` `21e96de1-d628-42c2-aa62-84a13194945c` | `mll-cloudflare` `e49694ae-60ce-4b4d-a64b-fb334b513f16` |

Production URLs:

- https://mylatinolist.io
- https://www.mylatinolist.io
- https://api.mylatinolist.io

## What shipped

- Redesigned homepage (desktop family split hero, mobile family-first flow)
- Mobile header: Logo \| EN/ES \| Sign In/Account \| 3-line hamburger
- Mobile drawer, 2×3 shortcuts, Popular Search pills
- Floating mobile Ask MLL AI + docked desktop AI panel
- Grounded Workers AI search (`business_search`, `job_search`, `resource_search`)
- English + Spanish intent keywords
- Production AI quotas (anonymous 3/UTC day, authenticated 10/UTC day)
- No Stripe AI entitlements

## Production AI config

- Worker: `mll-api` (`wrangler deploy --env production`)
- Binding: `AI`
- Flag: `MLL_AI_ENABLED=true` under `[env.production]` only
- Model: `@cf/meta/llama-3.2-3b-instruct`
- Quota store: production KV `SESSION_CACHE` `8934635b28204b7eb3b58566bd97af43`
- R2 unchanged: `mll-media`
- Supabase unchanged: `jhjdhmjkcnjtbojocjam`
- Frontend URL: `https://mylatinolist.io`
- Route unchanged: `api.mylatinolist.io/*`
- Cron unchanged: `0 10 * * *`, `0 9 * * 1`
- Staging remains isolated (`mll-api-staging`, mll-dev Supabase, staging KV/R2)

Default (no `--env`) Worker config stays `MLL_AI_ENABLED=false` and has empty crons. Always deploy production with `--env production`.

## Validation

Pre-deploy source/regression suite: PASS  
Worker type-check: PASS  
Staging isolation check: PASS  
Production Worker dry-run bindings: PASS  

Live Worker:

- `GET /api/health` → `healthy`
- `GET /api/ai/status` → `enabled=true`, `binding=true`, model set
- `GET /api/businesses`, `/api/jobs`, `/api/marketplace`, `/api/resources` → 200
- Regular search `GET /api/businesses?q=Ramos` → grounded Ramos Law Group
- `GET /api/admin/health` unauthenticated → 401

Controlled AI smoke (3 queries max):

1. Find a Latino restaurant → `business_search` / La Cocina de Maria (DB id match)
2. Find an attorney → `business_search` / Ramos Law Group + Servicios Legales Abogados Chicago (DB id match)
3. Help me find immigration resources → `resource_search` / DACA business resources (DB id match)

Quota decremented 3 → 2 → 1 → 0. No fabricated listings. Model stayed Worker-side.

Live HTTP on apex + www homepage and core pages: PASS  
Mobile header/menu/hero/shortcuts/AI source on production CSS/JS: PASS  
Pixel visual QA: MANUAL_REQUIRED (no browser screenshot tooling in this session)

## Cost notes (ESTIMATE)

Live production smoke neurons: 0.838, 0.834, 0.934 (mean ~0.87 neurons/query).  
Staging planning figure previously cited: ~1.1 neurons/query. Both are estimates.

Planning neurons at 1.1/query:

- 100 searches ≈ 110 neurons
- 1,000 searches ≈ 1,100 neurons
- 10,000 searches ≈ 11,000 neurons
- 100,000 searches ≈ 110,000 neurons

Dollar cost: UNKNOWN / BILLING DASHBOARD REQUIRED. This repo does not store a verified Cloudflare Workers AI neuron rate.

## Not changed

- Database schema/data
- Stripe products/prices/customers
- DNS
- R2 object contents
- KV key deletion
- Secrets
- Production billing configuration

## Rollback

Do not delete deployments or resources.

Worker:

```powershell
cd workers
npx wrangler rollback --env production
```

Or restore Worker version `98f19604-3c1c-4782-b9ac-c55be97edbbe`.

Frontend: in Cloudflare Pages project `mll-cloudflare`, restore deployment `21e96de1-d628-42c2-aa62-84a13194945c`.

Git: `mll-v2-dev` commit `bdc02098d6ea2ef45bfe0b6c2872f8b3785c93a7` / tag `mll-v2.0.2` as needed. Do not force-push.

See also `docs/PRODUCTION_ROLLBACK.md`.

## Next step

Perform a final manual desktop/mobile production visual check and monitor AI usage/error logs during initial launch.
