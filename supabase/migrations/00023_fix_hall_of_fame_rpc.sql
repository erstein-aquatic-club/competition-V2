-- Fix get_hall_of_fame() to return TABLE instead of JSONB
-- and join with users to resolve athlete names.
-- Previous version returned a JSONB object which the client couldn't parse as an array.

DROP FUNCTION IF EXISTS get_hall_of_fame();

CREATE OR REPLACE FUNCTION get_hall_of_fame()
RETURNS TABLE(
  athlete_name text,
  total_distance bigint,
  avg_performance numeric,
  avg_engagement numeric
)
LANGUAGE sql STABLE
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
