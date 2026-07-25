/*
# Micro-Crowdfunding Platform Schema

## Summary
Creates the full schema for a Stars-based crowdfunding platform.

## Tables

### profiles
Stores per-user wallet data linked to Supabase auth.users.
- id (uuid) — matches auth.users.id
- username (text) — display name
- avatar_url (text) — optional avatar URL
- stars_balance (numeric) — wallet balance in Stars (1 Star = 1 USDT)
- created_at (timestamptz)
- updated_at (timestamptz)

### requests
Funding requests created by users.
- id (uuid)
- user_id (uuid) — owner, references auth.users
- title (text) — item name / short description
- description (text) — longer details
- image_url (text) — product image
- product_url (text) — optional product link
- base_target (numeric) — cost the user wants funded (in Stars)
- final_target (numeric) — base_target * 1.10 (platform includes 10% fee)
- current_stars (numeric) — total Stars donated so far
- status (text) — 'active' | 'funded' | 'closed'
- created_at, updated_at

### transactions
Records each donation.
- id (uuid)
- donor_id (uuid) — who donated, references auth.users
- request_id (uuid) — which request
- stars_amount (numeric) — amount donated
- created_at

## Security
- RLS enabled on all three tables
- profiles: owner can read/update their own row; anyone authenticated can read others' profiles (for display names on requests)
- requests: authenticated users can read all; only the owner can create/update/delete
- transactions: authenticated users can read all (to show donor counts); only the owner can insert their own transaction
- A trigger auto-creates a profile row when a new auth user signs up
- A trigger updates current_stars on requests when a transaction is inserted
*/

-- ─────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL DEFAULT '',
  avatar_url text,
  stars_balance numeric NOT NULL DEFAULT 0 CHECK (stars_balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"        ON profiles;
DROP POLICY IF EXISTS "profiles_select_others"     ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"        ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own"        ON profiles;

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- REQUESTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  product_url text NOT NULL DEFAULT '',
  base_target numeric NOT NULL CHECK (base_target > 0),
  final_target numeric NOT NULL,
  current_stars numeric NOT NULL DEFAULT 0 CHECK (current_stars >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'funded', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requests_select_all"   ON requests;
DROP POLICY IF EXISTS "requests_insert_own"   ON requests;
DROP POLICY IF EXISTS "requests_update_own"   ON requests;
DROP POLICY IF EXISTS "requests_delete_own"   ON requests;

CREATE POLICY "requests_select_all" ON requests FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "requests_insert_own" ON requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "requests_update_own" ON requests FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "requests_delete_own" ON requests FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  stars_amount numeric NOT NULL CHECK (stars_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_all"  ON transactions;
DROP POLICY IF EXISTS "transactions_insert_own"  ON transactions;

CREATE POLICY "transactions_select_all" ON transactions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "transactions_insert_own" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = donor_id);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_requests_user_id    ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status     ON requests(status);
CREATE INDEX IF NOT EXISTS idx_transactions_request ON transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_transactions_donor   ON transactions(donor_id);

-- ─────────────────────────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- AUTO-UPDATE current_stars & STATUS ON NEW TRANSACTION
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_transaction()
RETURNS trigger AS $$
BEGIN
  UPDATE requests
  SET
    current_stars = current_stars + NEW.stars_amount,
    status = CASE
      WHEN (current_stars + NEW.stars_amount) >= final_target THEN 'funded'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.request_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_transaction_created ON transactions;
CREATE TRIGGER on_transaction_created
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION handle_new_transaction();

-- ─────────────────────────────────────────────────────────────
-- AUTO-UPDATE profiles.stars_balance ON DONATION (deduct from donor)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deduct_donor_stars()
RETURNS trigger AS $$
BEGIN
  UPDATE profiles
  SET stars_balance = stars_balance - NEW.stars_amount,
      updated_at = now()
  WHERE id = NEW.donor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donor profile not found';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_donation_deduct_stars ON transactions;
CREATE TRIGGER on_donation_deduct_stars
  BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION deduct_donor_stars();

-- ─────────────────────────────────────────────────────────────
-- RPC: BUY STARS (add Stars to user wallet)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION buy_stars(amount numeric)
RETURNS void AS $$
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  UPDATE profiles
  SET stars_balance = stars_balance + amount,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- RPC: DONATE STARS (validate balance, insert transaction atomically)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION donate_stars(p_request_id uuid, p_amount numeric)
RETURNS void AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Donation amount must be positive';
  END IF;

  SELECT stars_balance INTO v_balance
  FROM profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient Stars balance';
  END IF;

  INSERT INTO transactions (donor_id, request_id, stars_amount)
  VALUES (auth.uid(), p_request_id, p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
