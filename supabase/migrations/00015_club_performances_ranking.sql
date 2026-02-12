-- =============================================================================
-- Migration 00015: Add swimmer_iuf to club_performances for ranking support
-- =============================================================================

-- Add swimmer_iuf column to club_performances (to identify individual swimmers)
ALTER TABLE club_performances ADD COLUMN IF NOT EXISTS swimmer_iuf TEXT;

-- Add index for ranking queries (filter by event/pool/sex/age, order by time)
CREATE INDEX IF NOT EXISTS club_performances_ranking_idx
  ON club_performances (event_code, pool_m, sex, age, time_ms ASC);
