-- =============================================================================
-- Migration 00035: Interviews (multi-phase entretiens individuels)
-- =============================================================================

CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft_athlete'
    CHECK (status IN ('draft_athlete', 'draft_coach', 'sent', 'signed')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Athlete sections (phase 1)
  athlete_successes TEXT,
  athlete_difficulties TEXT,
  athlete_goals TEXT,
  athlete_commitments TEXT,
  -- Coach sections (phase 2)
  coach_review TEXT,
  coach_objectives TEXT,
  coach_actions TEXT,
  -- Context
  current_cycle_id UUID REFERENCES training_cycles(id) ON DELETE SET NULL,
  -- Timestamps
  submitted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_interviews_athlete ON interviews(athlete_id);
CREATE INDEX idx_interviews_status ON interviews(status);

-- RLS: phase-based access control
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Coach/admin can always read all interviews
CREATE POLICY interviews_coach_select ON interviews FOR SELECT
  USING (app_user_role() IN ('admin', 'coach'));

-- Athlete can read own interviews ONLY when status is draft_athlete, sent, or signed
CREATE POLICY interviews_athlete_select ON interviews FOR SELECT
  USING (
    app_user_role() = 'athlete'
    AND athlete_id = app_user_id()
    AND status IN ('draft_athlete', 'sent', 'signed')
  );

-- Coach/admin can insert (initiate interviews)
CREATE POLICY interviews_coach_insert ON interviews FOR INSERT
  WITH CHECK (app_user_role() IN ('admin', 'coach'));

-- Coach can update coach sections + status transitions
CREATE POLICY interviews_coach_update ON interviews FOR UPDATE
  USING (app_user_role() IN ('admin', 'coach'));

-- Athlete can update own interviews in draft_athlete (their sections) or sent (signature)
-- WITH CHECK allows status transitions: draft_athlete→draft_coach, sent→signed
CREATE POLICY interviews_athlete_update ON interviews FOR UPDATE
  USING (
    app_user_role() = 'athlete'
    AND athlete_id = app_user_id()
    AND status IN ('draft_athlete', 'sent')
  )
  WITH CHECK (
    app_user_role() = 'athlete'
    AND athlete_id = app_user_id()
    AND status IN ('draft_athlete', 'draft_coach', 'sent', 'signed')
  );

-- Only coach/admin can delete
CREATE POLICY interviews_coach_delete ON interviews FOR DELETE
  USING (app_user_role() IN ('admin', 'coach'));
