-- 1. Replace donate_stars to update campaign progress
DROP FUNCTION IF EXISTS public.donate_stars(uuid, numeric);

CREATE OR REPLACE FUNCTION public.donate_stars(p_request_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_balance numeric;
  v_new_total numeric;
  v_target numeric;
  v_is_unlimited boolean;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Donation amount must be positive';
  END IF;

  -- Lock the donor's profile row and check balance
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

  -- Deduct from donor
  UPDATE profiles
  SET stars_balance = stars_balance - p_amount,
      updated_at = now()
  WHERE id = auth.uid();

  -- Record the transaction
  INSERT INTO transactions (donor_id, request_id, stars_amount)
  VALUES (auth.uid(), p_request_id, p_amount);

  -- Get the request's target and current state
  SELECT final_target, current_stars, is_unlimited
  INTO v_target, v_new_total, v_is_unlimited
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_new_total IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- Increment the campaign's raised amount
  v_new_total := v_new_total + p_amount;

  -- Update the request; auto-mark as funded if goal is met (unless unlimited)
  IF v_is_unlimited THEN
    UPDATE requests
    SET current_stars = v_new_total,
        updated_at = now()
    WHERE id = p_request_id;
  ELSE
    UPDATE requests
    SET current_stars = v_new_total,
        status = CASE WHEN v_new_total >= v_target THEN 'funded' ELSE status END,
        updated_at = now()
    WHERE id = p_request_id;
  END IF;

  RETURN v_new_total;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.donate_stars(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.donate_stars(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.donate_stars(uuid, numeric) TO authenticated;

-- 2. Create pay_platform_fee function
CREATE OR REPLACE FUNCTION public.pay_platform_fee()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_balance numeric;
  v_platform_post_id uuid := '103da574-f131-407d-899f-8f510df18cda';
  v_new_total numeric;
BEGIN
  -- Lock and check balance
  SELECT stars_balance INTO v_balance
  FROM profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < 5 THEN
    RAISE EXCEPTION 'Insufficient balance. You need at least 5 Stars to pay the platform fee.';
  END IF;

  -- Deduct 5 stars
  UPDATE profiles
  SET stars_balance = stars_balance - 5,
      updated_at = now()
  WHERE id = auth.uid();

  -- Record as a donation to the platform campaign
  INSERT INTO transactions (donor_id, request_id, stars_amount)
  VALUES (auth.uid(), v_platform_post_id, 5);

  -- Update the platform campaign's raised amount
  SELECT current_stars INTO v_new_total
  FROM requests
  WHERE id = v_platform_post_id
  FOR UPDATE;

  IF v_new_total IS NOT NULL THEN
    v_new_total := v_new_total + 5;
    UPDATE requests
    SET current_stars = v_new_total,
        updated_at = now()
    WHERE id = v_platform_post_id;
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pay_platform_fee() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pay_platform_fee() FROM anon;
GRANT EXECUTE ON FUNCTION public.pay_platform_fee() TO authenticated;

-- 3. Reload PostgREST schema cache so buy_stars(integer) is discovered
NOTIFY pgrst, 'reload schema';