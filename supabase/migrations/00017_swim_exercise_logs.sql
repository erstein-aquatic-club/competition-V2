-- Swim exercise logs: technical notes per exercise (times, tempo, stroke count)
CREATE TABLE swim_exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id INTEGER NOT NULL REFERENCES dim_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  exercise_label TEXT NOT NULL,
  source_item_id INTEGER REFERENCES swim_session_items(id),
  split_times JSONB DEFAULT '[]',
  tempo NUMERIC(5,2),
  stroke_count JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE swim_exercise_logs ENABLE ROW LEVEL SECURITY;

-- Swimmers see/edit their own logs
CREATE POLICY "Users manage own exercise logs"
  ON swim_exercise_logs FOR ALL
  USING (user_id = auth.uid());

-- Coaches see all logs
CREATE POLICY "Coaches view all exercise logs"
  ON swim_exercise_logs FOR SELECT
  USING (app_user_role() IN ('coach', 'admin'));

CREATE INDEX idx_exercise_logs_session ON swim_exercise_logs(session_id);
CREATE INDEX idx_exercise_logs_user ON swim_exercise_logs(user_id);
