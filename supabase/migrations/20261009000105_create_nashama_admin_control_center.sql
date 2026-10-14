/*
# Create Nashama Drive administration control center

1. New Tables
- `nashama_drive_admin_accounts`: server-stored administrative accounts with a bcrypt password hash, role, profile details, and active status.
- `nashama_drive_admin_sessions`: short-lived server sessions used by the administration interface.
- `nashama_drive_agents`: shipping agent profiles, locations, balances, and usage totals.
- `nashama_drive_complaints`: customer and captain complaints with status and priority.
- `nashama_drive_issues`: operational problems reported by the connected applications.

2. Roles and Security
- `owner` is the program owner and can create or deactivate administrative accounts.
- `admin` can use the administration dashboard but cannot remove another administrator.
- Passwords are stored only as bcrypt hashes; the provided owner password is never stored as readable text.
- RLS is enabled on every new table and direct browser table access is denied.
- All dashboard reads and account mutations go through server-side functions that validate the session token and role.

3. Important Notes
- The schema is prepared for the driver, agent, customer, and captain applications to share the same control center.
- Existing driver, wallet, and transaction data is preserved.
- The initial owner account uses the username supplied for the program owner.
*/

CREATE TABLE IF NOT EXISTS public.nashama_drive_admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin')),
  phone text NOT NULL DEFAULT '',
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nashama_drive_admin_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.nashama_drive_admin_accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nashama_drive_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  location text NOT NULL DEFAULT 'الأردن',
  available_balance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  monthly_spend numeric(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_spend >= 0),
  daily_spend numeric(12, 2) NOT NULL DEFAULT 0 CHECK (daily_spend >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nashama_drive_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  description text NOT NULL,
  complainant_type text NOT NULL DEFAULT 'customer',
  driver_id text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nashama_drive_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.nashama_drive_admin_accounts (username, password_hash, full_name, role, phone)
VALUES ('Muhammad1212', '$2a$12$0ASsCc72WlfG8CVw/JQBUOuRlEcx5N8cZWGt5olg70Klh1KwnIpja', 'صاحب البرنامج', 'owner', '0798939402')
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.nashama_drive_agents (name, phone, location, available_balance, monthly_spend, daily_spend, status)
SELECT 'وكالة النشامة المركزية', '0790000000', 'عمّان - الأردن', 3500, 12800, 740, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.nashama_drive_agents);

INSERT INTO public.nashama_drive_complaints (subject, description, complainant_type, driver_id, priority, status)
SELECT 'تأخر في الوصول', 'العميل أبلغ عن تأخر السائق في الوصول إلى نقطة الالتقاء.', 'customer', 'ND-1045', 'medium', 'open'
WHERE NOT EXISTS (SELECT 1 FROM public.nashama_drive_complaints);

INSERT INTO public.nashama_drive_issues (title, description, severity, status)
SELECT 'بطء في تحديث حالة الطلبات', 'توجد بعض الطلبات التي تتأخر في الظهور داخل لوحة الإدارة.', 'high', 'in_progress'
WHERE NOT EXISTS (SELECT 1 FROM public.nashama_drive_issues);

ALTER TABLE public.nashama_drive_admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nashama_drive_admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nashama_drive_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nashama_drive_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nashama_drive_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin accounts select denied" ON public.nashama_drive_admin_accounts;
CREATE POLICY "admin accounts select denied" ON public.nashama_drive_admin_accounts FOR SELECT TO anon, authenticated USING (false);
DROP POLICY IF EXISTS "admin accounts insert denied" ON public.nashama_drive_admin_accounts;
CREATE POLICY "admin accounts insert denied" ON public.nashama_drive_admin_accounts FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "admin accounts update denied" ON public.nashama_drive_admin_accounts;
CREATE POLICY "admin accounts update denied" ON public.nashama_drive_admin_accounts FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "admin accounts delete denied" ON public.nashama_drive_admin_accounts;
CREATE POLICY "admin accounts delete denied" ON public.nashama_drive_admin_accounts FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "admin sessions select denied" ON public.nashama_drive_admin_sessions;
CREATE POLICY "admin sessions select denied" ON public.nashama_drive_admin_sessions FOR SELECT TO anon, authenticated USING (false);
DROP POLICY IF EXISTS "admin sessions insert denied" ON public.nashama_drive_admin_sessions;
CREATE POLICY "admin sessions insert denied" ON public.nashama_drive_admin_sessions FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "admin sessions update denied" ON public.nashama_drive_admin_sessions;
CREATE POLICY "admin sessions update denied" ON public.nashama_drive_admin_sessions FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "admin sessions delete denied" ON public.nashama_drive_admin_sessions;
CREATE POLICY "admin sessions delete denied" ON public.nashama_drive_admin_sessions FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "agents select denied" ON public.nashama_drive_agents;
CREATE POLICY "agents select denied" ON public.nashama_drive_agents FOR SELECT TO anon, authenticated USING (false);
DROP POLICY IF EXISTS "agents insert denied" ON public.nashama_drive_agents;
CREATE POLICY "agents insert denied" ON public.nashama_drive_agents FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "agents update denied" ON public.nashama_drive_agents;
CREATE POLICY "agents update denied" ON public.nashama_drive_agents FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "agents delete denied" ON public.nashama_drive_agents;
CREATE POLICY "agents delete denied" ON public.nashama_drive_agents FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "complaints select denied" ON public.nashama_drive_complaints;
CREATE POLICY "complaints select denied" ON public.nashama_drive_complaints FOR SELECT TO anon, authenticated USING (false);
DROP POLICY IF EXISTS "complaints insert denied" ON public.nashama_drive_complaints;
CREATE POLICY "complaints insert denied" ON public.nashama_drive_complaints FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "complaints update denied" ON public.nashama_drive_complaints;
CREATE POLICY "complaints update denied" ON public.nashama_drive_complaints FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "complaints delete denied" ON public.nashama_drive_complaints;
CREATE POLICY "complaints delete denied" ON public.nashama_drive_complaints FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "issues select denied" ON public.nashama_drive_issues;
CREATE POLICY "issues select denied" ON public.nashama_drive_issues FOR SELECT TO anon, authenticated USING (false);
DROP POLICY IF EXISTS "issues insert denied" ON public.nashama_drive_issues;
CREATE POLICY "issues insert denied" ON public.nashama_drive_issues FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "issues update denied" ON public.nashama_drive_issues;
CREATE POLICY "issues update denied" ON public.nashama_drive_issues FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "issues delete denied" ON public.nashama_drive_issues;
CREATE POLICY "issues delete denied" ON public.nashama_drive_issues FOR DELETE TO anon, authenticated USING (false);

REVOKE ALL ON public.nashama_drive_admin_accounts, public.nashama_drive_admin_sessions, public.nashama_drive_agents, public.nashama_drive_complaints, public.nashama_drive_issues FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.authenticate_nashama_admin(p_username text, p_password text)
RETURNS TABLE (session_token uuid, account_id uuid, full_name text, role text, phone text, avatar_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_account public.nashama_drive_admin_accounts%ROWTYPE; v_token uuid;
BEGIN
  DELETE FROM public.nashama_drive_admin_sessions WHERE expires_at < now();
  SELECT * INTO v_account FROM public.nashama_drive_admin_accounts WHERE username = trim(p_username) AND is_active = true LIMIT 1;
  IF v_account.id IS NULL OR crypt(p_password, v_account.password_hash) <> v_account.password_hash THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;
  INSERT INTO public.nashama_drive_admin_sessions (account_id) VALUES (v_account.id) RETURNING token INTO v_token;
  RETURN QUERY SELECT v_token, v_account.id, v_account.full_name, v_account.role, v_account.phone, v_account.avatar_url;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_nashama_admin_dashboard(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role text; v_result jsonb;
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Session expired'; END IF;
  SELECT jsonb_build_object(
    'driver_count', (SELECT count(*) FROM public.nashama_drive_drivers WHERE is_active),
    'agent_count', (SELECT count(*) FROM public.nashama_drive_agents),
    'open_complaints', (SELECT count(*) FROM public.nashama_drive_complaints WHERE status IN ('open', 'investigating')),
    'open_issues', (SELECT count(*) FROM public.nashama_drive_issues WHERE status IN ('open', 'in_progress')),
    'drivers', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at DESC) FROM public.nashama_drive_drivers d WHERE d.is_active), '[]'::jsonb),
    'agents', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC) FROM public.nashama_drive_agents a), '[]'::jsonb),
    'complaints', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM public.nashama_drive_complaints c), '[]'::jsonb),
    'issues', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC) FROM public.nashama_drive_issues i), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_nashama_admin_accounts(p_session_token uuid)
RETURNS TABLE (id uuid, username text, full_name text, role text, phone text, avatar_url text, is_active boolean, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY SELECT a.id, a.username, a.full_name, a.role, a.phone, a.avatar_url, a.is_active, a.created_at FROM public.nashama_drive_admin_accounts a ORDER BY a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_nashama_admin_account(p_session_token uuid, p_username text, p_password text, p_full_name text, p_phone text, p_avatar_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_role text; v_id uuid;
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role <> 'owner' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(p_username)) < 3 OR length(p_password) < 8 OR length(trim(p_full_name)) < 2 THEN RAISE EXCEPTION 'Invalid account data'; END IF;
  INSERT INTO public.nashama_drive_admin_accounts (username, password_hash, full_name, role, phone, avatar_url) VALUES (trim(p_username), crypt(p_password, gen_salt('bf', 12)), trim(p_full_name), 'admin', trim(p_phone), NULLIF(trim(p_avatar_url), '')) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_nashama_admin(p_session_token uuid, p_account_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT a.role INTO v_role FROM public.nashama_drive_admin_sessions s JOIN public.nashama_drive_admin_accounts a ON a.id = s.account_id WHERE s.token = p_session_token AND s.expires_at > now() AND a.is_active = true;
  IF v_role <> 'owner' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.nashama_drive_admin_accounts SET is_active = false WHERE id = p_account_id AND role = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_out_nashama_admin(p_session_token uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN DELETE FROM public.nashama_drive_admin_sessions WHERE token = p_session_token; END; $$;

REVOKE ALL ON FUNCTION public.authenticate_nashama_admin(text, text), public.get_nashama_admin_dashboard(uuid), public.list_nashama_admin_accounts(uuid), public.create_nashama_admin_account(uuid, text, text, text, text, text), public.deactivate_nashama_admin(uuid, uuid), public.sign_out_nashama_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authenticate_nashama_admin(text, text), public.get_nashama_admin_dashboard(uuid), public.list_nashama_admin_accounts(uuid), public.create_nashama_admin_account(uuid, text, text, text, text, text), public.deactivate_nashama_admin(uuid, uuid), public.sign_out_nashama_admin(uuid) TO anon, authenticated;
