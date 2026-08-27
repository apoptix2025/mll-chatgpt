# Design: JavaScript i18n pass (frontend)

Status: **approved spec, not yet implemented.** Do not start Chunk 0 until the
deploy pipeline is confirmed green.

## Goal & constraints
Translate the **JS-rendered / JS-overwritten** strings that `data-es` cannot reach
(built inside `innerHTML` template literals or set via `.textContent`). Must not
change English behavior, must not break conversion paths (enroll, login, card
rendering), and must ship in **small, independently deployable, revertible chunks**
— never one giant diff.

Background: the static `data-es` engine (`js/nav.js` `switchLang`, swaps
`[data-en]` innerHTML and `[data-en-ph]` placeholders, persists
`localStorage['mll_lang']`) is already live. This pass covers everything that
engine can't reach. ES wording register is locked (warm tú, US second-gen):
`registro`/`dueño`/`clientes potenciales`/`lealtad`/`subvenciones`/`Comercio`,
bare-imperative validation (no "Por favor"), English plan tier names, place
names unchanged.

## (1) Mechanism — shared ES table + `t()`, keyed by the English source string
Mirrors the `data-en`/`data-es` model: English is the key, ES is the override,
English is the fallback.

- **New file `frontend/js/i18n.js`**, loaded on every page **before** `nav.js`:
  - `window.I18N_ES = { "No products found.": "No se encontraron productos.", "{n} empleos disponibles": "{n} empleos disponibles", ... }` — ES only; English stays the in-code source.
  - `window.t = function (en, vars) { var s = (mllLang() === 'es' && I18N_ES[en]) || en; return vars ? s.replace(/\{(\w+)\}/g, function(_,k){return vars[k];}) : s; }` — returns ES when present, **else the English string** (graceful fallback → partial tables never blank out).
  - Interpolation via `{n}` tokens; the English key carries the same tokens so it matches: `t('{n} empleos disponibles', {n: jobs.length})`.
- **Render functions change minimally:** wrap each literal in `t(...)`.

**Reactivity (decided: yes, live re-render):** a toggle that doesn't update
already-rendered content is broken, so:
- `switchLang` (in `nav.js`) dispatches `document.dispatchEvent(new CustomEvent('mll:langswitch'))` after applying.
- Each JS-rendered page adds **one listener** that re-runs its existing render
  function from **cached data** (not a re-fetch). Render functions already
  re-attach their own listeners after setting `innerHTML`, so re-render restores
  click handlers.
- **Cache gotcha:** pages fetch-then-render once today; they must keep a
  module-level cache of the fetched payload (`allBusinesses` already exists;
  add equivalents for products / jobs / resources / bizData) so the langswitch
  re-render reuses it.
- **enroll gotcha:** on langswitch call `saveStep()` **before** re-rendering the
  current step, or unsaved typing in that step is wiped by the `innerHTML` rebuild.

Why keyed-by-English (not stable keys): minimal churn, English stays the source
of truth and automatic fallback, consistent with the `data-es` engine. A missing
key falls back to English.

## (2) Value-freeze gotchas (backend-bound)
Rule: **translate display only; never translate a value sent to the API or
compared against backend data.**
- **enroll language `<select>`** (English/Español/Bilingual) — value sent as
  `language`. Build options with explicit English `value="English"` and a
  `t()`-translated label (same value-freeze as directory categories).
- **enroll category payload (critical):** `submitEnrollment` sends
  `category: cats.find(...).lbl` (English canonical label). Translate `c.lbl`
  only at *display* time (`t(c.lbl)`); keep the `cats[]` array English so the
  payload stays canonical (matches commit `51ac1b0` / `.ilike`). `plan` (key
  `'pro'`) and `state` are never translated.
- **Already value-frozen (static):** directory/marketplace category dropdowns.
  JS-rendered **business cards** show `b.category` (backend English) — stays
  English (out of scope until backend i18n).

## (3) Files / functions to touch
- `js/i18n.js` (new): table + `t()` + token format.
- `js/nav.js`: dispatch `mll:langswitch` in `switchLang` (only change).
- All pages: add `<script src="/js/i18n.js">` **before** `nav.js`.
- Per page (wrap literals in `t()`, add langswitch re-render, cache data):
  - `marketplace.html` → `loadProducts` (empty/error/`{n} products`/card "by {seller}").
  - `jobs.html` → `loadJobs` (`{n} empleos disponibles`, empty, "Bilingual" badge, `timeAgo`).
  - `directory.html` → `renderGrid` (empty state, filter-count, load-more counter, "Featured" tag); cache exists.
  - `voz.html` → `renderResources` (`{n} recursos`, empty).
  - `business.html` → `loadBusiness` (hours `days[]` + "(today)" + "Closed", call/website button text, rating "No reviews yet", contact "Not listed"/"No website…", "Location not specified", "Get directions →"), `loadReviews`, `loadProducts`, `submitReview` messages. Backend name/desc/category stay English.
  - `login.html` → `handleLogin` (button `Sign in →`/`Signing in…`, errors), `handleForgot`; set button via `t()` on load too.
  - `reset-password.html` → `doReset` (button `Update password →`/`Updating…`, messages), no-token error.
  - `enroll.html` → `renderStep1..4`, `renderSuccess`, `updateDots` (`Paso {n} de 4`, Continuar / Completar registro), `setLoading` (Enviando…), `validateStep`, `showError`, `planLabel`, `catDisplay` ("Sin seleccionar"), step labels/headings/fields/placeholders/modules/plans/summary/terms. Highest surface.

## (4) Build + test order — lowest-risk first, each chunk deployable & revertible
| Chunk | Scope | Why this order |
|---|---|---|
| 0. Infra | Add `i18n.js` (table + `t()`), `mll:langswitch` dispatch, include on all pages. **Inert** — nothing calls `t()` yet. | Proves plumbing loads, zero behavior change. |
| 1. voz | `renderResources` + ~2 strings + re-render. | Read-only, not conversion, simplest render. |
| 2. marketplace + jobs | List renders, counts, empty/error, badges, timeAgo. | Discovery, same pattern, low risk. |
| 3. directory | `renderGrid` strings + load-more counter. | More strings; cache already exists. |
| 4. business | Profile chrome + hours rebuild. | Card rendering, medium-high traffic. |
| 5. login + reset | Button states + error messages. | Auth, small surface. |
| 6. enroll | Full wizard + value-freeze + per-step re-render (saveStep first). | Highest risk (conversion, payload integrity) — last, on a proven mechanism. |

**Per-chunk test checklist:** (a) EN unchanged; (b) toggle ES → JS strings switch
*including already-rendered content*; (c) toggle back to EN; (d) reload →
`mll_lang` persists; (e) forms: submit in ES, confirm **payload values unchanged**
(category = English canonical, language = English value) and validation/errors in
ES; (f) enroll: full ES wizard walkthrough + verify API payload English.
Rollback = revert that one chunk's commit. Missing table entries fall back to
English (mixed EN/ES, never blank) — safe incremental rollout.

## Banked ES strings (seed `I18N_ES`)
- **marketplace:** `{n} products`→"{n} productos" · "No products found."→"No se encontraron productos." · "No products found in this category."→"No se encontraron productos en esta categoría." · "Be the first to sell here →"→"Sé el primero en vender aquí →" · "Could not load products. Please try again."→"No pudimos cargar los productos. Inténtalo de nuevo." · "by {seller}"→"por {seller}"
- **jobs:** `{n} open positions`→"{n} empleos disponibles" · "No jobs found matching your filters."→"No hay empleos que coincidan con tus filtros." · "Post the first job →"→"Publica el primer empleo →" · "Could not load jobs. Please try again."→"No pudimos cargar los empleos. Inténtalo de nuevo." · "Bilingual"→"Bilingüe" · "Posted {t}"→"Publicado {t}" · "{n}h ago"→"hace {n}h" · "{n} days ago"→"hace {n} días" · "{n} weeks ago"→"hace {n} semanas"
- **directory:** "Featured"→"Destacado" · "No businesses found"→"No se encontraron negocios" · "Try adjusting your search or filters."→"Prueba ajustando tu búsqueda o filtros." · "Clear all filters"→"Borrar todos los filtros" · `{n} businesses`→"{n} negocios" · `{n} of {m} businesses`→"{n} de {m} negocios" · "Load more businesses ({n} remaining)"→"Ver más negocios ({n} restantes)"
- **voz:** `{n} resources`→"{n} recursos" · "No resources found. Try a different filter."→"No se encontraron recursos. Prueba otro filtro."
- **business:** days Lunes…Domingo · "(today)"→" (hoy)" · "Closed"→"Cerrado" · "No reviews yet"→"Sin reseñas aún" · "No reviews yet. Be the first to leave one!"→"Sin reseñas aún. ¡Sé el primero en dejar una!" · "Not listed"→"No disponible" · "No website — this page is their home!"→"Sin sitio web — ¡esta página es su hogar!" · "Location not specified"→"Ubicación no especificada" · "📍 Get directions →"→"📍 Cómo llegar →" · "📞 Call now"→"📞 Llamar ahora" · "📞 No phone listed"→"📞 Sin teléfono" · "🌐 Visit website"→"🌐 Visitar sitio web" · "Could not update password..."-style submit msgs
- **login:** "Sign in →"→"Iniciar sesión →" · "Signing in..."→"Iniciando sesión..." · "Please enter your email and password."→"Ingresa tu correo y contraseña." · "Invalid email or password. Please try again."→"Correo o contraseña incorrectos. Inténtalo de nuevo." · "Network error — please check your connection and try again."→"Error de red — revisa tu conexión e inténtalo de nuevo." · "Enter your email address above first."→"Primero ingresa tu correo arriba." · "If this email exists, a reset link has been sent."→"Si este correo existe, te enviamos un enlace para restablecer tu contraseña."
- **reset-password:** "Update password →"→"Actualizar contraseña →" · "Updating..."→"Actualizando..." · "Invalid or expired reset link. Please request a new one."→"El enlace para restablecer no es válido o expiró. Solicita uno nuevo." · "Password must be at least 8 characters."→"La contraseña debe tener al menos 8 caracteres." · "Passwords do not match."→"Las contraseñas no coinciden." · "Invalid reset link. Please request a new one."→"Enlace para restablecer no válido. Solicita uno nuevo." · "Could not update password. The link may have expired — request a new one."→"No se pudo actualizar la contraseña. El enlace pudo haber expirado — solicita uno nuevo." · "Network error. Please try again."→"Error de red. Inténtalo de nuevo."
- **enroll:** full step-chrome/field/placeholder/validation/button/summary/success set from the Batch 4 deferred tables. Step labels `Paso {n} de 4 — Cuenta/Perfil del negocio/Módulos/Plan`; buttons Continuar → / Completar registro → / Enviando…; validation bare-imperative; language-select values frozen to English; category display via `t(c.lbl)` with English payload.

## Resolved decisions
1. Separate `i18n.js`, loaded before `nav.js`. ✔
2. Live re-render on `mll:langswitch` (per-page cache + listener). ✔
3. `{n} empleos disponibles` (consistent with Batch 2 "empleos"). ✔
4. This doc is the in-repo spec (`docs/i18n-js-pass.md`). ✔
