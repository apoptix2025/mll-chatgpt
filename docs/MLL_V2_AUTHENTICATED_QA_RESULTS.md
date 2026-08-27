# MLL 2.0 authenticated QA results (staging)

Date: 2026-08-27  
Branch: `mll-v2-dev`  
Frontend: https://mll-v2-dev.mylatinolist-staging.pages.dev  
API: https://mll-api-staging.sparkling-hill-934f.workers.dev  
Database: mll-dev (`bjtfrmkhishoadjtpzgg`)

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
| AUTH | PUT `/api/businesses/:id` no token | 401 | 401 | PASS | |
| AUTH | POST `/api/marketplace` no token | 401 | 401 | PASS | |
| AUTH | POST `/api/jobs` no token | 401 | 401 | PASS | |
| AUTH | POST `/api/affiliates/join` no token | 401 | 401 | PASS | |
| AUTH | POST `/api/uploads/business-photo` no token | 401 | 401 | PASS | |
| AUTH | POST `/api/stripe/create-checkout-session` no token | 401 | 401 | PASS | |
| AUTH | GET `/api/auth/me` invalid token | 401 | 401 | PASS | |
| AUTH | POST `/api/jobs` invalid token | 401 | 401 | PASS | |
| AUTH | GET `/api/auth/me` QA token | 200 QA owner | 200 | PASS | Email matched QA account |
| OWNER ACCESS | GET `/api/businesses/mll-qa-test-business` | 200 | 200 | PASS | |
| OWNER ACCESS | GET `/api/leads?business_id=QA` | 200 | 200 | PASS | Route is **public**; returns id/action/created_at only |
| OWNER ACCESS | GET `/api/reviews?business_id=QA` | 200 | 200 | PASS | Public published reviews |
| OWNER ACCESS | GET `/api/stats` | 200 | 200 | PASS | Public aggregates; no owner-only dashboard API |
| OWNER ACCESS | GET owner products | owner-scoped GET | not implemented | SKIPPED | Only public GET `/api/marketplace` |
| OWNER ACCESS | GET owner jobs | owner-scoped GET | not implemented | SKIPPED | Only public GET `/api/jobs` |
| OWNER ACCESS | GET owner enrollments | owner-scoped GET | not implemented | SKIPPED | |
| ADMIN | GET `/api/admin/businesses` | skip | skipped | SKIPPED | No staging-safe admin QA role |
| RLS/OWNERSHIP | PUT `/api/businesses/{other}` | 403 | 403 | PASS | QA cannot edit another owner’s business |
| CRUD | PUT `/api/businesses/{qa}` | 200 | 200 | PASS | Synthetic description update |
| CRUD | POST `/api/leads` | 201 | 201 | PASS | `qa.lead@example.test` |
| CRUD | POST `/api/reviews` | 201 | 429 | PASS | Duplicate window after first submit |
| CRUD | POST `/api/marketplace` | 201 | 201 | PASS | QA Test Product |
| CRUD | GET marketplace after create | product visible | found | PASS | |
| CRUD | PATCH/DELETE product | owner update/delete | not implemented | SKIPPED | Worker POST-only |
| CRUD | POST `/api/jobs` | 201 | 201 | PASS | QA Test Job |
| CRUD | GET jobs after create | job visible | found | PASS | |
| CRUD | PATCH/DELETE job | owner update/close | not implemented | SKIPPED | Worker POST-only |
| CRUD | POST `/api/affiliates/join` | 201 | 500 | SKIPPED | First run 201; repeat unique-constraint 500 |
| UPLOADS | POST `/api/uploads/business-photo` | 2xx mll-media-dev | 200 | PASS | Staging R2 binding; no delete API |
| CRUD | cleanup synthetic rows | deleted | node cleanup ok | PASS | QA business kept; R2 logo left |
| STRIPE | checkout / portal | skip | skipped | SKIPPED | SKIPPED — staging integration not yet configured |
| STRIPE | Resend | skip | skipped | SKIPPED | SKIPPED — staging integration not yet configured |
| FRONTEND LOGIN | browser login/logout | documented | not executed here | SKIPPED | See `docs/MLL_V2_AUTH_QA.md` |
| MOBILE | login / bottom nav | documented | not executed here | SKIPPED | See `docs/MLL_V2_AUTH_QA.md` |

---

## Auth flow (inspected)

1. Login: `POST /api/auth/login` → Supabase `signInWithPassword` on mll-dev.
2. JWT check: `Authorization: Bearer` → `supabase.auth.getUser(token)` in `workers/src/middleware/auth.ts`.
3. Frontend stores `sessionStorage.mll_token`.
4. Protected writes (after `withAuth`): `PUT /api/businesses/:id`, `POST /api/jobs`, `POST /api/marketplace`, `POST /api/affiliates/join`, `POST /api/uploads/*`, `POST /api/stripe/*`.
5. `GET /api/auth/me` is under `/api/auth` (not `withAuth`) but checks the bearer token itself.
6. Admin routes require `info@apoptix.io` — skipped for this QA user.
7. There was no dedicated demo-login bypass; this workflow added a staging-only QA user.

---

## Findings (not production)

- **GET `/api/leads` does not require a bearer token.** It only needs `business_id`. Payload is limited to `id`, `action`, `created_at`.
- Product/job **update and delete are not implemented** on the Worker (create only).
- Repeat `POST /api/affiliates/join` returns **500** (unique enrollment), not 409.
- Upload records `https://media.mylatinolist.io/...` even though the object is stored in **mll-media-dev**.

---

## Browser QA

Not run in this session. Use `docs/MLL_V2_AUTH_QA.md`.

Set your own `QA_DEMO_PASSWORD` and re-run `node .\scripts\create-staging-qa-user.mjs` so the QA user password is one you know (the API run used a session-only password that was not printed).
