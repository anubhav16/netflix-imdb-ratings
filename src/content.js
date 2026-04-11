// Configuration (inlined to avoid import issues)
const NETFLIX_SELECTORS = [
  '[data-testid="hit-title"]',
  '.slider-item',
  '[data-uia="ptrack-content"]',
  '.title-card-container'
];
const DEFAULT_RATING_THRESHOLD = 0;
const BADGE_SIZE_PX = 28;
const BADGE_FONT_SIZE_PX = 11;
const IMDB_YELLOW = '#F5C518';

console.log('Netflix IMDb Ratings extension loaded');

// Track pending requests to avoid duplicates
const pendingTitles = new Set();

// Track filter bar state
let filterBar = null;
let currentThreshold = DEFAULT_RATING_THRESHOLD;

// Initialize
initializeExtension();

function initializeExtension() {
  // Inject badges on initial page load
  setTimeout(() => {
    injectBadgesForVisibleCards();
    injectFilterBar();
  }, 500);

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
        fetchIMDbRating(title, card);
      }
    }
  });
}

/**
 * Extract title text from a Netflix card, trying multiple strategies
 */
function extractTitle(card) {
  // Strategy 1: Direct text content
  const text = card.textContent?.trim();
  if (text && text.length > 0 && text.length < 150) {
    return text;
  }

  // Strategy 2: Title attribute
  const titleAttr = card.getAttribute('title') || card.getAttribute('aria-label');
  if (titleAttr) {
    return titleAttr.split('•')[0].trim();
  }

  // Strategy 3: Look for specific text elements
  const titleSpan = card.querySelector('[data-uia="title-span"], span[role="heading"]');
  if (titleSpan) {
    return titleSpan.textContent?.trim();
  }

  return null;
}

/**
 * Request IMDb rating from background script
 */
function fetchIMDbRating(title, card) {
  console.log(`[IMDb] Requesting rating for: ${title}`);

  chrome.runtime.sendMessage(
    { action: 'fetchIMDb', title },
    (response) => {
      pendingTitles.delete(title);
      console.log(`[IMDb] Response for ${title}:`, response);
      console.log(`[IMDb] Has rating field:`, response?.rating, `Type:`, typeof response?.rating);

      if (response && response.rating && response.rating !== 'N/A') {
        console.log(`[IMDb] Updating badge with rating: ${response.rating}`);
        updateBadge(card, response);
        applyFilterToCard(card, parseFloat(response.rating));
      } else {
        console.log(`[IMDb] No rating found, showing ?. Response was:`, JSON.stringify(response));
        updateBadge(card, { rating: '?' });
      }
    }
  );
}

/**
 * Inject a badge element into a Netflix card
 */
function injectBadge(card, data) {
  // Ensure card has position: relative for absolute badge positioning
  card.style.position = 'relative';

  // Create badge element
  const badge = document.createElement('div');
  badge.className = 'imdb-badge';

  if (data === null) {
    // Loading state
    badge.className += ' imdb-badge-loading';
    badge.innerHTML = '?';
  } else {
    // Show rating
    const ratingText = data.rating !== 'N/A' ? data.rating.substring(0, 4) : '?';
    badge.innerHTML = `<span>${ratingText}</span>`;
  }

  card.appendChild(badge);
}

/**
 * Update existing badge with actual rating
 */
function updateBadge(card, data) {
  const badge = card.querySelector('.imdb-badge');
  if (badge) {
    badge.classList.remove('imdb-badge-loading');
    const ratingText = data.rating !== 'N/A' ? data.rating.substring(0, 4) : '?';
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

  // Insert at top of main content area (before first Netflix section)
  const mainContent = document.querySelector('[data-uia="browse"]') || document.querySelector('[role="main"]');
  if (mainContent) {
    mainContent.insertBefore(filterBar, mainContent.firstChild);
  } else {
    // Fallback: insert after body opening
    document.body.insertBefore(filterBar, document.body.firstChild);
  }

  // Add event listener
  const slider = filterBar.querySelector('.imdb-slider');
  const valueDisplay = filterBar.querySelector('.imdb-filter-value');

  slider.addEventListener('input', (e) => {
    currentThreshold = parseFloat(e.target.value);
    valueDisplay.textContent = currentThreshold.toFixed(1) + '+';

    // Apply filter to all visible cards
    applyFilterToAllCards();
  });
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
