-- =============================================================================
-- Migration 00036: Interview status transition RPCs (SECURITY DEFINER)
-- =============================================================================
-- PostgreSQL applies SELECT RLS policies to the new row during UPDATE.
-- Since the athlete's SELECT policy hides draft_coach status, a direct
-- UPDATE from draft_athlete→draft_coach fails. These SECURITY DEFINER
-- functions bypass RLS while enforcing ownership + status guards internally.

-- Submit: draft_athlete → draft_coach (called by athlete)
CREATE OR REPLACE FUNCTION submit_interview_to_coach(p_interview_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE interviews
  SET status = 'draft_coach', submitted_at = now()
  WHERE id = p_interview_id
    AND athlete_id = app_user_id()
    AND status = 'draft_athlete';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interview not found, not yours, or not in draft_athlete status';
  END IF;
END;
$$;

-- Sign: sent → signed (called by athlete)
CREATE OR REPLACE FUNCTION sign_interview(p_interview_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE interviews
  SET status = 'signed', signed_at = now()
  WHERE id = p_interview_id
    AND athlete_id = app_user_id()
    AND status = 'sent';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Interview not found, not yours, or not in sent status';
  END IF;
END;
$$;
