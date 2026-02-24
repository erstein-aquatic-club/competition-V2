-- Add avatar_url to Hall of Fame RPCs by joining user_profiles

-- 1. Swim Hall of Fame with avatar
DROP FUNCTION IF EXISTS get_hall_of_fame();
DROP FUNCTION IF EXISTS get_hall_of_fame(date);

CREATE OR REPLACE FUNCTION get_hall_of_fame(from_date date DEFAULT NULL)
RETURNS TABLE(
  athlete_name text,
  total_distance bigint,
  avg_performance numeric,
  avg_engagement numeric,
  avatar_url text
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(u.display_name, d.athlete_name, 'Inconnu') AS athlete_name,
    COALESCE(SUM(d.distance), 0)::bigint AS total_distance,
    ROUND((AVG(d.performance) / 2.0)::numeric, 2) AS avg_performance,
    ROUND(AVG(d.engagement)::numeric, 2) AS avg_engagement,
    MAX(up.avatar_url) AS avatar_url
  FROM dim_sessions d
  LEFT JOIN users u ON u.id = d.athlete_id
  LEFT JOIN user_profiles up ON up.user_id = d.athlete_id
  WHERE (from_date IS NULL OR d.session_date >= from_date)
  GROUP BY COALESCE(u.display_name, d.athlete_name, 'Inconnu')
  ORDER BY total_distance DESC;
$$;

-- 2. Strength Hall of Fame with avatar
DROP FUNCTION IF EXISTS get_hall_of_fame_strength();
DROP FUNCTION IF EXISTS get_hall_of_fame_strength(date);

CREATE OR REPLACE FUNCTION get_hall_of_fame_strength(from_date date DEFAULT NULL)
RETURNS TABLE(
  athlete_name text,
  total_volume double precision,
  total_reps bigint,
  total_sets bigint,
  max_weight double precision,
  avatar_url text
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
    COALESCE(MAX(sl.weight), 0) AS max_weight,
    MAX(up.avatar_url) AS avatar_url
  FROM strength_set_logs sl
  INNER JOIN strength_session_runs sr ON sr.id = sl.run_id
  LEFT JOIN users u ON u.id = sr.athlete_id
  LEFT JOIN user_profiles up ON up.user_id = sr.athlete_id
  WHERE (from_date IS NULL OR sr.started_at::date >= from_date)
  GROUP BY COALESCE(u.display_name, 'Inconnu')
  ORDER BY total_volume DESC;
$$;
