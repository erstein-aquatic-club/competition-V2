-- =============================================================================
-- Migration 00034: Training cycles (macro-cycles) + weeks (micro-cycles)
-- =============================================================================

-- 1. Training cycles (macro-cycles between competitions)
CREATE TABLE training_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  athlete_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  start_competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  end_competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT training_cycles_has_target CHECK (group_id IS NOT NULL OR athlete_id IS NOT NULL)
);

CREATE INDEX idx_training_cycles_group ON training_cycles(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_training_cycles_athlete ON training_cycles(athlete_id) WHERE athlete_id IS NOT NULL;

-- 2. Training weeks (micro-cycles within a macro-cycle)
CREATE TABLE training_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES training_cycles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_type TEXT,
  notes TEXT,
  UNIQUE(cycle_id, week_start)
);

CREATE INDEX idx_training_weeks_cycle ON training_weeks(cycle_id);

-- 3. RLS policies
ALTER TABLE training_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_weeks ENABLE ROW LEVEL SECURITY;

-- training_cycles: everyone can read, coach/admin can write
CREATE POLICY training_cycles_select ON training_cycles FOR SELECT USING (true);
CREATE POLICY training_cycles_insert ON training_cycles FOR INSERT
  WITH CHECK (app_user_role() IN ('admin', 'coach'));
CREATE POLICY training_cycles_update ON training_cycles FOR UPDATE
  USING (app_user_role() IN ('admin', 'coach'));
CREATE POLICY training_cycles_delete ON training_cycles FOR DELETE
  USING (app_user_role() IN ('admin', 'coach'));

-- training_weeks: everyone can read, coach/admin can write
CREATE POLICY training_weeks_select ON training_weeks FOR SELECT USING (true);
CREATE POLICY training_weeks_insert ON training_weeks FOR INSERT
  WITH CHECK (app_user_role() IN ('admin', 'coach'));
CREATE POLICY training_weeks_update ON training_weeks FOR UPDATE
  USING (app_user_role() IN ('admin', 'coach'));
CREATE POLICY training_weeks_delete ON training_weeks FOR DELETE
  USING (app_user_role() IN ('admin', 'coach'));
