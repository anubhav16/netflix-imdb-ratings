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
const TOP_BLANKS_LIMIT = 20; // Track top 20 blank titles only

/**
 * Initialize analytics tracking
 */
function initializeAnalytics() {
  setupWeeklyReporting();
}

/**
 * Track API call outcome
 */
async function trackAPICall(title, success, isBlank = false) {
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
        blank_titles: stats.blank_titles,
        features_used: stats.features
      }
    };

    // Send to backend
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('[Analytics] Weekly report sent successfully');

      // Mark as sent
      stats.last_sent = now;
      await saveAnalytics(stats);
    } else {
      console.error('[Analytics] Failed to send report:', response.status);
    }
  } catch (error) {
    console.error('[Analytics] Error sending report:', error);
    // Silently fail — don't disrupt extension
  }
}

/**
 * Get analytics for dashboard (user-facing)
 */
async function getAnalyticsForDisplay() {
  const stats = await getAnalytics();

  return {
    totalRequests: stats.api.total_requests,
    successfulRequests: stats.api.successful,
    blankResults: stats.api.blank_results,
    errors: stats.api.errors,
    badgesInjected: stats.badges_injected,
    cacheHitRate: ((stats.cache_hits / (stats.cache_hits + stats.cache_misses || 1)) * 100).toFixed(1) + '%',
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
