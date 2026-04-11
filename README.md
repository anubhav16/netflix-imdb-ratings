# Netflix IMDb Ratings

A browser extension that displays IMDb ratings and information for movies while browsing Netflix.

## Features

- Shows IMDb rating for any movie on Netflix
- Quick access to IMDb page
- Clean, non-intrusive UI overlay
- Works seamlessly while browsing Netflix

## Project Structure

```
netflix-imdb-ratings/
├── manifest.json          # Extension manifest
├── src/
│   ├── content.js        # Content script for Netflix page injection
│   ├── background.js     # Background service worker
│   ├── api.js            # IMDb API integration
│   └── styles.css        # Extension styles
├── images/               # Icons and assets
└── README.md
```

## Setup

1. Clone the repository
2. Install dependencies (if any)
3. Load as unpacked extension in Chrome/Firefox
4. Visit netflix.com and hover over movie thumbnails to see ratings

## Development

- Node.js 16+ recommended
- No external build tools required (vanilla JS)
- Test in extension developer mode

## License

MIT
