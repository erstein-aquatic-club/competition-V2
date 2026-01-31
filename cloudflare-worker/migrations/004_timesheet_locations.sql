CREATE TABLE IF NOT EXISTS timesheet_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS timesheet_locations_name_idx ON timesheet_locations (name);
INSERT OR IGNORE INTO timesheet_locations (name)
VALUES ('Piscine'), ('Compétition');
