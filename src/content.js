// ===== CONFIGURATION =====
// [2026-04-12] Refined selectors to exclude ranking number containers
const NETFLIX_SELECTORS = [
  '[data-testid="hit-title"]:not([data-testid*="ranking"])',
  '.slider-item:not(.ranking-item)',
  '[data-uia="ptrack-content"]:not([data-uia*="ranking"])',
  '.title-card-container:not(.ranking-container)',
  // [2026-04-12 FIX] Add search page selector for Netflix search gallery results
  '[data-uia="search-gallery-video-card"]'
];
// [2026-04-13 FIX] Slider ranges 0-9: 0=show all (≤5), 5=show 5+, 6=show 6+, etc.
const DEFAULT_RATING_THRESHOLD = 5;
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
let filterBar = null;
let currentThreshold = DEFAULT_RATING_THRESHOLD;
let filterBarInsertionRetries = 0; // [2026-04-12 FIX] Track retry attempts for filter bar
// [2026-04-13] Filter mode: 'imdb' or 'rotten_tomatoes'
let currentFilterMode = 'imdb';
const FILTER_MODES = { imdb: 'IMDb', rotten_tomatoes: 'Rotten Tomatoes' };

// [2026-04-13] Exact filter labels per mode
const IMDB_FILTER_LABELS = {
  0: '≤5',
  5: '5.0+',
  5.5: '5.5+',
  6: '6.0+',
  7: '7.0+',
  7.5: '7.5+',
  8: '8.0+',
  8.5: '8.5+',
  9: '9.0+'
};

const RT_FILTER_LABELS = {
  0: '0%',
  10: '10%',
  20: '20%',
  30: '30%',
  40: '40%',
  50: '50%',
  60: '60%',
  70: '70%',
  80: '80%',
  90: '90%',
  100: '100%'
};

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
          imdbRating: cached.imdbRating || cached.rating, // Fallback for old cache format
          rtRating: cached.rtRating,
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
    // [2026-04-13] Cache both IMDb and RT ratings
    await chrome.storage.local.set({
      [cacheKey]: {
        title: data.title,
        imdbRating: data.imdbRating,
        rtRating: data.rtRating,
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
  // [2026-04-13] Extract both IMDb and Rotten Tomatoes ratings
  const imdbRating = data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : 'N/A';

  // [2026-04-13] Parse Rotten Tomatoes score from Ratings array
  let rtRating = 'N/A';
  if (data.Ratings && Array.isArray(data.Ratings)) {
    const rtEntry = data.Ratings.find(r => r.Source === 'Rotten Tomatoes');
    if (rtEntry && rtEntry.Value) {
      // Extract percentage from "85%" format to 85 integer
      const rtPercentage = parseInt(rtEntry.Value.replace('%', ''));
      if (!isNaN(rtPercentage)) {
        rtRating = rtPercentage;
      }
    }
  }

  return {
    title: data.Title || 'Unknown',
    imdbRating: imdbRating,
    rtRating: rtRating,
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

/**
 * Get filter labels for current mode
 * [2026-04-13] Return exact labels per IMDb or RT mode
 */
function getCurrentFilterLabels() {
  return currentFilterMode === 'imdb' ? IMDB_FILTER_LABELS : RT_FILTER_LABELS;
}

/**
 * Get filter label for a specific threshold value
 * [2026-04-13] Return display label matching threshold
 */
function getFilterLabel(threshold) {
  const labels = getCurrentFilterLabels();
  return labels[threshold] || `${threshold}`;
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
 * Save filter mode (IMDb vs Rotten Tomatoes) to chrome.storage.sync
 * [2026-04-13] Persist selected filter type across sessions
 */
async function saveFilterMode(mode) {
  try {
    await chrome.storage.sync.set({ imdb_filter_mode: mode });
    console.log(`[Storage] Saved filter mode: ${mode}`);
  } catch (error) {
    console.error('[Storage] Failed to save filter mode:', error);
  }
}

/**
 * Restore filter mode from chrome.storage.sync
 * [2026-04-13] Restore user's previously selected filter type
 */
async function restoreFilterMode() {
  try {
    const result = await chrome.storage.sync.get('imdb_filter_mode');
    const mode = result.imdb_filter_mode;

    if (mode && (mode === 'imdb' || mode === 'rotten_tomatoes')) {
      console.log(`[Storage] Restored filter mode: ${mode}`);
      return mode;
    }

    console.log(`[Storage] No saved filter mode found, using default: imdb`);
    return 'imdb';
  } catch (error) {
    console.error('[Storage] Failed to restore filter mode:', error);
    return 'imdb';
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
function updateFilterBarVisibility() {
  const filterBarElement = document.querySelector('.imdb-filter-bar');
  if (!filterBarElement) {
    return;
  }

  if (shouldShowFilter()) {
    filterBarElement.style.display = 'block';
    console.log('[Filter] Showing filter bar');
  } else {
    filterBarElement.style.display = 'none';
    console.log('[Filter] Hiding filter bar');
  }
}

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

    // [2026-04-13] Restore filter preference and mode from chrome.storage.sync
    const restoredThreshold = await restoreFilterPreference();
    const restoredMode = await restoreFilterMode();
    currentThreshold = restoredThreshold;
    currentFilterMode = restoredMode;

    // Apply the restored threshold immediately
    applyFilterToAllCards();

    // Update slider to show restored value
    const slider = document.querySelector('.imdb-slider');
    const valueDisplay = document.querySelector('.imdb-filter-value');
    if (slider) {
      slider.value = restoredThreshold;
    }
    if (valueDisplay) {
      valueDisplay.textContent = restoredThreshold === 0 ? '≤5' : restoredThreshold.toFixed(1) + '+';
    }

    // [2026-04-13] Verify filter bar is in DOM and visible
    const filterBarElement = document.querySelector('.imdb-filter-bar');
    if (filterBarElement) {
      const styles = window.getComputedStyle(filterBarElement);
      console.log('[Init] Filter bar CSS computed:', {
        display: styles.display,
        position: styles.position,
        zIndex: styles.zIndex,
        top: styles.top,
        visibility: styles.visibility,
        opacity: styles.opacity
      });
    } else {
      console.warn('[Init] Filter bar element not found in DOM after injection');
    }
  }, 1000);

  // [2026-04-14] Periodic check: re-inject filter trigger if removed AND should be shown
  // [2026-04-14] Updated to check for .imdb-filter-trigger (new floating button)
  // Also update visibility based on current page (handles SPA navigation)
  setInterval(() => {
    if (shouldShowFilter()) {
      const filterTriggerElement = document.querySelector('.imdb-filter-trigger');
      if (!filterTriggerElement) {
        console.log('[Periodic] Filter trigger missing from DOM, re-injecting...');
        injectFilterBar();
      } else {
        // Ensure it's visible if it exists
        filterTriggerElement.style.display = 'block';
      }
    } else {
      // Hide filter bar if we shouldn't be showing it
      updateFilterBarVisibility();
    }
  }, 5000);

  // [2026-04-13] Set up MutationObserver to handle Netflix's dynamic content loading + SPA navigation
  const observer = new MutationObserver((mutations) => {
    // Debounce mutations to avoid excessive processing
    clearTimeout(observer.debounceTimer);
    observer.debounceTimer = setTimeout(() => {
      injectBadgesForVisibleCards();
      // [2026-04-13] Also update filter visibility on DOM changes (catches SPA navigation)
      updateFilterBarVisibility();
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
    updateFilterBarVisibility();
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    console.log('[SPA] replaceState detected, updating filter visibility');
    updateFilterBarVisibility();
  };

  // [2026-04-13] Listen to popstate for back button navigation
  window.addEventListener('popstate', () => {
    console.log('[SPA] popstate detected, updating filter visibility');
    updateFilterBarVisibility();
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

    if (response && response.rating && response.rating !== 'N/A') {
      console.log(`[IMDb] Updating badge with rating: ${response.rating}`);
      // [2026-04-12] Track successful API call with full rating data for accuracy improvement
      const ratingData = {
        imdbRating: response.imdbRating || response.rating,
        rtRating: response.rtRating,
        year: response.year,
        imdbId: response.imdbId
      };
      trackAPICall(title, true, false, ratingData, currentFilterMode);
      trackCacheHit(response.cached);
      updateBadge(card, response);
      applyFilterToCard(card, parseFloat(response.rating));
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

  // [2026-04-13] Store rating data on badge for re-rendering on mode toggle
  if (data) {
    badge.dataset.rating = JSON.stringify({
      imdbRating: data.imdbRating,
      rtRating: data.rtRating
    });
  }

  if (data === null) {
    // Loading state: pulsating dot (no text)
    // [2026-04-12] Show pulsating dot instead of "?" during loading
    badge.className += ' imdb-badge-loading';
    badge.innerHTML = '<span style="width: 6px; height: 6px; background: #F5C518; border-radius: 50%; display: block;"></span>';
  } else {
    // [2026-04-13] Show rating based on filter mode
    let ratingText = '?';

    if (currentFilterMode === 'imdb') {
      // IMDb mode: show imdbRating, add gold color class
      if (data.imdbRating && data.imdbRating !== 'N/A') {
        ratingText = data.imdbRating.substring(0, 4);
        badge.className += ' imdb-badge-mode-imdb';
      }
    } else {
      // RT mode: show rtRating as percentage, add red color class
      if (data.rtRating && data.rtRating !== 'N/A') {
        ratingText = `${data.rtRating}%`;
        badge.className += ' imdb-badge-mode-rt';
      }
    }

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
 */
function updateBadge(card, data) {
  // [2026-04-12] Remove badge if N/A instead of showing "?"
  if (data.rating === 'N/A') {
    removeBadge(card);
    return;
  }

  const badge = card.querySelector('.imdb-badge');
  if (badge) {
    badge.classList.remove('imdb-badge-loading');
    const ratingText = data.rating.substring(0, 4);
    badge.innerHTML = `<span>${ratingText}</span>`;
  }
}

/**
 * Apply filter to a card based on current threshold
 * [2026-04-13] 0 = show all (≤5), 5 = show 5+, 6 = show 6+, etc.
 */
function applyFilterToCard(card, rating) {
  // [2026-04-13] Hide filtered cards with display: none instead of fade
  // 0 threshold means show all (including ≤5), otherwise hide if rating < threshold
  if (currentThreshold > 0 && rating < currentThreshold) {
    card.style.display = 'none';
  } else {
    card.style.display = '';
  }
}

/**
 * Inject floating trigger button + bottom sheet panel (replaces old fixed filter bar)
 * [2026-04-14] New minimalist UI: floating button (bottom-right) → taps to reveal bottom sheet with pills
 */
function injectFilterBar() {
  // [2026-04-14] Check if floating trigger already exists (might have been re-injected)
  const existingTrigger = document.querySelector('.imdb-filter-trigger');
  if (existingTrigger) {
    return;
  }

  // [2026-04-14] Create floating trigger button (48px circle, bottom-right)
  const triggerButton = document.createElement('button');
  triggerButton.className = 'imdb-filter-trigger';
  triggerButton.setAttribute('aria-label', 'Filter content');
  triggerButton.setAttribute('title', 'Filter by rating');

  // [2026-04-14] Show mode icon: IMDb gold or RT red circle
  const modeIcon = currentFilterMode === 'imdb' ? '◉' : '●';
  const modeColor = currentFilterMode === 'imdb' ? '#F5C518' : '#E84D37';
  triggerButton.innerHTML = `<span style="color: ${modeColor}; font-size: 20px;">${modeIcon}</span>`;

  document.body.appendChild(triggerButton);
  console.log('[Filter] Floating trigger button injected');

  // [2026-04-14] Create bottom sheet panel (hidden, slides up on trigger click)
  const bottomSheet = document.createElement('div');
  bottomSheet.className = 'imdb-bottom-sheet';
  bottomSheet.setAttribute('role', 'dialog');
  bottomSheet.setAttribute('aria-label', 'Filter panel');
  bottomSheet.setAttribute('aria-modal', 'true');

  // [2026-04-14] Generate pill buttons from current mode labels
  const labels = getCurrentFilterLabels();
  const pillButtonsHTML = Object.entries(labels)
    .map(([threshold, label]) => {
      const isActive = parseFloat(threshold) === currentThreshold ? 'active' : '';
      return `<button class="imdb-pill-button ${isActive}" data-threshold="${threshold}">${label}</button>`;
    })
    .join('');

  // [2026-04-14] Build bottom sheet HTML with header, mode toggle, and pill buttons
  bottomSheet.innerHTML = `
    <div class="imdb-sheet-backdrop"></div>
    <div class="imdb-sheet-panel">
      <div class="imdb-sheet-header">
        <h2>Filter Content</h2>
        <button class="imdb-sheet-close" aria-label="Close filter panel">&times;</button>
      </div>

      <div class="imdb-sheet-content">
        <div class="imdb-mode-toggle">
          <button class="imdb-mode-button imdb-mode-button-imdb ${currentFilterMode === 'imdb' ? 'active' : ''}" data-mode="imdb">IMDb</button>
          <button class="imdb-mode-button imdb-mode-button-rt ${currentFilterMode === 'rotten_tomatoes' ? 'active' : ''}" data-mode="rotten_tomatoes">RT</button>
        </div>

        <div class="imdb-pill-buttons">
          ${pillButtonsHTML}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(bottomSheet);
  console.log('[Filter] Bottom sheet panel injected');

  // [2026-04-14] Wire open/close handlers
  try {
    // Open sheet on trigger button click
    triggerButton.addEventListener('click', () => {
      bottomSheet.classList.add('open');
      document.body.style.overflow = 'hidden'; // [2026-04-14] Prevent scrolling when sheet open
      console.log('[Filter] Bottom sheet opened');
    });

    // Close sheet on X button click
    const closeButton = bottomSheet.querySelector('.imdb-sheet-close');
    closeButton.addEventListener('click', () => {
      bottomSheet.classList.remove('open');
      document.body.style.overflow = '';
      console.log('[Filter] Bottom sheet closed');
    });

    // Close sheet on backdrop click (outside panel)
    const backdrop = bottomSheet.querySelector('.imdb-sheet-backdrop');
    backdrop.addEventListener('click', () => {
      bottomSheet.classList.remove('open');
      document.body.style.overflow = '';
      console.log('[Filter] Bottom sheet closed (backdrop click)');
    });

    // [2026-04-14] Close sheet on Escape key
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && bottomSheet.classList.contains('open')) {
        bottomSheet.classList.remove('open');
        document.body.style.overflow = '';
        console.log('[Filter] Bottom sheet closed (Escape key)');
      }
    };
    document.addEventListener('keydown', handleEscapeKey);

    // [2026-04-14] Handle pill button clicks
    const pillButtons = bottomSheet.querySelectorAll('.imdb-pill-button');
    const handlePillButtonClick = (e) => {
      const threshold = parseFloat(e.target.getAttribute('data-threshold'));
      currentThreshold = threshold;

      // [2026-04-13] Save filter preference to chrome.storage.sync for persistence
      saveFilterPreference(currentThreshold);

      // [2026-04-13] Update active state on buttons
      pillButtons.forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');

      // [2026-04-12] Track filter usage
      trackFeatureUse('filter-pill-button');

      // Apply filter to all visible cards
      applyFilterToAllCards();
      console.log(`[Pill Button] Threshold updated to ${currentThreshold}`);
    };

    pillButtons.forEach(button => {
      button.addEventListener('click', handlePillButtonClick);
    });

    // [2026-04-14] Handle mode toggle clicks
    const modeButtons = bottomSheet.querySelectorAll('.imdb-mode-button');
    modeButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const newMode = e.target.getAttribute('data-mode');
        if (newMode === currentFilterMode) return; // Already selected

        // Update state and storage
        currentFilterMode = newMode;
        await saveFilterMode(newMode);

        // [2026-04-14] Update trigger button icon color
        const modeIcon = newMode === 'imdb' ? '◉' : '●';
        const modeColor = newMode === 'imdb' ? '#F5C518' : '#E84D37';
        triggerButton.innerHTML = `<span style="color: ${modeColor}; font-size: 20px;">${modeIcon}</span>`;

        // Update UI: toggle active button
        modeButtons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        // [2026-04-13] Rebuild pill buttons with new mode labels
        const newLabels = getCurrentFilterLabels();
        const newPillButtonsHTML = Object.entries(newLabels)
          .map(([threshold, label]) => {
            const isActive = parseFloat(threshold) === currentThreshold ? 'active' : '';
            return `<button class="imdb-pill-button ${isActive}" data-threshold="${threshold}">${label}</button>`;
          })
          .join('');

        const pillButtonsContainer = bottomSheet.querySelector('.imdb-pill-buttons');
        if (pillButtonsContainer) {
          pillButtonsContainer.innerHTML = newPillButtonsHTML;
          // [2026-04-13] Re-attach click listeners to new pill buttons
          const newPillButtons = bottomSheet.querySelectorAll('.imdb-pill-button');
          newPillButtons.forEach(button => {
            button.addEventListener('click', handlePillButtonClick);
          });
        }

        // [2026-04-13] Re-render all badges with new mode colors/values
        reRenderAllBadges();

        // Re-apply filter with new mode (visibility may change based on different scores)
        applyFilterToAllCards();
        console.log(`[Mode Toggle] Switched to ${newMode}`);
      });
    });

    console.log('[Filter] Event listeners attached for floating trigger and bottom sheet');
  } catch (error) {
    console.error('[Filter] Error setting up event listeners:', error);
  }
}

/**
 * Re-render all badges on page with current filter mode
 * [2026-04-13] Update badge colors and values when mode toggles
 */
function reRenderAllBadges() {
  const NETFLIX_SELECTORS_TO_CHECK = [
    '[data-testid="hit-title"]:not([data-testid*="ranking"])',
    '.slider-item:not(.ranking-item)',
    '[data-uia="ptrack-content"]:not([data-uia*="ranking"])',
    '.title-card-container:not(.ranking-container)',
    '[data-uia="search-gallery-video-card"]'
  ];

  let cards = [];
  for (const selector of NETFLIX_SELECTORS_TO_CHECK) {
    cards = document.querySelectorAll(selector);
    if (cards.length > 0) break;
  }

  cards.forEach((card) => {
    const badge = card.querySelector('.imdb-badge');
    if (badge && badge.dataset.rating) {
      // Remove old mode classes
      badge.classList.remove('imdb-badge-mode-imdb', 'imdb-badge-mode-rt');

      // Parse stored rating data
      const ratingData = JSON.parse(badge.dataset.rating);

      // Update badge with new mode
      if (currentFilterMode === 'imdb') {
        badge.className = 'imdb-badge imdb-badge-mode-imdb';
        badge.setAttribute('data-size', badge.dataset.size);
        badge.innerHTML = `<span>${ratingData.imdbRating || '?'}</span>`;
      } else {
        badge.className = 'imdb-badge imdb-badge-mode-rt';
        badge.setAttribute('data-size', badge.dataset.size);
        const rtText = ratingData.rtRating && ratingData.rtRating !== 'N/A' ? `${ratingData.rtRating}%` : '?';
        badge.innerHTML = `<span>${rtText}</span>`;
      }
    }
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
      let score = 'N/A';

      if (currentFilterMode === 'imdb') {
        score = ratingData.imdbRating;
      } else {
        score = ratingData.rtRating;
      }

      const rating = parseFloat(score);

      // [2026-04-13] Only apply filter if we have a valid numeric rating
      if (!isNaN(rating)) {
        applyFilterToCard(card, rating);
      }
    }
  });
}
