-- Backfill user_id in swimmer_performances for rows that can be linked
-- via swimmer_iuf → user_profiles.ffn_iuf → user_profiles.user_id
-- This fixes the swim_records_comp view which filters WHERE user_id IS NOT NULL
-- Without this, bulk-imported performances (from import-club-records) had NULL user_id
-- and were invisible in the athlete's personal competition records.

UPDATE swimmer_performances sp
SET user_id = up.user_id
FROM user_profiles up
WHERE sp.swimmer_iuf = up.ffn_iuf
  AND up.ffn_iuf IS NOT NULL
  AND up.ffn_iuf != ''
  AND sp.user_id IS NULL;
