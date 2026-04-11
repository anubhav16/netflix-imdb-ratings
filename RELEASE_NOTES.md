# Release Notes

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
