-- Merge a manual club_record_swimmers entry into a user entry (atomic)
CREATE OR REPLACE FUNCTION public.merge_club_record_swimmers(
  p_manual_id INTEGER,
  p_user_swimmer_id INTEGER
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_manual RECORD;
  v_user RECORD;
  v_iuf TEXT;
  v_perfs_updated INTEGER := 0;
BEGIN
  -- 1. Lock & fetch both entries
  SELECT * INTO v_manual FROM club_record_swimmers WHERE id = p_manual_id AND source_type = 'manual' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrée manuelle introuvable (id=%)', p_manual_id; END IF;

  SELECT * INTO v_user FROM club_record_swimmers WHERE id = p_user_swimmer_id AND source_type = 'user' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrée utilisateur introuvable (id=%)', p_user_swimmer_id; END IF;

  v_iuf := v_manual.iuf;

  -- 2. Transfer IUF from manual to user (handle uniqueness: clear manual first)
  IF v_iuf IS NOT NULL THEN
    UPDATE club_record_swimmers SET iuf = NULL WHERE id = p_manual_id;
    UPDATE club_record_swimmers SET iuf = COALESCE(v_user.iuf, v_iuf) WHERE id = p_user_swimmer_id;
  END IF;

  -- 3. Transfer sex & birthdate if missing on user entry
  UPDATE club_record_swimmers SET
    sex = COALESCE(v_user.sex, v_manual.sex),
    birthdate = COALESCE(v_user.birthdate, v_manual.birthdate)
  WHERE id = p_user_swimmer_id;

  -- 4. Reassign swimmer_performances to user
  IF v_iuf IS NOT NULL AND v_user.user_id IS NOT NULL THEN
    UPDATE swimmer_performances
    SET user_id = v_user.user_id
    WHERE swimmer_iuf = v_iuf AND (user_id IS NULL OR user_id <> v_user.user_id);
    GET DIAGNOSTICS v_perfs_updated = ROW_COUNT;
  END IF;

  -- 5. Delete manual entry
  DELETE FROM club_record_swimmers WHERE id = p_manual_id;

  RETURN jsonb_build_object(
    'merged_into', p_user_swimmer_id,
    'iuf_transferred', v_iuf,
    'performances_reassigned', v_perfs_updated
  );
END;
$$;
