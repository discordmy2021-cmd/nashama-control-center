/*
# Add management entry forms and profile media

1. Modified Tables
- `nashama_drive_admin_accounts`: adds `profile_id`, the visible numeric ID for each account; the owner is ID 1.
- `nashama_drive_drivers`: adds national ID and vehicle plate fields, and stores selected profile images in the avatar field.
- `nashama_drive_agents`: adds center owner name and optional latitude/longitude while resetting the demo center's balance and usage to zero.

2. Server Operations
- Adds owner/admin functions to create drivers and shipping centers.
- Adds a controlled function to update a shipping center's balance.
- Adds a function for the administration session to update its profile image.
- Adds server-side image validation for browser-selected image data, including type and size limits.

3. Data Safety
- Existing demo drivers are marked inactive so they no longer appear in the active list without deleting historical records.
- Existing transaction and wallet data is preserved.
- Direct browser table writes remain blocked; changes go through session-checked functions.
*/

ALTER TABLE public.nashama_drive_admin_accounts ADD COLUMN IF NOT EXISTS profile_id integer;
ALTER TABLE public.nashama_drive_drivers ADD COLUMN IF NOT EXISTS national_id text NOT NULL DEFAULT '';
ALTER TABLE public.nashama_drive_drivers ADD COLUMN IF NOT EXISTS vehicle_plate text NOT NULL DEFAULT '';
ALTER TABLE public.nashama_drive_agents ADD COLUMN IF NOT EXISTS owner_name text NOT NULL DEFAULT '';
ALTER TABLE public.nashama_drive_agents ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.nashama_drive_agents ADD COLUMN IF NOT EXISTS longitude numeric;

UPDATE public.nashama_drive_admin_accounts SET profile_id = 1 WHERE username = 'Muhammad1212' AND profile_id IS NULL;
UPDATE public.nashama_drive_admin_accounts SET profile_id = subquery.next_id
FROM (SELECT id, row_number() OVER (ORDER BY created_at, id)::integer + 1 AS next_id FROM public.nashama_drive_admin_accounts WHERE username <> 'Muhammad1212' AND profile_id IS NULL) AS subquery
WHERE public.nashama_drive_admin_accounts.id = subquery.id;
CREATE UNIQUE INDEX IF NOT EXISTS nashama_admin_profile_id_key ON public.nashama_drive_admin_accounts(profile_id);

UPDATE public.nashama_drive_drivers SET is_active = false WHERE id IN ('ND-1045', '9999');
UPDATE public.nashama_drive_agents SET available_balance = 0, monthly_spend = 0, daily_spend = 0 WHERE name = 'وكالة النشامة المركزية';

CREATE OR REPLACE FUNCTION public.create_nashama_driver(p_session_token uuid, p_driver_id text, p_name text, p_national_id text, p_vehicle_plate text, p_phone text, p_avatar_data_url text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_id uuid; v_avatar text := NULLIF(trim(p_avatar_data_url), '');
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(p_driver_id)) < 2 OR length(trim(p_name)) < 2 OR length(trim(p_phone)) < 7 OR length(trim(p_vehicle_plate)) < 2 THEN RAISE EXCEPTION 'Invalid driver data'; END IF;
  IF v_avatar IS NOT NULL AND (length(v_avatar) > 2000000 OR v_avatar NOT LIKE 'data:image/%') THEN RAISE EXCEPTION 'Invalid image'; END IF;
  INSERT INTO public.nashama_drive_drivers (id, name, phone, avatar_url, national_id, vehicle_plate, is_active) VALUES (upper(trim(p_driver_id)), trim(p_name), trim(p_phone), v_avatar, trim(p_national_id), trim(p_vehicle_plate), true) RETURNING gen_random_uuid() INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_nashama_agent(p_session_token uuid, p_name text, p_owner_name text, p_phone text, p_location text, p_latitude numeric DEFAULT NULL, p_longitude numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_id uuid;
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(p_name)) < 2 OR length(trim(p_owner_name)) < 2 OR length(trim(p_phone)) < 7 OR length(trim(p_location)) < 2 THEN RAISE EXCEPTION 'Invalid agent data'; END IF;
  INSERT INTO public.nashama_drive_agents (name, owner_name, phone, location, latitude, longitude, available_balance, monthly_spend, daily_spend, status) VALUES (trim(p_name), trim(p_owner_name), trim(p_phone), trim(p_location), p_latitude, p_longitude, 0, 0, 0, 'active') RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_nashama_agent_balance(p_session_token uuid, p_agent_id uuid, p_balance numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role IS NULL OR p_balance IS NULL OR p_balance < 0 OR p_balance > 100000000 THEN RAISE EXCEPTION 'Invalid balance'; END IF;
  UPDATE public.nashama_drive_agents SET available_balance = p_balance WHERE id = p_agent_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_nashama_admin_profile(p_session_token uuid, p_phone text, p_avatar_data_url text DEFAULT NULL)
RETURNS TABLE (profile_id integer, phone text, avatar_url text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account_id uuid; v_avatar text := NULLIF(trim(p_avatar_data_url), '');
BEGIN
  SELECT a.id INTO v_account_id FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'Session expired'; END IF;
  IF v_avatar IS NOT NULL AND (length(v_avatar) > 2000000 OR v_avatar NOT LIKE 'data:image/%') THEN RAISE EXCEPTION 'Invalid image'; END IF;
  UPDATE public.nashama_drive_admin_accounts SET phone = COALESCE(NULLIF(trim(p_phone), ''), phone), avatar_url = COALESCE(v_avatar, avatar_url) WHERE id = v_account_id;
  RETURN QUERY SELECT a.profile_id, a.phone, a.avatar_url FROM public.nashama_drive_admin_accounts a WHERE a.id = v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_nashama_admin_dashboard(p_session_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_result jsonb;
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Session expired'; END IF;
  SELECT jsonb_build_object('driver_count', (SELECT count(*) FROM public.nashama_drive_drivers WHERE is_active), 'agent_count', (SELECT count(*) FROM public.nashama_drive_agents), 'open_complaints', (SELECT count(*) FROM public.nashama_drive_complaints WHERE status IN ('open', 'investigating')), 'open_issues', (SELECT count(*) FROM public.nashama_drive_issues WHERE status IN ('open', 'in_progress')), 'drivers', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at DESC) FROM public.nashama_drive_drivers d WHERE d.is_active), '[]'::jsonb), 'agents', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC) FROM public.nashama_drive_agents a), '[]'::jsonb), 'complaints', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM public.nashama_drive_complaints c), '[]'::jsonb), 'issues', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC) FROM public.nashama_drive_issues i), '[]'::jsonb)) INTO v_result;
  RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.authenticate_nashama_admin(text, text);
CREATE OR REPLACE FUNCTION public.authenticate_nashama_admin(p_username text, p_password text)
RETURNS TABLE (session_token uuid, account_id uuid, profile_id integer, full_name text, role text, phone text, avatar_url text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_account public.nashama_drive_admin_accounts%ROWTYPE; v_token uuid;
BEGIN
  DELETE FROM public.nashama_drive_admin_sessions WHERE expires_at < now();
  SELECT * INTO v_account FROM public.nashama_drive_admin_accounts WHERE username = trim(p_username) AND is_active = true LIMIT 1;
  IF v_account.id IS NULL OR crypt(p_password, v_account.password_hash) <> v_account.password_hash THEN RAISE EXCEPTION 'Invalid credentials'; END IF;
  INSERT INTO public.nashama_drive_admin_sessions (account_id) VALUES (v_account.id) RETURNING token INTO v_token;
  RETURN QUERY SELECT v_token, v_account.id, v_account.profile_id, v_account.full_name, v_account.role, v_account.phone, v_account.avatar_url;
END;
$$;

DROP FUNCTION IF EXISTS public.list_nashama_admin_accounts(uuid);
CREATE OR REPLACE FUNCTION public.list_nashama_admin_accounts(p_session_token uuid)
RETURNS TABLE (id uuid, profile_id integer, username text, full_name text, role text, phone text, avatar_url text, is_active boolean, created_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY SELECT a.id, a.profile_id, a.username, a.full_name, a.role, a.phone, a.avatar_url, a.is_active, a.created_at FROM public.nashama_drive_admin_accounts a ORDER BY a.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.create_nashama_admin_account(uuid, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.create_nashama_admin_account(p_session_token uuid, p_username text, p_password text, p_full_name text, p_phone text, p_avatar_url text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_role text; v_id uuid; v_profile_id integer; v_avatar text := NULLIF(trim(p_avatar_url), '');
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role <> 'owner' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(p_username)) < 3 OR length(p_password) < 8 OR length(trim(p_full_name)) < 2 THEN RAISE EXCEPTION 'Invalid account data'; END IF;
  IF v_avatar IS NOT NULL AND (length(v_avatar) > 2000000 OR v_avatar NOT LIKE 'data:image/%') THEN RAISE EXCEPTION 'Invalid image'; END IF;
  SELECT COALESCE(max(profile_id), 1) + 1 INTO v_profile_id FROM public.nashama_drive_admin_accounts;
  INSERT INTO public.nashama_drive_admin_accounts (profile_id, username, password_hash, full_name, role, phone, avatar_url) VALUES (v_profile_id, trim(p_username), crypt(p_password, gen_salt('bf', 12)), trim(p_full_name), 'admin', trim(p_phone), v_avatar) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.list_nashama_admin_accounts(uuid);
REVOKE ALL ON FUNCTION public.create_nashama_driver(uuid, text, text, text, text, text, text), public.create_nashama_agent(uuid, text, text, text, text, numeric, numeric), public.set_nashama_agent_balance(uuid, uuid, numeric), public.update_nashama_admin_profile(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_nashama_driver(uuid, text, text, text, text, text, text), public.create_nashama_agent(uuid, text, text, text, text, numeric, numeric), public.set_nashama_agent_balance(uuid, uuid, numeric), public.update_nashama_admin_profile(uuid, text, text) TO anon, authenticated;
