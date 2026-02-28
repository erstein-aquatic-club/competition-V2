-- 00044_push_webhook_trigger.sql
-- Database trigger to call push-send Edge Function on notification_targets INSERT.
-- Uses pg_net for async HTTP calls and vault for key storage.

-- Enable pg_net extension for async HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: sends a POST to the push-send Edge Function
CREATE OR REPLACE FUNCTION notify_push_on_target_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url text := 'https://fscnobivsgornxdwqwlk.supabase.co/functions/v1/push-send';
  api_key text;
BEGIN
  -- Read API key from vault (stored as 'push_edge_function_key')
  SELECT decrypted_secret INTO api_key
  FROM vault.decrypted_secrets
  WHERE name = 'push_edge_function_key'
  LIMIT 1;

  IF api_key IS NULL THEN
    RAISE WARNING '[push] No push_edge_function_key found in vault, skipping push notification';
    RETURN NEW;
  END IF;

  -- Fire-and-forget async HTTP POST via pg_net
  PERFORM net.http_post(
    url := edge_url,
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object(
        'id', NEW.id,
        'notification_id', NEW.notification_id,
        'target_user_id', NEW.target_user_id,
        'target_group_id', NEW.target_group_id
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || api_key
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on notification_targets INSERT
CREATE TRIGGER trg_push_notification_on_target_insert
  AFTER INSERT ON notification_targets
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_target_insert();
