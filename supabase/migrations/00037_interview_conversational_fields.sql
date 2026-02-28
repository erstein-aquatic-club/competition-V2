-- Migration: Add conversational fields to interviews + fix athlete RLS for draft_coach visibility
--
-- New coach fields per section (replaces monolithic coach_review approach):
--   coach_comment_successes, coach_comment_difficulties, coach_comment_goals
--
-- New athlete field for commitment follow-up:
--   athlete_commitment_review

-- Coach comment per section
ALTER TABLE interviews ADD COLUMN coach_comment_successes TEXT;
ALTER TABLE interviews ADD COLUMN coach_comment_difficulties TEXT;
ALTER TABLE interviews ADD COLUMN coach_comment_goals TEXT;

-- Athlete commitment review (filled during draft_athlete phase)
ALTER TABLE interviews ADD COLUMN athlete_commitment_review TEXT;

-- Fix: allow athlete to see draft_coach (visible as "en preparation" in UI)
DROP POLICY IF EXISTS interviews_athlete_select ON interviews;
CREATE POLICY interviews_athlete_select ON interviews FOR SELECT
  USING (
    app_user_role() = 'athlete'
    AND athlete_id = app_user_id()
    AND status IN ('draft_athlete', 'draft_coach', 'sent', 'signed')
  );
