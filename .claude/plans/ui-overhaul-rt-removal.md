# Feature Implementation Plan — UI Overhaul + RT Removal

**Overall Progress:** `0%` (0/4 steps complete)

---

## TLDR
Remove Rotten Tomatoes entirely, clean up IMDB filter thresholds, fix empty-box regressions when filtering, and replace the hidden floating-trigger UI with an always-visible filter bar (two navbar variants to evaluate).

---

## Critical Decisions

- **RT removal is total** — no deprecation shims, no storage migration, no "coming back later" hooks. Delete cleanly.
- **Cell shifting via parent targeting** — instead of `display:none` on the inner card, walk up to the direct flex/grid child (`.slider-item` for carousels, outer grid item for search) and hide that. Netflix's React will not re-inject hidden outer containers the same way.
- **Two navbar variants, one constant** — `FILTER_UI_MODE = 'VARIANT_A' | 'VARIANT_B'` controls which UI renders. Both are fully built; user picks after seeing both.
  - **Variant A**: Pills injected inside `[data-uia="header"]` (Netflix nav DOM — fragile but native-looking)
  - **Variant B**: Fixed bar pinned `top: 70px`, appended to `document.body` (zero Netflix DOM dependency — resilient)
- **Default threshold resets to 0 (≤5 = show all)** — removing RT complexity means no reason to keep 5 as default.
- **Bottom sheet + floating trigger deleted entirely** — not hidden, not kept as fallback.

---

## Reuse Inventory

| File | Function | Purpose |
|---|---|---|
| [src/content.js](src/content.js) | `applyFilterToAllCards()` | Iterates all cards and calls applyFilterToCard — keep, just update caller |
| [src/content.js](src/content.js) | `saveFilterPreference()` | Persists threshold to chrome.storage.sync — keep as-is |
| [src/content.js](src/content.js) | `restoreFilterPreference()` | Restores threshold on load — keep as-is |
| [src/content.js](src/content.js) | `injectBadge()` | Badge injection on inner card — keep entirely unchanged |
| [src/content.js](src/content.js) | `injectBadgesForVisibleCards()` | Badge orchestration — keep as-is |

---

## Blast Radius

| At risk | Why | Regression check |
|---|---|---|
| `src/content.js:applyFilterToCard()` | Core change — now targets parent container | After Step 2: filter a 7+ threshold on browse, confirm no empty slots visible |
| `src/content.js:injectBadge()` | Badge appends to inner card — must still work after outer container is hidden | After Step 2: badges appear on visible cards, absent on hidden ones |
| `src/analytics.js:trackRawRatingData()` | RT fields removed — function signature changes | After Step 1: no `rt_rating` or `ratingSource` references remain |
| `src/content.js:restoreFilterPreference()` | RT mode restore deleted — must not error if old RT storage key exists | After Step 1: load extension, open console, confirm zero JS errors |
| `src/styles.css` | Bottom sheet + trigger styles deleted in Step 3 — no orphan selectors | After Step 3: grep for `.imdb-filter-trigger` and `.imdb-bottom-sheet` returns zero hits |
| `chrome.storage.sync` | Old users may have `filterMode: 'rotten_tomatoes'` saved | Step 1 must handle stale storage gracefully (ignore unknown mode, default to imdb) |

---

## Consumer & Ownership Checks

- `currentFilterMode` is read in: badge rendering, `applyFilterToAllCards`, `getCurrentFilterLabels`, mode toggle handler, `saveFilterMode`, `restoreFilterMode` — **all deleted in Step 1**. Confirm zero remaining references with grep after Step 1.
- `IMDB_FILTER_LABELS` keys are consumed by pill button generation in `injectFilterBar` — Step 3 replaces `injectFilterBar` entirely, so updated keys feed directly into new pill renderer.
- `DEFAULT_RATING_THRESHOLD` is read at init and in `restoreFilterPreference` — update both in Step 2.

---

## Tasks

- [ ] 🟥 **Step 1: Remove Rotten Tomatoes**
  - [ ] 🟥 Delete `FILTER_MODES`, `RT_FILTER_LABELS`, `currentFilterMode` and all references from [src/content.js](src/content.js)
  - [ ] 🟥 Delete `saveFilterMode()` and `restoreFilterMode()` from [src/content.js](src/content.js)
  - [ ] 🟥 Remove mode toggle HTML block from `injectFilterBar()` in [src/content.js](src/content.js)
  - [ ] 🟥 Remove RT branch from badge rendering (~line 716) and `applyFilterToAllCards()` (~line 1027)
  - [ ] 🟥 Remove mode toggle click handler block entirely (~lines 913–959)
  - [ ] 🟥 Delete `.imdb-badge-mode-rt`, RT pill styles, RT mode button styles from [src/styles.css](src/styles.css)
  - [ ] 🟥 Remove `ratingSource` logic and `rt_rating` tracking from [src/analytics.js](src/analytics.js)
  - [ ] 🟥 Add guard in `restoreFilterPreference` to ignore stale `filterMode: 'rotten_tomatoes'` from chrome.storage (default to `'imdb'`)
  - **Acceptance Criteria**:
    - `grep -r "rotten\|tomato\|rt_rating\|FILTER_MODES\|rotten_tomatoes" src/` returns zero hits
    - Extension loads on Netflix with zero JS console errors
    - IMDb filter still applies correctly (set 7+, confirm <7 titles hidden)
  - **Test Input**: Load extension on Netflix browse page, open DevTools console, set filter to 7+
  - **Gate**: Do NOT proceed to Step 2 until Step 1 criteria confirmed PASS ✅

- [ ] 🟥 **Step 2: Update Filter Thresholds + Fix Cell Shifting**
  - [ ] 🟥 Replace `IMDB_FILTER_LABELS` in [src/content.js](src/content.js) with exactly: `{0:'≤5', 5:'5+', 6:'6+', 6.5:'6.5+', 7:'7+', 7.5:'7.5+', 8:'8+', 8.5:'8.5+'}`
  - [ ] 🟥 Set `DEFAULT_RATING_THRESHOLD = 0` in [src/content.js](src/content.js)
  - [ ] 🟥 In `applyFilterToCard()`: walk up DOM from inner card to find `.slider-item` ancestor (carousel) or outermost grid item (search); store as `card._filterContainer`
  - [ ] 🟥 Apply `display:none` / `display:''` to `_filterContainer` instead of `card` directly
  - [ ] 🟥 Fallback: if no recognized ancestor found, hide `card` itself (preserves current behavior for unknown layouts)
  - **Acceptance Criteria**:
    - Pill buttons display exactly: `≤5  5+  6+  6.5+  7+  7.5+  8+  8.5+` — no 5.5+, no 9+
    - On browse page with 7+ filter: no empty slots/boxes visible in carousel rows
    - On search results page with 7+ filter: grid reflows, no blank grid cells
    - Badges still appear correctly on visible cards
    - Un-filtering (set to ≤5) restores all titles
  - **Test Input**: Netflix browse page + search results page, set threshold to 7+, visually inspect rows
  - **Gate**: Do NOT proceed to Step 3 until Step 2 criteria confirmed PASS ✅

- [ ] 🟥 **Step 3: Replace Filter UI with Always-Visible Navbar Bar (Two Variants)**
  - [ ] 🟥 Add `const FILTER_UI_MODE = 'VARIANT_B'` constant at top of [src/content.js](src/content.js) (default to B for safety)
  - [ ] 🟥 **Variant A** — build `injectNavbarFilter()`: inject `.imdb-nav-filter-bar` as last child of first matching selector (`[data-uia="header"]` → `.pinning-header` → `[class*="NavigationBar"]`); log warning + skip if none found
  - [ ] 🟥 **Variant B** — build `injectFixedFilterBar()`: create fixed div `top:70px`, full-width, `background: rgba(0,0,0,0.85)`, `backdrop-filter: blur(8px)`, appended to `document.body`
  - [ ] 🟥 Both variants: render pills from `IMDB_FILTER_LABELS`, wire click → `currentThreshold` → `applyFilterToAllCards()` → `saveFilterPreference()`; highlight active pill gold (`#F5C518`)
  - [ ] 🟥 Variant A pill style: height 28px, font 13px, transparent bg, white text, gold when active — inherits Netflix nav font
  - [ ] 🟥 Variant B pill style: height 24px, font 12px, preceded by `IMDb` label in gold at 11px
  - [ ] 🟥 Delete `injectFilterBar()` and all sub-functions entirely from [src/content.js](src/content.js)
  - [ ] 🟥 Delete all `.imdb-filter-trigger` and `.imdb-bottom-sheet` CSS from [src/styles.css](src/styles.css)
  - [ ] 🟥 Add CSS for `.imdb-nav-filter-bar` (both variant styles, clearly labeled) to [src/styles.css](src/styles.css)
  - **Acceptance Criteria**:
    - With `FILTER_UI_MODE = 'VARIANT_B'`: gold-labeled pill row visible immediately below Netflix nav on page load — no click required
    - With `FILTER_UI_MODE = 'VARIANT_A'`: pills appear inside Netflix top nav bar
    - Switching the constant and reloading changes which variant renders
    - No floating trigger button visible in either variant
    - No bottom sheet appears
    - `grep -r "imdb-filter-trigger\|imdb-bottom-sheet" src/` returns zero hits
    - Filter still functions (threshold persists across page reload)
  - **Test Input**: Toggle `FILTER_UI_MODE` between `'VARIANT_A'` and `'VARIANT_B'`, reload extension, screenshot both
  - **Gate**: Do NOT proceed to Step 4 until Step 3 criteria confirmed PASS ✅ and both variants visually reviewed by product

- [ ] 🟥 **Step 4: Regression Sweep**
  - [ ] 🟥 Run `grep -r "rotten\|tomato\|rt_rating\|FILTER_MODES" src/` → must return zero
  - [ ] 🟥 Run `grep -r "imdb-filter-trigger\|imdb-bottom-sheet\|injectFilterBar" src/` → must return zero
  - [ ] 🟥 Load extension on Netflix browse page → confirm badges render, filter works, no console errors
  - [ ] 🟥 Load extension on Netflix search results → confirm grid reflows on filter, no empty cells
  - [ ] 🟥 Set filter to 8+, reload page → confirm threshold persists (restored from storage)
  - [ ] 🟥 Open DevTools → Application → Storage → confirm no `filterMode: 'rotten_tomatoes'` causes errors
  - [ ] 🟥 Verify analytics: confirm `trackRawRatingData()` no longer references RT fields
  - **Acceptance Criteria**: All 7 checks above return PASS ✅ with actual output shown
  - **Gate**: Ship only after all rows PASS ✅

---

## Out of Scope (explicitly)
- Any changes to badge design or positioning
- Analytics dashboard changes beyond RT field removal
- Mobile/responsive layout changes beyond what variant styles naturally provide
- Netflix profile page or "continue watching" row — existing exclusion selectors unchanged
