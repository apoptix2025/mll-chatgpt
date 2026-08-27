# MLL 2.0 functional QA (staging)

**Environment:** staging only  
**Frontend:** https://mll-v2-dev.mylatinolist-staging.pages.dev  
**API:** https://mll-api-staging.sparkling-hill-934f.workers.dev  
**Database:** mll-dev (`bjtfrmkhishoadjtpzgg`)

Do not test `https://mylatinolist.io` or `https://api.mylatinolist.io`.  
Do not use Stripe live keys. Do not send email to real production users.

Fill **Actual result** / **Pass/Fail** / **Notes** during a QA pass. Leave them blank until executed.

After a production-derived clone, run this matrix on sanitized data. Until then, current mll-dev demo seed (8 DMV businesses) is the baseline.

---

## AUTH

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Open staging frontend, go to sign up | Sign-up form loads; request goes to staging API |  |  | |
| Submit a new `@example.test` account | User created in mll-dev Auth; session established |  |  | Do not use a real personal inbox if Resend is on |
| Log out | Session cleared; protected dashboard redirects to login |  |  | |
| Log in with the same account | Dashboard / owned business loads |  |  | |
| Refresh the page while logged in | Session persists (KV cache + Supabase session) |  |  | |
| Password reset with a synthetic email | Reset accepted; no production user emailed |  |  | Skip or use Admin API if Resend is unset |
| Login with a wrong password | Error shown; no session |  |  | |

---

## BUSINESS ENROLLMENT

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Start Add / enroll wizard | 4-step flow with live preview |  |  | |
| Create a new business (free plan) | Row in `businesses` with `owner_id` = current user |  |  | |
| Edit name, category, city, hours | Values persist on profile + dashboard |  |  | |
| Upload an image | Object stored in `mll-media-dev` (not `mll-media`) |  |  | |
| Profile completion meter | Percentage updates as fields are filled |  |  | |
| Select modules (directory / jobs / marketplace) | `modules` array saved; matching nav appears |  |  | |
| Choose a paid plan in UI | Checkout blocked or Stripe **test** only |  |  | Never live charges |

---

## DIRECTORY

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Browse directory | Card grid of active businesses |  |  | |
| Search by name | Matching listings; unrelated hidden |  |  | |
| Filter by category | Only that category |  |  | |
| Filter / search by location | City/state matches |  |  | |
| Open a business profile | Hero, contact, hours, reviews, modules |  |  | Phone/email should be synthetic after clone |

---

## REVIEWS

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Submit a review while logged in | Review stored; public list updates |  |  | |
| View review on public profile | Published reviews visible |  |  | |
| Submit another rating | Business `rating` / `review_count` recalculate |  |  | Trigger `update_business_rating` |

---

## LEADS

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Submit inquiry from a profile | Lead row created; no crash |  |  | |
| Owner dashboard lead list | Owner sees only their business leads |  |  | |
| Dashboard lead count | KPI matches lead rows |  |  | |

---

## MARKETPLACE

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Browse marketplace | Active products list |  |  | GET `/api/marketplace` |
| Owner add/edit product | Product appears; owned only |  |  | |
| Cart / checkout UI | UI loads; pay path uses Stripe **test** or is disabled |  |  | Current staging: Stripe key unset → no live charge |
| Attempt live-looking card | Must not hit `sk_live_` |  |  | |

---

## JOBS

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Browse jobs | Active jobs list |  |  | GET `/api/jobs` |
| Owner post a job | Job visible publicly when `active` |  |  | |
| Owner edit / close job | Status change reflected |  |  | |
| Apply with synthetic applicant | `job_applications` row; resume not a prod URL |  |  | |
| Employer views applications | Owner sees applicants; others do not |  |  | |

---

## RESOURCES

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Browse La Voz resources | List loads |  |  | GET `/api/resources` |
| Filter by category / state | Filtered set |  |  | |

---

## AFFILIATES

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Browse programs | Active programs list |  |  | GET `/api/affiliates` |
| Enroll a business in a program | `affiliate_enrollments` row + referral code |  |  | |
| Referral tracking UI | Clicks/conversions display if implemented |  |  | Do not fire live partner conversion pixels |

---

## DASHBOARD

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Open dashboard as owner | Welcome, KPIs, next actions |  |  | |
| Navigation to directory / jobs / marketplace modules | Only enabled modules |  |  | |
| Business ownership | Only owned business is editable |  |  | |
| Next-action prompts | Sensible for incomplete vs complete profiles |  |  | |

---

## UPLOADS

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Upload logo from enroll or dashboard | Stored in `mll-media-dev` |  |  | Confirm Worker binding |
| Reject huge / invalid file | Error; no production bucket write |  |  | |

---

## MOBILE

Use a ~390px viewport (or device toolbar).

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Bottom nav visible | Home / browse / add / dashboard reachable |  |  | |
| Search on small screen | Usable, not clipped |  |  | |
| Add / enroll flow | Wizard usable; preview readable |  |  | |
| Business profile | Hero and actions usable |  |  | |
| Dashboard | Sidebar collapses or stacks; KPIs readable |  |  | |

---

## LANGUAGE

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Switch EN → ES | Chrome strings update |  |  | |
| Switch ES → EN | Restores English |  |  | |
| Reload with language preference | Preference persists if implemented |  |  | |

---

## BILLING

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Health check Stripe | `degraded` if unset, or healthy with **test** key |  |  | GET `/api/health` |
| Checkout with test card `4242…` | Succeeds only if test key present |  |  | |
| Confirm no `sk_live_` on staging | Wrangler staging secret is test or unset |  |  | Dashboard inspect; do not paste keys |
| Cloned Stripe IDs | All null after sanitize |  |  | `validate-clone.sql` |

---

## API smoke (scripted)

Run:

```powershell
powershell -File .\scripts\test-staging-api.ps1
```

| Test step | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| GET `/api/health` | 200 or 207; supabase healthy |  |  | 207 with Resend/Stripe degraded is OK |
| GET `/api/businesses` | 200 |  |  | |
| GET `/api/jobs` | 200 |  |  | |
| GET `/api/marketplace` | 200 |  |  | |
| GET `/api/resources` | 200 |  |  | |
| GET `/api/affiliates` | 200 |  |  | |
| GET `/api/auth/me` with `STAGING_DEMO_TOKEN` | 200 if token set |  |  | Optional |

---

## Sign-off

| Field | Value |
| --- | --- |
| QA date |  |
| Tester |  |
| Data set | current demo seed / sanitized prod clone (circle one) |
| Blockers |  |
| Ready for next clone? | yes / no |
