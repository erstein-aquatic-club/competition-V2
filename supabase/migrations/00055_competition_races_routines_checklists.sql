-- Competition Races, Routines, Checklists for swimmer competition prep
-- Applied via Supabase MCP 2026-03-01

CREATE TABLE competition_races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,
  race_day DATE NOT NULL,
  start_time TIME,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE competition_races ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competition_races_select" ON competition_races FOR SELECT TO authenticated USING (true);
CREATE POLICY "competition_races_own_insert" ON competition_races FOR INSERT TO authenticated WITH CHECK (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));
CREATE POLICY "competition_races_own_update" ON competition_races FOR UPDATE TO authenticated USING (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin')) WITH CHECK (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));
CREATE POLICY "competition_races_own_delete" ON competition_races FOR DELETE TO authenticated USING (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));
CREATE INDEX idx_competition_races_comp ON competition_races (competition_id, athlete_id);

CREATE TABLE routine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_templates_select" ON routine_templates FOR SELECT TO authenticated USING (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));
CREATE POLICY "routine_templates_own_insert" ON routine_templates FOR INSERT TO authenticated WITH CHECK (athlete_id = app_user_id());
CREATE POLICY "routine_templates_own_update" ON routine_templates FOR UPDATE TO authenticated USING (athlete_id = app_user_id()) WITH CHECK (athlete_id = app_user_id());
CREATE POLICY "routine_templates_own_delete" ON routine_templates FOR DELETE TO authenticated USING (athlete_id = app_user_id());

CREATE TABLE routine_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  offset_minutes INTEGER NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE routine_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_steps_select" ON routine_steps FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = routine_id AND (rt.athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'))));
CREATE POLICY "routine_steps_own_insert" ON routine_steps FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = routine_id AND rt.athlete_id = app_user_id()));
CREATE POLICY "routine_steps_own_update" ON routine_steps FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = routine_id AND rt.athlete_id = app_user_id())) WITH CHECK (EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = routine_id AND rt.athlete_id = app_user_id()));
CREATE POLICY "routine_steps_own_delete" ON routine_steps FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = routine_id AND rt.athlete_id = app_user_id()));
CREATE INDEX idx_routine_steps_routine ON routine_steps (routine_id);

CREATE TABLE race_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID NOT NULL REFERENCES competition_races(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  UNIQUE(race_id)
);
ALTER TABLE race_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "race_routines_select" ON race_routines FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM competition_races cr WHERE cr.id = race_id AND (cr.athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'))));
CREATE POLICY "race_routines_own_insert" ON race_routines FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM competition_races cr WHERE cr.id = race_id AND cr.athlete_id = app_user_id()));
CREATE POLICY "race_routines_own_delete" ON race_routines FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM competition_races cr WHERE cr.id = race_id AND cr.athlete_id = app_user_id()));

CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_templates_select" ON checklist_templates FOR SELECT TO authenticated USING (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));
CREATE POLICY "checklist_templates_own_insert" ON checklist_templates FOR INSERT TO authenticated WITH CHECK (athlete_id = app_user_id());
CREATE POLICY "checklist_templates_own_update" ON checklist_templates FOR UPDATE TO authenticated USING (athlete_id = app_user_id()) WITH CHECK (athlete_id = app_user_id());
CREATE POLICY "checklist_templates_own_delete" ON checklist_templates FOR DELETE TO authenticated USING (athlete_id = app_user_id());

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_items_select" ON checklist_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM checklist_templates ct WHERE ct.id = checklist_id AND (ct.athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'))));
CREATE POLICY "checklist_items_own_insert" ON checklist_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM checklist_templates ct WHERE ct.id = checklist_id AND ct.athlete_id = app_user_id()));
CREATE POLICY "checklist_items_own_update" ON checklist_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM checklist_templates ct WHERE ct.id = checklist_id AND ct.athlete_id = app_user_id())) WITH CHECK (EXISTS (SELECT 1 FROM checklist_templates ct WHERE ct.id = checklist_id AND ct.athlete_id = app_user_id()));
CREATE POLICY "checklist_items_own_delete" ON checklist_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM checklist_templates ct WHERE ct.id = checklist_id AND ct.athlete_id = app_user_id()));
CREATE INDEX idx_checklist_items_checklist ON checklist_items (checklist_id);

CREATE TABLE competition_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checklist_template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  UNIQUE(competition_id, athlete_id)
);
ALTER TABLE competition_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competition_checklists_select" ON competition_checklists FOR SELECT TO authenticated USING (athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'));
CREATE POLICY "competition_checklists_own_insert" ON competition_checklists FOR INSERT TO authenticated WITH CHECK (athlete_id = app_user_id());
CREATE POLICY "competition_checklists_own_delete" ON competition_checklists FOR DELETE TO authenticated USING (athlete_id = app_user_id());

CREATE TABLE competition_checklist_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_checklist_id UUID NOT NULL REFERENCES competition_checklists(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ,
  UNIQUE(competition_checklist_id, checklist_item_id)
);
ALTER TABLE competition_checklist_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competition_checklist_checks_select" ON competition_checklist_checks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM competition_checklists cc WHERE cc.id = competition_checklist_id AND (cc.athlete_id = app_user_id() OR app_user_role() IN ('coach', 'admin'))));
CREATE POLICY "competition_checklist_checks_own_insert" ON competition_checklist_checks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM competition_checklists cc WHERE cc.id = competition_checklist_id AND cc.athlete_id = app_user_id()));
CREATE POLICY "competition_checklist_checks_own_update" ON competition_checklist_checks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM competition_checklists cc WHERE cc.id = competition_checklist_id AND cc.athlete_id = app_user_id())) WITH CHECK (EXISTS (SELECT 1 FROM competition_checklists cc WHERE cc.id = competition_checklist_id AND cc.athlete_id = app_user_id()));
CREATE INDEX idx_comp_checklist_checks_cc ON competition_checklist_checks (competition_checklist_id);
