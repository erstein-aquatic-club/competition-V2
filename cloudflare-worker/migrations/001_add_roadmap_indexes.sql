-- Roadmap indexes alignment (D1)
CREATE INDEX IF NOT EXISTS idx_users_created ON users (created_at);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications (expires_at);
CREATE INDEX IF NOT EXISTS idx_notification_targets_notification ON notification_targets (notification_id);
CREATE INDEX IF NOT EXISTS idx_dim_sessions_athlete_date ON DIM_sessions (athlete_id, sessionDate);
CREATE INDEX IF NOT EXISTS idx_dim_sessions_created ON DIM_sessions (created_at);
CREATE INDEX IF NOT EXISTS idx_swim_records_date ON swim_records (record_date);
CREATE INDEX IF NOT EXISTS idx_swim_sessions_created_by ON swim_sessions_catalog (created_by);
CREATE INDEX IF NOT EXISTS idx_strength_sessions_created_by ON strength_sessions (created_by);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_by ON session_assignments (assigned_by, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_strength_runs_assignment_status ON strength_session_runs (assignment_id, status);
CREATE INDEX IF NOT EXISTS idx_strength_set_logs_completed ON strength_set_logs (completed_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated ON user_profiles (updated_at);
CREATE INDEX IF NOT EXISTS idx_dim_seance_numero ON dim_seance (numero_seance);
