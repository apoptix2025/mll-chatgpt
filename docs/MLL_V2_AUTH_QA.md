# MLL 2.0 authenticated frontend QA (staging)

**Frontend:** https://mll-v2-dev.mylatinolist-staging.pages.dev  
**API:** https://mll-api-staging.sparkling-hill-934f.workers.dev  
**Auth:** mll-dev only (`bjtfrmkhishoadjtpzgg`)

Do not use `https://mylatinolist.io` or `https://api.mylatinolist.io`.  
Do not send real email. Do not use Stripe live keys.

QA account (staging only):

- Email: `qa.owner@demo.mylatinolist.io`
- Password: from `QA_DEMO_PASSWORD` (never commit)

---

## How login works

1. Staging `pages/login.html` posts to `window.MLL_CONFIG.API_URL` + `/api/auth/login`.
2. The Worker calls Supabase `signInWithPassword` on mll-dev.
3. The access token is stored in `sessionStorage` as `mll_token` (not localStorage).
4. Dashboard and owner writes send `Authorization: Bearer <token>`.
5. The Worker validates JWTs with `supabase.auth.getUser(token)` (`workers/src/middleware/auth.ts`).

There is no separate demo-login bypass. Staging QA uses a real Auth user.

---

## LOGIN

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Open https://mll-v2-dev.mylatinolist-staging.pages.dev/pages/login.html | Login card loads; request will go to staging API |
| 2 | Enter `qa.owner@demo.mylatinolist.io` and the QA password | Fields accept input |
| 3 | Click Sign in | Redirect to `/pages/dashboard.html` |
| 4 | DevTools → Application → Session Storage | `mll_token` is set (do not copy it into tickets) |
| 5 | Reload dashboard | Session persists (token still in sessionStorage) |
| 6 | Open dashboard in a new tab of the same window | Still signed in |
| 7 | Close the tab and reopen login in a new window | sessionStorage is empty; must sign in again |
| 8 | Sign in, then clear `mll_token` and reload | Treated as logged out |
| 9 | Wrong password | Error: invalid email or password; no token |
| 10 | Logout control on dashboard (if present) | Token cleared; protected UI gone |

Password reset: Worker always returns success. Do **not** complete reset if Resend is unset or if it might email a real inbox. Skip unless a staging-safe recipient override exists.

---

## DASHBOARD

After login as the QA owner:

| Step | Expected |
| --- | --- |
| Owned business | **MLL QA Test Business** (`mll-qa-test-business`) |
| Metrics | KPIs load; they may be small for a new QA listing |
| Leads | Empty or only synthetic `qa.lead@example.test` rows |
| Products / jobs | Only QA synthetics if CRUD tests left rows; cloned listings belong to other owners |
| Navigation | Directory, jobs, marketplace, dashboard links work |
| Edit | Saving description on the QA business succeeds |
| Other listings | Opening a cloned public profile is allowed; editing it via API must 403 |

Do not enroll a second production-like business unless you need a throwaway DEV listing. Prefer the dedicated QA business.

---

## ENROLLMENT

Only test enroll if you intend to create **another** staging-only business.

- Use a `qa-` / `test-` name and slug
- Do not take over cloned production businesses
- Do not change the special owner `00000000-0000-0000-0000-000000000001`

---

## MOBILE (~390px)

| Step | Expected |
| --- | --- |
| Login | Form usable; sign-in still hits staging API |
| Bottom nav | Home / browse / add / dashboard reachable |
| Dashboard | Layout stacks; QA business still shown |
| Logout / clear session | Returns to logged-out home/login |

---

## API helpers (not for the browser)

```powershell
# mll-dev only — never print secrets
$env:SUPABASE_URL = "https://bjtfrmkhishoadjtpzgg.supabase.co"
$env:SUPABASE_SERVICE_KEY = "<mll-dev service role>"
$env:QA_DEMO_PASSWORD = "<qa password>"
node .\scripts\create-staging-qa-user.mjs

$env:SUPABASE_ANON_KEY = "<mll-dev anon key>"
. .\scripts\get-staging-demo-token.ps1
# prints: STAGING_DEMO_TOKEN = SET

powershell -File .\scripts\test-staging-api.ps1
Remove-Item Env:\STAGING_DEMO_TOKEN
```
