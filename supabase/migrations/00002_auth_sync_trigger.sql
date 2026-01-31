-- =============================================================================
-- Supabase Migration: Auth → Users sync trigger
--
-- When a new user signs up via Supabase Auth, this trigger:
-- 1. Creates a corresponding row in the public.users table
-- 2. Creates a user_profiles row with group info from user_metadata
-- 3. Injects app_user_id and app_user_role into auth JWT (app_metadata)
--    so that RLS policies can use app_user_id() and app_user_role()
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Trigger function: runs after INSERT on auth.users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    new_user_id INTEGER;
    display_name TEXT;
    raw_meta JSONB;
    user_birthdate DATE;
    user_group_id INTEGER;
BEGIN
    raw_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    display_name := COALESCE(
        raw_meta ->> 'display_name',
        raw_meta ->> 'full_name',
        split_part(NEW.email, '@', 1)
    );

    -- Parse optional fields from signup metadata
    user_birthdate := CASE
        WHEN raw_meta ->> 'birthdate' IS NOT NULL
        THEN (raw_meta ->> 'birthdate')::date
        ELSE NULL
    END;

    user_group_id := CASE
        WHEN raw_meta ->> 'group_id' IS NOT NULL
        THEN (raw_meta ->> 'group_id')::integer
        ELSE NULL
    END;

    -- Insert into public.users
    INSERT INTO public.users (
        display_name,
        display_name_lower,
        email,
        role,
        birthdate,
        is_active
    ) VALUES (
        display_name,
        lower(display_name),
        NEW.email,
        'athlete',
        user_birthdate,
        true
    )
    RETURNING id INTO new_user_id;

    -- Create user_profiles row
    INSERT INTO public.user_profiles (user_id, group_id, display_name, email, birthdate)
    VALUES (new_user_id, user_group_id, display_name, NEW.email, user_birthdate);

    -- Add to group if specified
    IF user_group_id IS NOT NULL THEN
        INSERT INTO public.group_members (group_id, user_id)
        VALUES (user_group_id, new_user_id)
        ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;

    -- Inject app_user_id and app_user_role into Supabase JWT claims
    -- This makes them available to RLS via app_user_id() and app_user_role()
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('app_user_id', new_user_id)
        || jsonb_build_object('app_user_role', 'athlete')
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Attach trigger to auth.users
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- 3. Helper function to update JWT claims when role changes
--    (call this from admin UI or an Edge Function when promoting a user)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_role_to_jwt(p_user_id INTEGER)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_role TEXT;
    v_auth_uid UUID;
BEGIN
    -- Get the user's current role
    SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'User % not found', p_user_id;
    END IF;

    -- Find the corresponding auth.users entry
    SELECT au.id INTO v_auth_uid
    FROM auth.users au
    WHERE au.raw_app_meta_data ->> 'app_user_id' = p_user_id::text
    LIMIT 1;

    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'No auth.users entry found for user %', p_user_id;
    END IF;

    -- Update app_metadata in auth.users
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('app_user_role', v_role)
    WHERE id = v_auth_uid;
END;
$$;
