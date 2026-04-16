#!/usr/bin/env bash
# Build a clean zip for Chrome Web Store submission.
# Usage: ./tools/build-cws.sh

set -euo pipefail

# Move to repo root
cd "$(dirname "$0")/.."

VERSION=$(grep -E '"version"' manifest.json | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
OUT_DIR="dist"
STAGING="${OUT_DIR}/netflix-imdb-ratings-v${VERSION}"
ZIP_PATH="${OUT_DIR}/netflix-imdb-ratings-v${VERSION}.zip"

echo "Building Chrome Web Store package for v${VERSION}"
echo ""

# Pre-flight: verify icons exist
for size in 16 32 48 128; do
  if [ ! -f "icons/icon-${size}.png" ]; then
    echo "ERROR: icons/icon-${size}.png not found."
    echo "Open tools/generate-icons.html in a browser, click 'Download all', and move the PNGs into icons/"
    exit 1
  fi
done

# Pre-flight: verify required source files
for f in manifest.json src/content.js src/styles.css src/analytics.js src/background.js; do
  if [ ! -f "$f" ]; then
    echo "ERROR: required file $f missing"
    exit 1
  fi
done

# Clean and recreate staging dir
rm -rf "${OUT_DIR}"
mkdir -p "${STAGING}"

# Copy only the files Chrome actually needs
cp manifest.json "${STAGING}/"
cp -R src "${STAGING}/"
cp -R icons "${STAGING}/"

# Create the zip
cd "${OUT_DIR}"
zip -r "netflix-imdb-ratings-v${VERSION}.zip" "netflix-imdb-ratings-v${VERSION}" > /dev/null
cd ..

echo "Done."
echo ""
echo "  Package: ${ZIP_PATH}"
echo "  Size:    $(du -h "${ZIP_PATH}" | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Visit https://chrome.google.com/webstore/devconsole"
echo "  2. 'New item' > upload ${ZIP_PATH}"
echo "  3. Fill listing fields from CHROME_STORE_LISTING.md"
echo "  4. Add screenshots (1280x800)"
echo "  5. Submit for review"
