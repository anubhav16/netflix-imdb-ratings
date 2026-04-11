// Configuration (inlined to avoid import issues)
const OMDB_API_KEY = '9b86bd5';
const OMDB_API_URL = 'https://www.omdbapi.com/';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_KEY_PREFIX = 'imdb_';
const MAX_CONCURRENT_REQUESTS = 3;
const REQUEST_TIMEOUT_MS = 5000;

// Request queue management
let requestQueue = [];
let activeRequests = 0;

// Message listener for content script requests
chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  console.log('[BG] Message received:', JSON.stringify(request));

  if (request.action === 'fetchIMDb') {
    console.log(`[BG] Fetching IMDb for: ${request.title}`);

    fetchIMDbRating(request.title)
      .then(data => {
        console.log(`[BG] Sending response:`, JSON.stringify(data));
        sendResponse(data);
      })
      .catch(error => {
        console.error('[BG] Error:', error);
        sendResponse({ title: request.title, rating: 'N/A', error: error.message });
      });

    // Keep the message channel open for async response
    return true;
  }
});

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
      console.log(`[BG] Trying OMDb with: "${variant}" (original: "${title}")`);

      // Try as movie first
      let data = await tryOMDbSearch(variant, 'movie');
      if (data.Response === 'True') {
        console.log(`[BG] Found as movie: ${variant}`);
        return normalizeOMDbResponse(data);
      }

      // Try as series
      data = await tryOMDbSearch(variant, 'series');
      if (data.Response === 'True') {
        console.log(`[BG] Found as series: ${variant}`);
        return normalizeOMDbResponse(data);
      }
    } catch (error) {
      console.log(`[BG] Error trying ${variant}:`, error.message);
      continue;
    }
  }

  // Nothing found
  console.log(`[BG] No match found for any variation of: ${title}`);
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
