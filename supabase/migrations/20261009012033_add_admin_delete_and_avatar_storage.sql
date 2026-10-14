/*
# Add admin account deletion and avatar storage bucket

1. New Server Functions
- `delete_nashama_admin`: permanently removes an admin account (owner-only). The owner account cannot be deleted.

2. Storage
- Creates a public bucket `nashama-avatars` for storing profile photos.
- Sets RLS policies allowing anyone to read and authenticated/anon to upload.

3. Data Safety
- The owner account is protected from deletion.
- Deactivated accounts can still be deleted.
- No existing data is modified.
*/

CREATE OR REPLACE FUNCTION public.delete_nashama_admin(p_session_token uuid, p_account_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role text; v_target_role text;
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role <> 'owner' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT role INTO v_target_role FROM public.nashama_drive_admin_accounts WHERE id = p_account_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'Cannot delete owner account'; END IF;
  DELETE FROM public.nashama_drive_admin_sessions WHERE account_id = p_account_id;
  DELETE FROM public.nashama_drive_admin_accounts WHERE id = p_account_id AND role = 'admin';
END;
$$;

REVOKE ALL ON FUNCTION public.delete_nashama_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_nashama_admin(uuid, uuid) TO anon, authenticated;

INSERT INTO storage.buckets (id, name, public) VALUES ('nashama-avatars', 'nashama-avatars', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatar_read_public" ON storage.objects;
CREATE POLICY "avatar_read_public" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'nashama-avatars');

DROP POLICY IF EXISTS "avatar_upload_all" ON storage.objects;
CREATE POLICY "avatar_upload_all" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'nashama-avatars');

DROP POLICY IF EXISTS "avatar_update_all" ON storage.objects;
CREATE POLICY "avatar_update_all" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'nashama-avatars') WITH CHECK (bucket_id = 'nashama-avatars');

DROP POLICY IF EXISTS "avatar_delete_all" ON storage.objects;
CREATE POLICY "avatar_delete_all" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'nashama-avatars');
