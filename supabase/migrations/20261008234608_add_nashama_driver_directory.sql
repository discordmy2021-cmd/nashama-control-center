/*
# Add dynamic Nashama Drive driver directory

1. New Tables
- `nashama_drive_drivers`: the driver directory controlled by the administrative system.
- `id`: the driver identifier entered by the agent, such as `ND-1045` or `9999`.
- `name`: the driver's display name.
- `phone`: the driver's registered phone number.
- `avatar_url`: the driver's profile image URL.
- `is_active`: whether the driver can receive a top-up.

2. Modified Behavior
- Driver verification now reads the matching directory record instead of displaying a hard-coded person.
- The top-up function now requires a valid active driver identifier and records that exact recipient in the transaction.

3. Security
- Row-level security is enabled on the directory.
- Agents can read active driver profiles but cannot insert, update, or delete directory records from the public client.
- The balance mutation validates the recipient again inside the database function before deducting funds.

4. Important Notes
- The directory is intentionally shared for this single-tenant prototype and is ready for a future administrative dashboard to manage.
- Existing transaction data is preserved.
*/

CREATE TABLE IF NOT EXISTS public.nashama_drive_drivers (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.nashama_drive_drivers (id, name, phone, avatar_url)
VALUES
  ('ND-1045', 'محمود علي', '079-XXXXXXX', 'https://images.pexels.com/photos/9519969/pexels-photo-9519969.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'),
  ('9999', 'سائق تجريبي 9999', '078-XXXXXXX', 'https://images.pexels.com/photos/32078145/pexels-photo-32078145.jpeg?auto=compress&cs=tinysrgb&h=650&w=940')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.nashama_drive_drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can read active drivers" ON public.nashama_drive_drivers;
CREATE POLICY "anon can read active drivers" ON public.nashama_drive_drivers
  FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "anon cannot insert drivers" ON public.nashama_drive_drivers;
CREATE POLICY "anon cannot insert drivers" ON public.nashama_drive_drivers
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "anon cannot update drivers" ON public.nashama_drive_drivers;
CREATE POLICY "anon cannot update drivers" ON public.nashama_drive_drivers
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "anon cannot delete drivers" ON public.nashama_drive_drivers;
CREATE POLICY "anon cannot delete drivers" ON public.nashama_drive_drivers
  FOR DELETE TO anon, authenticated USING (false);

REVOKE INSERT, UPDATE, DELETE ON public.nashama_drive_drivers FROM anon, authenticated;
GRANT SELECT ON public.nashama_drive_drivers TO anon, authenticated;

DROP FUNCTION IF EXISTS public.perform_nashama_topup(numeric);

CREATE OR REPLACE FUNCTION public.perform_nashama_topup(p_driver_id text, p_amount numeric)
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
  v_driver_id text := upper(trim(p_driver_id));
BEGIN
  IF v_driver_id IS NULL OR v_driver_id = '' THEN
    RAISE EXCEPTION 'Invalid driver';
  END IF;

  IF p_amount NOT IN (5, 10, 15, 20, 25, 30, 35, 40, 45, 50) THEN
    RAISE EXCEPTION 'Invalid top-up amount';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.nashama_drive_drivers
    WHERE id = v_driver_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Driver not found';
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
  )
  SELECT name, id, p_amount, 1.00, v_total, v_reference
  FROM public.nashama_drive_drivers
  WHERE id = v_driver_id;

  RETURN QUERY
  SELECT available_balance, daily_operations, v_reference
  FROM public.nashama_drive_state
  WHERE id = 'default';
END;
$$;

REVOKE ALL ON FUNCTION public.perform_nashama_topup(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perform_nashama_topup(text, numeric) TO anon, authenticated;
