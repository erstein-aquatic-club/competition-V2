-- Tables pour l'historique des performances et les records du club
CREATE TABLE IF NOT EXISTS club_performances (
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

CREATE INDEX IF NOT EXISTS club_performances_filters_idx
  ON club_performances (pool_m, sex, age, event_code);

CREATE TABLE IF NOT EXISTS club_records (
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

CREATE INDEX IF NOT EXISTS club_records_filters_idx
  ON club_records (pool_m, sex, age, event_code);
