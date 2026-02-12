-- Add last_imported_at tracking to club_record_swimmers
ALTER TABLE club_record_swimmers ADD COLUMN IF NOT EXISTS last_imported_at TIMESTAMPTZ;

-- App settings table for configurable rate limits
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_write" ON app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "app_settings_update" ON app_settings FOR UPDATE USING (true);

-- Default rate limits: coach 3/month, athlete 1/month, admin unlimited (-1)
INSERT INTO app_settings (key, value) VALUES
    ('import_rate_limits', '{"coach_monthly": 3, "athlete_monthly": 1, "admin_monthly": -1}')
ON CONFLICT (key) DO NOTHING;

-- Stroke distance breakdown for swim sessions
ALTER TABLE dim_sessions ADD COLUMN IF NOT EXISTS stroke_distances JSONB;
