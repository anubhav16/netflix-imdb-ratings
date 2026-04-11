/**
 * API endpoint to receive anonymous aggregate analytics from extension
 *
 * Deployed to: https://netflix-imdb-backend.vercel.app/api/stats
 *
 * This function receives ONLY aggregate, anonymous statistics:
 * - Total API calls and outcomes
 * - Feature usage counts
 * - Top blank titles (no user data attached)
 * - Cache hit rates
 *
 * NEVER receives:
 * - User identity
 * - User IP
 * - Personal data
 * - Timestamps of individual actions
 */

// For local development with Supabase
const { createClient } = require('@supabase/supabase-js');

// Environment variables (set in Vercel dashboard)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * POST /api/stats
 * Receive and store anonymous aggregate statistics
 */
export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { timestamp, stats } = req.body;

    // Validate payload
    if (!stats || !stats.api_total) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Insert into Supabase
    const { error, data } = await supabase.from('weekly_stats').insert([
      {
        created_at: timestamp || new Date().toISOString(),
        api_total: stats.api_total,
        api_successful: stats.api_successful,
        api_blank: stats.api_blank,
        api_errors: stats.api_errors,
        badges_injected: stats.badges_injected,
        cache_hit_rate: stats.cache_hit_rate,
        blank_titles: stats.blank_titles, // JSON object
        features_used: stats.features_used // JSON object
      }
    ]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to store analytics' });
    }

    return res.status(200).json({
      ok: true,
      message: 'Analytics received',
      id: data?.[0]?.id
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
