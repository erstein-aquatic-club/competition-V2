ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS neurotype_result jsonb DEFAULT NULL;

COMMENT ON COLUMN user_profiles.neurotype_result IS
'Stores neurotype quiz result: { dominant, scores, takenAt }';
