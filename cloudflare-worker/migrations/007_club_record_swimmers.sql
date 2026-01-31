CREATE TABLE IF NOT EXISTS club_record_swimmers (
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

CREATE UNIQUE INDEX IF NOT EXISTS club_record_swimmers_user_idx
  ON club_record_swimmers (user_id, source_type);

CREATE INDEX IF NOT EXISTS club_record_swimmers_active_idx
  ON club_record_swimmers (is_active);
