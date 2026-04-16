# Privacy Policy — Netflix IMDb Ratings

**Last updated:** 2026-04-17

This Chrome extension is designed to respect your privacy. This document explains exactly what the extension does with data.

---

## What data is collected

**Personally identifiable information: none.**

The extension never collects, stores, or transmits:
- Your name, email, IP address, or any identifier
- Your Netflix account details, password, or session cookies
- Your viewing history, watchlist, or search queries
- The specific titles you watch, click, or hover over
- Any location data

## What the extension reads and stores locally

To show IMDb ratings on your Netflix page, the extension:

1. **Reads visible titles** from the Netflix page HTML in your browser (the same titles you can see with your own eyes)
2. **Queries the public [OMDb API](https://www.omdbapi.com/)** with those title strings to fetch the IMDb rating, year, and IMDb ID
3. **Caches the returned ratings** in your local browser storage (`chrome.storage.local`) for 7 days so repeat visits are instant
4. **Saves your chosen filter threshold** (e.g., `7+`) in `chrome.storage.sync` so the setting follows you across Chrome sign-ins

None of this data leaves your browser, except for the OMDb API request which contains only the movie/show title.

## Optional anonymous analytics

The extension includes an **optional**, **aggregate**, **anonymous** analytics module (`src/analytics.js`) that sends a weekly summary to a backend owned by the developer. This summary contains:

- Total count of API calls, successes, errors, cache hits/misses (numbers only)
- Count of feature interactions (e.g., "filter pill clicked 42 times")
- A list of up to 20 movie/show titles that the OMDb API could not match (used to improve title-matching accuracy)

The summary **never** includes:
- Any identifier that could link data back to you
- Any title you watched, clicked, or filtered in
- IP addresses (these are discarded server-side)
- Timestamps of individual actions

**To disable analytics completely:** remove `src/analytics.js` from the `content_scripts` array in `manifest.json` before loading the extension. This is documented in the README.

## Permissions requested

The extension requests the following Chrome permissions:

| Permission | Why |
|---|---|
| `activeTab` | Read the currently open Netflix tab to find titles |
| `scripting` | Inject the IMDb badge and filter bar into the Netflix page |
| `storage` | Cache ratings locally and save your filter preference |
| Host permission: `https://www.netflix.com/*` | Run only on Netflix, nowhere else |
| Host permission: `https://www.omdbapi.com/*` | Fetch IMDb ratings |
| Host permission: `https://netflix-imdb-backend.vercel.app/*` | Send the optional weekly anonymous analytics |

The extension does **not** run on any website other than `netflix.com`.

## Third parties

- **OMDb API** (omdbapi.com) — receives title strings only. See their [privacy policy](https://www.omdbapi.com/).
- **Netflix** — the extension runs inside Netflix's page but does not send them any additional data beyond what your normal browsing sends.

We do **not** share, sell, or license any data to advertisers, data brokers, or any other third party.

## Your rights and controls

- **Clear all cached ratings:** Chrome DevTools → Application → Storage → Clear site data, or disable/remove the extension
- **Clear sync preference:** Uninstall the extension — `chrome.storage.sync` data is removed automatically
- **Disable analytics:** see "Optional anonymous analytics" above

## Open source

The full source code is available at <https://github.com/anubhav16/netflix-imdb-ratings> and can be audited by anyone.

## Contact

Questions, concerns, or requests? Open an issue: <https://github.com/anubhav16/netflix-imdb-ratings/issues>

## Changes to this policy

Any change will be reflected in this file, with a new date at the top. Significant changes will be announced in RELEASE_NOTES.md.
