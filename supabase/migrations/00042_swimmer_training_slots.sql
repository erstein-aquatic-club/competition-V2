-- 00042_swimmer_training_slots.sql
-- Per-swimmer custom training slots with optional link to group assignment

CREATE TABLE IF NOT EXISTS swimmer_training_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_assignment_id UUID REFERENCES training_slot_assignments(id) ON DELETE SET NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  location TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_swimmer_slots_user ON swimmer_training_slots (user_id) WHERE is_active;
CREATE INDEX idx_swimmer_slots_source ON swimmer_training_slots (source_assignment_id) WHERE source_assignment_id IS NOT NULL;

-- RLS
ALTER TABLE swimmer_training_slots ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can read
CREATE POLICY "swimmer_slots_select" ON swimmer_training_slots
  FOR SELECT TO authenticated USING (true);

-- INSERT: coach and admin only
CREATE POLICY "swimmer_slots_insert" ON swimmer_training_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid()::text::integer)
        AND users.role IN ('coach', 'admin')
    )
  );

-- UPDATE: coach and admin only
CREATE POLICY "swimmer_slots_update" ON swimmer_training_slots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid()::text::integer)
        AND users.role IN ('coach', 'admin')
    )
  );

-- DELETE: coach and admin only
CREATE POLICY "swimmer_slots_delete" ON swimmer_training_slots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid()::text::integer)
        AND users.role IN ('coach', 'admin')
    )
  );
