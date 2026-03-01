-- FFN auto-sync cron job
-- Runs hourly, checks app_settings.ffn_auto_sync config to decide if it should fire.
-- Calls import-club-records edge function when day/hour match.
-- Requires pg_cron and pg_net extensions (available on Supabase Pro plan).

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Hourly check: if current day/hour match the ffn_auto_sync config, call import-club-records
SELECT cron.schedule(
  'ffn-auto-sync-check',
  '0 * * * *',
  $$
  DO $body$
  DECLARE
    v_config jsonb;
    v_project_url text;
    v_service_key text;
  BEGIN
    -- Read config
    SELECT value INTO v_config
    FROM app_settings
    WHERE key = 'ffn_auto_sync';

    -- Skip if disabled or not configured
    IF v_config IS NULL OR (v_config->>'enabled')::boolean IS NOT TRUE THEN
      RETURN;
    END IF;

    -- Check day and hour match
    IF EXTRACT(DOW FROM NOW()) != (v_config->>'day')::int
       OR EXTRACT(HOUR FROM NOW()) != (v_config->>'hour')::int THEN
      RETURN;
    END IF;

    -- Guard against double execution (must be >20h since last run)
    IF v_config->>'last_run' IS NOT NULL
       AND v_config->>'last_run' != 'null'
       AND NOW() - (v_config->>'last_run')::timestamptz < INTERVAL '20 hours' THEN
      RETURN;
    END IF;

    -- Use the project URL (same as push trigger migration 00044)
    v_project_url := 'https://fscnobivsgornxdwqwlk.supabase.co';

    -- Call the import-club-records edge function via pg_net
    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/import-club-records',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := '{}'::jsonb
    );

    -- Update last_run timestamp
    UPDATE app_settings
    SET value = jsonb_set(value, '{last_run}', to_jsonb(NOW()::text)),
        updated_at = NOW()
    WHERE key = 'ffn_auto_sync';
  END $body$;
  $$
);
