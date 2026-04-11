# Quick Reference - Netflix IMDb Extension Project

## TL;DR - Is This Feasible?

**YES - Score: 7/10** ✓ Proceed with development

- Technical: ✓ Straightforward (proven patterns exist)
- Legal: ⚠️ Moderate risk (Netflix ToS, manageable with disclaimers)
- Maintenance: ⚠️ Ongoing effort (Netflix changes DOM quarterly)

---

## Key Technical Decisions

| Area | Decision | Why |
|------|----------|-----|
| **IMDb Data Source** | OMDb API (free tier) | Free, reliable, 99%+ coverage, already used by similar extensions |
| **Architecture** | Service worker + Content script | Manifest V3 compliant, proven pattern |
| **Caching** | IndexedDB (50MB+) | Large capacity, persistent, perfect for ratings |
| **Title Extraction** | Multiple fallback strategies | Netflix DOM is fragile; need robustness |
| **Rate Limiting** | Queue requests (0.7 req/sec) | Stay within OMDb free tier (1,000/day) |
| **Overlay Position** | Top-right corner badge | Non-intrusive, visible, doesn't block content |

---

## Architecture Overview

```
Netflix Thumbnail (user hovers)
         ↓
Content Script detects hover event
         ↓
Extracts title (DOM text / attributes / internal state)
         ↓
Sends to Background Service Worker
         ↓
Service Worker checks IndexedDB cache
         ├─ HIT: Return immediately
         └─ MISS: Queue OMDb API request
         ↓
Batch requests to OMDb (rate-limited)
         ↓
Cache result + Return to Content Script
         ↓
Content Script injects overlay with rating
```

---

## Core Files to Implement

### Phase 1 (Week 1 - MVP)

1. **src/config.js** (NEW)
   - OMDb API key
   - Configuration constants

2. **src/cache.js** (NEW)
   - IndexedDB wrapper
   - get/set/cleanup methods
   - ~100 lines of code

3. **src/api.js** (NEW)
   - OMDb API client
   - Request queuing (rate limiting)
   - ~150 lines of code

4. **src/extractors.js** (NEW)
   - Multiple title extraction strategies
   - DOM traversal, attribute parsing, etc.
   - ~80 lines of code

5. **src/background.js** (REPLACE)
   - Message handling
   - Integrate cache + API client
   - ~80 lines of code

6. **src/content.js** (REPLACE)
   - DOM mutation observer
   - Hover event detection
   - Overlay injection
   - ~120 lines of code

7. **src/styles.css** (REPLACE)
   - Non-intrusive rating overlay
   - Animations, responsive design
   - ~80 lines of code

**Total: ~610 lines of new/refactored code**

### Phase 2 (Week 2 - Polish)

- Settings page (optional but recommended)
- Error logging/debugging
- Test suite (optional)
- Chrome Web Store assets (icons, screenshots)

---

## Risks Summary

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|-----------|
| Netflix ToS enforcement | HIGH | LOW | Add disclaimer, avoid Netflix APIs, pivot strategy |
| Netflix DOM changes | HIGH | CERTAIN | Multiple selectors, active maintenance (2-4h/month) |
| Title matching failures | MEDIUM | CERTAIN (5-15%) | User feedback, manual override, graceful N/A |
| Rate limit exceeded | MEDIUM | LOW | Queue system, warn user, suggest upgrade |
| OMDb API downtime | MEDIUM | LOW | Fallback to cache only, retry logic |
| Performance regression | LOW | LOW | Caching, batching, careful MutationObserver setup |

---

## Regulatory/Legal Checklist

- [ ] Disclaimer added to extension description about Netflix ToS
- [ ] Privacy policy drafted (data sent to OMDb)
- [ ] Only fetch titles, no Netflix API access
- [ ] Using OMDb (not direct IMDb scraping)
- [ ] No storage of copyrighted content
- [ ] Clear attribution to IMDb in UI

---

## Testing Checklist

**Manual Testing:**
- [ ] Hover over 10+ titles, verify ratings appear
- [ ] Test with slow network (DevTools throttle)
- [ ] Scroll through full homepage
- [ ] Check console for errors
- [ ] Verify cache working (load same title twice)
- [ ] Monitor memory (should be <5MB overhead)

**Edge Cases:**
- [ ] Obscure title not in IMDb
- [ ] Title with special characters (é, ñ, etc.)
- [ ] Very long titles (70+ characters)
- [ ] Netflix original without IMDb entry
- [ ] Slow network (timeout handling)

---

## Maintenance Burden

### Monthly (2-3 hours)
- Check for Netflix DOM breakage
- Test 10-15 random titles
- Review GitHub issues
- Monitor extension dashboard

### Quarterly (4-6 hours)
- Major feature reviews
- Dependency updates
- Performance optimization
- User analytics review

### When Needed (Emergency)
- Netflix DOM change: 2-4 hours to fix
- OMDb outage: Automatic fallback to cache
- Security issue: Immediate patch

**Total: ~10-12 hours/month (or 2-3 hours/week)**

---

## OMDb API Details

| Metric | Value |
|--------|-------|
| **Free Tier** | 1,000 requests/day |
| **Sustained Rate** | 0.7 requests/second |
| **Cost** | Free (or small donation for unlimited) |
| **Response Time** | 200-500ms |
| **Data Coverage** | 99%+ of mainstream movies/shows |
| **ToS** | Permits non-commercial use |

**Example Request:**
```
GET https://www.omdbapi.com/?apikey=YOUR_KEY&t=The+Shawshank+Redemption
```

**Response:**
```json
{
  "Title": "The Shawshank Redemption",
  "Year": "1994",
  "imdbID": "tt0111161",
  "imdbRating": "9.3",
  "imdbVotes": "2800000"
}
```

---

## Netflix DOM Reality

**Current Selectors in Codebase:**
- `[data-testid="hit-title"]` - Sometimes works, frequently breaks
- `[data-uia="ptrack-container"]` - Tracking container, unreliable

**Better Approach:**
1. Use MULTIPLE selectors (fallback chain)
2. Extract title via multiple methods:
   - DOM text content (easiest)
   - HTML attributes (aria-label, title)
   - Netflix internal state (if available)
   - Network monitoring (if needed)
3. Robust error handling for ALL failures

**Reality Check:**
- Netflix changes DOM every few months
- No stable, documented selectors
- Requires active maintenance to fix breakage

---

## Development Environment Setup

### Prerequisites
- Chrome/Chromium browser
- Text editor (VS Code recommended)
- Git (for version control)

### Local Testing
1. Clone/open project
2. Get OMDb API key: https://www.omdbapi.com/apikey.aspx
3. Create `src/config.js` with API key
4. Open `chrome://extensions`
5. Enable "Developer mode"
6. Click "Load unpacked"
7. Select project folder

### Debugging
- Open DevTools (F12) on Netflix page
- Check "Extension console" in chrome://extensions
- Network tab shows OMDb API calls
- Console shows title extraction results
- Performance tab shows memory usage

---

## Go/No-Go Decision Matrix

| Factor | Status | Go/No-Go |
|--------|--------|----------|
| Technical feasibility | ✓ Proven | GO |
| Data source available | ✓ OMDb API | GO |
| Browser compatibility | ✓ Chrome MV3 | GO |
| Similar projects exist | ✓ Yes (Tubi, etc.) | GO |
| Legal clarity | ⚠️ Gray area | CAUTION GO |
| Maintenance burden | ⚠️ Moderate | PROCEED |
| **Overall** | **7/10** | **✓ GO** |

---

## Timeline Estimate

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Setup + Phase 1 | 1-2 weeks | Working MVP |
| Phase 2 + Polish | +1 week | Production v1.0 |
| Chrome Web Store | +1 week | Listed + live |
| **Total** | **3-4 weeks** | **Live extension** |

**Ongoing:** 2-4 hours/month maintenance

---

## Success Indicators

✓ Launch successful when:
- Extension loads without errors
- Hovers show ratings in <500ms (acceptable latency)
- 85%+ title match rate
- <5MB memory overhead
- No browser performance impact
- Graceful handling of failures

---

## Critical Success Factors

1. **Robust Title Extraction**
   - Netflix titles must be reliably identified
   - Multiple extraction methods prevent total failure

2. **Aggressive Caching**
   - 30-day cache prevents API quota exhaustion
   - Offline-first approach improves performance

3. **Rate Limiting**
   - Queue requests to stay within OMDb limits
   - Alert users when approaching quota

4. **Netflix DOM Resilience**
   - Multiple selector fallbacks
   - Graceful degradation when all fail
   - Active monitoring for changes

5. **User Communication**
   - Clear ToS disclaimer
   - Transparent privacy policy
   - Error messages when data unavailable

---

## Recommended Next Steps

### Immediate (Today)
1. Review TECHNICAL_FEASIBILITY_ASSESSMENT.md (comprehensive analysis)
2. Review IMPLEMENTATION_ROADMAP.md (specific code guidance)
3. Get OMDb API key: https://www.omdbapi.com/apikey.aspx

### This Week
1. Implement Phase 1 files (cache.js, api.js, extractors.js)
2. Update background.js and content.js
3. Local testing on netflix.com

### Next Week
1. Phase 2 refinements (UI polish, error handling)
2. Chrome Web Store preparation
3. Final testing and launch

---

## Resources

**Official Documentation:**
- [Chrome Extension Developer Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/migrating-to-manifest-v3/)
- [Service Worker API](https://developer.chrome.com/docs/extensions/develop/service_workers)
- [OMDb API Documentation](https://www.omdbapi.com/)

**Existing Examples:**
- [Tubi IMDb Rater (GitHub)](https://github.com/ikristina/tubi-imdb-rater)
- [IMDb Ratings on Various OTT Platforms (Firefox)](https://addons.mozilla.org/en-US/firefox/addon/imdb-ratings-for-various-ott/)

**Learning Resources:**
- MutationObserver: https://javascript.info/mutation-observer
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Chrome Message Passing: https://developer.chrome.com/docs/extensions/develop/messaging

---

## Contact & Support

For technical questions:
1. Check TECHNICAL_FEASIBILITY_ASSESSMENT.md (Q&A format)
2. Review IMPLEMENTATION_ROADMAP.md (code examples)
3. See this QUICK_REFERENCE.md (summary)

---

**Last Updated:** April 12, 2026  
**Status:** ✓ Ready for Development  
**Confidence Level:** HIGH (7/10)
