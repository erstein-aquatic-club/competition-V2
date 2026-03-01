-- Atomic RPC for updating strength sessions
-- Wraps UPDATE metadata + DELETE old items + INSERT new items in single transaction
-- Prevents data loss if INSERT fails after DELETE

CREATE OR REPLACE FUNCTION update_strength_session_atomic(
  p_session_id INTEGER,
  p_name TEXT,
  p_description TEXT,
  p_folder_id INTEGER,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE strength_sessions
  SET name = p_name, description = p_description, folder_id = p_folder_id
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session % not found', p_session_id;
  END IF;

  DELETE FROM strength_session_items WHERE session_id = p_session_id;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO strength_session_items (
      session_id, ordre, exercise_id, block, cycle_type,
      sets, reps, pct_1rm, rest_series_s, rest_exercise_s, notes, raw_payload
    )
    SELECT
      p_session_id,
      (item->>'ordre')::INTEGER,
      (item->>'exercise_id')::INTEGER,
      COALESCE(item->>'block', 'main'),
      COALESCE(item->>'cycle_type', 'normal'),
      (item->>'sets')::INTEGER,
      (item->>'reps')::INTEGER,
      (item->>'pct_1rm')::DOUBLE PRECISION,
      (item->>'rest_series_s')::INTEGER,
      (item->>'rest_exercise_s')::INTEGER,
      item->>'notes',
      item->'raw_payload'
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  RETURN jsonb_build_object('status', 'updated', 'session_id', p_session_id);
END;
$$;

GRANT EXECUTE ON FUNCTION update_strength_session_atomic TO authenticated;
