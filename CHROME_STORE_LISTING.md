# Chrome Web Store — Listing Copy

Copy-paste this into the Chrome Web Store developer dashboard.

---

## Extension name (max 45 chars)

```
Netflix IMDb Ratings — Rating Filter
```
*(36 chars)*

## Short summary / Short description (max 132 chars)

```
See IMDb ratings on every Netflix thumbnail. Filter out low-rated titles in one click. Free, private, no tracking.
```
*(119 chars)*

## Category

```
Productivity
```
*(Alternative if unavailable: Entertainment)*

## Language

```
English (United States)
```

---

## Detailed description (max 16,000 chars)

```
Stop wasting 30 minutes browsing Netflix before finding something to watch.

Netflix IMDb Ratings shows the IMDb score on every thumbnail and lets you filter the entire catalog by rating in one click. No hover. No menu-digging. No guessing.

━━━━━━━━━━━━━━━━━━━━━━
WHAT YOU GET
━━━━━━━━━━━━━━━━━━━━━━

⭐ IMDb rating on every Netflix tile — small gold badge, top-left corner
🎯 One-click filter — pick 6+, 7+, 7.5+, 8+, 8.5+ and low-rated tiles vanish
🔁 Click the active filter again to turn it off
⚡ 7-day local cache — ratings load instantly on repeat visits
💾 Filter preference syncs across your Chrome devices
🚫 Hidden automatically on the Netflix player and Games pages — never in the way
🔒 Zero tracking, zero ads, zero account required

━━━━━━━━━━━━━━━━━━━━━━
HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━━

1. Install the extension
2. Open Netflix
3. You'll see a filter bar at the top with pills: All, 5+, 6+, 6.5+, 7+, 7.5+, 8+, 8.5+
4. Click any pill — titles below that rating instantly disappear and the rest reflow to fill the space
5. Click the same pill again (or click "All") to show everything

Ratings are fetched from the free, public OMDb API (which mirrors IMDb) and cached locally for 7 days. No Netflix credentials are ever read.

━━━━━━━━━━━━━━━━━━━━━━
PRIVACY
━━━━━━━━━━━━━━━━━━━━━━

We do not collect any personal data. We do not track you. We do not see what you watch.

The extension reads the title text that is already visible on your Netflix page, sends it to OMDb, and caches the rating in your local browser storage. That's it.

Optional anonymous usage counts (weekly aggregate, no personal info) can be fully disabled — see the full privacy policy for instructions:
https://github.com/anubhav16/netflix-imdb-ratings/blob/main/PRIVACY.md

━━━━━━━━━━━━━━━━━━━━━━
OPEN SOURCE
━━━━━━━━━━━━━━━━━━━━━━

The entire codebase is open and auditable on GitHub:
https://github.com/anubhav16/netflix-imdb-ratings

Found a bug? Want a feature? Open an issue — we actually respond.

━━━━━━━━━━━━━━━━━━━━━━
WHO IT'S FOR
━━━━━━━━━━━━━━━━━━━━━━

• Anyone tired of scrolling Netflix endlessly
• People who trust IMDb ratings as a quality signal
• Privacy-conscious users who want NO tracking
• Keyboard-light users who want one-click filtering

━━━━━━━━━━━━━━━━━━━━━━
NOT AFFILIATED WITH NETFLIX OR IMDB
━━━━━━━━━━━━━━━━━━━━━━

This is an independent, fan-made tool. Ratings from IMDb via OMDb. Netflix is a trademark of Netflix, Inc. IMDb is a trademark of IMDb.com, Inc.
```

---

## Privacy policy URL

```
https://github.com/anubhav16/netflix-imdb-ratings/blob/main/PRIVACY.md
```

## Homepage URL

```
https://github.com/anubhav16/netflix-imdb-ratings
```

## Support URL

```
https://github.com/anubhav16/netflix-imdb-ratings/issues
```

---

## Single purpose description (required field)

```
Displays IMDb ratings on Netflix thumbnails and lets users filter Netflix content by a minimum IMDb rating.
```

## Permission justifications

**`activeTab`** — Required to read the currently-open Netflix tab's DOM to find movie and TV show titles that need rating badges.

**`scripting`** — Required to inject the small rating badge and the filter bar UI into Netflix's page.

**`storage`** — Required to cache fetched IMDb ratings locally for 7 days (so ratings load instantly on revisits) and to persist the user's chosen filter threshold.

**Host permission `https://www.netflix.com/*`** — The extension runs only on Netflix. Needed to read page content and inject badges.

**Host permission `https://www.omdbapi.com/*`** — Needed to fetch the IMDb ratings (OMDb mirrors IMDb data via a public API).

**Host permission `https://netflix-imdb-backend.vercel.app/*`** — Sends optional anonymous aggregate usage counts (can be disabled by the user). Never sends any personal data.

## Data usage disclosures (for the CWS "Privacy practices" tab)

Check the following boxes:

- [x] **Website content** — "This developer has disclosed that it will not collect or use your data."
  (We only read Netflix page HTML transiently to extract titles. Nothing about you is collected.)
- [x] **Web history** — NOT collected
- [x] **User activity** — NOT collected
- [x] **Personally identifiable info** — NOT collected
- [x] **Authentication info** — NOT collected
- [x] **Personal communications** — NOT collected
- [x] **Financial / payment info** — NOT collected
- [x] **Health info** — NOT collected
- [x] **Location** — NOT collected

Check the three disclaimer boxes at the bottom:
- [x] I do not sell or transfer user data to third parties
- [x] I do not use or transfer user data for unrelated purposes
- [x] I do not use or transfer user data to determine creditworthiness or for lending

---

## Screenshots (1280×800 recommended, up to 5)

Take these on Netflix with the extension active:

1. **Home page with filter bar visible** — shows pills in the Netflix nav, multiple tiles with gold rating badges
2. **Filter applied (7+)** — same home, with lower-rated titles collapsed out (no empty gaps)
3. **Click active pill to toggle off** — before/after demonstrating the deselect behavior (optional, 2-panel)
4. **Search results with ratings** — shows badges in the search grid
5. **Close-up of a rating badge** — zoomed-in view of the gold 8.5 badge on a poster

**How to capture exactly 1280×800:**
- macOS: Resize browser window, use `Cmd+Shift+5` → Capture Selected Window
- Then in Preview: Tools → Adjust Size → set to 1280×800 (uncheck "Scale proportionally" temporarily or crop first)
- Save as PNG

## Promotional images (optional but recommended)

- **Small promo tile:** 440×280 PNG/JPEG — shows extension name + tagline + screenshot thumbnail
- **Marquee promo tile:** 1400×560 PNG/JPEG — used if featured

Skip these for first submission — can add later.

---

## Submission checklist

- [ ] Register Chrome Web Store developer account ($5 one-time) — <https://chrome.google.com/webstore/devconsole>
- [ ] Generate icons via `tools/generate-icons.html` → drop into `icons/`
- [ ] Run `tools/build-cws.sh` → creates `dist/netflix-imdb-ratings-v0.4.1.zip`
- [ ] Take 2-5 screenshots at 1280×800
- [ ] In the developer console: "New item" → upload zip
- [ ] Fill in every field above (copy-paste from this doc)
- [ ] Upload screenshots
- [ ] Privacy practices tab: fill using the "Data usage disclosures" checklist above
- [ ] Save draft → Submit for review
- [ ] Wait 1-3 business days
- [ ] Once approved, update the README badge from "coming soon" to the live store link
