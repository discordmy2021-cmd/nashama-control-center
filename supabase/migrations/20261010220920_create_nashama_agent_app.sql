/*
# Nashama Drive — Agent (Shipping Agent) App Database Layer

This migration adds everything needed for the shipping-agent app:
- Agent login (phone-based password authentication)
- Agent sessions (same pattern as admin sessions)
- A proper top-up flow that debits the agent's own balance (not the legacy shared wallet)
- An agent-scoped transaction log
- An agent profile update function

## 1. New Tables

### nashama_drive_agent_sessions
- token (uuid PK) — session token
- agent_id (uuid FK → nashama_drive_agents.id ON DELETE CASCADE)
- expires_at (timestptz, default now + 12h)
- created_at (timestamptz, default now)

### nashama_drive_agent_transactions
- id (uuid PK)
- agent_id (uuid FK → nashama_drive_agents.id)
- driver_id (text) — the driver who received the top-up
- driver_name (text) — snapshot of driver name at time of transaction
- amount (numeric 12,2) — the top-up amount
- commission (numeric 12,2) — the agent commission (1.00 JOD fixed)
- total_charged (numeric 12,2) — amount + commission
- reference_number (text) — unique receipt number
- balance_after (numeric 12,2) — agent balance after this transaction
- created_at (timestamptz, default now)

## 2. Modified Tables

### nashama_drive_agents
- Added column password_hash (text, nullable) — bcrypt hash for agent login
- Added column last_login_at (timestamptz, nullable) — tracks last successful login

## 3. New Functions

- authenticate_nashama_agent(p_phone, p_password) — verifies agent credentials, creates session, returns agent info + session token
- get_nashama_agent_dashboard(p_session_token) — returns agent profile, balance, today's transactions, and recent transaction history
- agent_topup_driver(p_session_token, p_driver_id, p_amount) — validates driver exists & active, checks agent has sufficient balance (amount + commission), deducts, increments daily_spend/monthly_spend, inserts transaction receipt, returns receipt info
- sign_out_nashama_agent(p_session_token) — deletes session
- update_nashama_agent_profile(p_session_token, p_phone, p_password) — lets agent update own phone and/or password

## 4. Security
- RLS enabled on both new tables, all direct access denied (anon + authenticated).
- All data access goes through SECURITY DEFINER functions with session validation.
- Agent password_hash column is never returned to the client.
- Top-up validates amount is in the allowed set {5,10,15,20,25,30,35,40,45,50}.
- Agent must be active (status = 'active') to login or perform top-ups.

## 5. Important Notes
- The existing perform_nashama_topup (legacy shared wallet) is untouched.
- Agent balance deduction is atomic within the top-up function.
- Commission is fixed at 1.00 JOD per top-up (same as legacy).
- Reference numbers use format AG-<timestamp>-<random>.
*/

-- ============ Add agent login columns ============

ALTER TABLE public.nashama_drive_agents
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- ============ Agent sessions table ============

CREATE TABLE IF NOT EXISTS public.nashama_drive_agent_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.nashama_drive_agents(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nashama_drive_agent_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nashama_drive_agent_sessions FROM anon, authenticated;

-- ============ Agent transactions table ============

CREATE TABLE IF NOT EXISTS public.nashama_drive_agent_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.nashama_drive_agents(id) ON DELETE CASCADE,
  driver_id text NOT NULL,
  driver_name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  commission numeric(12,2) NOT NULL DEFAULT 1.00 CHECK (commission >= 0),
  total_charged numeric(12,2) NOT NULL CHECK (total_charged = amount + commission),
  reference_number text NOT NULL,
  balance_after numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nashama_drive_agent_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nashama_drive_agent_transactions FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_agent_tx_agent_id ON public.nashama_drive_agent_transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tx_created ON public.nashama_drive_agent_transactions(created_at DESC);

-- ============ Agent sessions cleanup function ============

CREATE OR REPLACE FUNCTION public.authenticate_nashama_agent(p_phone text, p_password text)
RETURNS TABLE (session_token uuid, agent_id uuid, agent_name text, owner_name text, phone text, location text, available_balance numeric, daily_spend numeric, monthly_spend numeric, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_agent public.nashama_drive_agents%ROWTYPE; v_token uuid;
BEGIN
  SELECT * INTO v_agent FROM public.nashama_drive_agents WHERE phone = trim(p_phone) AND status = 'active' LIMIT 1;
  IF v_agent.id IS NULL OR v_agent.password_hash IS NULL THEN RAISE EXCEPTION 'Invalid credentials'; END IF;
  IF v_agent.password_hash <> crypt(p_password, v_agent.password_hash) THEN RAISE EXCEPTION 'Invalid credentials'; END IF;

  DELETE FROM public.nashama_drive_agent_sessions WHERE expires_at < now();
  INSERT INTO public.nashama_drive_agent_sessions (agent_id) VALUES (v_agent.id) RETURNING token INTO v_token;
  UPDATE public.nashama_drive_agents SET last_login_at = now() WHERE id = v_agent.id;

  RETURN QUERY SELECT v_token, v_agent.id, v_agent.name, v_agent.owner_name, v_agent.phone, v_agent.location, v_agent.available_balance, v_agent.daily_spend, v_agent.monthly_spend, v_agent.status;
END;
$$;

REVOKE ALL ON FUNCTION public.authenticate_nashama_agent(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authenticate_nashama_agent(text, text) TO anon, authenticated;

-- ============ Agent dashboard ============

CREATE OR REPLACE FUNCTION public.get_nashama_agent_dashboard(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_agent_id uuid; v_agent public.nashama_drive_agents%ROWTYPE; v_today_count integer; v_today_total numeric; v_tx jsonb; v_drivers jsonb;
BEGIN
  SELECT s.agent_id INTO v_agent_id FROM public.nashama_drive_agent_sessions s WHERE s.token = p_session_token AND s.expires_at > now();
  IF v_agent_id IS NULL THEN RAISE EXCEPTION 'Session expired'; END IF;

  SELECT * INTO v_agent FROM public.nashama_drive_agents WHERE id = v_agent_id AND status = 'active';
  IF v_agent.id IS NULL THEN RAISE EXCEPTION 'Agent suspended'; END IF;

  SELECT count(*), COALESCE(sum(amount), 0) INTO v_today_count, v_today_total
  FROM public.nashama_drive_agent_transactions WHERE agent_id = v_agent_id AND created_at >= date_trunc('day', now());

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_tx
  FROM (SELECT id, driver_id, driver_name, amount, commission, total_charged, reference_number, balance_after, created_at FROM public.nashama_drive_agent_transactions WHERE agent_id = v_agent_id ORDER BY created_at DESC LIMIT 50) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.name), '[]'::jsonb) INTO v_drivers
  FROM (SELECT id, name, phone, avatar_url FROM public.nashama_drive_drivers WHERE is_active = true ORDER BY name) d;

  RETURN jsonb_build_object(
    'agent', jsonb_build_object('id', v_agent.id, 'name', v_agent.name, 'owner_name', v_agent.owner_name, 'phone', v_agent.phone, 'location', v_agent.location, 'available_balance', v_agent.available_balance, 'daily_spend', v_agent.daily_spend, 'monthly_spend', v_agent.monthly_spend, 'status', v_agent.status),
    'today_count', v_today_count,
    'today_total', v_today_total,
    'transactions', v_tx,
    'drivers', v_drivers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_nashama_agent_dashboard(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nashama_agent_dashboard(uuid) TO anon, authenticated;

-- ============ Agent top-up driver ============

CREATE OR REPLACE FUNCTION public.agent_topup_driver(p_session_token uuid, p_driver_id text, p_amount numeric)
RETURNS TABLE (reference_number text, new_balance numeric, driver_name text, amount numeric, commission numeric, total_charged numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_agent_id uuid; v_agent public.nashama_drive_agents%ROWTYPE; v_driver public.nashama_drive_drivers%ROWTYPE; v_total numeric; v_ref text; v_new_balance numeric;
BEGIN
  SELECT s.agent_id INTO v_agent_id FROM public.nashama_drive_agent_sessions s WHERE s.token = p_session_token AND s.expires_at > now();
  IF v_agent_id IS NULL THEN RAISE EXCEPTION 'Session expired'; END IF;

  SELECT * INTO v_agent FROM public.nashama_drive_agents WHERE id = v_agent_id AND status = 'active' FOR UPDATE;
  IF v_agent.id IS NULL THEN RAISE EXCEPTION 'Agent suspended'; END IF;

  SELECT * INTO v_driver FROM public.nashama_drive_drivers WHERE id = upper(trim(p_driver_id)) AND is_active = true;
  IF v_driver.id IS NULL THEN RAISE EXCEPTION 'Driver not found or inactive'; END IF;

  IF p_amount NOT IN (5,10,15,20,25,30,35,40,45,50) THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  v_total := p_amount + 1.00;
  IF v_agent.available_balance < v_total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_agent.available_balance - v_total;
  v_ref := 'AG-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 5);

  UPDATE public.nashama_drive_agents
    SET available_balance = v_new_balance,
        daily_spend = daily_spend + v_total,
        monthly_spend = monthly_spend + v_total
    WHERE id = v_agent_id;

  INSERT INTO public.nashama_drive_agent_transactions (agent_id, driver_id, driver_name, amount, commission, total_charged, reference_number, balance_after)
    VALUES (v_agent_id, v_driver.id, v_driver.name, p_amount, 1.00, v_total, v_ref, v_new_balance);

  RETURN QUERY SELECT v_ref, v_new_balance, v_driver.name, p_amount, 1.00, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_topup_driver(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_topup_driver(uuid, text, numeric) TO anon, authenticated;

-- ============ Agent sign out ============

CREATE OR REPLACE FUNCTION public.sign_out_nashama_agent(p_session_token uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.nashama_drive_agent_sessions WHERE token = p_session_token;
END;
$$;

REVOKE ALL ON FUNCTION public.sign_out_nashama_agent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_out_nashama_agent(uuid) TO anon, authenticated;

-- ============ Agent profile update ============

CREATE OR REPLACE FUNCTION public.update_nashama_agent_profile(p_session_token uuid, p_phone text DEFAULT NULL, p_password text DEFAULT NULL)
RETURNS TABLE (phone text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_agent_id uuid; v_new_phone text; v_new_hash text;
BEGIN
  SELECT s.agent_id INTO v_agent_id FROM public.nashama_drive_agent_sessions s WHERE s.token = p_session_token AND s.expires_at > now();
  IF v_agent_id IS NULL THEN RAISE EXCEPTION 'Session expired'; END IF;

  v_new_phone := NULLIF(trim(p_phone), '');
  v_new_hash := NULL;

  IF p_password IS NOT NULL AND length(p_password) >= 6 THEN
    v_new_hash := crypt(p_password, gen_salt('bf', 12));
  END IF;

  UPDATE public.nashama_drive_agents SET
    phone = COALESCE(v_new_phone, phone),
    password_hash = COALESCE(v_new_hash, password_hash)
    WHERE id = v_agent_id;

  RETURN QUERY SELECT phone FROM public.nashama_drive_agents WHERE id = v_agent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_nashama_agent_profile(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_nashama_agent_profile(uuid, text, text) TO anon, authenticated;
