-- Add event, pool and equipment columns to swim_exercise_logs
ALTER TABLE swim_exercise_logs
  ADD COLUMN IF NOT EXISTS event_code TEXT,
  ADD COLUMN IF NOT EXISTS pool_length INTEGER,
  ADD COLUMN IF NOT EXISTS equipment TEXT[] DEFAULT '{aucun}';

-- Make session_id nullable (standalone notes without a session)
ALTER TABLE swim_exercise_logs ALTER COLUMN session_id DROP NOT NULL;

-- Index for querying by user + event
CREATE INDEX IF NOT EXISTS idx_swim_exercise_logs_user_event
  ON swim_exercise_logs(user_id, event_code)
  WHERE event_code IS NOT NULL;
