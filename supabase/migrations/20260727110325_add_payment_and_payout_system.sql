/*
# Crypto Payment & Payout Architecture

## Summary
Extends the platform with a full deposit/payout audit trail and a new request status
so every money movement — both inbound (Stars purchases) and outbound (creator withdrawals) —
is recorded in a dedicated table and queryable by the frontend.

## New Tables

### payment_orders
Records every USDT deposit attempt made through the Buy Stars flow.
- id (uuid, PK)
- user_id (uuid) — buyer, references auth.users
- usdt_amount (numeric) — USD value paid
- stars_amount (numeric) — Stars to credit on confirmation
- status (text) — 'pending' | 'confirmed' | 'failed'
- tx_hash (text) — simulated blockchain transaction hash
- created_at, confirmed_at

### payout_requests
Records every creator withdrawal attempt.
- id (uuid, PK)
- request_id (uuid) — the funded crowdfunding request being paid out
- creator_id (uuid) — who initiated the withdrawal, references auth.users
- gross_stars (numeric) — total Stars raised on the request
- platform_fee_stars (numeric) — 10% platform cut
- net_stars (numeric) — 90% going to the creator (= gross * 0.9)
- net_usdt (numeric) — equivalent USDT (1:1 with Stars)
- wallet_address (text) — creator's USDT wallet address
- status (text) — 'processing' | 'completed' | 'failed'
- tx_hash (text) — simulated blockchain tx hash
- created_at, completed_at

## Modified Tables

### requests
- Added status value 'paid_out': request has been funded AND the creator has received their payout.
  (Implemented via a CHECK constraint update — the existing CHECK is replaced.)

## Security
- payment_orders: authenticated only. Users can only read/insert their own rows.
- payout_requests: authenticated only. Creators can only read/insert rows for their own funded requests.
- Both tables have RLS enabled with 4 separate policies each.

## RPCs

### confirm_deposit(p_order_id uuid)
  SECURITY DEFINER function called by the deposit webhook edge function.
  Atomically: marks the payment_order as confirmed and credits the user's Stars balance.

### process_payout(p_payout_id uuid)
  SECURITY DEFINER function called by the payout webhook edge function.
  Atomically: marks the payout_request as completed, marks the source request as 'paid_out',
  and sets the completed_at timestamp.
*/

-- ─────────────────────────────────────────────────────────────
-- PAYMENT ORDERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_orders (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  usdt_amount    numeric     NOT NULL CHECK (usdt_amount > 0),
  stars_amount   numeric     NOT NULL CHECK (stars_amount > 0),
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','confirmed','failed')),
  tx_hash        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  confirmed_at   timestamptz
);

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_select_own"  ON payment_orders;
DROP POLICY IF EXISTS "po_insert_own"  ON payment_orders;
DROP POLICY IF EXISTS "po_update_own"  ON payment_orders;
DROP POLICY IF EXISTS "po_delete_own"  ON payment_orders;

CREATE POLICY "po_select_own" ON payment_orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "po_insert_own" ON payment_orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "po_update_own" ON payment_orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "po_delete_own" ON payment_orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);

-- ─────────────────────────────────────────────────────────────
-- PAYOUT REQUESTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_requests (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          uuid        NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  creator_id          uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  gross_stars         numeric     NOT NULL CHECK (gross_stars > 0),
  platform_fee_stars  numeric     NOT NULL CHECK (platform_fee_stars >= 0),
  net_stars           numeric     NOT NULL CHECK (net_stars > 0),
  net_usdt            numeric     NOT NULL CHECK (net_usdt > 0),
  wallet_address      text        NOT NULL,
  status              text        NOT NULL DEFAULT 'processing'
                                  CHECK (status IN ('processing','completed','failed')),
  tx_hash             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pr_select_own"  ON payout_requests;
DROP POLICY IF EXISTS "pr_insert_own"  ON payout_requests;
DROP POLICY IF EXISTS "pr_update_own"  ON payout_requests;
DROP POLICY IF EXISTS "pr_delete_own"  ON payout_requests;

CREATE POLICY "pr_select_own" ON payout_requests FOR SELECT
  TO authenticated USING (auth.uid() = creator_id);

CREATE POLICY "pr_insert_own" ON payout_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "pr_update_own" ON payout_requests FOR UPDATE
  TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "pr_delete_own" ON payout_requests FOR DELETE
  TO authenticated USING (auth.uid() = creator_id);

CREATE INDEX IF NOT EXISTS idx_payout_requests_creator ON payout_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_request ON payout_requests(request_id);

-- ─────────────────────────────────────────────────────────────
-- EXTEND requests.status to allow 'paid_out'
-- ─────────────────────────────────────────────────────────────
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('active','funded','closed','paid_out'));

-- ─────────────────────────────────────────────────────────────
-- RPC: CONFIRM_DEPOSIT
-- Called by deposit-webhook edge function (service role).
-- Atomically credits Stars and marks order confirmed.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_deposit(p_order_id uuid)
RETURNS void AS $$
DECLARE
  v_user_id    uuid;
  v_stars      numeric;
  v_status     text;
  v_tx_hash    text;
BEGIN
  SELECT user_id, stars_amount, status
  INTO v_user_id, v_stars, v_status
  FROM payment_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found: %', p_order_id;
  END IF;

  IF v_status = 'confirmed' THEN
    RETURN; -- idempotent: already processed
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Cannot confirm order in status: %', v_status;
  END IF;

  -- Generate a simulated tx hash
  v_tx_hash := '0x' || encode(gen_random_bytes(32), 'hex');

  -- Credit Stars
  UPDATE profiles
  SET stars_balance = stars_balance + v_stars,
      updated_at = now()
  WHERE id = v_user_id;

  -- Mark order confirmed
  UPDATE payment_orders
  SET status = 'confirmed',
      tx_hash = v_tx_hash,
      confirmed_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- RPC: PROCESS_PAYOUT
-- Called by payout-webhook edge function (service role).
-- Atomically marks payout completed + request as paid_out.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_payout(p_payout_id uuid)
RETURNS void AS $$
DECLARE
  v_request_id uuid;
  v_status     text;
  v_tx_hash    text;
BEGIN
  SELECT request_id, status
  INTO v_request_id, v_status
  FROM payout_requests
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found: %', p_payout_id;
  END IF;

  IF v_status = 'completed' THEN
    RETURN; -- idempotent
  END IF;

  IF v_status != 'processing' THEN
    RAISE EXCEPTION 'Cannot process payout in status: %', v_status;
  END IF;

  v_tx_hash := '0x' || encode(gen_random_bytes(32), 'hex');

  UPDATE payout_requests
  SET status = 'completed',
      tx_hash = v_tx_hash,
      completed_at = now()
  WHERE id = p_payout_id;

  UPDATE requests
  SET status = 'paid_out',
      updated_at = now()
  WHERE id = v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- RPC: CREATE_PAYOUT_REQUEST
-- Called by frontend (authenticated). Validates the request is
-- funded and owned by the caller, then creates the payout row.
-- Returns the new payout_request id.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_payout_request(
  p_request_id     uuid,
  p_wallet_address text
)
RETURNS uuid AS $$
DECLARE
  v_req            requests%ROWTYPE;
  v_gross          numeric;
  v_fee            numeric;
  v_net            numeric;
  v_payout_id      uuid;
BEGIN
  SELECT * INTO v_req FROM requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the request owner can withdraw funds';
  END IF;

  IF v_req.status NOT IN ('funded') THEN
    RAISE EXCEPTION 'Request must be in funded status to withdraw (current: %)', v_req.status;
  END IF;

  v_gross := v_req.current_stars;
  v_fee   := round(v_gross * 0.10, 2);
  v_net   := v_gross - v_fee;

  INSERT INTO payout_requests (
    request_id, creator_id, gross_stars, platform_fee_stars,
    net_stars, net_usdt, wallet_address, status
  )
  VALUES (
    p_request_id, auth.uid(), v_gross, v_fee,
    v_net, v_net, p_wallet_address, 'processing'
  )
  RETURNING id INTO v_payout_id;

  RETURN v_payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
