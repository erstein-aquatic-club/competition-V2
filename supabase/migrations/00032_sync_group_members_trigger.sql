-- =============================================================================
-- 00032: Sync group_members when user_profiles.group_id changes
-- =============================================================================
-- Bug fix: when a swimmer changes group via Profile, only user_profiles.group_id
-- was updated but group_members (used by assignments, athlete lists, RLS policies)
-- was not. This trigger keeps both in sync.
-- =============================================================================

-- 1. Trigger function: sync group_members + group_label on profile group change
CREATE OR REPLACE FUNCTION sync_group_members_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if group_id did not change (UPDATE only)
  IF (TG_OP = 'UPDATE' AND OLD.group_id IS NOT DISTINCT FROM NEW.group_id) THEN
    RETURN NEW;
  END IF;

  -- Remove old permanent group membership (preserve temporary groups)
  IF (TG_OP = 'UPDATE' AND OLD.group_id IS NOT NULL) THEN
    DELETE FROM group_members gm
    USING groups g
    WHERE gm.user_id = NEW.user_id
      AND gm.group_id = OLD.group_id
      AND g.id = gm.group_id
      AND (g.is_temporary IS NULL OR g.is_temporary = false);
  END IF;

  -- Add new permanent group membership
  IF (NEW.group_id IS NOT NULL) THEN
    INSERT INTO group_members (group_id, user_id)
    VALUES (NEW.group_id, NEW.user_id)
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  -- Sync group_label cache from groups.name
  IF (NEW.group_id IS NOT NULL) THEN
    NEW.group_label := (SELECT name FROM groups WHERE id = NEW.group_id);
  ELSE
    NEW.group_label := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger (BEFORE so we can modify NEW.group_label)
DROP TRIGGER IF EXISTS trg_sync_group_members ON user_profiles;
CREATE TRIGGER trg_sync_group_members
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_group_members_on_profile();

-- 3. One-shot data fix: resync existing divergent data
-- 3a. Add missing group_members entries for current user_profiles.group_id
INSERT INTO group_members (group_id, user_id)
SELECT up.group_id, up.user_id
FROM user_profiles up
JOIN groups g ON g.id = up.group_id AND (g.is_temporary IS NULL OR g.is_temporary = false)
WHERE up.group_id IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;

-- 3b. Remove stale permanent group_members that don't match user_profiles.group_id
DELETE FROM group_members gm
USING groups g
WHERE g.id = gm.group_id
  AND (g.is_temporary IS NULL OR g.is_temporary = false)
  AND gm.group_id != (
    SELECT COALESCE(up.group_id, -1)
    FROM user_profiles up
    WHERE up.user_id = gm.user_id
  );

-- 3c. Sync group_label cache for all profiles
UPDATE user_profiles up
SET group_label = g.name
FROM groups g
WHERE g.id = up.group_id
  AND (up.group_label IS DISTINCT FROM g.name);
