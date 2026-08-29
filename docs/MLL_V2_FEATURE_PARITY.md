# MLL 2.0 authenticated feature parity

Compared: staging MLL 2.0 frontend (`frontend/`) + Worker (`workers/src/`) vs the capabilities required for production relaunch.

Theme: approved white/blue MLL 2.0 UI. No theme redesign in this pass.

| Feature | Status | Notes |
| --- | --- | --- |
| Dashboard | PRESERVED | `pages/dashboard.html` — KPIs, leads, referral card, sidebar |
| Analytics / profile views | PRESERVED | `pages/analytics.html` |
| My Listing / My Business | PRESERVED | `pages/listing.html` + `PUT /api/businesses/:id` |
| Marketplace (browse) | PRESERVED | `pages/marketplace.html` + public `GET /api/marketplace` |
| Marketplace owner CRUD | UPDATED | Staging QA added `POST/PATCH/DELETE /api/marketplace/:id` (soft delete `inactive`) |
| Jobs Board (browse) | PRESERVED | `pages/jobs.html` + public `GET /api/jobs` |
| Jobs owner CRUD | UPDATED | `POST/PATCH/DELETE /api/jobs/:id` (close = `status=closed`) |
| La Voz Latino / resources | PRESERVED | `pages/voz.html` + `GET /api/resources` |
| Affiliates | PRESERVED | `pages/affiliates.html` + `GET /api/affiliates` + `POST /api/affiliates/join` |
| Partners | PRESERVED | `pages/partners.html` (marketing page) |
| Refer & Earn | PRESERVED | Dashboard referral link; `GET /api/referral`; enroll `?ref=` |
| My Profile | PRESERVED | Listing/profile sidebar; `GET/PATCH` via auth + listing |
| Billing | PRESERVED | `pages/billing.html` + Stripe checkout/portal |
| Upgrade Plan | PRESERVED | Billing CTAs + Stripe prices (basic/pro/featured/agency) |
| Admin Panel | PRESERVED | `pages/admin.html`; `isAdmin('info@apoptix.io')`; `POST /api/admin/set-plan` |
| Owner business editing | PRESERVED | Auth + ownership 403 on other businesses |
| Product create/update/delete | PRESERVED | Worker marketplace handlers |
| Job create/update/delete | PRESERVED | Worker jobs handlers |
| Lead access | UPDATED | `GET /api/leads` is owner-only (401/403); `POST /api/leads` stays public |
| Review workflow | PRESERVED | Public POST + published GET |
| Uploads | PRESERVED | `POST /api/uploads/business-photo` → production `mll-media` + `media.mylatinolist.io` |
| Affiliate joins | UPDATED | Duplicate join returns 409 |
| Referral generation | PRESERVED | `referral_code` on businesses |
| Admin access controls | PRESERVED | Email allow-list, not a DB role flag |
| Login / logout / reset | PRESERVED | `pages/login.html`, `reset-password.html` |
| Enroll / signup | PRESERVED | `pages/enroll.html` + `POST /api/enroll` |
| Appointments | MISSING | Sidebar link is a stub (`dashboard.html`) — no appointments API |
| Messages | MISSING | Sidebar link is a stub — no messages API |
| Owner-scoped GET products/jobs | NEEDS_REVIEW | Public lists only; dashboard filters client-side |
| Password reset redirect | NEEDS_REVIEW | Worker always uses `https://mylatinolist.io` even when `ENVIRONMENT=staging` |
| Subscriptions table | NEEDS_REVIEW | Worker writes `businesses.plan` + Stripe customer id, not `public.subscriptions` |

**Parity verdict:** authenticated launch features required for relaunch are present. Appointments/Messages are UI stubs (same as staging). Do not block relaunch on those stubs.
