# MLL 2.0 authenticated QA results (staging)

Date: 2026-08-27  
Branch: `mll-v2-dev`  
Frontend: https://mll-v2-dev.mylatinolist-staging.pages.dev  
API: https://mll-api-staging.sparkling-hill-934f.workers.dev  
Database: mll-dev (`bjtfrmkhishoadjtpzgg`)  
Staging Worker version: `199fde47-ae62-4eca-84d0-4eda2ec03529`

Production was not called. Tokens, passwords, and service keys were not logged.

QA identity: `qa.owner@demo.mylatinolist.io`  
QA business: **MLL QA Test Business** (`mll-qa-test-business`)

---

## Result matrix

| Test | Route/Feature | Expected | Actual | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PUBLIC | GET `/api/health` | 2xx | 207 | PASS | Stripe/Resend degraded (unset) |
| PUBLIC | GET `/api/businesses` | 200 | 200 | PASS | |
| PUBLIC | GET `/api/jobs` | 200 | 200 | PASS | |
| PUBLIC | GET `/api/marketplace` | 200 | 200 | PASS | |
| PUBLIC | GET `/api/resources` | 200 | 200 | PASS | |
| PUBLIC | GET `/api/affiliates` | 200 | 200 | PASS | |
| PUBLIC | GET `/api/stats` | 200 | 200 | PASS | |
| AUTH | GET `/api/auth/me` no token | 401 | 401 | PASS | |
| AUTH | GET `/api/leads` no token | 401 | 401 | PASS | Bearer now required |
| AUTH | PUT `/api/businesses/:id` no token | 401 | 401 | PASS | |
| AUTH | POST `/api/marketplace` no token | 401 | 401 | PASS | |
| AUTH | POST `/api/jobs` no token | 401 | 401 | PASS | |
| AUTH | POST `/api/affiliates/join` no token | 401 | 401 | PASS | |
| AUTH | POST `/api/uploads/business-photo` no token | 401 | 401 | PASS | |
| AUTH | POST `/api/stripe/create-checkout-session` no token | 401 | 401 | PASS | |
| AUTH | GET `/api/auth/me` invalid token | 401 | 401 | PASS | |
| AUTH | GET `/api/leads` invalid token | 401 | 401 | PASS | |
| AUTH | POST `/api/jobs` invalid token | 401 | 401 | PASS | |
| AUTH | GET `/api/auth/me` QA token | 200 QA owner | 200 | PASS | Email matched QA account |
| OWNER ACCESS | GET `/api/businesses/mll-qa-test-business` | 200 | 200 | PASS | |
| OWNER ACCESS | GET `/api/leads?business_id=QA` | 200 | 200 | PASS | Auth + owner required |
| OWNER ACCESS | GET `/api/reviews?business_id=QA` | 200 | 200 | PASS | Public published reviews |
| OWNER ACCESS | GET `/api/stats` | 200 | 200 | PASS | Public aggregates |
| OWNER ACCESS | GET owner products | owner-scoped GET | not implemented | SKIPPED | Public GET `/api/marketplace` only |
| OWNER ACCESS | GET owner jobs | owner-scoped GET | not implemented | SKIPPED | Public GET `/api/jobs` only |
| OWNER ACCESS | GET owner enrollments | owner-scoped GET | not implemented | SKIPPED | |
| ADMIN | GET `/api/admin/businesses` | skip | skipped | SKIPPED | No staging-safe admin QA role |
| RLS/OWNERSHIP | GET `/api/leads?business_id={other}` | 403 | 403 | PASS | Authenticated non-owner |
| RLS/OWNERSHIP | PUT `/api/businesses/{other}` | 403 | 403 | PASS | |
| RLS/OWNERSHIP | PATCH `/api/marketplace/{other}` | 403 | 403 | PASS | |
| RLS/OWNERSHIP | PATCH `/api/jobs/{other}` | 403 | 403 | PASS | |
| CRUD | PUT `/api/businesses/{qa}` | 200 | 200 | PASS | Synthetic description update |
| CRUD | POST `/api/leads` | 201 | 201 | PASS | Public inquiry; no token |
| CRUD | POST `/api/reviews` | 201 | 201 | PASS | `qa.review@example.test` |
| CRUD | POST `/api/marketplace` | 201 | 201 | PASS | QA Test Product |
| CRUD | GET marketplace after create | product visible | found | PASS | |
| CRUD | PATCH `/api/marketplace/{unknown}` | 404 | 404 | PASS | |
| CRUD | PATCH `/api/marketplace/{qa}` | 200 | 200 | PASS | |
| CRUD | DELETE `/api/marketplace/{qa}` | 200 inactive | 200 | PASS | Soft delete `status=inactive` |
| CRUD | POST `/api/jobs` | 201 | 201 | PASS | QA Test Job |
| CRUD | GET jobs after create | job visible | found | PASS | |
| CRUD | PATCH `/api/jobs/{unknown}` | 404 | 404 | PASS | |
| CRUD | PATCH `/api/jobs/{qa}` | 200 | 200 | PASS | |
| CRUD | DELETE `/api/jobs/{qa}` | 200 closed | 200 | PASS | Sets `status=closed` |
| CRUD | POST `/api/affiliates/join` first | 201 | 201 | PASS | Dedicated retest after cleanup |
| CRUD | POST `/api/affiliates/join` repeat | 409 Already enrolled | 409 | PASS | No raw database error |
| UPLOADS | POST `/api/uploads/business-photo` | staging `/api/media/` URL | 200 | PASS | Not `media.mylatinolist.io` |
| CRUD | cleanup synthetic rows | deleted | node cleanup ok | PASS | QA business kept; R2 logo left |
| STRIPE | checkout / portal | skip | skipped | SKIPPED | SKIPPED — staging integration not yet configured |
| STRIPE | Resend | skip | skipped | SKIPPED | SKIPPED — staging integration not yet configured |
| FRONTEND LOGIN | browser login/logout | documented | not executed here | SKIPPED | See `docs/MLL_V2_AUTH_QA.md` |
| MOBILE | login / bottom nav | documented | not executed here | SKIPPED | See `docs/MLL_V2_AUTH_QA.md` |

`scripts/test-staging-api.ps1` reported **no FAIL/BLOCKED rows**. The script’s first affiliate join in that same run was **409** (leftover enrollment). After cleanup, a dedicated join retest returned **201 then 409**.

---

## Auth flow (inspected)

1. Login: `POST /api/auth/login` → Supabase `signInWithPassword` on mll-dev.
2. JWT check: `Authorization: Bearer` → `supabase.auth.getUser(token)` in `workers/src/middleware/auth.ts`.
3. Frontend stores `sessionStorage.mll_token`.
4. Protected writes (after `withAuth`): `PUT /api/businesses/:id`, `POST/PATCH/DELETE /api/jobs`, `POST/PATCH/DELETE /api/marketplace`, `POST /api/affiliates/join`, `GET /api/leads`, `POST /api/uploads/*`, `POST /api/stripe/*`.
5. `POST /api/leads` remains public (directory inquiry).
6. `GET /api/auth/me` is under `/api/auth` (not `withAuth`) but checks the bearer token itself.
7. Admin routes require `info@apoptix.io` — skipped for this QA user.

---

## Fixes verified this pass

- **GET `/api/leads`** requires a bearer token. No token / invalid token → 401. Non-owner → 403. Owner → 200. Private name/email/message are no longer public.
- **Marketplace** `PATCH /api/marketplace/:id` and `DELETE /api/marketplace/:id` (soft delete `status='inactive'`). Owner 200; other owner 403; unknown 404.
- **Jobs** `PATCH /api/jobs/:id` and `DELETE /api/jobs/:id` (close via `status='closed'`). Owner 200; other owner 403; unknown 404.
- **Affiliates** duplicate `POST /api/affiliates/join` → 409 `{ "error": "Already enrolled" }`.
- **Staging media:** `ENVIRONMENT=staging` returns `{Worker origin}/api/media/{key}` from `mll-media-dev`. Production still uses `https://media.mylatinolist.io` and bucket `mll-media`. Staging GET/HEAD `/api/media/` is Worker-proxied because `mll-media-dev` has no public custom domain.

---

## Browser QA

Not run in this session (no browser automation). Manual steps: `docs/MLL_V2_AUTH_QA.md`.

QA password was reset with `scripts/create-staging-qa-user.mjs` using `QA_DEMO_PASSWORD` (not printed). Staging Worker login succeeded (`POST /api/auth/login` → token SET, not printed).
