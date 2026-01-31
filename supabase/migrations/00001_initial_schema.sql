-- =============================================================================
-- Supabase Migration: Initial Schema
-- Converted from Cloudflare D1 (SQLite) → PostgreSQL
-- Includes all 7 D1 migrations consolidated
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. CORE & USERS
-- =============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT NOT NULL,
    display_name_lower TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'athlete' CHECK (role IN ('athlete', 'coach', 'admin')),
    email TEXT UNIQUE,
    password_hash TEXT,
    birthdate DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_users_created ON users (created_at);

CREATE TABLE user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER,
    display_name TEXT,
    email TEXT,
    birthdate DATE,
    group_label TEXT,
    objectives TEXT,
    bio TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_user_profiles_updated ON user_profiles (updated_at);

CREATE TABLE auth_login_attempts (
    identifier TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    first_attempt_at TIMESTAMPTZ NOT NULL,
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (identifier, ip_address)
);

CREATE TABLE refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by TEXT,
    token_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);

-- =============================================================================
-- 2. GROUPS & MEMBERSHIP
-- =============================================================================

CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE dim_groupes (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_group TEXT,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (group_id, user_id)
);
CREATE INDEX idx_group_members_group ON group_members (group_id);
CREATE INDEX idx_group_members_user ON group_members (user_id);

-- =============================================================================
-- 3. NOTIFICATIONS
-- =============================================================================

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT,
    type TEXT NOT NULL CHECK (type IN ('message', 'assignment', 'birthday')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    metadata JSONB
);
CREATE INDEX idx_notifications_created ON notifications (created_at);
CREATE INDEX idx_notifications_expires ON notifications (expires_at);

CREATE TABLE notification_targets (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    target_group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ
);
CREATE INDEX idx_notification_targets_user ON notification_targets (target_user_id);
CREATE INDEX idx_notification_targets_group ON notification_targets (target_group_id);
CREATE INDEX idx_notification_targets_notification ON notification_targets (notification_id);

-- =============================================================================
-- 4. NATATION (SWIMMING)
-- =============================================================================

CREATE TABLE dim_sessions (
    id SERIAL PRIMARY KEY,
    athlete_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    athlete_name TEXT NOT NULL,
    timestamp_reception TIMESTAMPTZ,
    session_date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    distance INTEGER,
    duration INTEGER NOT NULL,
    rpe INTEGER NOT NULL,
    performance INTEGER,
    engagement INTEGER,
    fatigue INTEGER,
    training_load INTEGER,
    comments TEXT,
    user_agent TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_dim_sessions_dedupe ON dim_sessions (athlete_name, session_date, time_slot, duration, rpe);
CREATE INDEX idx_dim_sessions_athlete ON dim_sessions (athlete_id);
CREATE INDEX idx_dim_sessions_athlete_date ON dim_sessions (athlete_id, session_date);
CREATE INDEX idx_dim_sessions_name_date ON dim_sessions (athlete_name, session_date);
CREATE INDEX idx_dim_sessions_date ON dim_sessions (session_date);
CREATE INDEX idx_dim_sessions_created ON dim_sessions (created_at);

CREATE TABLE swim_records (
    id SERIAL PRIMARY KEY,
    athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    pool_length INTEGER,
    time_seconds DOUBLE PRECISION,
    record_date DATE,
    notes TEXT
);
CREATE INDEX idx_swim_records_athlete ON swim_records (athlete_id);
CREATE INDEX idx_swim_records_date ON swim_records (record_date);

CREATE TABLE club_performances (
    id SERIAL PRIMARY KEY,
    athlete_name TEXT NOT NULL,
    sex TEXT NOT NULL,
    pool_m INTEGER NOT NULL,
    event_code TEXT NOT NULL,
    event_label TEXT,
    age INTEGER NOT NULL,
    time_ms INTEGER NOT NULL,
    record_date DATE,
    source TEXT,
    import_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX club_performances_filters_idx ON club_performances (pool_m, sex, age, event_code);

CREATE TABLE club_records (
    id SERIAL PRIMARY KEY,
    performance_id INTEGER NOT NULL,
    athlete_name TEXT NOT NULL,
    sex TEXT NOT NULL,
    pool_m INTEGER NOT NULL,
    event_code TEXT NOT NULL,
    event_label TEXT,
    age INTEGER NOT NULL,
    time_ms INTEGER NOT NULL,
    record_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (pool_m, sex, age, event_code)
);
CREATE INDEX club_records_filters_idx ON club_records (pool_m, sex, age, event_code);

CREATE TABLE club_record_swimmers (
    id SERIAL PRIMARY KEY,
    source_type TEXT NOT NULL CHECK (source_type IN ('user', 'manual')),
    user_id INTEGER,
    display_name TEXT NOT NULL,
    iuf TEXT,
    sex TEXT CHECK (sex IN ('M', 'F')),
    birthdate DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX club_record_swimmers_user_idx ON club_record_swimmers (user_id, source_type);
CREATE INDEX club_record_swimmers_active_idx ON club_record_swimmers (is_active);

CREATE TABLE swim_sessions_catalog (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_swim_sessions_created_by ON swim_sessions_catalog (created_by);
CREATE INDEX idx_swim_sessions_created ON swim_sessions_catalog (created_at);

CREATE TABLE swim_session_items (
    id SERIAL PRIMARY KEY,
    catalog_id INTEGER NOT NULL REFERENCES swim_sessions_catalog(id) ON DELETE CASCADE,
    ordre INTEGER NOT NULL,
    label TEXT,
    distance INTEGER,
    duration INTEGER,
    intensity TEXT,
    notes TEXT,
    raw_payload JSONB
);
CREATE INDEX idx_swim_session_items_catalog ON swim_session_items (catalog_id, ordre);

-- =============================================================================
-- 5. MUSCULATION (STRENGTH TRAINING)
-- =============================================================================

CREATE TABLE dim_exercices (
    id SERIAL PRIMARY KEY,
    numero_exercice INTEGER,
    nom_exercice TEXT NOT NULL,
    description TEXT,
    illustration_gif TEXT,
    exercise_type TEXT NOT NULL CHECK (exercise_type IN ('strength', 'warmup')),
    nb_series_endurance INTEGER,
    nb_reps_endurance INTEGER,
    pourcentage_charge_1rm_endurance DOUBLE PRECISION,
    recup_series_endurance INTEGER,
    recup_exercices_endurance INTEGER,
    nb_series_hypertrophie INTEGER,
    nb_reps_hypertrophie INTEGER,
    pourcentage_charge_1rm_hypertrophie DOUBLE PRECISION,
    recup_series_hypertrophie INTEGER,
    recup_exercices_hypertrophie INTEGER,
    nb_series_force INTEGER,
    nb_reps_force INTEGER,
    pourcentage_charge_1rm_force DOUBLE PRECISION,
    recup_series_force INTEGER,
    recup_exercices_force INTEGER
);

CREATE TABLE strength_sessions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_strength_sessions_created_by ON strength_sessions (created_by);
CREATE INDEX idx_strength_sessions_created ON strength_sessions (created_at);

CREATE TABLE strength_session_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES strength_sessions(id) ON DELETE CASCADE,
    ordre INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL REFERENCES dim_exercices(id) ON DELETE CASCADE,
    block TEXT NOT NULL CHECK (block IN ('warmup', 'main')),
    cycle_type TEXT NOT NULL CHECK (cycle_type IN ('endurance', 'hypertrophie', 'force')),
    sets INTEGER,
    reps INTEGER,
    pct_1rm DOUBLE PRECISION,
    rest_series_s INTEGER,
    rest_exercise_s INTEGER,
    notes TEXT,
    raw_payload JSONB
);
CREATE INDEX idx_strength_session_items_session ON strength_session_items (session_id, ordre);

CREATE TABLE session_assignments (
    id SERIAL PRIMARY KEY,
    assignment_type TEXT NOT NULL CHECK (assignment_type IN ('swim', 'strength')),
    swim_catalog_id INTEGER REFERENCES swim_sessions_catalog(id) ON DELETE SET NULL,
    strength_session_id INTEGER REFERENCES strength_sessions(id) ON DELETE SET NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    scheduled_date DATE,
    due_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_assignments_assigned_by ON session_assignments (assigned_by, scheduled_date);
CREATE INDEX idx_assignments_target_user ON session_assignments (target_user_id, scheduled_date);
CREATE INDEX idx_assignments_target_group ON session_assignments (target_group_id, scheduled_date);
CREATE INDEX idx_assignments_status ON session_assignments (status);

CREATE TABLE strength_session_runs (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER REFERENCES session_assignments(id) ON DELETE SET NULL,
    athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    progress_pct DOUBLE PRECISION,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    raw_payload JSONB
);
CREATE INDEX idx_strength_runs_assignment ON strength_session_runs (assignment_id);
CREATE INDEX idx_strength_runs_assignment_status ON strength_session_runs (assignment_id, status);
CREATE INDEX idx_strength_runs_athlete ON strength_session_runs (athlete_id, started_at);

CREATE TABLE strength_set_logs (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES strength_session_runs(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES dim_exercices(id) ON DELETE CASCADE,
    set_index INTEGER,
    reps INTEGER,
    weight DOUBLE PRECISION,
    pct_1rm_suggested DOUBLE PRECISION,
    rest_seconds INTEGER,
    rpe INTEGER,
    notes TEXT,
    completed_at TIMESTAMPTZ,
    raw_payload JSONB
);
CREATE INDEX idx_strength_set_logs_run ON strength_set_logs (run_id);
CREATE INDEX idx_strength_set_logs_exercise ON strength_set_logs (exercise_id);
CREATE INDEX idx_strength_set_logs_completed ON strength_set_logs (completed_at);

CREATE TABLE one_rm_records (
    id SERIAL PRIMARY KEY,
    athlete_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES dim_exercices(id) ON DELETE CASCADE,
    one_rm DOUBLE PRECISION NOT NULL,
    source_run_id INTEGER REFERENCES strength_session_runs(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_one_rm_athlete ON one_rm_records (athlete_id, recorded_at);

-- =============================================================================
-- 6. LEGACY COACH SESSIONS
-- =============================================================================

CREATE TABLE dim_seance (
    id SERIAL PRIMARY KEY,
    numero_seance INTEGER,
    nom_seance TEXT,
    description TEXT
);
CREATE INDEX idx_dim_seance_numero ON dim_seance (numero_seance);

CREATE TABLE dim_seance_deroule (
    id SERIAL PRIMARY KEY,
    numero_seance INTEGER,
    ordre INTEGER,
    numero_exercice INTEGER
);

-- =============================================================================
-- 7. TIMESHEET
-- =============================================================================

CREATE TABLE timesheet_locations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO timesheet_locations (name) VALUES ('Piscine'), ('Compétition');

CREATE TABLE timesheet_shifts (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    location TEXT,
    is_travel BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_timesheet_shifts_coach ON timesheet_shifts (coach_id);
CREATE INDEX idx_timesheet_shifts_date ON timesheet_shifts (shift_date);

-- =============================================================================
-- 8. HELPER FUNCTION: auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply auto-update triggers to all tables with updated_at
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_dim_sessions_updated_at BEFORE UPDATE ON dim_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_swim_sessions_catalog_updated_at BEFORE UPDATE ON swim_sessions_catalog
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_strength_sessions_updated_at BEFORE UPDATE ON strength_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_session_assignments_updated_at BEFORE UPDATE ON session_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_club_record_swimmers_updated_at BEFORE UPDATE ON club_record_swimmers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_timesheet_locations_updated_at BEFORE UPDATE ON timesheet_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_timesheet_shifts_updated_at BEFORE UPDATE ON timesheet_shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_groupes ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE swim_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_record_swimmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE swim_sessions_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE swim_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_session_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_set_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_rm_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_seance ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_seance_deroule ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_shifts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: extract app user_id from Supabase JWT
-- The app stores the internal users.id in auth.users.raw_app_meta_data->>'app_user_id'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_user_id() RETURNS INTEGER AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'app_user_id')::integer,
        NULL
    );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_user_role() RETURNS TEXT AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'app_user_role',
        'athlete'
    );
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------------
-- USERS: everyone can read active users, only admins can write
-- ---------------------------------------------------------------------------
CREATE POLICY users_select ON users FOR SELECT
    USING (true);

CREATE POLICY users_insert ON users FOR INSERT
    WITH CHECK (app_user_role() IN ('admin', 'coach'));

CREATE POLICY users_update ON users FOR UPDATE
    USING (id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY users_delete ON users FOR DELETE
    USING (app_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- USER_PROFILES: own profile or coach/admin
-- ---------------------------------------------------------------------------
CREATE POLICY user_profiles_select ON user_profiles FOR SELECT
    USING (true);

CREATE POLICY user_profiles_upsert ON user_profiles FOR ALL
    USING (user_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- AUTH tables: service role only (no direct client access)
-- ---------------------------------------------------------------------------
CREATE POLICY auth_attempts_service ON auth_login_attempts FOR ALL
    USING (false);

CREATE POLICY refresh_tokens_service ON refresh_tokens FOR ALL
    USING (false);

-- ---------------------------------------------------------------------------
-- GROUPS: everyone reads, coach/admin writes
-- ---------------------------------------------------------------------------
CREATE POLICY groups_select ON groups FOR SELECT
    USING (true);

CREATE POLICY groups_write ON groups FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

CREATE POLICY dim_groupes_select ON dim_groupes FOR SELECT
    USING (true);

CREATE POLICY dim_groupes_write ON dim_groupes FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

CREATE POLICY group_members_select ON group_members FOR SELECT
    USING (true);

CREATE POLICY group_members_write ON group_members FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS: read own, coach/admin can send
-- ---------------------------------------------------------------------------
CREATE POLICY notifications_select ON notifications FOR SELECT
    USING (true);

CREATE POLICY notifications_insert ON notifications FOR INSERT
    WITH CHECK (app_user_role() IN ('admin', 'coach'));

CREATE POLICY notification_targets_select ON notification_targets FOR SELECT
    USING (target_user_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY notification_targets_insert ON notification_targets FOR INSERT
    WITH CHECK (app_user_role() IN ('admin', 'coach'));

CREATE POLICY notification_targets_update ON notification_targets FOR UPDATE
    USING (target_user_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- SWIM SESSIONS (dim_sessions): own data or coach/admin
-- ---------------------------------------------------------------------------
CREATE POLICY dim_sessions_select ON dim_sessions FOR SELECT
    USING (athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY dim_sessions_insert ON dim_sessions FOR INSERT
    WITH CHECK (athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY dim_sessions_update ON dim_sessions FOR UPDATE
    USING (athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY dim_sessions_delete ON dim_sessions FOR DELETE
    USING (app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- SWIM RECORDS: own records or coach/admin
-- ---------------------------------------------------------------------------
CREATE POLICY swim_records_select ON swim_records FOR SELECT
    USING (athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY swim_records_write ON swim_records FOR ALL
    USING (athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- CLUB PERFORMANCES & RECORDS: public read, coach/admin write
-- ---------------------------------------------------------------------------
CREATE POLICY club_performances_select ON club_performances FOR SELECT
    USING (true);

CREATE POLICY club_performances_write ON club_performances FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

CREATE POLICY club_records_select ON club_records FOR SELECT
    USING (true);

CREATE POLICY club_records_write ON club_records FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

CREATE POLICY club_record_swimmers_select ON club_record_swimmers FOR SELECT
    USING (true);

CREATE POLICY club_record_swimmers_write ON club_record_swimmers FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- SWIM CATALOG: public read, coach/admin write
-- ---------------------------------------------------------------------------
CREATE POLICY swim_catalog_select ON swim_sessions_catalog FOR SELECT
    USING (true);

CREATE POLICY swim_catalog_write ON swim_sessions_catalog FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

CREATE POLICY swim_items_select ON swim_session_items FOR SELECT
    USING (true);

CREATE POLICY swim_items_write ON swim_session_items FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- EXERCISES: public read, coach/admin write
-- ---------------------------------------------------------------------------
CREATE POLICY exercices_select ON dim_exercices FOR SELECT
    USING (true);

CREATE POLICY exercices_write ON dim_exercices FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- STRENGTH CATALOG: public read, coach/admin write
-- ---------------------------------------------------------------------------
CREATE POLICY strength_sessions_select ON strength_sessions FOR SELECT
    USING (true);

CREATE POLICY strength_sessions_write ON strength_sessions FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

CREATE POLICY strength_items_select ON strength_session_items FOR SELECT
    USING (true);

CREATE POLICY strength_items_write ON strength_session_items FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- ASSIGNMENTS: own or coach/admin
-- ---------------------------------------------------------------------------
CREATE POLICY assignments_select ON session_assignments FOR SELECT
    USING (target_user_id = app_user_id() OR assigned_by = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY assignments_write ON session_assignments FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- STRENGTH RUNS & LOGS: own data or coach/admin
-- ---------------------------------------------------------------------------
CREATE POLICY runs_select ON strength_session_runs FOR SELECT
    USING (athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY runs_insert ON strength_session_runs FOR INSERT
    WITH CHECK (athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY runs_update ON strength_session_runs FOR UPDATE
    USING (athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY runs_delete ON strength_session_runs FOR DELETE
    USING (athlete_id = app_user_id() OR app_user_role() = 'admin');

CREATE POLICY set_logs_select ON strength_set_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM strength_session_runs r
            WHERE r.id = strength_set_logs.run_id
            AND (r.athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'))
        )
    );

CREATE POLICY set_logs_write ON strength_set_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM strength_session_runs r
            WHERE r.id = strength_set_logs.run_id
            AND (r.athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'))
        )
    );

-- ---------------------------------------------------------------------------
-- ONE RM RECORDS: own data or coach/admin
-- ---------------------------------------------------------------------------
CREATE POLICY one_rm_select ON one_rm_records FOR SELECT
    USING (athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

CREATE POLICY one_rm_write ON one_rm_records FOR ALL
    USING (athlete_id = app_user_id() OR app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- LEGACY COACH: public read, coach/admin write
-- ---------------------------------------------------------------------------
CREATE POLICY seance_select ON dim_seance FOR SELECT
    USING (true);

CREATE POLICY seance_write ON dim_seance FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

CREATE POLICY seance_deroule_select ON dim_seance_deroule FOR SELECT
    USING (true);

CREATE POLICY seance_deroule_write ON dim_seance_deroule FOR ALL
    USING (app_user_role() IN ('admin', 'coach'));

-- ---------------------------------------------------------------------------
-- TIMESHEET: own shifts or admin
-- ---------------------------------------------------------------------------
CREATE POLICY timesheet_locations_select ON timesheet_locations FOR SELECT
    USING (true);

CREATE POLICY timesheet_locations_write ON timesheet_locations FOR ALL
    USING (app_user_role() = 'admin');

CREATE POLICY timesheet_shifts_select ON timesheet_shifts FOR SELECT
    USING (coach_id = app_user_id() OR app_user_role() = 'admin');

CREATE POLICY timesheet_shifts_insert ON timesheet_shifts FOR INSERT
    WITH CHECK (coach_id = app_user_id() OR app_user_role() = 'admin');

CREATE POLICY timesheet_shifts_update ON timesheet_shifts FOR UPDATE
    USING (coach_id = app_user_id() OR app_user_role() = 'admin');

CREATE POLICY timesheet_shifts_delete ON timesheet_shifts FOR DELETE
    USING (coach_id = app_user_id() OR app_user_role() = 'admin');
