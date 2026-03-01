-- Migration: Create missing tables for schema reproducibility
-- These tables already exist in production but were never in migration files

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  end_date DATE,
  location TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'competitions_select') THEN
    CREATE POLICY competitions_select ON competitions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'competitions_write') THEN
    CREATE POLICY competitions_write ON competitions FOR ALL
      USING (app_user_role() IN ('admin','coach'))
      WITH CHECK (app_user_role() IN ('admin','coach'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS competition_assignments (
  id SERIAL PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(competition_id, athlete_id)
);
ALTER TABLE competition_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_comp_assign_competition ON competition_assignments(competition_id);
CREATE INDEX IF NOT EXISTS idx_comp_assign_athlete ON competition_assignments(athlete_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'comp_assign_coach_all') THEN
    CREATE POLICY comp_assign_coach_all ON competition_assignments FOR ALL
      USING (app_user_role() IN ('coach','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'comp_assign_athlete_select') THEN
    CREATE POLICY comp_assign_athlete_select ON competition_assignments FOR SELECT
      USING (athlete_id = app_user_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES auth.users(id),
  competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL,
  event_code TEXT,
  pool_length INTEGER,
  target_time_seconds NUMERIC,
  text TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_objectives_athlete_id ON objectives(athlete_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'objectives_select') THEN
    CREATE POLICY objectives_select ON objectives FOR SELECT
      USING (athlete_id = auth.uid() OR app_user_role() IN ('admin','coach'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'objectives_write') THEN
    CREATE POLICY objectives_write ON objectives FOR ALL
      USING (app_user_role() IN ('admin','coach') OR athlete_id = auth.uid())
      WITH CHECK (app_user_role() IN ('admin','coach') OR athlete_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS planned_absences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE planned_absences ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_planned_absences_user_date ON planned_absences(user_id, date);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'planned_absences_own') THEN
    CREATE POLICY planned_absences_own ON planned_absences FOR ALL
      USING (user_id = app_user_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'planned_absences_coach_read') THEN
    CREATE POLICY planned_absences_coach_read ON planned_absences FOR SELECT
      USING (app_user_role() IN ('coach','admin'));
  END IF;
END $$;
