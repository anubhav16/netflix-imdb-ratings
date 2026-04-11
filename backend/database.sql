-- Netflix IMDb Analytics Database Schema
-- Deploy to Supabase: Dashboard → SQL Editor → Create new query

-- UP: Create weekly_stats table
CREATE TABLE IF NOT EXISTS weekly_stats (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()),

  -- API statistics
  api_total INTEGER NOT NULL DEFAULT 0,
  api_successful INTEGER NOT NULL DEFAULT 0,
  api_blank INTEGER NOT NULL DEFAULT 0,
  api_errors INTEGER NOT NULL DEFAULT 0,

  -- Feature usage
  badges_injected INTEGER NOT NULL DEFAULT 0,
  cache_hit_rate FLOAT DEFAULT 0.0,

  -- JSON data (top blank titles, features used)
  blank_titles JSONB DEFAULT '{}',
  features_used JSONB DEFAULT '{}',

  -- Indexing for queries
  CREATED INDEX idx_weekly_stats_created_at ON weekly_stats(created_at DESC)
);

-- Query examples:
-- Top 10 blank titles across all time
-- SELECT
--   jsonb_each_text(blank_titles) as (title, count)
-- FROM weekly_stats
-- ORDER BY (jsonb_each_text(blank_titles)).value::INT DESC
-- LIMIT 10;

-- Feature usage trends (last 30 days)
-- SELECT
--   DATE_TRUNC('week', created_at) as week,
--   AVG(badges_injected) as avg_badges,
--   AVG(cache_hit_rate) as avg_cache_hit
-- FROM weekly_stats
-- WHERE created_at > NOW() - INTERVAL '30 days'
-- GROUP BY week
-- ORDER BY week DESC;

-- API success rate trend
-- SELECT
--   DATE_TRUNC('week', created_at) as week,
--   api_successful,
--   api_blank,
--   api_errors,
--   ROUND(100.0 * api_successful / api_total, 2) as success_rate
-- FROM weekly_stats
-- WHERE created_at > NOW() - INTERVAL '30 days'
-- ORDER BY week DESC;

-- DOWN: Drop table
-- DROP TABLE IF EXISTS weekly_stats;
