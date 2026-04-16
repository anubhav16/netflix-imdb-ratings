// ===== CONFIGURATION =====
// Switch between 'VARIANT_A' (inject into Netflix nav) and 'VARIANT_B' (fixed bar below nav)
const FILTER_UI_MODE = 'VARIANT_A';

// [2026-04-12] Refined selectors to exclude ranking number containers
const NETFLIX_SELECTORS = [
  '[data-testid="hit-title"]:not([data-testid*="ranking"])',
  '.slider-item:not(.ranking-item)',
  '[data-uia="ptrack-content"]:not([data-uia*="ranking"])',
  '.title-card-container:not(.ranking-container)',
  // [2026-04-12 FIX] Add search page selector for Netflix search gallery results
  '[data-uia="search-gallery-video-card"]'
];
const DEFAULT_RATING_THRESHOLD = 0;
const BADGE_SIZE_PX = 28;
const BADGE_FONT_SIZE_PX = 11;
const IMDB_YELLOW = '#F5C518';

// OMDb API Configuration (inlined to avoid import issues)
const OMDB_API_KEY = '9b86bd5';
const OMDB_API_URL = 'https://www.omdbapi.com/';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_KEY_PREFIX = 'imdb_';
const MAX_CONCURRENT_REQUESTS = 3;
const REQUEST_TIMEOUT_MS = 5000;

console.log('Netflix IMDb Ratings extension loaded');

// Load analytics module
const analyticsScript = document.createElement('script');
analyticsScript.src = chrome.runtime.getURL('src/analytics.js');
document.documentElement.appendChild(analyticsScript);

// ===== STATE MANAGEMENT =====
// Track pending requests to avoid duplicates
const pendingTitles = new Set();

// Track filter bar state
let currentThreshold = DEFAULT_RATING_THRESHOLD;

// Array of [threshold, label] — object keys would reorder integer keys before floats.
const IMDB_FILTER_LABELS = [
  [0,   'All'],
  [5,   '5+'],
  [6,   '6+'],
  [6.5, '6.5+'],
  [7,   '7+'],
  [7.5, '7.5+'],
  [8,   '8+'],
  [8.5, '8.5+']
];

// Request queue management
let requestQueue = [];
let activeRequests = 0;

// Initialize
initializeExtension();

// ===== OMDb API FUNCTIONS =====

/**
 * Fetch IMDb rating for a title, using cache and request queue
 */
async function fetchIMDbRating(title) {
  if (!title) {
    return { title, rating: 'N/A', cached: false };
  }

  // Check cache first
  const cached = await checkCache(title);
  if (cached) {
    return { ...cached, cached: true };
  }

  // Enqueue request if not already cached
  return new Promise((resolve) => {
    requestQueue.push({ title, resolve });
    processQueue();
  });
}

/**
 * Check if title exists in cache and is not expired
 */
async function checkCache(title) {
  try {
    const cacheKey = CACHE_KEY_PREFIX + normalizeTitle(title);
    const result = await chrome.storage.local.get(cacheKey);

    if (result[cacheKey]) {
      const cached = result[cacheKey];
      const now = Date.now();

      // Check if cache is still valid
      if (now - cached.timestamp < CACHE_TTL_MS) {
        // [2026-04-13] Return both ratings from cache (backward compatible with old format)
        return {
          title: cached.title,
          imdbRating: cached.imdbRating || cached.rating,
          year: cached.year,
          imdbId: cached.imdbId
        };
      } else {
        // Cache expired, remove it
        await chrome.storage.local.remove(cacheKey);
      }
    }
  } catch (error) {
    console.error('Cache check error:', error);
  }

  return null;
}

/**
 * Save result to cache
 */
async function saveCache(title, data) {
  try {
    const cacheKey = CACHE_KEY_PREFIX + normalizeTitle(title);
    await chrome.storage.local.set({
      [cacheKey]: {
        title: data.title,
        imdbRating: data.imdbRating,
        year: data.year,
        imdbId: data.imdbId,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}

/**
 * Process request queue with concurrent request limiting
 */
async function processQueue() {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
    return;
  }

  activeRequests++;
  const { title, resolve } = requestQueue.shift();

  try {
    const data = await fetchFromOMDb(title);
    await saveCache(title, data);
    resolve(data);
  } catch (error) {
    console.error('Request failed:', error);
    // Cache failure to prevent retry storm
    const fallbackData = { title, rating: 'N/A', year: null, imdbId: null };
    await saveCache(title, fallbackData);
    resolve(fallbackData);
  } finally {
    activeRequests--;
    // Process next request in queue
    if (requestQueue.length > 0) {
      processQueue();
    }
  }
}

/**
 * Fetch data from OMDb API
 */
async function fetchFromOMDb(title) {
  // Try multiple variations of the title
  const titleVariations = [
    title,                                    // Original
    title.split(':')[0].trim(),               // Remove subtitle (before colon)
    title.split('(')[0].trim(),               // Remove parenthetical info
    title.replace(/[^\w\s]/g, '').trim()      // Remove special characters
  ];

  for (const variant of titleVariations) {
    if (!variant || variant.length < 2) continue;

    try {
      console.log(`[Content] Trying OMDb with: "${variant}" (original: "${title}")`);

      // Try as movie first
      let data = await tryOMDbSearch(variant, 'movie');
      if (data.Response === 'True') {
        console.log(`[Content] Found as movie: ${variant}`);
        return normalizeOMDbResponse(data);
      }

      // Try as series
      data = await tryOMDbSearch(variant, 'series');
      if (data.Response === 'True') {
        console.log(`[Content] Found as series: ${variant}`);
        return normalizeOMDbResponse(data);
      }
    } catch (error) {
      console.log(`[Content] Error trying ${variant}:`, error.message);
      continue;
    }
  }

  // Nothing found
  console.log(`[Content] No match found for any variation of: ${title}`);
  return {
    title,
    rating: 'N/A',
    year: null,
    imdbId: null
  };
}

/**
 * Try a single OMDb search
 */
async function tryOMDbSearch(title, type) {
  const params = new URLSearchParams({
    apikey: OMDB_API_KEY,
    t: title,
    type: type
  });

  try {
    const response = await Promise.race([
      fetch(`${OMDB_API_URL}?${params}`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS)
      )
    ]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Normalize OMDb API response to consistent format
 */
function normalizeOMDbResponse(data) {
  const imdbRating = data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : 'N/A';

  return {
    title: data.Title || 'Unknown',
    imdbRating: imdbRating,
    year: data.Year || null,
    imdbId: data.imdbID || null
  };
}

/**
 * Normalize title for cache key (lowercase, trim whitespace)
 */
function normalizeTitle(title) {
  return title.toLowerCase().trim().replace(/\s+/g, '_');
}

// ===== FILTER PREFERENCE STORAGE FUNCTIONS =====

/**
 * Save filter preference to chrome.storage.sync for cross-device sync
 * [2026-04-13] Persist user's selected rating threshold
 */
async function saveFilterPreference(threshold) {
  try {
    await chrome.storage.sync.set({ imdb_filter_threshold: threshold });
    console.log(`[Storage] Saved filter preference: ${threshold}`);
  } catch (error) {
    console.error('[Storage] Failed to save filter preference:', error);
  }
}

/**
 * Restore filter preference from chrome.storage.sync
 * Returns saved threshold or DEFAULT_RATING_THRESHOLD if not found
 * [2026-04-13] Restore user's previously selected rating threshold on page load
 */
async function restoreFilterPreference() {
  try {
    const result = await chrome.storage.sync.get('imdb_filter_threshold');
    const threshold = result.imdb_filter_threshold;

    if (threshold !== undefined && threshold !== null) {
      console.log(`[Storage] Restored filter preference: ${threshold}`);
      return threshold;
    }

    console.log(`[Storage] No saved preference found, using default: ${DEFAULT_RATING_THRESHOLD}`);
    return DEFAULT_RATING_THRESHOLD;
  } catch (error) {
    console.error('[Storage] Failed to restore filter preference:', error);
    // Graceful fallback to default on error
    return DEFAULT_RATING_THRESHOLD;
  }
}

// ===== DOM INJECTION FUNCTIONS =====

/**
 * Update filter bar visibility based on current page
 * [2026-04-13] Shows/hides filter bar via CSS without removing from DOM
 */
// [2026-04-14 REMOVED] updateFilterBarVisibility() - deprecated legacy function for old fixed filter bar
// The new floating trigger button is always visible and handles its own visibility via shouldShowFilter()

/**
 * Determine if filter bar should be shown on current page
 * [2026-04-13] Hide filter on profile screen (.list-profiles) and player screen (/watch/...)
 * Show on browse, search, and other content browsing pages
 */
function shouldShowFilter() {
  const pathname = window.location.pathname;

  // [2026-04-13] Primary check: Hide on player screen (URL is most reliable)
  if (pathname.startsWith('/watch/')) {
    console.log('[Filter] Hiding filter on player screen: /watch/...');
    return false;
  }

  // Hide on Netflix Games — games don't have IMDb ratings
  if (pathname.startsWith('/games')) {
    console.log('[Filter] Hiding filter on Games page');
    return false;
  }

  // [2026-04-13] Secondary check: Hide on profile selection screen ("Who's watching?")
  if (document.querySelector('.list-profiles')) {
    console.log('[Filter] Hiding filter on profile selection screen');
    return false;
  }

  // [2026-04-13] Hide on fullscreen browse
  if (pathname.includes('/browse/fullscreen')) {
    console.log('[Filter] Hiding filter on fullscreen browse');
    return false;
  }

  // Show on all other pages: /browse, /search, etc.
  return true;
}

function initializeExtension() {
  // Inject badges on initial page load
  // [2026-04-12 FIX] Increased from 500ms to 1000ms to wait for Netflix layout stabilization
  // This ensures offsetWidth reflects final rendered dimensions on all rows
  setTimeout(async () => {
    console.log('[Init] Page load initialization: injecting badges and filter bar');
    injectBadgesForVisibleCards();

    // [2026-04-13] Only show filter if browsing content, not on profile screens
    if (shouldShowFilter()) {
      injectFilterBar();
    }

    const restoredThreshold = await restoreFilterPreference();
    currentThreshold = restoredThreshold;

    // Apply the restored threshold immediately
    applyFilterToAllCards();

    // [2026-04-14 REMOVED] Slider value update code - no longer needed with floating trigger + bottom sheet
    // The new bottom sheet handles pill button active state automatically
  }, 1000);

  // Periodic check: re-inject filter bar if removed, update visibility on page changes
  setInterval(() => {
    if (shouldShowFilter()) {
      const bar = document.querySelector('.imdb-nav-filter-bar');
      if (!bar) {
        console.log('[Periodic] Filter bar missing from DOM, re-injecting...');
        injectFilterBar();
      } else {
        bar.style.display = '';
      }
    } else {
      const bar = document.querySelector('.imdb-nav-filter-bar');
      if (bar) bar.style.display = 'none';
    }
  }, 5000);

  // [2026-04-13] Set up MutationObserver to handle Netflix's dynamic content loading + SPA navigation
  const observer = new MutationObserver((mutations) => {
    // Debounce mutations to avoid excessive processing
    clearTimeout(observer.debounceTimer);
    observer.debounceTimer = setTimeout(() => {
      injectBadgesForVisibleCards();
      // [2026-04-14] Update trigger visibility on DOM changes (catches SPA navigation)
      if (!shouldShowFilter()) {
        const trigger = document.querySelector('.imdb-nav-filter-bar');
        if (trigger) trigger.style.display = 'none';
      }
    }, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // [2026-04-13] Override history API for immediate SPA navigation detection
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    console.log('[SPA] pushState detected, updating filter visibility');
    // [2026-04-14] Update trigger visibility on SPA navigation
    if (!shouldShowFilter()) {
      const trigger = document.querySelector('.imdb-nav-filter-bar');
      if (trigger) trigger.style.display = 'none';
    } else {
      const trigger = document.querySelector('.imdb-nav-filter-bar');
      if (trigger) trigger.style.display = '';
    }
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    console.log('[SPA] replaceState detected, updating filter visibility');
    // [2026-04-14] Update trigger visibility on SPA navigation
    if (!shouldShowFilter()) {
      const trigger = document.querySelector('.imdb-nav-filter-bar');
      if (trigger) trigger.style.display = 'none';
    } else {
      const trigger = document.querySelector('.imdb-nav-filter-bar');
      if (trigger) trigger.style.display = '';
    }
  };

  // [2026-04-14] Listen to popstate for back button navigation
  window.addEventListener('popstate', () => {
    console.log('[SPA] popstate detected, updating filter visibility');
    // [2026-04-14] Update trigger visibility on back button
    if (!shouldShowFilter()) {
      const trigger = document.querySelector('.imdb-nav-filter-bar');
      if (trigger) trigger.style.display = 'none';
    } else {
      const trigger = document.querySelector('.imdb-nav-filter-bar');
      if (trigger) trigger.style.display = '';
    }
  });
}

/**
 * Inject badges on all visible title cards
 */
function injectBadgesForVisibleCards() {
  // Try each selector strategy
  let cards = [];
  for (const selector of NETFLIX_SELECTORS) {
    cards = document.querySelectorAll(selector);
    if (cards.length > 0) {
      break;
    }
  }

  if (cards.length === 0) {
    console.warn('No Netflix title cards found');
    return;
  }

  cards.forEach((card) => {
    // Skip if badge already exists
    if (card.querySelector('.imdb-badge')) {
      return;
    }

    const title = extractTitle(card);
    if (title) {
      // [2026-04-13] Skip loading badge, only inject after data arrives
      // Fetch rating if not already pending (badge will be injected on successful fetch)
      if (!pendingTitles.has(title)) {
        pendingTitles.add(title);
        requestIMDbRating(title, card);
      }
    }
  });
}

/**
 * Extract title text from a Netflix card, trying multiple strategies
 * [2026-04-12] Added validation to reject ranking numbers and invalid titles
 */
function extractTitle(card) {
  // Validate card width first — ranking cards are ~80px, movies are ≥120px
  // [2026-04-12] Skip narrow containers (prevents ranking number injection)
  // [2026-04-12 FIX] Use !card.offsetWidth to also reject undefined/0 values (falsy-check bug)
  if (!card.offsetWidth || card.offsetWidth < 100) {
    return null;
  }

  // Strategy 1: Direct text content
  let text = card.textContent?.trim();
  if (text && text.length > 0 && text.length < 150) {
    // [2026-04-12] Reject purely numeric titles (ranking numbers like "1", "2", "42")
    if (!isValidTitle(text)) {
      text = null;
    } else {
      return text;
    }
  }

  // Strategy 2: Title attribute
  const titleAttr = card.getAttribute('title') || card.getAttribute('aria-label');
  if (titleAttr) {
    const extracted = titleAttr.split('•')[0].trim();
    if (isValidTitle(extracted)) {
      return extracted;
    }
  }

  // Strategy 3: Look for specific text elements
  const titleSpan = card.querySelector('[data-uia="title-span"], span[role="heading"]');
  if (titleSpan) {
    const spanText = titleSpan.textContent?.trim();
    if (spanText && isValidTitle(spanText)) {
      return spanText;
    }
  }

  return null;
}

/**
 * Validate that a title is an actual movie/show name, not a ranking number
 * [2026-04-12] Reject: pure digits, too short, non-alphanumeric only
 */
function isValidTitle(title) {
  // Reject if too short
  if (!title || title.length < 2) {
    return false;
  }

  // Reject if purely numeric (ranking numbers: "1", "2", "42", etc.)
  if (/^\d+$/.test(title)) {
    return false;
  }

  // Reject if no alphanumeric characters at all
  if (!/[a-zA-Z0-9]/.test(title)) {
    return false;
  }

  return true;
}

/**
 * Request IMDb rating directly (moved from background script)
 * [2026-04-12] Direct API integration to avoid MV3 service worker lifecycle issues
 */
async function requestIMDbRating(title, card) {
  console.log(`[IMDb] Requesting rating for: ${title}`);

  try {
    const response = await fetchIMDbRating(title);
    pendingTitles.delete(title);
    console.log(`[IMDb] Response for ${title}:`, response);
    console.log(`[IMDb] Has rating field:`, response?.rating, `Type:`, typeof response?.rating);

    // [2026-04-13 FIX] Check imdbRating field (not rating) — normalizeOMDbResponse returns imdbRating
    if (response && response.imdbRating && response.imdbRating !== 'N/A') {
      console.log(`[IMDb] Updating badge with rating: ${response.imdbRating}`);
      const ratingData = {
        imdbRating: response.imdbRating,
        year: response.year,
        imdbId: response.imdbId
      };
      trackAPICall(title, true, false, ratingData);
      trackCacheHit(response.cached);
      injectBadge(card, response);
      applyFilterToCard(card, parseFloat(response.imdbRating));
    } else {
      // [2026-04-12] Remove badge for N/A results, track as blank
      console.log(`[IMDb] No rating found, removing badge. Response was:`, JSON.stringify(response));
      trackAPICall(title, false, true); // Track blank result
      removeBadge(card);
    }
  } catch (error) {
    // [2026-04-12] Remove badge on error, track as error
    console.error(`[IMDb] Error fetching rating for ${title}:`, error);
    pendingTitles.delete(title);
    trackAPICall(title, false, false); // Track as error
    removeBadge(card);
  }
}

/**
 * Inject a badge element into a Netflix card
 */
function injectBadge(card, data) {
  // Ensure card has position: relative for absolute badge positioning
  // [2026-04-12] Also set overflow: hidden to constrain badge to thumbnail
  card.style.position = 'relative';
  card.style.overflow = 'hidden';

  // Create badge element
  const badge = document.createElement('div');
  badge.className = 'imdb-badge';

  // [2026-04-12 FIX] Responsive sizing: small (18px) for narrow cards (<100px), large (28px) for regular
  const cardWidth = card.offsetWidth;
  const badgeSize = cardWidth < 100 ? 'small' : 'large';
  badge.setAttribute('data-size', badgeSize);

  if (data) {
    badge.dataset.rating = JSON.stringify({ imdbRating: data.imdbRating });
  }

  if (data === null) {
    badge.className += ' imdb-badge-loading';
    badge.innerHTML = '<span style="width: 6px; height: 6px; background: #F5C518; border-radius: 50%; display: block;"></span>';
  } else {
    badge.className += ' imdb-badge-mode-imdb';
    const ratingText = (data.imdbRating && data.imdbRating !== 'N/A')
      ? data.imdbRating.substring(0, 4)
      : '?';
    badge.innerHTML = `<span>${ratingText}</span>`;
  }

  card.appendChild(badge);

  // [2026-04-12] Track badge injection
  trackBadgeInjected();
}

/**
 * Remove badge from card completely
 * [2026-04-12] Remove N/A badges to reduce visual clutter
 */
function removeBadge(card) {
  const badge = card.querySelector('.imdb-badge');
  if (badge) {
    badge.remove();
  }
}

/**
 * Update existing badge with actual rating, or remove if N/A
 * [2026-04-13 FIX] updateBadge is now unused — injectBadge is called instead
 * Keeping for backward compatibility with potential future callers
 */
function updateBadge(card, data) {
  // [2026-04-12] Remove badge if N/A instead of showing "?"
  if (data.imdbRating === 'N/A') {
    removeBadge(card);
    return;
  }

  const badge = card.querySelector('.imdb-badge');
  if (badge) {
    badge.classList.remove('imdb-badge-loading');
    const ratingText = data.imdbRating.substring(0, 4);
    badge.innerHTML = `<span>${ratingText}</span>`;
  }
}

/**
 * Apply filter to a card based on current threshold.
 * Hides the outermost flex/grid child so carousel rows and search grid reflow
 * without leaving empty boxes. Netflix's wrapper class names vary and change;
 * we walk up the DOM and pick the first ancestor whose parent is flex/grid.
 */
function applyFilterToCard(card, rating) {
  if (!card._filterContainer) {
    card._filterContainer = findFlexGridChild(card);
  }

  const target = card._filterContainer;
  if (currentThreshold > 0 && rating < currentThreshold) {
    target.style.display = 'none';
  } else {
    target.style.display = '';
  }
}

/**
 * Walk up from `card` and return the first ancestor whose parent uses
 * a flex or grid layout. Hiding that ancestor causes sibling cards to reflow.
 */
function findFlexGridChild(card) {
  let el = card;
  while (el && el.parentElement && el.parentElement !== document.body) {
    const parentDisplay = window.getComputedStyle(el.parentElement).display;
    if (
      parentDisplay === 'flex' ||
      parentDisplay === 'inline-flex' ||
      parentDisplay === 'grid' ||
      parentDisplay === 'inline-grid' ||
      parentDisplay === '-webkit-box'
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return card;
}

/**
 * Inject the always-visible filter bar.
 * Delegates to Variant A (Netflix nav injection) or Variant B (fixed bar below nav)
 * based on FILTER_UI_MODE constant at top of file.
 */
function injectFilterBar() {
  if (document.querySelector('.imdb-nav-filter-bar')) return;

  if (FILTER_UI_MODE === 'VARIANT_A') {
    injectNavbarFilter();
  } else {
    injectFixedFilterBar();
  }
}

/**
 * Variant A: inject pill row directly inside Netflix's top nav bar.
 * Falls back to Variant B if no nav selector matches.
 */
function injectNavbarFilter() {
  const NAV_SELECTORS = [
    '[data-uia="header"]',
    '.pinning-header',
    '[class*="NavigationBar"]',
    'header[class*="nav"]'
  ];

  let navEl = null;
  for (const sel of NAV_SELECTORS) {
    navEl = document.querySelector(sel);
    if (navEl) break;
  }

  if (!navEl) {
    console.warn('[Filter] Variant A: no Netflix nav selector matched — falling back to Variant B');
    injectFixedFilterBar();
    return;
  }

  const bar = buildFilterBar('imdb-nav-filter-bar imdb-nav-filter-bar--variant-a');
  navEl.appendChild(bar);
  wireFilterBar(bar);
  console.log('[Filter] Variant A: pills injected into Netflix nav');
}

/**
 * Variant B: fixed bar pinned just below the Netflix nav, appended to body.
 * Zero Netflix DOM dependency — resilient to Netflix DOM changes.
 */
function injectFixedFilterBar() {
  const bar = buildFilterBar('imdb-nav-filter-bar imdb-nav-filter-bar--variant-b');
  document.body.appendChild(bar);
  wireFilterBar(bar);
  console.log('[Filter] Variant B: fixed filter bar injected below nav');
}

/**
 * Build the filter bar DOM element with label and pill buttons.
 */
function buildFilterBar(className) {
  const bar = document.createElement('div');
  bar.className = className;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'IMDb filter');

  const label = document.createElement('span');
  label.className = 'imdb-filter-label';
  label.textContent = 'IMDb';
  bar.appendChild(label);

  const pillsContainer = document.createElement('div');
  pillsContainer.className = 'imdb-filter-pills';
  bar.appendChild(pillsContainer);

  IMDB_FILTER_LABELS.forEach(([threshold, text]) => {
    const btn = document.createElement('button');
    btn.className = 'imdb-pill-button' + (threshold === currentThreshold ? ' active' : '');
    btn.dataset.threshold = threshold;
    btn.textContent = text;
    pillsContainer.appendChild(btn);
  });

  return bar;
}

/**
 * Wire pill click handlers on a filter bar element.
 */
function wireFilterBar(bar) {
  const pills = bar.querySelectorAll('.imdb-pill-button');
  pills.forEach(btn => {
    btn.addEventListener('click', () => {
      const clicked = parseFloat(btn.dataset.threshold);
      // Clicking the active numeric pill toggles back to "All" (threshold 0).
      // "All" itself doesn't toggle — it's already the off state.
      currentThreshold = (clicked === currentThreshold && clicked !== 0) ? 0 : clicked;
      saveFilterPreference(currentThreshold);
      pills.forEach(b => {
        b.classList.toggle('active', parseFloat(b.dataset.threshold) === currentThreshold);
      });
      trackFeatureUse('filter-pill-button');
      applyFilterToAllCards();
    });
  });
}

/**
 * Apply current filter threshold to all cards
 * [2026-04-13] Improved selector to avoid matching parent containers
 */
function applyFilterToAllCards() {
  // Find all cards with badges (directly, not parents)
  // [2026-04-12 FIX] Added search gallery selector to support filter on search pages
  // [2026-04-13] Use more specific selectors to avoid parent container matches
  const cardsWithBadges = document.querySelectorAll('[data-testid="hit-title"]:not([data-testid*="ranking"]), .slider-item:not(.ranking-item), [data-uia="ptrack-content"]:not([data-uia*="ranking"]), .title-card-container:not(.ranking-container), [data-uia="search-gallery-video-card"]');

  cardsWithBadges.forEach((card) => {
    const badge = card.querySelector('.imdb-badge');
    if (badge && badge.dataset.rating) {
      // [2026-04-13] Use stored rating data per mode, not badge text
      const ratingData = JSON.parse(badge.dataset.rating);
      const rating = parseFloat(ratingData.imdbRating);
      if (!isNaN(rating)) {
        applyFilterToCard(card, rating);
      }
    }
  });
}
