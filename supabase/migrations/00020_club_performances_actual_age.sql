-- Add actual_age column to club_performances table
-- Stores the swimmer's real age at competition time before 8-17 clamping

ALTER TABLE club_performances
ADD COLUMN IF NOT EXISTS actual_age INTEGER;

COMMENT ON COLUMN club_performances.actual_age IS 'Swimmer''s real age at competition time before 8-17 clamping';
