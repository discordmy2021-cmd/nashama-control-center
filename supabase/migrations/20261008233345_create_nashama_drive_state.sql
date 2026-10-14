/*
# Create Nashama Drive single-agent wallet

1. New Tables
- `nashama_drive_state`: one shared prototype wallet row with the current available balance and today's completed operation count.
- `nashama_drive_transactions`: immutable operation receipts with the driver, amount, commission, total charged, and reference number.

2. Security
- Row-level security is enabled on both tables.
- The public prototype may read the shared wallet and receipt list through the anon client.
- Direct writes are denied; balance changes happen only through the validated `perform_nashama_topup` database function.
- The function validates the approved top-up amounts, recomputes the commission and total, checks available balance, updates the wallet, and records the receipt atomically.

3. Important Notes
- This is intentionally single-tenant because the requested experience uses one fixed agent account and no account registration flow.
- The database function owns the balance mutation so the browser cannot submit an arbitrary balance or total.
*/

CREATE TABLE IF NOT EXISTS public.nashama_drive_state (
  id text PRIMARY KEY,
  available_balance numeric(12, 2) NOT NULL DEFAULT 1000.00 CHECK (available_balance >= 0),
  daily_operations integer NOT NULL DEFAULT 0 CHECK (daily_operations >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nashama_drive_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL DEFAULT 'أصيل',
  driver_name text NOT NULL,
  driver_id text NOT NULL,
  top_up_amount numeric(12, 2) NOT NULL CHECK (top_up_amount > 0),
  commission numeric(12, 2) NOT NULL DEFAULT 1.00 CHECK (commission = 1.00),
  total_charged numeric(12, 2) NOT NULL CHECK (total_charged = top_up_amount + commission),
  reference_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.nashama_drive_state (id, available_balance, daily_operations)
VALUES ('default', 1000.00, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.nashama_drive_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nashama_drive_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can read drive state" ON public.nashama_drive_state;
CREATE POLICY "anon can read drive state" ON public.nashama_drive_state
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon cannot insert drive state" ON public.nashama_drive_state;
CREATE POLICY "anon cannot insert drive state" ON public.nashama_drive_state
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "anon cannot update drive state" ON public.nashama_drive_state;
CREATE POLICY "anon cannot update drive state" ON public.nashama_drive_state
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "anon cannot delete drive state" ON public.nashama_drive_state;
CREATE POLICY "anon cannot delete drive state" ON public.nashama_drive_state
  FOR DELETE TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "anon can read drive transactions" ON public.nashama_drive_transactions;
CREATE POLICY "anon can read drive transactions" ON public.nashama_drive_transactions
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon cannot insert drive transactions" ON public.nashama_drive_transactions;
CREATE POLICY "anon cannot insert drive transactions" ON public.nashama_drive_transactions
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "anon cannot update drive transactions" ON public.nashama_drive_transactions;
CREATE POLICY "anon cannot update drive transactions" ON public.nashama_drive_transactions
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "anon cannot delete drive transactions" ON public.nashama_drive_transactions;
CREATE POLICY "anon cannot delete drive transactions" ON public.nashama_drive_transactions
  FOR DELETE TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.perform_nashama_topup(p_amount numeric)
RETURNS TABLE (
  new_balance numeric,
  daily_operations integer,
  reference_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(12, 2);
  v_reference text := 'ATRN967';
BEGIN
  IF p_amount NOT IN (5, 10, 15, 20, 25, 30, 35, 40, 45, 50) THEN
    RAISE EXCEPTION 'Invalid top-up amount';
  END IF;

  v_total := p_amount + 1.00;

  UPDATE public.nashama_drive_state
  SET available_balance = available_balance - v_total,
      daily_operations = daily_operations + 1,
      updated_at = now()
  WHERE id = 'default'
    AND available_balance >= v_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.nashama_drive_transactions (
    driver_name, driver_id, top_up_amount, commission, total_charged, reference_number
  ) VALUES (
    'محمود علي', 'ND-1045', p_amount, 1.00, v_total, v_reference
  );

  RETURN QUERY
  SELECT available_balance, daily_operations, v_reference
  FROM public.nashama_drive_state
  WHERE id = 'default';
END;
$$;

REVOKE ALL ON FUNCTION public.perform_nashama_topup(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perform_nashama_topup(numeric) TO anon, authenticated;
GRANT SELECT ON public.nashama_drive_state, public.nashama_drive_transactions TO anon, authenticated;
