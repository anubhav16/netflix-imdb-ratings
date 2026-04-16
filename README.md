# Netflix IMDb Ratings — Chrome Extension

**See IMDb ratings on every Netflix thumbnail. Filter out low-rated titles in one click.**

A free, open-source Chrome extension that shows IMDb ratings directly on Netflix thumbnails and lets you filter the entire catalog by rating (5+, 6+, 6.5+, 7+, 7.5+, 8+, 8.5+). No more guessing. No more doomscrolling. Just quality content, instantly.

[![GitHub](https://img.shields.io/badge/GitHub-netflix--imdb--ratings-181717?logo=github)](https://github.com/anubhav16/netflix-imdb-ratings)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-coming%20soon-orange)](https://chrome.google.com/webstore)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](#license)
[![No Tracking](https://img.shields.io/badge/Privacy-No%20tracking-blue)](#privacy)

---

## Install in 60 seconds

No Chrome Web Store yet — for now, install manually. Takes under a minute.

### Step 1 — Download the extension
Click the green **Code** button on [the GitHub page](https://github.com/anubhav16/netflix-imdb-ratings) → **Download ZIP** → unzip it somewhere you'll remember (e.g. Downloads folder).

*(Or if you use git: `git clone https://github.com/anubhav16/netflix-imdb-ratings.git`)*

### Step 2 — Open Chrome's extensions page
Copy-paste this into your Chrome address bar:
```
chrome://extensions/
```

### Step 3 — Turn on Developer Mode
Toggle **Developer mode** on (top-right corner of the extensions page).

### Step 4 — Load the extension
Click **Load unpacked** (top-left) → select the unzipped `netflix-imdb-ratings` folder → done.

### Step 5 — Open Netflix
Go to [netflix.com](https://www.netflix.com) and you'll see IMDb ratings on every tile plus a filter bar at the top. 🎉

**Troubleshooting:** If nothing shows, refresh the Netflix tab. If still broken, [open an issue](https://github.com/anubhav16/netflix-imdb-ratings/issues).

---

## What you get

- **IMDb rating on every thumbnail** — a small gold badge in the top-left of each tile, no hover needed
- **Always-visible filter bar** — pills (All / 5+ / 6+ / 6.5+ / 7+ / 7.5+ / 8+ / 8.5+) at the top of Netflix, hidden on Games and the video player
- **One-click filtering** — click a pill, low-rated tiles vanish and the row collapses (no empty slots)
- **Click the active pill to turn the filter off** — returns to *All*
- **Preference saved** — your last filter persists across sessions and devices (via Chrome sync)
- **Fast, local, zero telemetry on by default** — caches ratings for 7 days in your browser

---

## How it works

1. The extension scans Netflix thumbnails as you browse
2. For each title, it checks a 7-day local cache; if missing, it queries the free [OMDb API](https://www.omdbapi.com/)
3. Ratings render as small gold badges overlaid on the original Netflix artwork
4. The filter bar (injected into Netflix's top nav) lets you hide titles below any rating threshold
5. Your filter preference syncs via `chrome.storage.sync` — same setting everywhere you're signed into Chrome

No Netflix credentials are ever read. No content you watch is ever sent anywhere.

---

## Privacy

**What we never do:** collect identity, IP, viewing history, or any personal data. No tracking cookies. No ads.

**What the extension does:**
- Reads Netflix page HTML to extract visible title names
- Calls the public OMDb API with those title strings
- Stores the ratings in your local browser cache for 7 days
- Stores your chosen filter threshold in Chrome sync storage

**Optional anonymous analytics** (aggregate counts only — badges shown, cache hit rate, common "not found" titles) can be disabled at any time by removing `src/analytics.js` from the loaded extension.

The entire codebase is [open-source and auditable](https://github.com/anubhav16/netflix-imdb-ratings).

---

## Keyboard / UX tips

- Click **All** — or click the currently active pill — to clear the filter
- Filter bar is hidden automatically on `/watch/...` and `/games` so it never covers Netflix's own UI
- On first visit expect ~1–2 seconds for the OMDb cache to warm up; after that ratings appear instantly on reload

---

## FAQ

**Does this work on Firefox or Safari?**
Not yet — Chrome and Edge (Chromium) only. Port contributions welcome.

**Does this work on Netflix mobile / the Netflix TV app?**
No — browser extension only.

**Why do some thumbnails have no badge?**
OMDb didn't find a match (rare titles, some international content, or Netflix's internal title differs from IMDb's). We hide the badge rather than show a "?" — cleaner look.

**Is it against Netflix Terms of Service?**
The extension only reads what you already see and overlays information — no modification of Netflix streams, no circumvention. Use at your own discretion; we provide no warranty.

**Why OMDb and not IMDb directly?**
IMDb has no public API. OMDb mirrors IMDb data and is free (1,000 requests/day) — plenty for typical personal use thanks to our 7-day cache.

**Can I get Rotten Tomatoes too?**
RT was removed in v0.4.0 to keep the UI focused. Happy to revisit if there's demand — [open an issue](https://github.com/anubhav16/netflix-imdb-ratings/issues).

---

## For developers

```bash
git clone https://github.com/anubhav16/netflix-imdb-ratings.git
cd netflix-imdb-ratings
# Load unpacked in chrome://extensions/ with Developer mode enabled
# Edit src/content.js or src/styles.css → reload extension → refresh Netflix
```

**Project layout:**
```
src/
├── content.js      # main content script (DOM, OMDb fetch, cache, filter)
├── styles.css      # badge + filter-bar styles
├── analytics.js    # optional anonymous usage counts
└── background.js   # minimal service worker
manifest.json       # MV3 config
```

**Filter UI variants:** Set `FILTER_UI_MODE` at the top of [src/content.js](src/content.js) to `'VARIANT_A'` (inject into Netflix nav) or `'VARIANT_B'` (fixed bar below nav).

**Contributing:** Fork → feature branch → PR. Keep diffs focused; no large refactors in bug-fix PRs.

---

## Changelog

See [RELEASE_NOTES.md](RELEASE_NOTES.md).

## License

[MIT](LICENSE) — free for personal and commercial use. No warranty.

---

## Why this exists

Netflix ranks by engagement, not quality. You can spend 30 minutes in the browse UI before finding something worth watching. Pasting titles into IMDb one-by-one is absurd. This extension is the 5-second fix.

---

## Keywords

Netflix IMDb extension · Netflix rating filter · Chrome extension for Netflix · Netflix IMDb ratings · filter Netflix by rating · Netflix quality filter · see IMDb ratings on Netflix · best Netflix content finder · Netflix hide low-rated shows · IMDb overlay Netflix · Netflix browser extension

---

**Made by [Anubhav](https://github.com/anubhav16)** · [Report a bug](https://github.com/anubhav16/netflix-imdb-ratings/issues) · [Suggest a feature](https://github.com/anubhav16/netflix-imdb-ratings/issues/new)
