-- =============================================================================
-- Migration: Auto-sync public.users.role → auth.users JWT claims
--
-- Problem: When the role column in public.users is updated (via SQL or admin UI),
-- the JWT claims (raw_app_meta_data.app_user_role) in auth.users are NOT
-- automatically updated. This means the frontend always sees the old role
-- from the JWT, regardless of what public.users.role says.
--
-- Fix:
-- 1. Add an AFTER UPDATE trigger on public.users that calls
--    sync_user_role_to_jwt() whenever the role column changes.
-- 2. One-time sync of all existing users to fix any current mismatches.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Trigger function: auto-sync role to JWT claims on UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_role_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        PERFORM public.sync_user_role_to_jwt(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Attach trigger to public.users
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_user_role_changed ON public.users;
CREATE TRIGGER on_user_role_changed
    AFTER UPDATE OF role ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_role_change();

-- ---------------------------------------------------------------------------
-- 3. One-time sync: fix all existing users whose JWT claims may be stale
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT u.id, u.role
        FROM public.users u
        JOIN auth.users au ON au.raw_app_meta_data ->> 'app_user_id' = u.id::text
        WHERE COALESCE(au.raw_app_meta_data ->> 'app_user_role', '') IS DISTINCT FROM u.role
    LOOP
        PERFORM public.sync_user_role_to_jwt(r.id);
    END LOOP;
END;
$$;
