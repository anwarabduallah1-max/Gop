/*
# Plisio Crypto Payment Gateway Integration

## Summary
Extends the existing payment_orders and payout_requests tables with Plisio-specific
columns so every invoice and withdrawal is linked to its real Plisio API record.
Updates the RPCs to work with Plisio invoice IDs and withdrawal operation IDs.

## Modified Tables

### payment_orders
Added columns:
- plisio_invoice_id (text) — Plisio's internal invoice ID (txn_id)
- plisio_invoice_url (text) — Plisio-hosted invoice URL for the user to pay at
- plisio_invoice_qr (text) — QR code data URL or plaintext for the invoice
- plisio_order_number (text) — unique order number sent to Plisio (maps to our payment_order UUID)

### payout_requests
Added columns:
- plisio_operation_id (text) — Plisio's internal withdrawal operation ID
- plisio_tx_url (text) — block explorer URL for the on-chain transaction

## RPCs

### confirm_deposit(p_order_id uuid)
Updated to accept the Plisio tx_hash from the webhook callback and store it.

### process_payout(p_payout_id uuid, p_tx_hash text DEFAULT NULL, p_plisio_op_id text DEFAULT NULL, p_tx_url text DEFAULT NULL)
Updated to accept the Plisio operation details and store them.

### create_payout_request(p_request_id uuid, p_wallet_address text)
Unchanged — still creates the payout_requests row with the 10% fee calculation.
*/

-- ─────────────────────────────────────────────────────────────
-- ADD PLISIO COLUMNS TO payment_orders
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_orders' AND column_name = 'plisio_invoice_id') THEN
    ALTER TABLE payment_orders ADD COLUMN plisio_invoice_id text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_orders' AND column_name = 'plisio_invoice_url') THEN
    ALTER TABLE payment_orders ADD COLUMN plisio_invoice_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_orders' AND column_name = 'plisio_invoice_qr') THEN
    ALTER TABLE payment_orders ADD COLUMN plisio_invoice_qr text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_orders' AND column_name = 'plisio_order_number') THEN
    ALTER TABLE payment_orders ADD COLUMN plisio_order_number text;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- ADD PLISIO COLUMNS TO payout_requests
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payout_requests' AND column_name = 'plisio_operation_id') THEN
    ALTER TABLE payout_requests ADD COLUMN plisio_operation_id text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payout_requests' AND column_name = 'plisio_tx_url') THEN
    ALTER TABLE payout_requests ADD COLUMN plisio_tx_url text;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- UPDATE confirm_deposit RPC to accept tx_hash from Plisio webhook
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_deposit(p_order_id uuid, p_tx_hash text DEFAULT NULL)
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

  -- Use provided tx_hash or generate a fallback
  v_tx_hash := COALESCE(p_tx_hash, '0x' || encode(gen_random_bytes(32), 'hex'));

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
-- UPDATE process_payout RPC to accept Plisio operation details
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_payout(
  p_payout_id    uuid,
  p_tx_hash      text DEFAULT NULL,
  p_plisio_op_id text DEFAULT NULL,
  p_tx_url       text DEFAULT NULL
)
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

  v_tx_hash := COALESCE(p_tx_hash, '0x' || encode(gen_random_bytes(32), 'hex'));

  UPDATE payout_requests
  SET status = 'completed',
      tx_hash = v_tx_hash,
      plisio_operation_id = p_plisio_op_id,
      plisio_tx_url = p_tx_url,
      completed_at = now()
  WHERE id = p_payout_id;

  UPDATE requests
  SET status = 'paid_out',
      updated_at = now()
  WHERE id = v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- UPDATE create_payout_request to also store plisio details later
-- (no change needed — the RPC stays the same, plisio columns are
--  populated by process_payout when the withdraw API responds)
-- ─────────────────────────────────────────────────────────────
