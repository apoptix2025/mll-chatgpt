# MLL 2.0 production QA

Frontend: https://mylatinolist.io  
API: https://api.mylatinolist.io  
Admin email: `info@apoptix.io` (do not record the password)

Do not use staging QA user `qa.owner@demo.mylatinolist.io` on production.  
Do not email real inboxes except an approved test recipient.

---

## PUBLIC

| Check | Expected |
| --- | --- |
| Homepage | Approved MLL 2.0 white/blue theme, navbar, hero |
| Directory | Cards load from production API |
| Business profile | Showcase or operator listing opens |
| Jobs | Launch jobs empty or seed-only |
| Marketplace | Empty or seed-only |
| Resources / La Voz Latino | Seeded resource cards |
| Affiliates | Seeded partner catalog |

Network: requests go to `https://api.mylatinolist.io`, never the staging Worker.

---

## AUTH

| Check | Expected |
| --- | --- |
| Signup / enroll | Creates a real production owner; use a throwaway `@apoptix.io` or approved inbox |
| Login | `sessionStorage.mll_token`; redirect dashboard |
| Logout | Sign out clears sessionStorage |
| Password recovery | Skip unless Resend recipient is approved |
| Dashboard | Owned business loads |
| Profile / listing | Save description succeeds |
| Uploads | Logo stores in `mll-media`; URL host `media.mylatinolist.io` |
| Leads | Owner GET 200; other business 403 |
| Reviews | Public submit; duplicate window may 429 |
| Jobs CRUD | Create / PATCH / close own job |
| Products CRUD | Create / PATCH / soft-delete own product |
| Affiliate join | 201 then 409 on repeat |
| Referral link | Copy link uses `mylatinolist.io/pages/enroll.html?ref=` |

---

## ADMIN

| Check | Expected |
| --- | --- |
| Admin panel | Loads only for `info@apoptix.io` |
| Business management | List/search production businesses |
| User management | As implemented in `admin.html` |
| Content moderation | Reviews/status if UI present |
| Plan/status | `POST /api/admin/set-plan` |

Non-admin JWT must 403 on `/api/admin/*`.

---

## INTEGRATIONS

| Integration | Check |
| --- | --- |
| Stripe | Checkout with **live** production keys; no `sk_test_` on production Worker |
| Resend | One approved recipient only |
| R2 | Upload then GET via `https://media.mylatinolist.io/...` |
| Supabase | Health supabase=healthy; project ref production |
| KV | Login still works after reload (JWT in sessionStorage; KV is session cache) |

---

## MOBILE

| Viewport | Check |
| --- | --- |
| iPhone / ~390px | Login, bottom nav, dashboard stack, directory cards |
| Android / ~412px | Same flows |

---

Record PASS / FAIL / SKIPPED. Do not mark PASS unless the step was executed.
