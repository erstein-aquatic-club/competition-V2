-- =============================================================================
-- Migration 00039: RPC to count objectives per numeric user_id
--
-- Returns objectives count grouped by the public.users integer ID,
-- resolving the auth UUID → app_user_id mapping server-side.
-- Used by CoachSwimmersOverview to display accurate objective counts.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_objectives_counts_by_user()
RETURNS TABLE(user_id INTEGER, objectives_count BIGINT)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    (au.raw_app_meta_data ->> 'app_user_id')::integer AS user_id,
    COUNT(*) AS objectives_count
  FROM objectives o
  JOIN auth.users au ON au.id = o.athlete_id
  WHERE (au.raw_app_meta_data ->> 'app_user_id') IS NOT NULL
  GROUP BY user_id;
$$;
