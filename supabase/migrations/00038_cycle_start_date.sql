-- =============================================================================
-- Migration 00038: Allow "today" as cycle start (nullable start_competition_id + start_date)
-- =============================================================================

-- 1. Make start_competition_id nullable
ALTER TABLE training_cycles ALTER COLUMN start_competition_id DROP NOT NULL;

-- 2. Add optional start_date for cycles that don't start at a competition
ALTER TABLE training_cycles ADD COLUMN start_date DATE;

-- 3. Ensure every cycle has either a start competition or a start date
ALTER TABLE training_cycles
  ADD CONSTRAINT training_cycles_has_start
  CHECK (start_competition_id IS NOT NULL OR start_date IS NOT NULL);
