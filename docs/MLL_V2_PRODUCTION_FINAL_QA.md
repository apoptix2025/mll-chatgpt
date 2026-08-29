# MLL 2.0 — Final production authenticated QA

Date: 2026-08-29  
Project root: `mylatinolist.io.chatgpt-v2-dev`  
Frontend: https://mylatinolist.io  
API: https://api.mylatinolist.io  
Worker: `mll-api` (reported version `d5fd3bfe-64d7-4054-b7d6-89673a68c453`)  
Pages project: `mll-cloudflare` (reported deployment `b3eaf961`)  
Admin account: `info@apoptix.io`

This run is **read-only QA**. No reset, migration, seed, Worker/frontend deploy, DNS, R2, Stripe, or Resend changes. No live Stripe charge. No password reset. Tokens and passwords were not printed.

Method: GET/public HTTP checks, unauthenticated authorization probes, live `config.js` inspection, and source review of authenticated UI. There is no browser automation in this session and no admin password in the environment, so signed-in dashboard flows were not executed.

---

## Result matrix

| Area | Status |
| --- | --- |
| Public site | **PASS** |
| Production API | **PASS** |
| Admin login | **MANUAL_CHECK_REQUIRED** |
| Dashboard | **FAIL** |
| My Listing | **PASS** |
| Marketplace | **PASS** |
| Jobs | **PASS** |
| Resources | **PASS** |
| Affiliates | **PASS** |
| Refer & Earn | **FAIL** |
| Profile | **FAIL** |
| Billing/Upgrade | **PASS** |
| Admin Panel | **FAIL** |
| Uploads | **NOT_TESTED** |
| Authorization | **PASS** |
| Mobile | **MANUAL_CHECK_REQUIRED** |

Production data permanently modified by QA: **NO**  
QA records left behind: **NO**

---

## 1. Public health

| URL | HTTP | Notes |
| --- | --- | --- |
| https://mylatinolist.io | 200 | Apex homepage. Theme markers present (`--coral`, La Voz Latino). No staging Worker / staging Supabase / `mll-media-dev` references. |
| https://www.mylatinolist.io | 200 | Same homepage payload size as apex. |
| https://api.mylatinolist.io/api/health | 200 | `status=healthy`. Worker, Supabase, R2, Resend, Stripe, GA4 all healthy. Stats: 4 businesses, 1 profile, 0 reviews, 0 leads. |

Public pages (follow redirects; trailing-slash 308 then 200):

| Page | HTTP | Notes |
| --- | --- | --- |
| Homepage | 200 | Renders. Popular-card preferred slugs are stale (`la-cocina-de-maryland`, etc.) but `pickBySlug` fills from the current 4 listings. |
| Directory | 200 | Page loads; list API returns 4 businesses. |
| Business detail | 200 | `business.html` loads. API 200 for `ap-optix-llc`, `ramos-law-group`, `casa-flores-salon`, `la-cocina-de-maria`. |
| Jobs | 200 | Empty catalog (`total=0`) — expected after clean relaunch. |
| Marketplace | 200 | Empty catalog (`total=0`) — expected. |
| La Voz Latino / resources | 200 | 6 resources from API. |
| Login | 200 | Password form + `/api/auth/login`. |
| Signup / enroll | 200 | Enroll page present. |

No broken HTML shells observed on GET. Client-side JS hydration was not screenshot-verified.

Unknown paths (`/pages/profile.html`, `/pages/refer.html`, `/pages/referrals.html`, `/pages/my-products.html`, `/pages/my-jobs.html`) return the homepage (Pages fallback). Those features live on `dashboard.html` / `listing.html`, not separate routes.

---

## 2. Production API safety

Live `https://mylatinolist.io/js/config.js`:

- Production hosts `mylatinolist.io` and `www.mylatinolist.io` select `https://api.mylatinolist.io`.
- Inactive `STAGING_API` constant is present (`mll-api-staging.sparkling-hill-934f.workers.dev`) and is **not** selected on production hosts.
- Live config does **not** contain `bjtfrmkhishoadjtpzgg` or `mll-media-dev`.

Health services: Stripe healthy, Resend API key present, Supabase healthy, R2 healthy. Production Worker config binds R2 `mll-media` and public media host `https://media.mylatinolist.io`.

---

## 3. Admin login

**MANUAL_BROWSER_CHECK_REQUIRED**

No admin password was available in this environment. Browser automation is not available. Password was **not** reset.

Not verified in a real browser session:

- Admin role recognized after login
- Dashboard load
- Logout

Public evidence that the admin listing exists and is associated:

- `GET /api/businesses/ap-optix-llc` → name `AP Optix LLC`, `plan=admin`, `status=active`, `owner_id` set
- Health: `profiles=1`
- Worker allow-list remains `info@apoptix.io`; `/api/auth/me` forces `plan: 'admin'` for that email

---

## 4. Dashboard

**FAIL** — authenticated dashboard was not opened. One defect is already proven from public listing data + dashboard JS:

`dashboard.html` only replaces the Refer & Earn `Loading...` text when `business.referral_code` is set. Production `ap-optix-llc` has **no referral code**. After a successful login, that card will stay on **Loading...**.

Other dashboard sections (if login succeeds) should resolve from public APIs:

| Section | Expected after login |
| --- | --- |
| Marketplace summary | Resolves to “No products yet” (`total=0`) |
| Jobs summary | Resolves to “No jobs posted yet” (`total=0`) |
| La Voz Latino | Resolves — 6 resources |
| Affiliate programs | Resolves — 6 programs |
| Leads | Resolves — health `leads=0` |
| Analytics | Page `analytics.html` 200; data not opened |
| Profile completion | Public `profile_completion=0` |
| Recent activity | Not opened |

`+ Add product` / `+ Post job` on the dashboard link to the **public** marketplace/jobs pages, which have no owner create form.

---

## 5. My Listing

**PASS** for the live production record (GET detail; listing editor not opened).

| Field | Live value |
| --- | --- |
| Name | AP Optix LLC |
| Slug | `ap-optix-llc` |
| Category | Tech |
| Location | Silver Spring, Maryland |
| Description | Official My Latino List operator listing. Not a customer account. |
| Phone | set |
| Website | set |
| Email | empty |
| Address | empty |
| Logo | empty |
| Plan | `admin` |
| Status | `active` |
| Tags | `mll-operator` |

No listing content was edited.

Showcase listings also live (admin-owned, tagged `mll-launch-showcase`): La Cocina de Maria, Ramos Law Group, Casa Flores Salon.

---

## 6. Marketplace

**PASS** for public catalog.

- Page 200; `GET /api/marketplace` 200, `total=0`
- Empty state is the intended launch state
- Unauthenticated `POST` / `PATCH` / `DELETE` → 401

Owner create/edit/delete **UI is not present** on `marketplace.html` or the dashboard (summary + link only). Worker routes for owner PATCH/DELETE exist. No QA product was created.

---

## 7. Jobs

**PASS** for public catalog.

- Page 200; `GET /api/jobs` 200, `total=0`
- Unauthenticated `POST` / `PATCH` / `DELETE` → 401
- Same gap: public jobs page has no owner create/edit/delete form
- No QA job was created

---

## 8. La Voz Latino

**PASS**

All 6 seeded resources are live and `status=active`:

1. SBA loan programs — finance / Finance  
2. DACA business resources — immigration / Legal  
3. Tax credits for small business — tax / Tax  
4. Business licensing guide — licensing / Operations  
5. Minority business grants — grants / Grants  
6. Free legal aid directory — legal / Legal  

`voz.html` renders title, category tag, description, and bilingual badge. Resource `url` is null on all six (seed does not set URLs; the page does not require outbound links). Records were not modified.

---

## 9. Affiliates

**PASS** for the public catalog.

All 6 seeded programs load:

1. Banco Latino Business  
2. ShipLatino Express  
3. Verizon Business Español (UTF-8 `ñ` confirmed in API bytes)  
4. Chubb Business Insurance  
5. QuickBooks Latino  
6. Google Workspace Negocios  

Join workflow:

- Unauthenticated Join → confirm, then login (client-side). `POST /api/affiliates/join` without token → 401.
- When a token exists, the page **redirects to the dashboard** and does **not** call `/api/affiliates/join`. Duplicate-join 409 was not exercised.
- No enrollments were created.

---

## 10. Refer & Earn

**FAIL**

On `ap-optix-llc`:

- `referral_code` = empty  
- `referral_credits` = 0  

Dashboard JS leaves `#ref-link-display` at **Loading...** when the code is missing. Copy-link is a no-op without a code. Seed SQL does not set `referral_code` (enroll path does).

---

## 11. Profile

**FAIL** — authenticated “My Profile” (`listing.html`) was not opened.

Public evidence only: health `profiles=1`; operator listing `owner_id` set; listing editor requires a bearer token and redirects to login. Account email / role were not confirmed in a session. Admin identity and password were not changed.

There is no dedicated `profile.html` route (homepage fallback). Profile editing is `listing.html`.

---

## 12. Billing / Upgrade

**PASS** for load + initiation UI. No checkout session and no charge were created.

- `billing.html` 200  
- Plans render in HTML: Basic, Pro, Featured  
- Checkout UI calls `/api/stripe/create-checkout-session`  
- Portal UI calls `/api/stripe/create-portal-session`  
- Unauthenticated checkout POST → 401  
- Health: Stripe healthy  

Stopped before any authenticated checkout start.

---

## 13. Admin Panel

**FAIL** — panel was not opened as admin.

- `admin.html` 200  
- Client gate: `info@apoptix.io` or `plan === 'admin'`; otherwise redirect  
- `GET /api/admin/businesses` no token → 401; invalid bearer → 403  
- `POST /api/admin/set-plan` no token → 401  

Code review: after login the panel loads businesses from **public** `GET /api/businesses`, whose list payload **omits `plan` and `status`**. Paid-subscriber / plan KPIs and plan dropdowns will not see real plan values unless a later authenticated fetch adds them. No production records were changed.

---

## 14. Uploads

**NOT_TESTED**

No file was uploaded (would write R2). Production Worker config binds `mll-media`; production media URLs use `https://media.mylatinolist.io`. Listing photo UI posts to `/api/uploads/business-photo` (401 without auth). Health R2 = healthy.

---

## 15. Security / authorization

**PASS** for unauthenticated and invalid-token probes.

| Request | Result |
| --- | --- |
| `GET /api/auth/me` | 401 |
| `GET /api/leads?business_id=…` | 401 |
| `POST /api/marketplace` | 401 |
| `POST /api/jobs` | 401 |
| `POST /api/affiliates/join` | 401 |
| `POST /api/uploads/business-photo` | 401 |
| `GET /api/admin/businesses` | 401 |
| `POST /api/admin/set-plan` | 401 |
| `POST /api/stripe/create-checkout-session` | 401 |
| `PATCH` / `DELETE` marketplace or jobs `/:id` | 401 |
| `GET /api/auth/me` invalid bearer | 401 |
| `GET /api/leads` invalid bearer | 401 |
| `GET /api/admin/businesses` invalid bearer | 403 |

`GET /api/leads` is protected. Authenticated owner 200 and cross-business 403 were not retested (no session). No access tokens were printed.

---

## 16. Mobile QA

**MANUAL_CHECK_REQUIRED**

No browser at 390×844 or 430×932. CSS includes hamburger / `nav-mobile`, dashboard sidebar collapse at 900px, directory 1-column at 480px, voz/marketplace/jobs grids collapsing at 768px. Visual clipping/overflow was not confirmed.

---

## Critical blockers

1. **Admin login was not executed.** `MANUAL_BROWSER_CHECK_REQUIRED` for `info@apoptix.io` — role, dashboard, listing editor, logout, admin panel, profile, copy-link. Do not reset the password automatically.
2. **Refer & Earn will stay on `Loading...`** because production `ap-optix-llc` has no `referral_code`. This also keeps Dashboard from a clean PASS.

---

## Non-blocking issues

1. Resource `url` is null on all 6 La Voz Latino cards. The page still renders title/category/description.
2. Marketplace and Jobs have **API** owner PATCH/DELETE, but **no owner create/edit/delete forms** in the production frontend. Dashboard “Add” links go to the public empty catalogs.
3. Affiliates “Join” with a session redirects to the dashboard and does not `POST /api/affiliates/join`. Duplicate-join 409 was not tested.
4. Homepage “popular” preferred slugs are leftover from older listings; fallback still fills four current cards.
5. Admin panel KPIs that read `plan` from public `GET /api/businesses` will be incomplete (list omits `plan` / `status`).
6. Operator listing has no email, address, or logo (`profile_completion=0`). Seed-expected.
7. Jobs and marketplace catalogs are empty. Seed-expected.
8. Homepage uses Plus Jakarta Sans; inner pages use Fraunces. Not a load failure.
9. `/pages/profile.html` and similar unknown paths fall back to the homepage.
10. Mobile viewports were not visually checked.

---

## FINAL STATUS

**NOT READY — FIX REQUIRED**

Public site, production API mapping, seeded catalog (4 listings / 6 resources / 6 affiliates), Stripe/R2/Supabase health, and unauthenticated authorization look correct after the relaunch.

Signoff is blocked until:

1. A human logs in as `info@apoptix.io` and confirms dashboard, listing, admin panel, profile, logout, and that no other section stays on `Loading...`.
2. Refer & Earn is given a real `referral_code` (or the UI handles a missing code) so the card does not stay on Loading...

Do not deploy fixes from this QA run. No production data was written by QA.

**STOP. WAIT FOR APPROVAL.**
