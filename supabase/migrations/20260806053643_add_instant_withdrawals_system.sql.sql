/*
# Automatic Instant Payout System

## Summary
Adds a `withdrawals` table and three SECURITY DEFINER RPCs that let any
authenticated user instantly withdraw part or all of their Stars balance as
USDT via the Plisio withdrawal API — at any time, regardless of whether their
campaigns are fully funded.

## New Tables

### withdrawals
Tracks every instant payout log.
- id (uuid, PK)
- user_id (uuid, NOT NULL, DEFAULT auth.uid()) — the user withdrawing
- stars_amount (numeric, NOT NULL, > 0) — gross Stars withdrawn
- platform_fee_stars (numeric, NOT NULL, >= 0) — 10% platform cut
- usdt_amount (numeric, NOT NULL, > 0) — net USDT sent to wallet (after fee)
- wallet_address (text, NOT NULL) — destination TRC20 address
- status (text, NOT NULL, DEFAULT 'processing') — 'processing' | 'completed' | 'failed'
- plisio_txn_id (text, nullable) — Plisio operation/transaction ID
- created_at (timestamptz, NOT NULL, DEFAULT now())
- completed_at (timestamptz, nullable)

## New RPCs

### create_withdrawal(p_stars_amount numeric, p_wallet_address text) RETURNS uuid
- SECURITY DEFINER. Validates the caller has enough Stars balance.
- Deducts the Stars from profiles.stars_balance immediately (prevents double-spend).
- Computes 10% platform fee and net USDT (1 Star = 1 USDT).
- Inserts a 'processing' withdrawal row and returns its id.

### complete_withdrawal(p_withdrawal_id uuid, p_plisio_txn_id text) RETURNS void
- SECURITY DEFINER. Marks a withdrawal 'completed', stores the Plisio txn id,
  sets completed_at. Idempotent.

### fail_withdrawal(p_withdrawal_id uuid) RETURNS void
- SECURITY DEFINER. Marks a withdrawal 'failed' AND refunds the full Stars
  amount back to the user's balance. Idempotent.

## Security
- RLS enabled on withdrawals; 4 owner-scoped policies (select/insert/update/delete).
- All three RPCs are SECURITY DEFINER with locked search_path and authenticated-only EXECUTE.
- The API key is NEVER stored in the withdrawals table — it lives only in the
  edge function's environment / app_config.
*/

-- ─────────────────────────────────────────────────────────────
-- WITHDRAWALS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  stars_amount        numeric     NOT NULL CHECK (stars_amount > 0),
  platform_fee_stars  numeric     NOT NULL CHECK (platform_fee_stars >= 0),
  usdt_amount         numeric     NOT NULL CHECK (usdt_amount > 0),
  wallet_address      text        NOT NULL,
  status              text        NOT NULL DEFAULT 'processing'
                                  CHECK (status IN ('processing','completed','failed')),
  plisio_txn_id       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "w_select_own"  ON withdrawals;
DROP POLICY IF EXISTS "w_insert_own"  ON withdrawals;
DROP POLICY IF EXISTS "w_update_own"  ON withdrawals;
DROP POLICY IF EXISTS "w_delete_own"  ON withdrawals;

CREATE POLICY "w_select_own" ON withdrawals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "w_insert_own" ON withdrawals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "w_update_own" ON withdrawals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "w_delete_own" ON withdrawals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user    ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status  ON withdrawals(status);

-- ─────────────────────────────────────────────────────────────
-- RPC: CREATE_WITHDRAWAL
-- Deducts Stars immediately, creates a 'processing' row, returns its id.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_withdrawal(
  p_stars_amount   numeric,
  p_wallet_address text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance   numeric;
  v_fee       numeric;
  v_net       numeric;
  v_wid       uuid;
BEGIN
  IF p_stars_amount IS NULL OR p_stars_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be positive';
  END IF;

  IF p_wallet_address IS NULL OR length(trim(p_wallet_address)) < 20 THEN
    RAISE EXCEPTION 'A valid wallet address is required';
  END IF;

  -- Lock and check balance
  SELECT stars_balance INTO v_balance
  FROM profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < p_stars_amount THEN
    RAISE EXCEPTION 'Insufficient Stars balance (available: %)', v_balance;
  END IF;

  -- Compute 10% platform fee
  v_fee := round(p_stars_amount * 0.10, 2);
  v_net := p_stars_amount - v_fee;

  IF v_net <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount too small after platform fee';
  END IF;

  -- Deduct Stars immediately (prevents double-spend)
  UPDATE profiles
  SET stars_balance = stars_balance - p_stars_amount,
      updated_at = now()
  WHERE id = auth.uid();

  -- Create the withdrawal log row
  INSERT INTO withdrawals (user_id, stars_amount, platform_fee_stars, usdt_amount, wallet_address, status)
  VALUES (auth.uid(), p_stars_amount, v_fee, v_net, trim(p_wallet_address), 'processing')
  RETURNING id INTO v_wid;

  RETURN v_wid;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_withdrawal(numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_withdrawal(numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION create_withdrawal(numeric, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- RPC: COMPLETE_WITHDRAWAL
-- Marks withdrawal completed, stores Plisio txn id. Idempotent.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_withdrawal(
  p_withdrawal_id uuid,
  p_plisio_txn_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM withdrawals WHERE id = p_withdrawal_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found: %', p_withdrawal_id;
  END IF;

  IF v_status = 'completed' THEN
    RETURN; -- idempotent
  END IF;

  IF v_status != 'processing' THEN
    RAISE EXCEPTION 'Cannot complete withdrawal in status: %', v_status;
  END IF;

  UPDATE withdrawals
  SET status = 'completed',
      plisio_txn_id = p_plisio_txn_id,
      completed_at = now()
  WHERE id = p_withdrawal_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_withdrawal(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION complete_withdrawal(uuid, text) FROM anon;
-- Service role needs to call this from the edge function
GRANT EXECUTE ON FUNCTION complete_withdrawal(uuid, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- RPC: FAIL_WITHDRAWAL
-- Marks withdrawal failed AND refunds Stars to user balance. Idempotent.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fail_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status      text;
  v_user_id    uuid;
  v_stars      numeric;
BEGIN
  SELECT status, user_id, stars_amount
  INTO v_status, v_user_id, v_stars
  FROM withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal not found: %', p_withdrawal_id;
  END IF;

  IF v_status = 'failed' THEN
    RETURN; -- idempotent
  END IF;

  IF v_status != 'processing' THEN
    RAISE EXCEPTION 'Cannot fail withdrawal in status: %', v_status;
  END IF;

  -- Refund the Stars
  UPDATE profiles
  SET stars_balance = stars_balance + v_stars,
      updated_at = now()
  WHERE id = v_user_id;

  -- Mark failed
  UPDATE withdrawals
  SET status = 'failed',
      completed_at = now()
  WHERE id = p_withdrawal_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION fail_withdrawal(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fail_withdrawal(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION fail_withdrawal(uuid) TO authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
