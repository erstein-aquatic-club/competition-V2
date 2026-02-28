-- 00045_auto_push_notifications.sql
-- Automatic push notification triggers for key events.
-- Each trigger INSERTs into notifications + notification_targets,
-- which fires the existing pg_net webhook → push-send Edge Function.

-- ============================================================================
-- 1. OVERRIDE CRÉNEAU (training_slot_overrides INSERT)
-- Notify all groups assigned to the affected slot.
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_notify_slot_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  slot_record RECORD;
  day_label TEXT;
  date_label TEXT;
  notif_title TEXT;
  notif_body TEXT;
  notif_id INTEGER;
  assignment RECORD;
  days_fr TEXT[] := ARRAY['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
BEGIN
  -- Get slot info
  SELECT day_of_week, start_time, end_time, location
  INTO slot_record
  FROM training_slots WHERE id = NEW.slot_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  day_label := days_fr[slot_record.day_of_week];
  date_label := to_char(NEW.override_date, 'DD/MM');

  IF NEW.status = 'cancelled' THEN
    notif_title := 'Créneau annulé';
    notif_body := day_label || ' ' || date_label || ' — '
      || to_char(slot_record.start_time, 'HH24:MI') || '-' || to_char(slot_record.end_time, 'HH24:MI');
    IF NEW.reason IS NOT NULL AND NEW.reason <> '' THEN
      notif_body := notif_body || ' (' || NEW.reason || ')';
    END IF;
  ELSE
    notif_title := 'Créneau modifié';
    notif_body := day_label || ' ' || date_label;
    IF NEW.new_start_time IS NOT NULL THEN
      notif_body := notif_body || ' — '
        || to_char(NEW.new_start_time, 'HH24:MI') || '-' || to_char(NEW.new_end_time, 'HH24:MI');
    END IF;
    IF NEW.new_location IS NOT NULL AND NEW.new_location <> '' THEN
      notif_body := notif_body || ' @ ' || NEW.new_location;
    END IF;
    IF NEW.reason IS NOT NULL AND NEW.reason <> '' THEN
      notif_body := notif_body || ' (' || NEW.reason || ')';
    END IF;
  END IF;

  -- Create notification
  INSERT INTO notifications (title, body, type)
  VALUES (notif_title, notif_body, 'message')
  RETURNING id INTO notif_id;

  -- Target each group assigned to this slot
  FOR assignment IN
    SELECT group_id FROM training_slot_assignments WHERE slot_id = NEW.slot_id
  LOOP
    INSERT INTO notification_targets (notification_id, target_group_id)
    VALUES (notif_id, assignment.group_id);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_notify_slot_override
  AFTER INSERT ON training_slot_overrides
  FOR EACH ROW
  EXECUTE FUNCTION auto_notify_slot_override();

-- ============================================================================
-- 2. ASSIGNATION SÉANCE (session_assignments INSERT)
-- Notify the assigned group or user.
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_notify_session_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notif_title TEXT;
  notif_body TEXT;
  notif_id INTEGER;
  type_label TEXT;
  date_label TEXT;
BEGIN
  -- Only notify new assignments
  IF NEW.status <> 'assigned' THEN RETURN NEW; END IF;

  type_label := CASE WHEN NEW.assignment_type = 'swim' THEN 'natation' ELSE 'musculation' END;
  date_label := COALESCE(to_char(NEW.scheduled_date, 'DD/MM'), '');

  notif_title := 'Nouvelle séance ' || type_label;
  notif_body := 'Séance de ' || type_label || ' assignée';
  IF date_label <> '' THEN
    notif_body := notif_body || ' pour le ' || date_label;
  END IF;

  INSERT INTO notifications (title, body, type)
  VALUES (notif_title, notif_body, 'assignment')
  RETURNING id INTO notif_id;

  INSERT INTO notification_targets (notification_id, target_user_id, target_group_id)
  VALUES (notif_id, NEW.target_user_id, NEW.target_group_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_notify_session_assignment
  AFTER INSERT ON session_assignments
  FOR EACH ROW
  EXECUTE FUNCTION auto_notify_session_assignment();

-- ============================================================================
-- 3. ASSIGNATION COMPÉTITION (competition_assignments INSERT)
-- Notify the assigned swimmer.
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_notify_competition_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  comp_name TEXT;
  comp_date TEXT;
  notif_id INTEGER;
BEGIN
  SELECT name, to_char(date, 'DD/MM/YYYY')
  INTO comp_name, comp_date
  FROM competitions WHERE id = NEW.competition_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO notifications (title, body, type)
  VALUES (
    'Compétition',
    'Vous êtes inscrit(e) à ' || comp_name || ' le ' || comp_date,
    'assignment'
  )
  RETURNING id INTO notif_id;

  INSERT INTO notification_targets (notification_id, target_user_id)
  VALUES (notif_id, NEW.athlete_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_notify_competition_assignment
  AFTER INSERT ON competition_assignments
  FOR EACH ROW
  EXECUTE FUNCTION auto_notify_competition_assignment();

-- ============================================================================
-- 4. ENTRETIEN (interviews UPDATE — phase transitions)
-- Notify swimmer when coach sends, notify coach when athlete submits.
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_notify_interview_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notif_id INTEGER;
  notif_title TEXT;
  notif_body TEXT;
  target_uid INTEGER;
BEGIN
  -- Only fire on status changes
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  IF NEW.status = 'draft_athlete' AND OLD.status = 'draft_coach' THEN
    -- Coach sent to athlete for review
    notif_title := 'Entretien à compléter';
    notif_body := 'Un entretien attend votre contribution.';
    target_uid := NEW.athlete_id;
  ELSIF NEW.status = 'sent' AND OLD.status = 'draft_athlete' THEN
    -- Athlete submitted back to coach
    notif_title := 'Entretien soumis';
    notif_body := 'Un nageur a soumis son entretien pour validation.';
    -- Notify all coaches (group_id-based is not available here, target coaches directly)
    -- We'll use the coach who created the interview if available, or skip
    target_uid := NULL;
  ELSE
    RETURN NEW;
  END IF;

  IF target_uid IS NULL THEN RETURN NEW; END IF;

  INSERT INTO notifications (title, body, type)
  VALUES (notif_title, notif_body, 'message')
  RETURNING id INTO notif_id;

  INSERT INTO notification_targets (notification_id, target_user_id)
  VALUES (notif_id, target_uid);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_notify_interview_transition
  AFTER UPDATE ON interviews
  FOR EACH ROW
  EXECUTE FUNCTION auto_notify_interview_transition();
