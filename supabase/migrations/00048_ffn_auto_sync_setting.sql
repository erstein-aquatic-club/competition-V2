-- Default FFN auto-sync schedule: Monday 15:00 UTC, enabled
INSERT INTO app_settings (key, value) VALUES
  ('ffn_auto_sync', '{"enabled": true, "day": 1, "hour": 15, "last_run": null}')
ON CONFLICT (key) DO NOTHING;
