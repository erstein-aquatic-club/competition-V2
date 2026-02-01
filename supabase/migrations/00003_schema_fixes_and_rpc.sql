-- =============================================================================
-- Migration 00003: Schema fixes and RPC functions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Missing columns
-- ---------------------------------------------------------------------------

ALTER TABLE swim_records
  ADD COLUMN IF NOT EXISTS ffn_points DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS record_type TEXT;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS ffn_iuf TEXT;

ALTER TABLE dim_exercices
  ADD COLUMN IF NOT EXISTS warmup_reps INTEGER,
  ADD COLUMN IF NOT EXISTS warmup_duration INTEGER;

ALTER TABLE strength_session_runs
  ADD COLUMN IF NOT EXISTS fatigue INTEGER,
  ADD COLUMN IF NOT EXISTS comments TEXT;

-- ---------------------------------------------------------------------------
-- 2. Unique constraint for upsert on one_rm_records
-- ---------------------------------------------------------------------------

ALTER TABLE one_rm_records
  DROP CONSTRAINT IF EXISTS one_rm_records_athlete_exercise_unique;

ALTER TABLE one_rm_records
  ADD CONSTRAINT one_rm_records_athlete_exercise_unique UNIQUE (athlete_id, exercise_id);

-- ---------------------------------------------------------------------------
-- 3. RLS policy for notification_targets (group members)
-- ---------------------------------------------------------------------------

-- Drop existing SELECT policy that doesn't account for group membership
DROP POLICY IF EXISTS notification_targets_select ON notification_targets;

CREATE POLICY notification_targets_select ON notification_targets FOR SELECT
  USING (
    target_user_id = app_user_id()
    OR target_group_id IN (
      SELECT group_id FROM group_members WHERE user_id = app_user_id()
    )
    OR app_user_role() IN ('admin', 'coach')
  );

-- ---------------------------------------------------------------------------
-- 4. RPC: get_hall_of_fame()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_hall_of_fame()
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'swim_distance', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(athlete_id::text, athlete_name) AS athlete,
          SUM(distance) AS total_distance
        FROM dim_sessions
        WHERE distance IS NOT NULL
        GROUP BY COALESCE(athlete_id::text, athlete_name)
        ORDER BY total_distance DESC
        LIMIT 5
      ) t
    ),
    'swim_performance', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(athlete_id::text, athlete_name) AS athlete,
          ROUND((AVG(performance) / 2.0)::numeric, 2) AS avg_performance
        FROM dim_sessions
        WHERE performance IS NOT NULL
        GROUP BY COALESCE(athlete_id::text, athlete_name)
        ORDER BY avg_performance DESC
        LIMIT 5
      ) t
    ),
    'swim_engagement', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(athlete_id::text, athlete_name) AS athlete,
          ROUND(AVG(engagement)::numeric, 2) AS avg_engagement
        FROM dim_sessions
        WHERE engagement IS NOT NULL
        GROUP BY COALESCE(athlete_id::text, athlete_name)
        ORDER BY avg_engagement DESC
        LIMIT 5
      ) t
    ),
    'strength_volume', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          r.athlete_id::text AS athlete,
          SUM(s.reps * s.weight) AS total_volume
        FROM strength_set_logs s
        JOIN strength_session_runs r ON r.id = s.run_id
        WHERE s.reps IS NOT NULL AND s.weight IS NOT NULL
        GROUP BY r.athlete_id
        ORDER BY total_volume DESC
        LIMIT 5
      ) t
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC: get_strength_history_aggregate(...)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_strength_history_aggregate(
  p_athlete_id INTEGER,
  p_period TEXT DEFAULT 'day',
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_order TEXT DEFAULT 'desc'
)
RETURNS TABLE(period TEXT, tonnage NUMERIC, volume NUMERIC)
LANGUAGE sql STABLE
AS $$
  SELECT t.period, t.tonnage, t.volume
  FROM (
    SELECT
      CASE p_period
        WHEN 'week'  THEN to_char(date_trunc('week', r.completed_at), 'IYYY-"W"IW')
        WHEN 'month' THEN to_char(date_trunc('month', r.completed_at), 'YYYY-MM')
        ELSE               to_char(date_trunc('day', r.completed_at), 'YYYY-MM-DD')
      END AS period,
      SUM(s.reps * s.weight)::numeric AS tonnage,
      SUM(s.reps)::numeric AS volume
    FROM strength_set_logs s
    JOIN strength_session_runs r ON r.id = s.run_id
    WHERE r.athlete_id = p_athlete_id
      AND r.completed_at IS NOT NULL
      AND (p_from IS NULL OR r.completed_at >= p_from)
      AND (p_to   IS NULL OR r.completed_at <  (p_to + INTERVAL '1 day'))
      AND s.reps IS NOT NULL
      AND s.weight IS NOT NULL
    GROUP BY
      CASE p_period
        WHEN 'week'  THEN to_char(date_trunc('week', r.completed_at), 'IYYY-"W"IW')
        WHEN 'month' THEN to_char(date_trunc('month', r.completed_at), 'YYYY-MM')
        ELSE               to_char(date_trunc('day', r.completed_at), 'YYYY-MM-DD')
      END
  ) t
  ORDER BY
    CASE WHEN p_order = 'asc'  THEN t.period END ASC,
    CASE WHEN p_order <> 'asc' THEN t.period END DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC: get_upcoming_birthdays(p_days)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_upcoming_birthdays(p_days INTEGER DEFAULT 30)
RETURNS TABLE(user_id INTEGER, display_name TEXT, birthdate DATE, next_birthday DATE, days_until INTEGER)
LANGUAGE sql STABLE
AS $$
  SELECT
    u.id AS user_id,
    u.display_name,
    up.birthdate::date AS birthdate,
    CASE
      WHEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                     EXTRACT(MONTH FROM up.birthdate::date)::int,
                     EXTRACT(DAY FROM up.birthdate::date)::int) >= CURRENT_DATE
      THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                     EXTRACT(MONTH FROM up.birthdate::date)::int,
                     EXTRACT(DAY FROM up.birthdate::date)::int)
      ELSE MAKE_DATE((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::int,
                     EXTRACT(MONTH FROM up.birthdate::date)::int,
                     EXTRACT(DAY FROM up.birthdate::date)::int)
    END AS next_birthday,
    (CASE
      WHEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                     EXTRACT(MONTH FROM up.birthdate::date)::int,
                     EXTRACT(DAY FROM up.birthdate::date)::int) >= CURRENT_DATE
      THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                     EXTRACT(MONTH FROM up.birthdate::date)::int,
                     EXTRACT(DAY FROM up.birthdate::date)::int)
      ELSE MAKE_DATE((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::int,
                     EXTRACT(MONTH FROM up.birthdate::date)::int,
                     EXTRACT(DAY FROM up.birthdate::date)::int)
    END - CURRENT_DATE)::integer AS days_until
  FROM users u
  JOIN user_profiles up ON up.user_id = u.id
  WHERE up.birthdate IS NOT NULL
    AND (CASE
          WHEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                         EXTRACT(MONTH FROM up.birthdate::date)::int,
                         EXTRACT(DAY FROM up.birthdate::date)::int) >= CURRENT_DATE
          THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                         EXTRACT(MONTH FROM up.birthdate::date)::int,
                         EXTRACT(DAY FROM up.birthdate::date)::int)
          ELSE MAKE_DATE((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::int,
                         EXTRACT(MONTH FROM up.birthdate::date)::int,
                         EXTRACT(DAY FROM up.birthdate::date)::int)
        END - CURRENT_DATE)::integer <= p_days
  ORDER BY days_until ASC;
$$;
