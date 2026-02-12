-- =============================================================================
-- Migration 00016: Fix notification_targets RLS for group membership,
--                  improve FFN import error surfacing
-- =============================================================================

-- 1. Fix notification_targets SELECT policy: athletes should see group-targeted notifications
DROP POLICY IF EXISTS notification_targets_select ON notification_targets;

CREATE POLICY notification_targets_select ON notification_targets FOR SELECT
    USING (
        target_user_id = app_user_id()
        OR app_user_role() IN ('admin', 'coach')
        OR target_group_id IN (
            SELECT group_id FROM group_members WHERE user_id = app_user_id()
        )
    );

-- 2. Fix notification_targets UPDATE policy: athletes should be able to mark group notifications as read
DROP POLICY IF EXISTS notification_targets_update ON notification_targets;

CREATE POLICY notification_targets_update ON notification_targets FOR UPDATE
    USING (
        target_user_id = app_user_id()
        OR app_user_role() IN ('admin', 'coach')
        OR target_group_id IN (
            SELECT group_id FROM group_members WHERE user_id = app_user_id()
        )
    );
