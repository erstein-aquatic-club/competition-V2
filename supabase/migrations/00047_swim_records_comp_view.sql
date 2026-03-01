-- Create a view that reconstructs competition best times from swimmer_performances.
-- This replaces the need for ffn-sync to write into swim_records for comp records.
-- swim_records is kept for manual training records (record_type = 'training').

CREATE OR REPLACE VIEW swim_records_comp AS
SELECT DISTINCT ON (sp.user_id, sp.event_code, sp.pool_length)
  sp.id,
  sp.user_id                  AS athlete_id,
  sp.event_code               AS event_name,
  sp.pool_length,
  sp.time_seconds,
  sp.competition_date          AS record_date,
  sp.competition_name          AS notes,
  sp.ffn_points,
  'comp'::text                 AS record_type
FROM swimmer_performances sp
WHERE sp.user_id IS NOT NULL
  AND sp.time_seconds IS NOT NULL
  AND sp.time_seconds > 0
ORDER BY sp.user_id, sp.event_code, sp.pool_length, sp.time_seconds ASC;

-- Grant access to authenticated users (view inherits base table RLS)
GRANT SELECT ON swim_records_comp TO authenticated;
