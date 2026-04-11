# Analytics Setup Guide

This guide walks you through setting up the analytics backend for the Netflix IMDb Ratings extension.

**Total time: ~10 minutes**

---

## What's Being Tracked

**Anonymous, aggregate data only:**
- API call outcomes (success/blank/error)
- Feature usage (filter slider, badges, cache)
- Top 20 blank titles
- Cache hit rate

**Never tracked:**
- User identity
- User IP
- Titles watched
- Personal data

---

## Step 1: Create Supabase Database (2 min)

1. Go to [supabase.com](https://supabase.com)
2. Sign up (free tier covers everything)
3. Create new project → PostgreSQL
4. Wait for initialization (~2 min)
5. Go to **SQL Editor** → **New Query**
6. Copy entire contents of `backend/database.sql`
7. Paste and execute
8. Confirm table `weekly_stats` is created

---

## Step 2: Get Supabase Credentials (1 min)

In your Supabase dashboard:

1. Go to **Settings** → **API**
2. Copy **Project URL** (looks like `https://xxx.supabase.co`)
3. Copy **Anon Public Key** (looks like `eyJ...`)
4. Keep these safe (needed for Vercel)

---

## Step 3: Deploy Backend to Vercel (3 min)

### Option A: Deploy via GitHub (Recommended)

1. Create GitHub repo for backend:
   ```bash
   mkdir netflix-imdb-backend
   cd netflix-imdb-backend
   git init
   ```

2. Copy `backend/api/stats.js` and `backend/package.json` to this repo

3. Push to GitHub:
   ```bash
   git add .
   git commit -m "Initial backend setup"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/netflix-imdb-backend.git
   git push -u origin main
   ```

4. Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - **Add New** → **Project**
   - Select `netflix-imdb-backend` repo
   - Deploy!

5. Vercel will auto-generate URL (e.g., `netflix-imdb-backend.vercel.app`)

### Option B: Deploy via Vercel CLI

```bash
cd backend/
npm install -g vercel
vercel deploy --prod
```

---

## Step 4: Add Environment Variables (1 min)

In Vercel dashboard:

1. Go to your project
2. **Settings** → **Environment Variables**
3. Add two variables:
   - Name: `SUPABASE_URL`, Value: `https://xxx.supabase.co`
   - Name: `SUPABASE_ANON_KEY`, Value: `eyJ...`
4. **Save**
5. **Redeploy** (Vercel will rebuild with env vars)

---

## Step 5: Update Extension Configuration (1 min)

In `src/analytics.js`:

```javascript
const BACKEND_URL = 'https://YOUR_VERCEL_URL.vercel.app/api/stats';
```

Replace `YOUR_VERCEL_URL` with your Vercel domain.

---

## Step 6: Test It Out (2 min)

1. Reload extension in Chrome
2. Visit Netflix
3. Open DevTools (F12)
4. Check Console for `[Analytics]` logs
5. Wait 10 seconds
6. Check `Application` → `Storage` → `Local Storage` → Look for `extension-analytics`

You should see stats like:
```json
{
  "api": { "total_requests": 23, "successful": 20, "blank_results": 3, "errors": 0 },
  "badges_injected": 23,
  "cache_hits": 18,
  "cache_misses": 5,
  "blank_titles": { "Unknown Title": 1, "Rare Film": 2 }
}
```

---

## Verify Backend Connection

1. Open DevTools → **Network** tab
2. Wait ~1 minute (analytics checks weekly)
3. Look for POST request to your Vercel URL
4. Should see `Status: 200` ✅

If stuck at "pending" or erroring:
- Check `SUPABASE_URL` and key in Vercel
- Verify table `weekly_stats` exists in Supabase
- Check Vercel function logs (Vercel dashboard → Deployments → Logs)

---

## Querying Your Data

In Supabase dashboard → **SQL Editor**:

```sql
-- Top blank titles
SELECT
  jsonb_each_text(blank_titles) as title,
  COUNT(*) as occurrences
FROM weekly_stats
GROUP BY title
ORDER BY occurrences DESC
LIMIT 10;

-- Feature usage over time
SELECT
  DATE_TRUNC('week', created_at) as week,
  AVG(badges_injected) as avg_badges,
  AVG(cache_hit_rate) as avg_cache_hit
FROM weekly_stats
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY week
ORDER BY week DESC;

-- API success rate
SELECT
  DATE_TRUNC('week', created_at) as week,
  ROUND(100.0 * SUM(api_successful) / SUM(api_total), 2) as success_rate
FROM weekly_stats
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY week
ORDER BY week DESC;
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "CORS error" | Check host permissions in `manifest.json` |
| "Failed to store" | Verify Supabase credentials in Vercel env vars |
| "No data arriving" | Check extension console for `[Analytics]` logs |
| "Table doesn't exist" | Run `database.sql` in Supabase SQL editor |
| "Vercel 500 error" | Check Vercel deployment logs |

---

## Privacy & Compliance

✅ **What's sent:** Only aggregate numbers (no personal data)
✅ **What's stored:** Anonymous statistics in PostgreSQL
✅ **User control:** Data stored locally first, weekly aggregate optional
✅ **Chrome Web Store:** Fully compliant (transparent, no personal data)

---

## Update README

Add to README.md under "Privacy & Security":

> "The extension collects anonymous aggregate statistics weekly to help improve the product. No personal data, user identity, or viewing history is tracked. All statistics are anonymous and can be viewed in your browser's local storage."

---

Done! Your analytics are now live. 🎉

Questions? Check Vercel logs or Supabase dashboard for errors.
