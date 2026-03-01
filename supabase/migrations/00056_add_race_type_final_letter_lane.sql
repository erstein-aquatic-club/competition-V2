-- Add race_type, final_letter, lane to competition_races for finals support
ALTER TABLE competition_races
  ADD COLUMN IF NOT EXISTS race_type TEXT NOT NULL DEFAULT 'series',
  ADD COLUMN IF NOT EXISTS final_letter TEXT,
  ADD COLUMN IF NOT EXISTS lane INTEGER;
