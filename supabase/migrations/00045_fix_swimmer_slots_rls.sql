-- Fix RLS policies on swimmer_training_slots
-- Use app_user_role() (from JWT claims) instead of auth.uid()::text::integer

-- Drop broken policies
DROP POLICY IF EXISTS "swimmer_slots_insert" ON swimmer_training_slots;
DROP POLICY IF EXISTS "swimmer_slots_update" ON swimmer_training_slots;
DROP POLICY IF EXISTS "swimmer_slots_delete" ON swimmer_training_slots;

-- Recreate with app_user_role()
CREATE POLICY "swimmer_slots_insert" ON swimmer_training_slots
  FOR INSERT TO authenticated
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "swimmer_slots_update" ON swimmer_training_slots
  FOR UPDATE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "swimmer_slots_delete" ON swimmer_training_slots
  FOR DELETE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'));
