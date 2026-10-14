/*
# Switch avatar storage from data URLs to storage URLs

1. Modified Functions
- `update_nashama_admin_profile`: accepts a storage URL instead of a base64 data URL.
- `create_nashama_admin_account`: same change for the avatar parameter.
- `create_nashama_driver`: same change for the driver photo.
- All three functions are dropped and recreated because parameter names changed.

2. Data Safety
- No existing data is modified.
*/

DROP FUNCTION IF EXISTS public.update_nashama_admin_profile(uuid, text, text);
CREATE OR REPLACE FUNCTION public.update_nashama_admin_profile(p_session_token uuid, p_phone text, p_avatar_url text DEFAULT NULL)
RETURNS TABLE (profile_id integer, phone text, avatar_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_account_id uuid; v_avatar text := NULLIF(trim(p_avatar_url), '');
BEGIN
  SELECT a.id INTO v_account_id FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'Session expired'; END IF;
  IF v_avatar IS NOT NULL AND v_avatar NOT LIKE 'https://%' AND v_avatar NOT LIKE 'data:image/%' THEN RAISE EXCEPTION 'Invalid image URL'; END IF;
  UPDATE public.nashama_drive_admin_accounts SET phone = COALESCE(NULLIF(trim(p_phone), ''), phone), avatar_url = COALESCE(v_avatar, avatar_url) WHERE id = v_account_id;
  RETURN QUERY SELECT a.profile_id, a.phone, a.avatar_url FROM public.nashama_drive_admin_accounts a WHERE a.id = v_account_id;
END;
$$;

DROP FUNCTION IF EXISTS public.create_nashama_admin_account(uuid, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.create_nashama_admin_account(p_session_token uuid, p_username text, p_password text, p_full_name text, p_phone text, p_avatar_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_role text; v_id uuid; v_profile_id integer; v_avatar text := NULLIF(trim(p_avatar_url), '');
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role <> 'owner' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(p_username)) < 3 OR length(p_password) < 8 OR length(trim(p_full_name)) < 2 THEN RAISE EXCEPTION 'Invalid account data'; END IF;
  IF v_avatar IS NOT NULL AND v_avatar NOT LIKE 'https://%' AND v_avatar NOT LIKE 'data:image/%' THEN RAISE EXCEPTION 'Invalid image URL'; END IF;
  SELECT COALESCE(max(profile_id), 1) + 1 INTO v_profile_id FROM public.nashama_drive_admin_accounts;
  INSERT INTO public.nashama_drive_admin_accounts (profile_id, username, password_hash, full_name, role, phone, avatar_url) VALUES (v_profile_id, trim(p_username), crypt(p_password, gen_salt('bf', 12)), trim(p_full_name), 'admin', trim(p_phone), v_avatar) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.create_nashama_driver(uuid, text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.create_nashama_driver(p_session_token uuid, p_driver_id text, p_name text, p_national_id text, p_vehicle_plate text, p_phone text, p_avatar_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role text; v_id uuid; v_avatar text := NULLIF(trim(p_avatar_url), '');
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(p_driver_id)) < 2 OR length(trim(p_name)) < 2 OR length(trim(p_phone)) < 7 OR length(trim(p_vehicle_plate)) < 2 THEN RAISE EXCEPTION 'Invalid driver data'; END IF;
  IF v_avatar IS NOT NULL AND v_avatar NOT LIKE 'https://%' AND v_avatar NOT LIKE 'data:image/%' THEN RAISE EXCEPTION 'Invalid image URL'; END IF;
  INSERT INTO public.nashama_drive_drivers (id, name, phone, avatar_url, national_id, vehicle_plate, is_active) VALUES (upper(trim(p_driver_id)), trim(p_name), trim(p_phone), v_avatar, trim(p_national_id), trim(p_vehicle_plate), true) RETURNING gen_random_uuid() INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_nashama_admin_profile(uuid, text, text), public.create_nashama_admin_account(uuid, text, text, text, text, text), public.create_nashama_driver(uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_nashama_admin_profile(uuid, text, text), public.create_nashama_admin_account(uuid, text, text, text, text, text), public.create_nashama_driver(uuid, text, text, text, text, text, text) TO anon, authenticated;
