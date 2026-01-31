CREATE TABLE IF NOT EXISTS timesheet_shifts (
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
CREATE INDEX IF NOT EXISTS timesheet_shifts_coach_id_idx ON timesheet_shifts (coach_id);
CREATE INDEX IF NOT EXISTS timesheet_shifts_date_idx ON timesheet_shifts (shift_date);
