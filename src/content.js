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
let filterBar = null;
let currentThreshold = DEFAULT_RATING_THRESHOLD;
let filterBarInsertionRetries = 0; // [2026-04-12 FIX] Track retry attempts for filter bar

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
        return {
          title: cached.title,
          rating: cached.rating,
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
        rating: data.rating,
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
  const rating = data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : 'N/A';

  return {
    title: data.Title || 'Unknown',
    rating: rating,
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

// ===== DOM INJECTION FUNCTIONS =====

function initializeExtension() {
  // Inject badges on initial page load
  // [2026-04-12 FIX] Increased from 500ms to 1000ms to wait for Netflix layout stabilization
  // This ensures offsetWidth reflects final rendered dimensions on all rows
  setTimeout(() => {
    injectBadgesForVisibleCards();
    injectFilterBar();
  }, 1000);

  // Set up MutationObserver to handle Netflix's dynamic content loading
  const observer = new MutationObserver((mutations) => {
    // Debounce mutations to avoid excessive processing
    clearTimeout(observer.debounceTimer);
    observer.debounceTimer = setTimeout(() => {
      injectBadgesForVisibleCards();
    }, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
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
      // Create badge placeholder (will show loading state)
      injectBadge(card, null);

      // Fetch rating if not already pending
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
      // [2026-04-12] Track successful API call
      trackAPICall(title, true, false);
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

  if (data === null) {
    // Loading state: pulsating dot (no text)
    // [2026-04-12] Show pulsating dot instead of "?" during loading
    badge.className += ' imdb-badge-loading';
    badge.innerHTML = '<span style="width: 6px; height: 6px; background: #F5C518; border-radius: 50%; display: block;"></span>';
  } else {
    // Show rating
    const ratingText = data.rating !== 'N/A' ? data.rating.substring(0, 4) : '?';
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
 */
function applyFilterToCard(card, rating) {
  if (currentThreshold > 0 && rating < currentThreshold) {
    card.classList.add('imdb-faded');
  } else {
    card.classList.remove('imdb-faded');
  }
}

/**
 * Inject filter control bar
 */
function injectFilterBar() {
  // Check if filter bar already exists
  if (filterBar) {
    return;
  }

  // Create filter bar
  filterBar = document.createElement('div');
  filterBar.className = 'imdb-filter-bar';
  filterBar.innerHTML = `
    <div class="imdb-filter-container">
      <label for="imdb-rating-slider">Filter by IMDb Rating:</label>
      <div class="imdb-slider-group">
        <input
          id="imdb-rating-slider"
          type="range"
          min="0"
          max="10"
          step="0.5"
          value="${DEFAULT_RATING_THRESHOLD}"
          class="imdb-slider"
        />
        <span class="imdb-filter-value">${DEFAULT_RATING_THRESHOLD.toFixed(1)}+</span>
      </div>
    </div>
  `;

  // [2026-04-12 FIX] Append filter bar to body with fixed positioning
  // Fixed positioning places it below Netflix header (top: 70px in CSS)
  // appendChild ensures it renders on top of content layer
  document.body.appendChild(filterBar);
  console.log('[Filter Bar] Filter bar injected with fixed positioning');

  // [2026-04-12 FIX] Add event listener with null checks to prevent crashes
  try {
    const slider = filterBar.querySelector('.imdb-slider');
    const valueDisplay = filterBar.querySelector('.imdb-filter-value');

    // [2026-04-12 FIX] Defensive null checks prevent TypeError if querySelector fails
    if (!slider || !valueDisplay) {
      console.error('[Filter Bar] Failed to find slider or value display elements', { slider: !!slider, valueDisplay: !!valueDisplay });
      return;
    }

    slider.addEventListener('input', (e) => {
      currentThreshold = parseFloat(e.target.value);
      valueDisplay.textContent = currentThreshold.toFixed(1) + '+';

      // [2026-04-12] Track filter usage
      trackFeatureUse('filter-slider');

      // Apply filter to all visible cards
      applyFilterToAllCards();
    });
  } catch (error) {
    console.error('[Filter Bar] Error setting up event listeners:', error);
  }
}

/**
 * Apply current filter threshold to all cards
 */
function applyFilterToAllCards() {
  // Find all cards with badges
  const cardsWithBadges = document.querySelectorAll('[data-testid="hit-title"], .slider-item, [data-uia="ptrack-content"], .title-card-container');

  cardsWithBadges.forEach((card) => {
    const badge = card.querySelector('.imdb-badge');
    if (badge) {
      const ratingText = badge.querySelector('span')?.textContent || '?';
      const rating = parseFloat(ratingText);

      if (!isNaN(rating)) {
        applyFilterToCard(card, rating);
      }
    }
  });
}
