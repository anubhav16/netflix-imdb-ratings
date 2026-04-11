// Content script - runs on Netflix pages

console.log('Netflix IMDb Ratings extension loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getMovieTitle') {
    // Extract movie title from Netflix page
    const title = document.querySelector('[data-uia="ptrack-container"]')?.textContent;
    sendResponse({ title });
  }
});

// Inject rating overlay on movie hover
document.addEventListener('mouseenter', (e) => {
  const movieCard = e.target.closest('[data-testid="hit-title"]');
  if (movieCard) {
    const title = movieCard.textContent?.trim();
    if (title) {
      fetchIMDbRating(title, movieCard);
    }
  }
}, true);

async function fetchIMDbRating(title, element) {
  try {
    // Send message to background script to fetch IMDb data
    chrome.runtime.sendMessage(
      { action: 'fetchIMDb', title },
      (response) => {
        if (response && response.rating) {
          showRatingOverlay(element, response);
        }
      }
    );
  } catch (error) {
    console.error('Error fetching IMDb rating:', error);
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
      <div class="imdb-rating-stars">⭐ ${data.rating}/10</div>
      <div class="imdb-rating-title">${data.title}</div>
    </div>
  `;

  element.appendChild(overlay);
}
