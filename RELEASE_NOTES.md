# Release Notes

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
