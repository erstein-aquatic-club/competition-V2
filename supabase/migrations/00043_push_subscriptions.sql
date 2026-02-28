-- 00043_push_subscriptions.sql
-- Web Push subscription storage for VAPID-based push notifications

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_info text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS: users can manage their own subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (user_id = app_user_id());

CREATE POLICY "Users can insert own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = app_user_id());

CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions FOR DELETE
  USING (user_id = app_user_id());

-- Service role bypass for edge functions
CREATE POLICY "Service role full access"
  ON push_subscriptions FOR ALL
  USING (auth.role() = 'service_role');
