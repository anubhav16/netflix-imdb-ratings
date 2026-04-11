# Netflix IMDb Ratings - Implementation Roadmap

## Overview

This document provides specific technical guidance for implementing the Netflix IMDb Ratings extension based on the feasibility assessment.

---

## Phase 1: Architecture Foundation (Week 1)

### 1.1 Secure OMDb API Key

**Action Items:**
1. Go to [OMDb API](https://www.omdbapi.com/apikey.aspx)
2. Create free account and generate API key
3. Store in `src/config.js` (add to .gitignore):
   ```javascript
   export const OMDB_API_KEY = 'your_key_here';
   export const OMDB_RATE_LIMIT = 1000; // requests/day
   ```

**Risk Considerations:**
- Free tier limited to 1,000 requests/day (0.7 req/sec sustained)
- No credit card required; no cost
- Consider upgrade ($50/month) if user exceeds limit

### 1.2 Build Cache Layer (IndexedDB)

**File:** `src/cache.js`

```javascript
class IMDbCache {
  constructor() {
    this.dbName = 'netflix-imdb-cache';
    this.storeName = 'imdbData';
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, 
            { keyPath: 'netflixTitle' });
          // Create indexes for faster lookup
          store.createIndex('imdbId', 'imdbId', { unique: true });
          store.createIndex('timestamp', 'timestamp');
        }
      };
    });
  }

  async get(netflixTitle) {
    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(netflixTitle);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async set(netflixTitle, imdbData) {
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    const cacheEntry = {
      netflixTitle,
      ...imdbData,
      timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(cacheEntry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async cleanup(daysOld = 30) {
    // Remove entries older than specified days
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const index = store.index('timestamp');
    
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const range = IDBKeyRange.upperBound(cutoff);
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => {
        request.result.forEach(entry => {
          store.delete(entry.netflixTitle);
        });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}
```

### 1.3 Implement OMDb API Client

**File:** `src/api.js`

```javascript
import { OMDB_API_KEY } from './config.js';

class OMDbClient {
  constructor(cache) {
    this.apiUrl = 'https://www.omdbapi.com/';
    this.cache = cache;
    this.requestQueue = [];
    this.dailyRequests = 0;
    this.lastResetDate = new Date().toDateString();
  }

  async search(title, year = null) {
    // Check cache first
    const cacheKey = year ? `${title} (${year})` : title;
    const cached = await this.cache.get(cacheKey);
    
    if (cached && cached.imdbId) {
      console.log(`Cache hit: ${cacheKey}`);
      return cached;
    }

    // Check if we're exceeding daily limit
    if (this.dailyRequests >= 950) { // Leave buffer
      console.warn('Approaching OMDb daily limit. Using cache only.');
      return { error: 'Daily limit approaching' };
    }

    // Queue request
    return new Promise((resolve) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this._fetchFromOMDb(title, year);
          
          if (result && result.imdbID) {
            await this.cache.set(cacheKey, {
              title: result.Title,
              year: result.Year,
              imdbId: result.imdbID,
              rating: result.imdbRating,
              votes: result.imdbVotes,
              type: result.Type
            });
          }
          
          resolve(result);
        } catch (error) {
          console.error('OMDb fetch error:', error);
          resolve({ error: error.message });
        }
      });
      
      this._processQueue();
    });
  }

  async _fetchFromOMDb(title, year) {
    const params = new URLSearchParams({
      apikey: OMDB_API_KEY,
      t: title,
      type: 'movie,series', // Allow both
      ...(year && { y: year })
    });

    const response = await fetch(`${this.apiUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`OMDb API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Track daily requests
    this._updateDailyCount();

    if (data.Response === 'False') {
      return { error: data.Error };
    }

    return data;
  }

  _updateDailyCount() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyRequests = 0;
      this.lastResetDate = today;
    }
    this.dailyRequests++;
    
    // Persist to storage
    chrome.storage.local.set({
      omdbDailyCount: this.dailyRequests,
      omdbLastReset: this.lastResetDate
    });
  }

  async _processQueue() {
    if (this.requestQueue.length === 0) return;

    // Process requests at ~0.7 req/sec (1 per 1400ms) to stay within free tier
    const request = this.requestQueue.shift();
    await request();
    
    setTimeout(() => this._processQueue(), 1400);
  }

  async loadDailyCount() {
    const data = await chrome.storage.local.get([
      'omdbDailyCount',
      'omdbLastReset'
    ]);
    
    const today = new Date().toDateString();
    
    if (data.omdbLastReset === today) {
      this.dailyRequests = data.omdbDailyCount || 0;
    } else {
      this.dailyRequests = 0;
    }
  }
}

export default OMDbClient;
```

### 1.4 Update Background Service Worker

**File:** `src/background.js` (REPLACE CURRENT)

```javascript
import OMDbClient from './api.js';
import IMDbCache from './cache.js';

let cache;
let omdbClient;

// Initialize on extension load
chrome.runtime.onInstalled.addListener(async () => {
  cache = new IMDbCache();
  await cache.init();
  
  omdbClient = new OMDbClient(cache);
  await omdbClient.loadDailyCount();
  
  console.log('Netflix IMDb extension initialized');
});

// Handle requests from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchIMDb') {
    handleFetchIMDb(request, sendResponse);
    return true; // Keep message channel open
  }
  
  if (request.action === 'getDailyStats') {
    sendResponse({
      dailyRequests: omdbClient.dailyRequests,
      limit: 1000,
      percentUsed: (omdbClient.dailyRequests / 1000) * 100
    });
  }
});

async function handleFetchIMDb(request, sendResponse) {
  try {
    const { title, year } = request;
    
    if (!omdbClient) {
      omdbClient = new OMDbClient(cache);
      await omdbClient.loadDailyCount();
    }

    const result = await omdbClient.search(title, year);
    
    if (result.error) {
      sendResponse({
        error: result.error,
        title: title,
        fallback: true
      });
    } else {
      sendResponse({
        title: result.Title || title,
        rating: result.imdbRating || 'N/A',
        votes: result.imdbVotes || 'N/A',
        imdbId: result.imdbID,
        type: result.Type,
        year: result.Year
      });
    }
  } catch (error) {
    console.error('Background script error:', error);
    sendResponse({ error: error.message });
  }
}
```

---

## Phase 2: Content Script & DOM Integration (Week 1-2)

### 2.1 Improve Title Extraction

**File:** `src/extractors.js` (NEW)

```javascript
/**
 * Multiple strategies to extract Netflix title from DOM
 * Try each in order until one succeeds
 */

export class TitleExtractor {
  // Strategy 1: Extract from visible text node
  static fromTextContent(element) {
    const text = element?.textContent?.trim();
    return text && text.length > 0 ? text : null;
  }

  // Strategy 2: Extract from aria-label or title attributes
  static fromAttributes(element) {
    return element?.getAttribute('aria-label') || 
           element?.getAttribute('title') ||
           element?.getAttribute('data-title') ||
           null;
  }

  // Strategy 3: Access Netflix's internal state (if available)
  static fromNetflixContext() {
    try {
      // Netflix may expose metadata in window object
      if (window.__NETFLIX_CONTEXT__?.contextSections) {
        // This is an example - actual structure varies
        return window.__NETFLIX_CONTEXT__.contextSections[0]?.title;
      }
      
      // Alternative: Check React's internal props
      const reactRoot = document.querySelector('[data-reactroot]');
      if (reactRoot && reactRoot.__reactProps) {
        // Navigate React component tree (brittle but possible)
        // This requires reverse-engineering Netflix's React structure
      }
    } catch (e) {
      // Silently fail - internal API not available
    }
    return null;
  }

  // Strategy 4: Network interception fallback
  static setupNetworkMonitor(callback) {
    // Intercept fetch/XHR to Netflix's metadata API
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      
      if (args[0]?.includes('/api/') || args[0]?.includes('/metadata')) {
        response.clone().json().then(data => {
          if (data.title) {
            callback(data);
          }
        }).catch(() => {});
      }
      
      return response;
    };
  }

  static extract(element) {
    // Try strategies in order of reliability
    return (
      this.fromTextContent(element) ||
      this.fromAttributes(element) ||
      this.fromNetflixContext()
    );
  }
}
```

### 2.2 Update Content Script with Robust Selection

**File:** `src/content.js` (REPLACE CURRENT)

```javascript
import { TitleExtractor } from './extractors.js';

console.log('Netflix IMDb Ratings extension loaded');

// Extension state
const state = {
  observing: false,
  pendingFetches: new Map(),
  processedTitles: new Set()
};

// Possible Netflix selectors (multiple for robustness)
const NETFLIX_SELECTORS = [
  '[data-testid="hit-title"]',
  '[data-testid="title-card"]',
  '[role="link"][data-testid*="title"]',
  '.nm-collections-row-item',
  '.slider-item',
  '[data-uia="ptrack-container"]'
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeObserver();
});

// Fallback if DOM loads before script
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initializeObserver();
}

function initializeObserver() {
  if (state.observing) return;
  state.observing = true;

  // Watch for new movie cards being added to DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // New nodes added - scan for movie cards
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            scanForMovieCards(node);
          }
        });
      }
    });
  });

  // Observe Netflix's main content area, not entire body
  const contentArea = document.querySelector(
    '[role="main"],' +
    '.mainView,' +
    '[data-uia="mainView"],' +
    'main'
  );

  if (contentArea) {
    observer.observe(contentArea, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    console.log('DOM observer started');
  }

  // Also scan existing cards
  scanForMovieCards(document.body);
}

function scanForMovieCards(container) {
  // Try each selector until we find results
  for (const selector of NETFLIX_SELECTORS) {
    const cards = container.querySelectorAll(selector);
    
    if (cards.length > 0) {
      cards.forEach(card => {
        const title = TitleExtractor.extract(card);
        if (title && !state.processedTitles.has(title)) {
          setupCardHover(card, title);
          state.processedTitles.add(title);
        }
      });
      
      if (cards.length > 0) {
        console.log(`Found ${cards.length} cards with selector: ${selector}`);
        return; // Use first working selector
      }
    }
  }
}

function setupCardHover(card, title) {
  card.addEventListener('mouseenter', () => {
    fetchIMDbRating(title, card);
  }, { once: false });

  card.addEventListener('mouseleave', () => {
    // Optionally: remove overlay on mouse leave
    // const overlay = card.querySelector('.imdb-rating-overlay');
    // if (overlay) overlay.remove();
  });
}

async function fetchIMDbRating(title, element) {
  // Check if already fetched in this session
  if (state.pendingFetches.has(title)) {
    return;
  }

  // Mark as pending
  state.pendingFetches.set(title, true);

  try {
    // Send to background script
    chrome.runtime.sendMessage(
      { action: 'fetchIMDb', title },
      (response) => {
        state.pendingFetches.delete(title);

        if (response && !response.error) {
          showRatingOverlay(element, response);
        } else if (response?.error) {
          showErrorOverlay(element, response.error);
        }
      }
    );
  } catch (error) {
    console.error('Error fetching IMDb rating:', error);
    state.pendingFetches.delete(title);
  }
}

function showRatingOverlay(element, data) {
  // Remove existing overlay if present
  const existing = element.querySelector('.imdb-rating-overlay');
  if (existing) existing.remove();

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.className = 'imdb-rating-overlay';
  overlay.innerHTML = `
    <div class="imdb-rating-content">
      <div class="imdb-rating-score">
        <span class="imdb-star">⭐</span>
        <span class="imdb-rating-value">${data.rating}/10</span>
      </div>
      <div class="imdb-rating-meta">
        <a href="https://www.imdb.com/title/${data.imdbId}/" 
           target="_blank" 
           title="View on IMDb"
           class="imdb-link">IMDb</a>
      </div>
    </div>
  `;

  // Position relative to card
  element.style.position = 'relative';
  element.appendChild(overlay);

  // Auto-remove after 10 seconds if user moves away
  setTimeout(() => {
    if (overlay.parentElement === element) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }
  }, 10000);
}

function showErrorOverlay(element, error) {
  const existing = element.querySelector('.imdb-rating-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'imdb-rating-overlay imdb-error';
  overlay.innerHTML = `
    <div class="imdb-rating-content">
      <div class="imdb-rating-error">
        <span class="imdb-error-icon">?</span>
        <div class="imdb-error-text">Not Found</div>
      </div>
    </div>
  `;

  element.style.position = 'relative';
  element.appendChild(overlay);

  setTimeout(() => {
    if (overlay.parentElement === element) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }
  }, 5000);
}
```

### 2.3 Improve Styling

**File:** `src/styles.css` (REPLACE CURRENT)

```css
/* Netflix IMDb Ratings Overlay */

.imdb-rating-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 6px;
  padding: 8px 12px;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  z-index: 1000;
  animation: fadeIn 0.3s ease-in-out;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  min-width: 60px;
  text-align: center;
  backdrop-filter: blur(4px);
}

.imdb-rating-overlay.imdb-error {
  background: rgba(200, 0, 0, 0.85);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.imdb-rating-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.imdb-rating-score {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #ffd700;
  font-weight: bold;
}

.imdb-star {
  font-size: 16px;
}

.imdb-rating-value {
  color: white;
  font-size: 14px;
}

.imdb-rating-meta {
  font-size: 11px;
}

.imdb-link {
  color: #ffd700;
  text-decoration: none;
  transition: opacity 0.2s;
}

.imdb-link:hover {
  opacity: 0.8;
}

.imdb-error-icon {
  font-size: 18px;
  color: white;
  display: block;
  margin-bottom: 2px;
}

.imdb-error-text {
  font-size: 11px;
  color: #ccc;
}

/* Ensure overlay doesn't interfere with Netflix UI */
.imdb-rating-overlay pointer-events: auto;

/* On touch devices, make overlay larger for easier interaction */
@media (hover: none) and (pointer: coarse) {
  .imdb-rating-overlay {
    padding: 12px 16px;
  }

  .imdb-rating-score {
    font-size: 16px;
  }

  .imdb-star {
    font-size: 18px;
  }
}
```

---

## Phase 3: Testing & Refinement (Week 2)

### 3.1 Manual Testing Checklist

- [ ] Load extension in Chrome (chrome://extensions)
- [ ] Visit netflix.com
- [ ] Scroll through homepage
- [ ] Hover over 10 different titles
- [ ] Verify ratings appear within 500ms
- [ ] Check that overlay doesn't block Netflix UI
- [ ] Test with different browser widths
- [ ] Test with slow network (DevTools throttling)
- [ ] Monitor memory usage (DevTools > Performance > Memory)
- [ ] Check for console errors

### 3.2 Monitoring & Debugging

**Add to `src/background.js` for debugging:**

```javascript
// Log cache statistics
async function logCacheStats() {
  const transaction = cache.db.transaction([cache.storeName], 'readonly');
  const store = transaction.objectStore(cache.storeName);
  
  return new Promise((resolve) => {
    const request = store.count();
    request.onsuccess = () => {
      console.log(`Cache entries: ${request.result}`);
      console.log(`Daily requests: ${omdbClient.dailyRequests}/1000`);
      console.log(`Remaining quota: ${1000 - omdbClient.dailyRequests}`);
      resolve();
    };
  });
}

// Call periodically
setInterval(logCacheStats, 300000); // Every 5 minutes
```

---

## Phase 4: Chrome Web Store Preparation (v1.0)

### 4.1 Create Assets

- [ ] 128x128px icon (logo)
- [ ] 1280x800px screenshot
- [ ] Promotional tile (440x280px)
- [ ] Description (max 132 characters)
- [ ] Detailed description
- [ ] Privacy policy

### 4.2 Update Manifest

```json
{
  "manifest_version": 3,
  "name": "Netflix IMDb Ratings",
  "version": "1.0.0",
  "description": "See IMDb ratings while browsing Netflix",
  "author": "Your Name",
  "homepage_url": "https://github.com/yourusername/netflix-imdb-ratings",
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://www.omdbapi.com/*"
  ],
  "background": {
    "service_worker": "src/background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["src/extractors.js", "src/content.js"],
      "css": ["src/styles.css"]
    }
  ],
  "action": {
    "default_title": "Netflix IMDb Ratings",
    "default_icon": {
      "16": "images/icon-16.png",
      "48": "images/icon-48.png",
      "128": "images/icon-128.png"
    }
  }
}
```

### 4.3 Write Privacy Policy

```
# Privacy Policy - Netflix IMDb Ratings

This extension collects only movie/show titles visible on Netflix's homepage
to fetch IMDb ratings from the OMDb API.

## Data Collection
- Movie/TV show titles from Netflix (only visible content)
- User IP address (via OMDb API request)
- Browser user agent

## Data Sharing
- Titles are sent to OMDb API (api.omdbapi.com) to fetch ratings
- No data shared with third parties

## Local Storage
- Ratings cached locally in IndexedDB for 30 days
- Settings stored in Chrome Storage API

## User Control
- Toggle extension on/off
- Clear cache manually
- Uninstall to stop all data collection

## Changes
- Policy updated April 2026
- Contact: [your email]
```

---

## Maintenance Plan (Post-Launch)

### Monthly Tasks
1. Check Chrome Extension Developer Dashboard for crash reports
2. Monitor GitHub issues for Netflix DOM breakage reports
3. Test 10-15 random titles to verify matching accuracy
4. Update selectors if Netflix DOM changes detected

### Quarterly Tasks
1. Analyze user analytics (if available)
2. Review OMDb API usage
3. Consider feature requests
4. Update dependencies

### Emergency Tasks
- Netflix DOM changed → Fix selectors (2-4 hours)
- OMDb API down → Failover to cached data (automated)
- Security vulnerability → Patch immediately

---

## File Structure (Final)

```
netflix-imdb-ratings/
├── manifest.json              ✓ Updated
├── package.json               (unchanged)
├── README.md                  (update with user guide)
├── TECHNICAL_FEASIBILITY_ASSESSMENT.md
├── FEASIBILITY_SUMMARY.txt
├── IMPLEMENTATION_ROADMAP.md  (this file)
├── .gitignore                 (add src/config.js)
├── src/
│   ├── background.js          ✓ Refactored
│   ├── content.js             ✓ Refactored
│   ├── extractors.js          ✓ NEW
│   ├── api.js                 ✓ NEW
│   ├── cache.js               ✓ NEW
│   ├── config.js              ✓ NEW (GITIGNORED)
│   └── styles.css             ✓ Updated
├── images/                    (add 16x16, 48x48, 128x128 icons)
├── tests/                     (optional)
└── .github/
    └── ISSUE_TEMPLATE/        (optional)
```

---

## Success Metrics

After MVP completion, verify:
- ✓ 85%+ of visible titles get ratings
- ✓ Ratings appear within 500ms on hover
- ✓ <5MB memory overhead per tab
- ✓ No console errors
- ✓ Cache persists across sessions
- ✓ Daily quota management working

---

## Known Limitations & Workarounds

1. **Title Matching Failures (5-15%)**
   - Limitation: Some Netflix titles don't exist on IMDb or have different names
   - Workaround: Show "N/A" with manual search link

2. **Netflix DOM Changes (Quarterly)**
   - Limitation: Netflix updates DOM structure regularly
   - Workaround: Multiple fallback selectors + active maintenance

3. **Daily Quota Limit (1,000 requests/day)**
   - Limitation: Free OMDb tier limited to 1,000 req/day
   - Workaround: Heavy users upgrade to paid tier

4. **Network Latency (200-500ms)**
   - Limitation: OMDb API takes time to respond
   - Workaround: Lazy-load with visual feedback

---

## Next Immediate Action

1. **Get OMDb API Key:** https://www.omdbapi.com/apikey.aspx
2. **Review Phase 1 Code:** Implement cache.js and api.js
3. **Create config.js** with API key
4. **Update background.js** with new code
5. **Test basic flow** (fetch → cache → display)

Estimated Phase 1 completion: 3-5 days of focused work
