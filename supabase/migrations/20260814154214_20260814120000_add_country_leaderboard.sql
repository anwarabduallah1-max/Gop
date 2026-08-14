/*
# Add country support for global donor leaderboard

1. Schema changes
- Adds `country` (text, nullable) to `profiles`. Stores an ISO 3166-1 alpha-2
  country code (e.g. "US", "GB", "JP"). Nullable so existing profiles are not
  forced to pick a country before the feature works.

2. New function: get_country_leaderboard()
- SECURITY DEFINER, STABLE, runs as the owner so it can join profiles +
  transactions even though the anon role only has SELECT on `profiles`.
- Returns one row per country that has at least one donation, with:
  - country_code (text)
  - total_donated (numeric) — sum of all stars donated by users in that country
  - donor_count (int) — number of distinct donors from that country
  - top_donor_username (text)
  - top_donor_avatar_url (text)
  - top_donor_amount (numeric) — the single highest donor's total from that country
- Countries with no donations are NOT returned; the frontend merges in the
  full country list from its static ISO data so every country is visible.

3. Security
- No RLS policy changes. `profiles` already has a SELECT policy for anon
  reads (added in an earlier migration). The new column inherits that.
- get_country_leaderboard() is SECURITY DEFINER with a locked search_path
  so the anon client can call it via RPC without direct table access.

4. Data safety
- No data is removed or rewritten. The new column is nullable with no default.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text;

DROP FUNCTION IF EXISTS public.get_country_leaderboard();

CREATE OR REPLACE FUNCTION public.get_country_leaderboard()
RETURNS TABLE (
  country_code text,
  total_donated numeric,
  donor_count integer,
  top_donor_username text,
  top_donor_avatar_url text,
  top_donor_amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH donor_totals AS (
    SELECT
      t.donor_id,
      SUM(t.stars_amount) AS donated
    FROM public.transactions t
    GROUP BY t.donor_id
  ),
  profile_donations AS (
    SELECT
      p.country AS country_code,
      p.username,
      p.avatar_url,
      COALESCE(d.donated, 0) AS donated
    FROM public.profiles p
    LEFT JOIN donor_totals d ON d.donor_id = p.id
    WHERE p.country IS NOT NULL
      AND p.country <> ''
      AND COALESCE(d.donated, 0) > 0
  )
  SELECT
    pd.country_code,
    SUM(pd.donated) AS total_donated,
    COUNT(*)::integer AS donor_count,
    (array_agg(pd.username ORDER BY pd.donated DESC, pd.username ASC))[1] AS top_donor_username,
    (array_agg(pd.avatar_url ORDER BY pd.donated DESC, pd.username ASC))[1] AS top_donor_avatar_url,
    (array_agg(pd.donated ORDER BY pd.donated DESC, pd.username ASC))[1] AS top_donor_amount
  FROM profile_donations pd
  GROUP BY pd.country_code
  ORDER BY total_donated DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_country_leaderboard() TO anon, authenticated;
