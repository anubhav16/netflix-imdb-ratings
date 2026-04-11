// Background service worker

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchIMDb') {
    fetchIMDbRating(request.title)
      .then(data => sendResponse(data))
      .catch(error => {
        console.error('IMDb fetch error:', error);
        sendResponse({ error: error.message });
      });

    // Keep the message channel open for async response
    return true;
  }
});

async function fetchIMDbRating(title) {
  try {
    // Use IMDb API or scraping to get rating
    // For now, using a placeholder implementation

    // In production, you'd use:
    // 1. OMDb API (requires API key)
    // 2. IMDb API wrapper
    // 3. Web scraping (with proper rate limiting)

    const response = await fetch(`https://www.imdb.com/find?q=${encodeURIComponent(title)}&json=1`);

    if (!response.ok) {
      throw new Error(`IMDb API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse response and extract rating
    if (data.description && data.description.length > 0) {
      const firstResult = data.description[0];
      return {
        title: firstResult['#TITLE'] || title,
        rating: firstResult['#RANK'] || 'N/A',
        imdbId: firstResult['#ID']
      };
    }

    return { title, rating: 'N/A' };
  } catch (error) {
    console.error('Error fetching IMDb rating:', error);
    throw error;
  }
}
