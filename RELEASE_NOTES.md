# Release Notes

## [0.4.0] - 2026-04-17

### Removed
- **Rotten Tomatoes filter** — Completely removed RT as a feature (mode toggle, RT badges, RT analytics, RT storage key)
  - Deleted RT_FILTER_LABELS, FILTER_MODES, currentFilterMode, saveFilterMode(), restoreFilterMode()
  - Deleted reRenderAllBadges() (only needed for mode switching)
  - Removed RT parsing from normalizeOMDbResponse() and RT fields from cache
  - Removed RT tracking from analytics (ratingSource, rt_rating, rtRatingsCollected)
  - Removed .imdb-badge-mode-rt, mode toggle CSS from styles.css

### Changed
- **Filter thresholds** — Revised IMDb pill set: ≤5, 5+, 6+, 6.5+, 7+, 7.5+, 8+, 8.5+ (removed 5.5+ and 9+, added 6.5+)
- **Default threshold** — Changed from 5 to 0 (show all by default)
- **Cell shifting** — Filtered titles now collapse fully in carousel rows and search grid; no empty boxes remain
  - applyFilterToCard() now hides the outermost flex/grid container (.slider-item or grid item), not just the inner card
- **Navbar filter bar** — Replaced floating trigger + bottom sheet with always-visible filter bar
  - Variant A: Pills injected inside Netflix nav bar
  - Variant B: Fixed bar pinned below Netflix nav (default, resilient to Netflix DOM changes)
  - Filter is always visible on browse/search pages — no click required to reveal

### Technical
- Removed ~150 lines of RT-related code from content.js
- Removed ~45 lines of RT CSS from styles.css
- Analytics now only tracks IMDb ratings
- FILTER_UI_MODE constant switches between navbar variants

---

## [0.3.3] - 2026-04-14

### Fixed
- **Filter trigger visibility** — Fixed visibility control for floating trigger button on all pages
  - Filter now correctly visible on `/browse` and `/search` pages
  - Filter correctly hidden on `/watch/...` (player) and profile selection screens
  - SPA navigation (pushState, replaceState, popstate) properly updates trigger visibility
  - Periodic re-injection respects visibility rules — no re-appearing on wrong screens
  - Fixed `requestIMDbRating()` to use correct `response.imdbRating` field (was: `response.rating`)
  - Fixed badge injection to use `injectBadge()` instead of deprecated `updateBadge()`

### Removed (Phase 2: Cleanup)
- **Legacy filter bar code** — Completely removed old fixed-position filter bar implementation
  - Deleted deprecated `updateFilterBarVisibility()` function (handled old `.imdb-filter-bar`)
  - Removed 90+ lines of legacy CSS (.imdb-filter-bar, .imdb-slider, .imdb-filter-container, etc.)
  - Updated all visibility handlers to use new `.imdb-filter-trigger` element
  - SPA navigation handlers (pushState, replaceState, popstate) use direct trigger queries

### Changed
- **Visibility logic** — Replaced old filter bar visibility with new floating trigger logic
  - All SPA navigation detection now updates `.imdb-filter-trigger` instead of `.imdb-filter-bar`
  - MutationObserver handles visibility for both badge injection and trigger visibility
  - Periodic re-injection check properly manages floating trigger element
  - All visibility checks use consistent `shouldShowFilter()` function

### Technical
- Code cleanup: ~130 lines removed from content.js and styles.css
- No changes to filter functionality or badge rendering
- State management and persistence unchanged
- Filter logic (applyFilterToAllCards, etc.) untouched

### Test Status
- ✅ All Step 1/2 filter tests still pass
- ✅ New UI is sole filter implementation
- ✅ No console errors from deleted code
- ✅ SPA navigation and visibility work correctly
- ✅ Filter trigger visible on `/browse`, hidden on `/watch/...` and profile screens

---

## [0.3.2] - 2026-04-14

### Changed (Phase 1: Filter UI Redesign)
- **Floating Trigger Button** — Replaced full-width fixed filter bar with minimalist 48px circular button (bottom-right)
  - Button shows mode indicator (◉ for IMDb gold, ● for RT red)
  - Floating position keeps screen real estate, non-intrusive
  - Mobile responsive: repositioned to avoid Netflix bottom controls
  
- **Bottom Sheet Panel** — New slide-up modal for filter controls
  - Appears on trigger button click, slides up from bottom (300ms animation)
  - Contains header ("Filter Content" + close X), mode toggle, pill buttons
  - Scrollable content area for responsive height (60% desktop, 100% mobile)
  - Semi-transparent dimmed backdrop with blur effect
  - Closes on: X button click, outside tap (backdrop), Escape key

- **Filter Logic Preserved** — All existing filter functionality intact
  - Pill buttons still filter by rating threshold (IMDb/RT)
  - Mode toggle still switches between IMDb and Rotten Tomatoes
  - Preferences still persisted to chrome.storage.sync
  - Badges on cards unchanged in styling/rendering

### Fixed
- Periodic re-injection check now correctly uses filterTriggerElement variable (was: filterBarElement)
  - Prevents ReferenceError every 5 seconds in periodic interval
  - Ensures filter trigger is always present on page

### Technical
- Event handlers: 6 listeners (trigger click, close click, backdrop click, Escape key, pill clicks, mode clicks)
- Z-index hierarchy: trigger 10000 > sheet 9999
- Animation: 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) for snappy feel
- Accessibility: ARIA labels, role="dialog", aria-modal="true", keyboard support
- CSS: New styles for .imdb-filter-trigger, .imdb-bottom-sheet, .imdb-sheet-panel, etc.

### Known
- This is Phase 1 of 4-phase UI redesign
- Phases 2-4 will: port filter logic, remove old code, add polish & accessibility, regression sweep

---

## [0.3.1] - 2026-04-13

### Fixed
- Filter bar now correctly hidden on profile selection screen ("Who's watching?")
- Filter bar correctly hidden on player screen (`/watch/...`)
- Filter bar correctly shown on browse and search pages
- SPA navigation detection: filter bar visibility updates immediately on route changes (pushState, replaceState, popstate)
- Periodic re-injection (5s interval) now respects `shouldShowFilter()` — won't re-appear on profile/player screens

### Changed
- `shouldShowFilter()`: Simplified and fixed detection logic
  - Primary check: `pathname.startsWith('/watch/')` for player screen
  - Secondary check: `document.querySelector('.list-profiles')` for profile selection
  - Removed overly broad checks (`/profiles`, `jbv=`, `[data-uia="profiles"]`) that were over-suppressing
- Added `updateFilterBarVisibility()` helper: sets `display: none/block` without DOM removal
- `setInterval` now gated on `shouldShowFilter()` before re-injection
- MutationObserver now calls `updateFilterBarVisibility()` in debounce callback

### Technical
- History API override catches all SPA route changes (Netflix uses pushState/replaceState heavily)
- `popstate` listener handles back button navigation
- `display: none` approach is faster than DOM removal and allows instant toggle back when returning to browse

---

## [0.3.0] - 2026-04-13

### Added
- **Rotten Tomatoes filter support** — Toggle between IMDb and RT ratings with dedicated filter modes
- Filter mode toggle switch (IMDb | Rotten Tomatoes) in filter bar
- RT badge styling with tomato red color (#E84D37) — IMDb uses gold (#F5C518)
- Fetch both IMDb and RT scores from OMDb API in single request

### Fixed
- Filter bar now hidden on Netflix profile/account screens — only visible when browsing content
- Exact filter label values: IMDb (≤5, 5.0+, 5.5+, ..., 9.0+), RT (0%, 10%, ..., 100%)
- Redesigned filter UI with pill buttons matching Netflix aesthetic — replaced HTML range slider
- Filtered-out cards now completely hidden with display: none — improves scroll performance and UX
- Loading state improved — badges only show after rating fetched, no pulsating dots

### Changed
- Filter bar design: Added mode toggle (IMDb/RT) at top, pill button grid below for theme-specific thresholds
- Badge styling: Different colors per mode (gold for IMDb, red for RT)
- Filter application: Uses correct score per mode when comparing against threshold
- Slider changed to pill buttons for cleaner, more discoverable UI

### Technical
- New storage key: `imdb_filter_mode` (persists selected filter type across sessions)
- Extended fetchFromOMDb() to parse Rotten Tomatoes score from OMDb Ratings array
- Updated injectBadge() to show correct rating and color based on currentFilterMode
- Updated applyFilterToCard() to hide cards (display: none) instead of fade
- Added shouldShowFilter() to conditionally hide filter on profile screens
- Badge injection now happens AFTER rating fetched (no loading placeholders)

---

## [0.2.8] - 2026-04-13

### Added
- Persistent filter preferences via chrome.storage.sync — filter threshold now automatically saved and restored across sessions
- Cross-device sync support — filter preference follows users across devices using Chrome's built-in sync

### Changed
- initializeExtension(): Now restores saved filter preference on page load before applying filters
- injectFilterBar(): Added storage listener to persist slider value on every change
- Filter bar initialization: Threshold restored from chrome.storage.sync, defaults to 0 if not saved

### Technical
- New utility functions: saveFilterPreference() and restoreFilterPreference() for clean storage abstraction
- Storage key: `imdb_filter_threshold` in chrome.storage.sync (7-day default fallback to local cache)
- Error handling: Graceful fallback to DEFAULT_RATING_THRESHOLD if storage API fails

---

## [0.2.7] - 2026-04-13

### Fixed
- Filter bar now re-injects if removed from DOM by Netflix (periodic check every 5s)
- Slider interaction fixed: now responds to input, change, and touchend events (works in both directions)
- Search page filter now works correctly when moving slider right-to-left
- Improved selector specificity to exclude ranking containers when applying filters
- Added diagnostic logging to help troubleshoot filter bar visibility issues

### Changed
- injectFilterBar(): Now checks DOM directly with querySelector instead of just checking memory reference
- Added periodic setInterval() that verifies filter bar presence and re-injects if needed
- Slider event handling: Added 'change' and 'touchend' listeners in addition to 'input'
- applyFilterToAllCards(): Updated selectors to exclude ranking containers (`:not([data-testid*="ranking"])`)

### Technical
- Better resilience against Netflix DOM mutations that remove the filter bar
- Diagnostic logging with full CSS property inspection on page load
- Enhanced event listener coverage ensures slider works on mobile and desktop in all directions

---

## [0.2.6] - 2026-04-12

### Fixed
- Filter bar default threshold changed from 0 to 5 — users see filtering immediately without manual adjustment
- Search page slider now works correctly — added search gallery video card selector to filter logic
- Filter properly fades/unfades cards on search pages when slider moves (both directions)

### Changed
- DEFAULT_RATING_THRESHOLD: 0 → 5 (users see "5.0+" by default, only ratings ≥5 visible on load)
- applyFilterToAllCards(): Updated selector to include `[data-uia="search-gallery-video-card"]` for search support

### Technical
- Selector consolidation in progress (Phase 2 will further consolidate duplicate selectors)
- Improved search page UX — filter now functional across all Netflix page types

---

## [0.2.5] - 2026-04-12

### Fixed
- Filter bar now visible on all Netflix pages (browse, search, etc.)
- Filter bar positioned below Netflix header (not covering navigation)
- Added support for IMDb ratings on Netflix search pages
- CSS: Added `position: fixed; top: 70px` to fix z-index visibility issue
- Filter bar insertion changed to `appendChild()` for correct DOM placement

### Changed
- .imdb-filter-bar CSS: Added fixed positioning below header (top: 70px)
- injectFilterBar(): Changed from insertBefore to appendChild for correct placement
- NETFLIX_SELECTORS: Added search gallery video card selector

### Technical
- Filter bar now uses fixed positioning with proper z-index layering
- Works across all Netflix page layouts (browse, search, genres, etc.)
- Search results now display IMDb ratings using correct selector

---

## [0.2.4] - 2026-04-12

### Fixed
- Filter bar no longer crashes with null pointer exception when querySelector fails
- Badge sizing now correctly calculated after Netflix layout stabilizes (1000ms vs 500ms)
- Manifest version updated to match deployed code (was stuck at 0.1.0)
- Added null checks and error handling for filter bar event listeners
- Increased initial setTimeout to 1000ms to ensure accurate offsetWidth calculations on all thumbnail rows

### Changed
- injectFilterBar(): Added try-catch and null checks around querySelector + addEventListener
- initializeExtension(): Increased setTimeout from 500ms to 1000ms for layout stabilization
- manifest.json: Updated version from 0.1.0 to 0.2.3

### Technical
- Defensive null checks prevent content script crashes when DOM selectors fail
- Timing alignment ensures offsetWidth reflects final rendered dimensions
- Version consistency enables proper extension hot-reload and cache busting

---

## [0.2.3] - 2026-04-12

### Fixed
- Pulsating dots no longer appear on ranking numbers — fixed falsy-check bug in width validation
- Rating badges no longer overflow narrow thumbnails — implemented responsive sizing (18px on narrow, 28px on regular)
- Filter bar now visible on Netflix pages — increased z-index to 10000 and added insertion retry logic
- Width validation now correctly rejects cards with offsetWidth ≤ 100px (was incorrectly accepting undefined/0)

### Changed
- extractTitle(): Fixed width check to use `!card.offsetWidth || card.offsetWidth < 100`
- injectBadge(): Added responsive sizing via data-size attribute based on thumbnail width
- injectFilterBar(): Added retry logic on MutationObserver if initial insertion fails
- .imdb-badge CSS: Added size variants (small: 18px, large: 28px)
- .imdb-filter-bar CSS: Increased z-index from 999 to 10000

### Technical
- Dynamic badge sizing adapts to container width (no hard-coded 28px for all cases)
- Filter bar retry logic ensures visibility even with late DOM insertion
- Backward compatible — no breaking changes to API or storage

---

## [0.2.2] - 2026-04-12

### Fixed
- Badges no longer injected on ranking numbers in "Top 10 Shows" sections
- Title validation: reject single/double digit strings (prevents "1", "2", "3" from being treated as movies)
- Width pre-flight check: skip narrow containers (ranking cards are ~80px, movies are ≥120px)
- Badge overflow handling: constrain badges to thumbnail boundaries (no bleed-out)
- Selector refinement: exclude index/ranking containers from badge injection

### Changed
- extractTitle(): Now validates title content (alphanumeric, min 2 chars)
- injectBadgesForVisibleCards(): Added width check before extracting titles
- Badge parent styling: Added overflow handling

---

## [0.2.1] - 2026-04-12

### Added
- Local analytics tracking (stores in chrome.storage.local)
- Anonymous aggregate reporting (weekly to backend)
- Track blank API results (which titles return no IMDb match)
- Track feature usage (filter slider uses, badge counts, cache rates)
- Backend setup: Vercel + Supabase integration
- ANALYTICS_SETUP.md: Complete deployment guide

### Changed
- manifest.json: Added analytics.js and backend host permissions
- README.md: Updated privacy section with analytics details
- Analytics data: Top 20 blank titles tracked for debugging

### Technical
- Concurrent analytics module with chrome.storage.local
- Automatic weekly aggregate reporting (no user intervention)
- Zero personal data collected (fully anonymous)
- Chrome Web Store compliant

---

## [0.2.0] - 2026-04-12

### Added
- Direct OMDb API integration in content script (moved from service worker)
- Fuzzy title matching for Netflix → IMDb title normalization (handles colons, special chars, subtitles)
- IMDb rating badges on Netflix thumbnails (always visible, no hover required)
- MutationObserver for dynamic content loading as user scrolls
- Filter UI with rating threshold slider
- 7-day caching of IMDb data via chrome.storage.local
- Pulsating dot loading state during badge fetch (no "?" text)
- Automatic badge removal for unmatched titles (no visual clutter)

### Changed
- Moved API calls from background service worker to content script for reliability
- Improved error handling for CORS and network failures
- Badge design: top-left corner, 28px circle with IMDb yellow rating
- Loading indicator: pulsating yellow dot instead of "?"
- N/A handling: badges completely removed instead of showing "?"

### Fixed
- Service worker message passing reliability issues (now using direct fetch)
- Title matching with multiple variation strategies
- UX: Removed visual clutter from unmatched titles (no more "?" badges)

---

## [0.1.0] - 2026-04-11

### Initial Release
- Basic extension scaffold with Manifest V3
- Content script + service worker architecture
- IMDb rating overlay on hover (proof of concept)
