-- Suivi Natation D1 Schema
PRAGMA foreign_keys = ON;

-- 1. CORE & USERS
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT NOT NULL,
    display_name_lower TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'athlete' CHECK (role IN ('athlete', 'coach', 'admin')),
    email TEXT UNIQUE,
    password_hash TEXT,
    birthdate TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1
);

DROP TABLE IF EXISTS user_profiles;
CREATE TABLE user_profiles (
    user_id INTEGER PRIMARY KEY,
    group_id INTEGER,
    display_name TEXT,
    email TEXT,
    birthdate TEXT,
    group_label TEXT,
    objectives TEXT,
    bio TEXT,
    avatar_url TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS auth_login_attempts;
CREATE TABLE auth_login_attempts (
    identifier TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    first_attempt_at TEXT NOT NULL,
    locked_until TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (identifier, ip_address)
);

DROP TABLE IF EXISTS refresh_tokens;
CREATE TABLE refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    issued_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    replaced_by TEXT,
    token_hash TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);

DROP TABLE IF EXISTS groups;
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

DROP TABLE IF EXISTS DIM_groupes;
CREATE TABLE DIM_groupes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

DROP TABLE IF EXISTS group_members;
CREATE TABLE group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role_in_group TEXT,
    joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT,
    type TEXT NOT NULL CHECK (type IN ('message', 'assignment', 'birthday')),
    created_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    metadata TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

DROP TABLE IF EXISTS notification_targets;
CREATE TABLE notification_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id INTEGER NOT NULL,
    target_user_id INTEGER,
    target_group_id INTEGER,
    read_at TEXT,
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- 2. NATATION
DROP TABLE IF EXISTS DIM_sessions;
CREATE TABLE DIM_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id INTEGER,
    athleteName TEXT NOT NULL,
    timestamp_reception TEXT,
    sessionDate TEXT NOT NULL,
    timeSlot TEXT NOT NULL,
    distance INTEGER,
    duration INTEGER NOT NULL,
    rpe INTEGER NOT NULL,
    performance INTEGER,
    engagement INTEGER,
    fatigue INTEGER,
    training_load INTEGER,
    comments TEXT,
    userAgent TEXT,
    raw_payload TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE SET NULL
);

DROP TABLE IF EXISTS swim_records;
CREATE TABLE swim_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id INTEGER NOT NULL,
    event_name TEXT NOT NULL,
    pool_length INTEGER,
    time_seconds REAL,
    record_date TEXT,
    notes TEXT,
    FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS club_performances;
CREATE TABLE club_performances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_name TEXT NOT NULL,
    sex TEXT NOT NULL,
    pool_m INTEGER NOT NULL,
    event_code TEXT NOT NULL,
    event_label TEXT,
    age INTEGER NOT NULL,
    time_ms INTEGER NOT NULL,
    record_date TEXT,
    source TEXT,
    import_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX club_performances_filters_idx ON club_performances (pool_m, sex, age, event_code);

DROP TABLE IF EXISTS club_records;
CREATE TABLE club_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    performance_id INTEGER NOT NULL,
    athlete_name TEXT NOT NULL,
    sex TEXT NOT NULL,
    pool_m INTEGER NOT NULL,
    event_code TEXT NOT NULL,
    event_label TEXT,
    age INTEGER NOT NULL,
    time_ms INTEGER NOT NULL,
    record_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pool_m, sex, age, event_code)
);
CREATE INDEX club_records_filters_idx ON club_records (pool_m, sex, age, event_code);

DROP TABLE IF EXISTS club_record_swimmers;
CREATE TABLE club_record_swimmers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL CHECK (source_type IN ('user', 'manual')),
    user_id INTEGER,
    display_name TEXT NOT NULL,
    iuf TEXT,
    sex TEXT CHECK (sex IN ('M', 'F')),
    birthdate TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX club_record_swimmers_user_idx ON club_record_swimmers (user_id, source_type);
CREATE INDEX club_record_swimmers_active_idx ON club_record_swimmers (is_active);

DROP TABLE IF EXISTS swim_sessions_catalog;
CREATE TABLE swim_sessions_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

DROP TABLE IF EXISTS swim_session_items;
CREATE TABLE swim_session_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_id INTEGER NOT NULL,
    ordre INTEGER NOT NULL,
    label TEXT,
    distance INTEGER,
    duration INTEGER,
    intensity TEXT,
    notes TEXT,
    raw_payload TEXT,
    FOREIGN KEY (catalog_id) REFERENCES swim_sessions_catalog(id) ON DELETE CASCADE
);

-- 3. MUSCULATION
DROP TABLE IF EXISTS DIM_exercices;
CREATE TABLE DIM_exercices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_exercice INTEGER,
    nom_exercice TEXT NOT NULL,
    description TEXT,
    illustration_gif TEXT,
    exercise_type TEXT NOT NULL CHECK (exercise_type IN ('strength', 'warmup')),
    Nb_series_endurance INTEGER,
    Nb_reps_endurance INTEGER,
    Pourcentage_charge_1RM_endurance REAL,
    recup_series_endurance INTEGER,
    recup_exercices_endurance INTEGER,
    Nb_series_hypertrophie INTEGER,
    Nb_reps_hypertrophie INTEGER,
    Pourcentage_charge_1RM_hypertrophie REAL,
    recup_series_hypertrophie INTEGER,
    recup_exercices_hypertrophie INTEGER,
    Nb_series_force INTEGER,
    Nb_reps_force INTEGER,
    Pourcentage_charge_1RM_force REAL,
    recup_series_force INTEGER,
    recup_exercices_force INTEGER
);

DROP TABLE IF EXISTS strength_sessions;
CREATE TABLE strength_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

DROP TABLE IF EXISTS strength_session_items;
CREATE TABLE strength_session_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    ordre INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    block TEXT NOT NULL CHECK (block IN ('warmup', 'main')),
    cycle_type TEXT NOT NULL CHECK (cycle_type IN ('endurance', 'hypertrophie', 'force')),
    sets INTEGER,
    reps INTEGER,
    pct_1rm REAL,
    rest_series_s INTEGER,
    rest_exercise_s INTEGER,
    notes TEXT,
    raw_payload TEXT,
    FOREIGN KEY (session_id) REFERENCES strength_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES DIM_exercices(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS session_assignments;
CREATE TABLE session_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_type TEXT NOT NULL CHECK (assignment_type IN ('swim', 'strength')),
    swim_catalog_id INTEGER,
    strength_session_id INTEGER,
    target_user_id INTEGER,
    target_group_id INTEGER,
    assigned_by INTEGER,
    scheduled_date TEXT,
    due_at TEXT,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (swim_catalog_id) REFERENCES swim_sessions_catalog(id) ON DELETE SET NULL,
    FOREIGN KEY (strength_session_id) REFERENCES strength_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (target_group_id) REFERENCES groups(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

DROP TABLE IF EXISTS strength_session_runs;
CREATE TABLE strength_session_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER,
    athlete_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    progress_pct REAL,
    started_at TEXT,
    completed_at TEXT,
    raw_payload TEXT,
    FOREIGN KEY (assignment_id) REFERENCES session_assignments(id) ON DELETE SET NULL,
    FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS strength_set_logs;
CREATE TABLE strength_set_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    set_index INTEGER,
    reps INTEGER,
    weight REAL,
    pct_1rm_suggested REAL,
    rest_seconds INTEGER,
    rpe INTEGER,
    notes TEXT,
    completed_at TEXT,
    raw_payload TEXT,
    FOREIGN KEY (run_id) REFERENCES strength_session_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES DIM_exercices(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS one_rm_records;
CREATE TABLE one_rm_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    one_rm REAL NOT NULL,
    source_run_id INTEGER,
    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES DIM_exercices(id) ON DELETE CASCADE,
    FOREIGN KEY (source_run_id) REFERENCES strength_session_runs(id) ON DELETE SET NULL
);

-- 4. LEGACY COACH
DROP TABLE IF EXISTS dim_seance;
CREATE TABLE dim_seance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_seance INTEGER,
    nom_seance TEXT,
    description TEXT
);

DROP TABLE IF EXISTS dim_seance_deroule;
CREATE TABLE dim_seance_deroule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_seance INTEGER,
    ordre INTEGER,
    numero_exercice INTEGER
);

-- INDEXES
CREATE UNIQUE INDEX idx_group_members_unique ON group_members (group_id, user_id);
CREATE INDEX idx_group_members_group ON group_members (group_id);
CREATE INDEX idx_group_members_user ON group_members (user_id);

CREATE INDEX idx_notifications_created ON notifications (created_at);
CREATE INDEX idx_notifications_expires ON notifications (expires_at);
CREATE INDEX idx_notification_targets_user ON notification_targets (target_user_id);
CREATE INDEX idx_notification_targets_group ON notification_targets (target_group_id);
CREATE INDEX idx_notification_targets_notification ON notification_targets (notification_id);

CREATE UNIQUE INDEX idx_dim_sessions_dedupe ON DIM_sessions (athleteName, sessionDate, timeSlot, duration, rpe);
CREATE INDEX idx_dim_sessions_athlete ON DIM_sessions (athlete_id);
CREATE INDEX idx_dim_sessions_athlete_date ON DIM_sessions (athlete_id, sessionDate);
CREATE INDEX idx_dim_sessions_name_date ON DIM_sessions (athleteName, sessionDate);
CREATE INDEX idx_dim_sessions_date ON DIM_sessions (sessionDate);
CREATE INDEX idx_dim_sessions_created ON DIM_sessions (created_at);

CREATE INDEX idx_swim_records_athlete ON swim_records (athlete_id);
CREATE INDEX idx_swim_records_date ON swim_records (record_date);
CREATE INDEX idx_swim_sessions_created_by ON swim_sessions_catalog (created_by);
CREATE INDEX idx_swim_sessions_created ON swim_sessions_catalog (created_at);
CREATE INDEX idx_swim_session_items_catalog ON swim_session_items (catalog_id, ordre);

CREATE INDEX idx_strength_sessions_created_by ON strength_sessions (created_by);
CREATE INDEX idx_strength_sessions_created ON strength_sessions (created_at);
CREATE INDEX idx_strength_session_items_session ON strength_session_items (session_id, ordre);

CREATE INDEX idx_assignments_assigned_by ON session_assignments (assigned_by, scheduled_date);
CREATE INDEX idx_assignments_target_user ON session_assignments (target_user_id, scheduled_date);
CREATE INDEX idx_assignments_target_group ON session_assignments (target_group_id, scheduled_date);
CREATE INDEX idx_assignments_status ON session_assignments (status);

CREATE INDEX idx_strength_runs_assignment ON strength_session_runs (assignment_id);
CREATE INDEX idx_strength_runs_assignment_status ON strength_session_runs (assignment_id, status);
CREATE INDEX idx_strength_runs_athlete ON strength_session_runs (athlete_id, started_at);

CREATE INDEX idx_strength_set_logs_run ON strength_set_logs (run_id);
CREATE INDEX idx_strength_set_logs_exercise ON strength_set_logs (exercise_id);
CREATE INDEX idx_strength_set_logs_completed ON strength_set_logs (completed_at);

CREATE INDEX idx_one_rm_athlete ON one_rm_records (athlete_id, recorded_at);
CREATE INDEX idx_user_profiles_updated ON user_profiles (updated_at);
CREATE INDEX idx_users_created ON users (created_at);
CREATE INDEX idx_dim_seance_numero ON dim_seance (numero_seance);

-- 5. TIMESHEET LOCATIONS
DROP TABLE IF EXISTS timesheet_locations;
CREATE TABLE timesheet_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_timesheet_locations_name ON timesheet_locations (name);
INSERT INTO timesheet_locations (name)
VALUES ('Piscine'), ('Compétition');

-- 6. TIMESHEET SHIFTS
DROP TABLE IF EXISTS timesheet_shifts;
CREATE TABLE timesheet_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_id INTEGER NOT NULL,
    shift_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    location TEXT,
    is_travel INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_timesheet_shifts_coach ON timesheet_shifts (coach_id);
CREATE INDEX idx_timesheet_shifts_date ON timesheet_shifts (shift_date);
