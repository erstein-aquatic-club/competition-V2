-- Fix permissive RLS policies identified in security audit
-- See: docs/plans/2026-03-01-rls-security-ffn-auto-sync.md

-- 1. swimmer_performances: INSERT was open to all authenticated users
--    Only Edge Functions (service_role, bypasses RLS) insert here.
DROP POLICY IF EXISTS "swimmer_performances_insert" ON swimmer_performances;
CREATE POLICY "swimmer_performances_insert"
  ON swimmer_performances FOR INSERT
  TO authenticated
  WITH CHECK (app_user_role() IN ('admin', 'coach'));

-- 2. import_logs: INSERT/UPDATE were open to all authenticated users
--    Only Edge Functions (service_role) write here.
DROP POLICY IF EXISTS "import_logs_write" ON import_logs;
DROP POLICY IF EXISTS "import_logs_update" ON import_logs;
CREATE POLICY "import_logs_insert"
  ON import_logs FOR INSERT
  TO authenticated
  WITH CHECK (app_user_role() = 'admin');
CREATE POLICY "import_logs_update"
  ON import_logs FOR UPDATE
  TO authenticated
  USING (app_user_role() = 'admin');

-- 3. app_settings: INSERT/UPDATE were open to all authenticated users
--    Only admin modifies settings (via RecordsAdmin UI).
DROP POLICY IF EXISTS "app_settings_write" ON app_settings;
DROP POLICY IF EXISTS "app_settings_update" ON app_settings;
CREATE POLICY "app_settings_insert"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (app_user_role() = 'admin');
CREATE POLICY "app_settings_update"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (app_user_role() = 'admin')
  WITH CHECK (app_user_role() = 'admin');

-- 4. strength_folders: INSERT/UPDATE/DELETE were open to all authenticated users
--    Only coaches create/edit/delete folders (StrengthCatalog coach UI).
--    SELECT stays open (athletes read folders to see organized sessions).
DROP POLICY IF EXISTS "Authenticated users can insert folders" ON strength_folders;
DROP POLICY IF EXISTS "Authenticated users can update folders" ON strength_folders;
DROP POLICY IF EXISTS "Authenticated users can delete folders" ON strength_folders;
CREATE POLICY "strength_folders_insert"
  ON strength_folders FOR INSERT
  TO authenticated
  WITH CHECK (app_user_role() IN ('admin', 'coach'));
CREATE POLICY "strength_folders_update"
  ON strength_folders FOR UPDATE
  TO authenticated
  USING (app_user_role() IN ('admin', 'coach'))
  WITH CHECK (app_user_role() IN ('admin', 'coach'));
CREATE POLICY "strength_folders_delete"
  ON strength_folders FOR DELETE
  TO authenticated
  USING (app_user_role() IN ('admin', 'coach'));
