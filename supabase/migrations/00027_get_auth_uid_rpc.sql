-- =============================================================================
-- Migration 00027: RPC to look up auth UUID from public.users.id
--
-- Needed because objectives.athlete_id references auth.users(id) (UUID)
-- but the coach UI uses public.users.id (integer) to identify athletes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_auth_uid_for_user(p_user_id INTEGER)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_auth_uid UUID;
BEGIN
    SELECT au.id INTO v_auth_uid
    FROM auth.users au
    WHERE (au.raw_app_meta_data ->> 'app_user_id')::integer = p_user_id
    LIMIT 1;

    RETURN v_auth_uid;
END;
$$;
