-- Ensure no two club_record_swimmers share the same IUF.
-- When a duplicate exists (same iuf, one 'user' + one 'manual') keep the 'user' entry.

-- Step 1: Remove manual duplicates where a user entry already has the same IUF
DELETE FROM club_record_swimmers a
USING club_record_swimmers b
WHERE a.iuf = b.iuf
  AND a.iuf IS NOT NULL
  AND a.source_type = 'manual'
  AND b.source_type = 'user'
  AND a.id <> b.id;

-- Step 2: Remove duplicate manual entries (keep the one with lowest id)
DELETE FROM club_record_swimmers a
USING club_record_swimmers b
WHERE a.iuf = b.iuf
  AND a.iuf IS NOT NULL
  AND a.source_type = 'manual'
  AND b.source_type = 'manual'
  AND a.id > b.id;

-- Step 3: Add partial unique index
CREATE UNIQUE INDEX idx_club_record_swimmers_iuf_unique
ON club_record_swimmers(iuf)
WHERE iuf IS NOT NULL;
