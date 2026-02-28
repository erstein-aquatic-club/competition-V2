-- Training Slots: recurring weekly time slots for training
-- Design doc: docs/plans/2026-02-28-training-slots-design.md

-- ── training_slots ──────────────────────────────────────────
CREATE TABLE training_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CHECK (end_time > start_time),
  UNIQUE (day_of_week, start_time, end_time, location)
);

-- ── training_slot_assignments ───────────────────────────────
CREATE TABLE training_slot_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES training_slots(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  coach_id INTEGER NOT NULL REFERENCES users(id),
  lane_count SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, group_id)
);

-- ── training_slot_overrides ─────────────────────────────────
CREATE TABLE training_slot_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES training_slots(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('cancelled', 'modified')),
  new_start_time TIME,
  new_end_time TIME,
  new_location TEXT,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, override_date)
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE training_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_slot_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_slot_overrides ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users
CREATE POLICY "training_slots_select" ON training_slots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "training_slot_assignments_select" ON training_slot_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "training_slot_overrides_select" ON training_slot_overrides
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: coach only
CREATE POLICY "training_slots_coach_insert" ON training_slots
  FOR INSERT TO authenticated
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slots_coach_update" ON training_slots
  FOR UPDATE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'))
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slots_coach_delete" ON training_slots
  FOR DELETE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_assignments_coach_insert" ON training_slot_assignments
  FOR INSERT TO authenticated
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_assignments_coach_update" ON training_slot_assignments
  FOR UPDATE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'))
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_assignments_coach_delete" ON training_slot_assignments
  FOR DELETE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_overrides_coach_insert" ON training_slot_overrides
  FOR INSERT TO authenticated
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_overrides_coach_update" ON training_slot_overrides
  FOR UPDATE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'))
  WITH CHECK (app_user_role() IN ('coach', 'admin'));

CREATE POLICY "training_slot_overrides_coach_delete" ON training_slot_overrides
  FOR DELETE TO authenticated
  USING (app_user_role() IN ('coach', 'admin'));

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_training_slots_day ON training_slots (day_of_week) WHERE is_active = true;
CREATE INDEX idx_training_slot_assignments_slot ON training_slot_assignments (slot_id);
CREATE INDEX idx_training_slot_assignments_group ON training_slot_assignments (group_id);
CREATE INDEX idx_training_slot_overrides_slot_date ON training_slot_overrides (slot_id, override_date);
