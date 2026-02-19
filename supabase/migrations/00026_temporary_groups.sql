-- =============================================================================
-- Migration: Temporary groups for coach stages
-- =============================================================================

-- 1. Add columns to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS parent_group_id integer REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS created_by integer REFERENCES users(id);

-- 2. Index for fast lookup of temporary groups
CREATE INDEX IF NOT EXISTS idx_groups_temporary ON groups (is_temporary, is_active);
CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups (parent_group_id) WHERE parent_group_id IS NOT NULL;

-- 3. RLS for groups table
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Everyone can read all groups
DROP POLICY IF EXISTS groups_select ON groups;
CREATE POLICY groups_select ON groups FOR SELECT USING (true);

-- Coaches/admins can insert temporary groups only
DROP POLICY IF EXISTS groups_insert ON groups;
CREATE POLICY groups_insert ON groups FOR INSERT
  WITH CHECK (
    app_user_role() IN ('admin', 'coach')
    AND is_temporary = true
  );

-- Coaches/admins can update temporary groups only
DROP POLICY IF EXISTS groups_update ON groups;
CREATE POLICY groups_update ON groups FOR UPDATE
  USING (app_user_role() IN ('admin', 'coach') AND is_temporary = true)
  WITH CHECK (app_user_role() IN ('admin', 'coach') AND is_temporary = true);

-- Coaches/admins can delete temporary groups only
DROP POLICY IF EXISTS groups_delete ON groups;
CREATE POLICY groups_delete ON groups FOR DELETE
  USING (app_user_role() IN ('admin', 'coach') AND is_temporary = true);
