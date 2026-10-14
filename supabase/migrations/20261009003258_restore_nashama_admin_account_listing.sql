/*
# Restore administration account listing after profile ID update

1. Server Operations
- Restores the session-checked account listing function with the new numeric profile ID.

2. Security
- Only active owner and admin sessions can list accounts.
- Direct table access remains blocked.

3. Data Safety
- No account data is deleted or changed.
*/

CREATE OR REPLACE FUNCTION public.list_nashama_admin_accounts(p_session_token uuid)
RETURNS TABLE (id uuid, profile_id integer, username text, full_name text, role text, phone text, avatar_url text, is_active boolean, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT a.role INTO v_role
  FROM public.nashama_drive_admin_sessions s
  JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id
  WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT a.id, a.profile_id, a.username, a.full_name, a.role, a.phone, a.avatar_url, a.is_active, a.created_at
  FROM public.nashama_drive_admin_accounts a
  ORDER BY a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_nashama_admin_accounts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_nashama_admin_accounts(uuid) TO anon, authenticated;
