/**
 * Analytics Module — Local tracking + optional weekly aggregate reporting
 * [2026-04-12] Anonymous usage statistics to improve product
 *
 * Tracked data:
 * - API call outcomes (success/blank/error)
 * - Feature usage (filter slider, badges, cache)
 * - Top blank titles (up to 20 most common)
 *
 * Never tracked:
 * - User identity, IP, location
 * - Specific titles user watches
 * - Timestamps of individual actions
 * - Personal data of any kind
 */

const ANALYTICS_STORAGE_KEY = 'extension-analytics';
const STATS_SEND_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BACKEND_URL = 'https://netflix-imdb-backend.vercel.app/api/stats'; // Update with your domain
const RAW_DATA_BACKEND_URL = 'https://netflix-imdb-backend.vercel.app/api/raw-ratings'; // Raw data endpoint
const TOP_BLANKS_LIMIT = 20; // Track top 20 blank titles only

/**
 * Initialize analytics tracking
 */
function initializeAnalytics() {
  setupWeeklyReporting();
}

/**
 * Track API call outcome with detailed metrics for each content item
 * @param {string} title - Content title
 * @param {boolean} success - Whether API returned valid data
 * @param {boolean} isBlank - Whether API hit but returned no data (N/A result)
 * @param {object} ratingData - IMDb rating data {imdbRating, year, imdbId}
 */
async function trackAPICall(title, success, isBlank = false, ratingData = null) {
  const stats = await getAnalytics();

  stats.api.total_requests++;
  if (success && !isBlank) {
    stats.api.successful++;
  } else if (isBlank) {
    stats.api.blank_results++;
    trackBlankTitle(title); // Track which titles are blank
  } else {
    stats.api.errors++;
  }

  // Track detailed per-content metrics for ratings shown calculation
  if (!stats.content_metrics) {
    stats.content_metrics = [];
  }

  stats.content_metrics.push({
    title: title,
    api_hit: true,
    data_fetched: success && !isBlank,
    is_blank_result: isBlank,
    timestamp: new Date().toISOString()
  });

  // Keep only last 1000 items to prevent storage overflow
  if (stats.content_metrics.length > 1000) {
    stats.content_metrics = stats.content_metrics.slice(-1000);
  }

  if (success && ratingData) {
    await trackRawRatingData(title, ratingData);
  }

  await saveAnalytics(stats);
}

/**
 * Track blank titles (keep top 20)
 */
async function trackBlankTitle(title) {
  const stats = await getAnalytics();

  if (!stats.blank_titles) {
    stats.blank_titles = {};
  }

  stats.blank_titles[title] = (stats.blank_titles[title] || 0) + 1;

  // Keep only top 20 to prevent storage bloat
  const sorted = Object.entries(stats.blank_titles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_BLANKS_LIMIT);

  stats.blank_titles = Object.fromEntries(sorted);

  await saveAnalytics(stats);
}

/**
 * Track raw rating data for accuracy improvement
 * @param {string} title - Movie/show name
 * @param {object} ratingData - {imdbRating, year, imdbId}
 */
async function trackRawRatingData(title, ratingData) {
  const stats = await getAnalytics();

  if (!stats.raw_ratings) {
    stats.raw_ratings = [];
  }

  stats.raw_ratings.push({
    title: title,
    year: ratingData.year,
    imdb_id: ratingData.imdbId,
    imdb_rating: ratingData.imdbRating,
    timestamp: new Date().toISOString()
  });

  if (stats.raw_ratings.length > 5000) {
    stats.raw_ratings = stats.raw_ratings.slice(-5000);
  }

  await saveAnalytics(stats);
}

/**
 * Track feature usage
 */
async function trackFeatureUse(featureName) {
  const stats = await getAnalytics();

  if (!stats.features) {
    stats.features = {};
  }

  stats.features[featureName] = (stats.features[featureName] || 0) + 1;

  await saveAnalytics(stats);
}

/**
 * Track badge injection
 */
async function trackBadgeInjected() {
  const stats = await getAnalytics();
  stats.badges_injected = (stats.badges_injected || 0) + 1;
  await saveAnalytics(stats);
}

/**
 * Track cache hit/miss
 */
async function trackCacheHit(hit = true) {
  const stats = await getAnalytics();

  if (hit) {
    stats.cache_hits = (stats.cache_hits || 0) + 1;
  } else {
    stats.cache_misses = (stats.cache_misses || 0) + 1;
  }

  await saveAnalytics(stats);
}

/**
 * Get or initialize analytics data
 */
async function getAnalytics() {
  const result = await chrome.storage.local.get(ANALYTICS_STORAGE_KEY);
  const current = result[ANALYTICS_STORAGE_KEY] || {};

  // Initialize structure if empty
  return {
    api: current.api || {
      total_requests: 0,
      successful: 0,
      blank_results: 0,
      errors: 0
    },
    features: current.features || {},
    badges_injected: current.badges_injected || 0,
    cache_hits: current.cache_hits || 0,
    cache_misses: current.cache_misses || 0,
    blank_titles: current.blank_titles || {},
    content_metrics: current.content_metrics || [],
    raw_ratings: current.raw_ratings || [],
    last_sent: current.last_sent || null
  };
}

/**
 * Save analytics to local storage
 */
async function saveAnalytics(stats) {
  await chrome.storage.local.set({
    [ANALYTICS_STORAGE_KEY]: stats
  });
}

/**
 * Setup weekly reporting to backend
 */
function setupWeeklyReporting() {
  // Check if should send this week
  chrome.alarms.create('send-analytics-weekly', { periodInMinutes: 24 * 60 }); // Check daily

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'send-analytics-weekly') {
      sendAnalyticsIfDue();
    }
  });
}

/**
 * Calculate percentage of content where ratings were shown
 * This is: content_with_ratings / total_api_hits * 100
 */
function calculateRatingsShownPercentage(stats) {
  if (stats.content_metrics.length === 0) {
    return 0;
  }

  const contentWithRatings = stats.content_metrics.filter(m => m.data_fetched).length;
  return ((contentWithRatings / stats.content_metrics.length) * 100).toFixed(1);
}

/**
 * Send analytics to backend if a week has passed
 */
async function sendAnalyticsIfDue() {
  const stats = await getAnalytics();
  const now = Date.now();
  const lastSent = stats.last_sent || 0;

  if (now - lastSent < STATS_SEND_INTERVAL_MS) {
    return; // Not yet a week
  }

  try {
    // Calculate key metrics
    const ratingsShownPercentage = calculateRatingsShownPercentage(stats);
    const contentWithoutRatings = stats.content_metrics.filter(m => !m.data_fetched);

    // Prepare aggregate payload (no personal data)
    const payload = {
      timestamp: new Date().toISOString(),
      stats: {
        api_total: stats.api.total_requests,
        api_successful: stats.api.successful,
        api_blank: stats.api.blank_results,
        api_errors: stats.api.errors,
        badges_injected: stats.badges_injected,
        cache_hit_rate: stats.cache_hits / (stats.cache_hits + stats.cache_misses || 1),
        // METRICS: Ratings shown percentage
        ratings_shown_percentage: ratingsShownPercentage,
        content_with_ratings: stats.content_metrics.filter(m => m.data_fetched).length,
        content_without_ratings: contentWithoutRatings.length,
        total_content_tracked: stats.content_metrics.length,
        // List of content that had API hit but no data
        content_without_ratings_list: contentWithoutRatings
          .slice(0, 50) // Send top 50 to prevent payload bloat
          .map(m => m.title),
        blank_titles: stats.blank_titles,
        features_used: stats.features
      }
    };

    console.log('[Analytics] Sending report with ratings_shown_percentage:', ratingsShownPercentage + '%');

    // Send aggregate stats to main endpoint
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('[Analytics] Weekly aggregate report sent successfully');
    } else {
      console.error('[Analytics] Failed to send aggregate report:', response.status);
    }

    // Send raw rating data separately for accuracy improvement
    if (stats.raw_ratings && stats.raw_ratings.length > 0) {
      await sendRawRatingData(stats.raw_ratings);
    }

    // Mark as sent after both reports
    stats.last_sent = now;
    await saveAnalytics(stats);

  } catch (error) {
    console.error('[Analytics] Error sending report:', error);
    // Silently fail — don't disrupt extension
  }
}

/**
 * Send raw rating data to backend for accuracy improvement
 * Format: [{ title, year, imdb_id, imdb_rating, timestamp }]
 */
async function sendRawRatingData(rawRatings) {
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      data_points: rawRatings
    };

    console.log(`[Analytics] Sending ${rawRatings.length} raw rating data points`);

    const response = await fetch(RAW_DATA_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('[Analytics] Raw rating data sent successfully');
    } else {
      console.error('[Analytics] Failed to send raw data:', response.status);
    }
  } catch (error) {
    console.error('[Analytics] Error sending raw data:', error);
    // Silently fail — don't disrupt extension
  }
}

/**
 * Get analytics for dashboard (user-facing)
 */
async function getAnalyticsForDisplay() {
  const stats = await getAnalytics();

  const ratingsShownPercentage = calculateRatingsShownPercentage(stats);
  const contentWithoutRatings = stats.content_metrics.filter(m => !m.data_fetched);

  return {
    // API metrics
    totalRequests: stats.api.total_requests,
    successfulRequests: stats.api.successful,
    blankResults: stats.api.blank_results,
    errors: stats.api.errors,
    badgesInjected: stats.badges_injected,
    cacheHitRate: ((stats.cache_hits / (stats.cache_hits + stats.cache_misses || 1)) * 100).toFixed(1) + '%',

    // KEY METRIC: Ratings shown percentage
    ratingsShownPercentage: ratingsShownPercentage,
    contentWithRatings: stats.content_metrics.filter(m => m.data_fetched).length,
    contentWithoutRatings: contentWithoutRatings.length,
    totalContentTracked: stats.content_metrics.length,
    contentWithoutRatingsList: contentWithoutRatings
      .slice(0, 20)
      .map(m => ({ title: m.title, timestamp: m.timestamp })),

    rawDataPoints: stats.raw_ratings.length,
    recentRawData: stats.raw_ratings.slice(-10).map(r => ({
      title: r.title,
      imdbRating: r.imdb_rating,
      timestamp: r.timestamp
    })),

    topBlankTitles: Object.entries(stats.blank_titles)
      .slice(0, 10)
      .map(([title, count]) => ({ title, count })),
    featuresUsed: stats.features
  };
}

/**
 * Clear analytics (user option)
 */
async function clearAnalytics() {
  await chrome.storage.local.remove(ANALYTICS_STORAGE_KEY);
  console.log('[Analytics] Data cleared');
}

// Initialize on load
initializeAnalytics();
