-- Fix: Hall of Fame only shows connected athlete's data
-- Root cause: RLS on dim_sessions and strength_set_logs restricts athletes
-- to their own rows. The RPC runs with caller privileges → athletes only
-- see their own aggregates.
-- Fix: SECURITY DEFINER bypasses RLS so club-wide aggregates are visible.

-- 1. Recreate swim RPC as SECURITY DEFINER
DROP FUNCTION IF EXISTS get_hall_of_fame();

CREATE OR REPLACE FUNCTION get_hall_of_fame()
RETURNS TABLE(
  athlete_name text,
  total_distance bigint,
  avg_performance numeric,
  avg_engagement numeric
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(u.display_name, d.athlete_name, 'Inconnu') AS athlete_name,
    COALESCE(SUM(d.distance), 0)::bigint AS total_distance,
    ROUND((AVG(d.performance) / 2.0)::numeric, 2) AS avg_performance,
    ROUND(AVG(d.engagement)::numeric, 2) AS avg_engagement
  FROM dim_sessions d
  LEFT JOIN users u ON u.id = d.athlete_id
  GROUP BY COALESCE(u.display_name, d.athlete_name, 'Inconnu')
  ORDER BY total_distance DESC;
$$;

-- 2. Create strength RPC as SECURITY DEFINER (replaces direct client query)
CREATE OR REPLACE FUNCTION get_hall_of_fame_strength()
RETURNS TABLE(
  athlete_name text,
  total_volume double precision,
  total_reps bigint,
  total_sets bigint,
  max_weight double precision
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(u.display_name, 'Inconnu') AS athlete_name,
    COALESCE(SUM(sl.reps::double precision * sl.weight), 0) AS total_volume,
    COALESCE(SUM(sl.reps), 0)::bigint AS total_reps,
    COUNT(sl.id)::bigint AS total_sets,
    COALESCE(MAX(sl.weight), 0) AS max_weight
  FROM strength_set_logs sl
  INNER JOIN strength_session_runs sr ON sr.id = sl.run_id
  LEFT JOIN users u ON u.id = sr.athlete_id
  GROUP BY COALESCE(u.display_name, 'Inconnu')
  ORDER BY total_volume DESC;
$$;
