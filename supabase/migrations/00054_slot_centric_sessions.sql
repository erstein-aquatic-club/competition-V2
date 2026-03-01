-- §85 Slot-Centric Sessions: visible_from, training_slot_id, deferred notifications

-- 1. Add columns to session_assignments
ALTER TABLE session_assignments
  ADD COLUMN IF NOT EXISTS visible_from DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS training_slot_id UUID REFERENCES training_slots(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_sa_visible_from ON session_assignments (visible_from)
  WHERE visible_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sa_training_slot ON session_assignments (training_slot_id)
  WHERE training_slot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sa_scheduled_date ON session_assignments (scheduled_date);

-- 3. Update RLS SELECT policy for athletes to filter by visible_from
DROP POLICY IF EXISTS assignments_select ON session_assignments;

CREATE POLICY assignments_select ON session_assignments FOR SELECT
    USING (
        -- Coaches/admins see everything
        app_user_role() IN ('admin', 'coach')
        OR assigned_by = app_user_id()
        -- Athletes: must pass visible_from gate
        OR (
            (visible_from IS NULL OR visible_from <= CURRENT_DATE)
            AND (
                target_user_id = app_user_id()
                OR target_group_id IN (
                    SELECT group_id FROM group_members WHERE user_id = app_user_id()
                )
            )
        )
    );

-- 4. pg_cron job: send push notification 30min before training slot ends
-- Runs every 15 minutes. Creates notification + notification_targets
-- which triggers push via existing trigger.
SELECT cron.schedule(
  'slot-session-reminder',
  '*/15 * * * *',
  $$
  DO $body$
  DECLARE
    rec RECORD;
    v_notif_id INTEGER;
  BEGIN
    FOR rec IN
      SELECT
        sa.id AS assignment_id,
        sa.target_group_id,
        sa.target_user_id,
        sc.name AS session_name,
        ts.end_time
      FROM session_assignments sa
      JOIN training_slots ts ON ts.id = sa.training_slot_id
      LEFT JOIN swim_sessions_catalog sc ON sc.id = sa.swim_catalog_id
      WHERE sa.training_slot_id IS NOT NULL
        AND sa.scheduled_date = CURRENT_DATE
        AND sa.notified_at IS NULL
        AND (sa.visible_from IS NULL OR sa.visible_from <= CURRENT_DATE)
        AND (ts.end_time - INTERVAL '30 minutes') <= LOCALTIME
    LOOP
      -- Create notification
      INSERT INTO notifications (title, body, type)
      VALUES (
        'Séance terminée ?',
        COALESCE('N''oublie pas d''enregistrer ton ressenti pour : ' || rec.session_name, 'Enregistre ton ressenti !'),
        'assignment'
      )
      RETURNING id INTO v_notif_id;

      -- Create target (triggers push via existing trigger)
      IF rec.target_user_id IS NOT NULL THEN
        INSERT INTO notification_targets (notification_id, target_user_id)
        VALUES (v_notif_id, rec.target_user_id);
      ELSIF rec.target_group_id IS NOT NULL THEN
        INSERT INTO notification_targets (notification_id, target_group_id)
        VALUES (v_notif_id, rec.target_group_id);
      END IF;

      -- Mark as notified
      UPDATE session_assignments
      SET notified_at = NOW()
      WHERE id = rec.id;
    END LOOP;
  END $body$;
  $$
);
