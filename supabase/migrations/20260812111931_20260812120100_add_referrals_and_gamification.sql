CREATE OR REPLACE FUNCTION public.generate_referral_code() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE v_code text;
BEGIN
  LOOP
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$function$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text, ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL OR referral_code = '';
ALTER TABLE public.profiles ALTER COLUMN referral_code SET DEFAULT public.generate_referral_code(), ALTER COLUMN referral_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles (referred_by);
CREATE TABLE IF NOT EXISTS public.referral_earnings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, source_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, source_type text NOT NULL CHECK (source_type IN ('platform_fee', 'payout_fee')), source_id uuid NOT NULL, fee_stars numeric NOT NULL CHECK (fee_stars > 0), platform_share_stars numeric NOT NULL CHECK (platform_share_stars >= 0), referrer_share_stars numeric NOT NULL CHECK (referrer_share_stars > 0), created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT referral_earnings_source_key UNIQUE (source_type, source_id));
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referral_earnings_select_own ON public.referral_earnings;
DROP POLICY IF EXISTS referral_earnings_insert_none ON public.referral_earnings;
DROP POLICY IF EXISTS referral_earnings_update_none ON public.referral_earnings;
DROP POLICY IF EXISTS referral_earnings_delete_none ON public.referral_earnings;
CREATE POLICY referral_earnings_select_own ON public.referral_earnings FOR SELECT TO authenticated USING (referrer_id = auth.uid());
CREATE POLICY referral_earnings_insert_none ON public.referral_earnings FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY referral_earnings_update_none ON public.referral_earnings FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY referral_earnings_delete_none ON public.referral_earnings FOR DELETE TO authenticated USING (false);
REVOKE INSERT, UPDATE, DELETE ON public.referral_earnings FROM anon, authenticated;
GRANT SELECT ON public.referral_earnings TO authenticated;
REVOKE UPDATE (stars_balance, referral_code, referred_by) ON public.profiles FROM authenticated;
GRANT UPDATE (username, avatar_url) ON public.profiles TO authenticated;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE v_referral_code text; v_referred_by uuid;
BEGIN
  v_referral_code := upper(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')));
  IF v_referral_code <> '' THEN SELECT id INTO v_referred_by FROM public.profiles WHERE referral_code = v_referral_code AND id <> NEW.id; END IF;
  INSERT INTO public.profiles (id, username, referred_by) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), v_referred_by) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_referral_earning(p_source_user_id uuid, p_source_type text, p_source_id uuid, p_fee_stars numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE v_referrer_id uuid; v_inserted_id uuid; v_referrer_share numeric; v_platform_share numeric;
BEGIN
  IF p_fee_stars IS NULL OR p_fee_stars <= 0 THEN RETURN; END IF;
  SELECT referred_by INTO v_referrer_id FROM public.profiles WHERE id = p_source_user_id FOR SHARE;
  IF v_referrer_id IS NULL OR v_referrer_id = p_source_user_id THEN RETURN; END IF;
  v_referrer_share := round(p_fee_stars * 0.50, 2); v_platform_share := p_fee_stars - v_referrer_share;
  INSERT INTO public.referral_earnings (referrer_id, source_user_id, source_type, source_id, fee_stars, platform_share_stars, referrer_share_stars) VALUES (v_referrer_id, p_source_user_id, p_source_type, p_source_id, p_fee_stars, v_platform_share, v_referrer_share) ON CONFLICT (source_type, source_id) DO NOTHING RETURNING id INTO v_inserted_id;
  IF v_inserted_id IS NOT NULL THEN UPDATE public.profiles SET stars_balance = stars_balance + v_referrer_share, updated_at = now() WHERE id = v_referrer_id; END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.record_referral_earning(uuid, text, uuid, numeric) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.get_referral_stats() RETURNS TABLE (referral_code text, invited_count bigint, earned_stars numeric) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp AS $function$ SELECT p.referral_code, (SELECT count(*) FROM public.profiles invited WHERE invited.referred_by = auth.uid()), COALESCE((SELECT sum(e.referrer_share_stars) FROM public.referral_earnings e WHERE e.referrer_id = auth.uid()), 0) FROM public.profiles p WHERE p.id = auth.uid(); $function$;
REVOKE EXECUTE ON FUNCTION public.get_referral_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_top_supporters() RETURNS TABLE (username text, avatar_url text, donated_stars numeric, referral_stars numeric, total_stars numeric) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp AS $function$ WITH donor_totals AS (SELECT donor_id AS user_id, sum(stars_amount) AS donated_stars FROM public.transactions GROUP BY donor_id), referral_totals AS (SELECT referrer_id AS user_id, sum(referrer_share_stars) AS referral_stars FROM public.referral_earnings GROUP BY referrer_id) SELECT p.username, p.avatar_url, COALESCE(d.donated_stars, 0), COALESCE(r.referral_stars, 0), COALESCE(d.donated_stars, 0) + COALESCE(r.referral_stars, 0) FROM public.profiles p LEFT JOIN donor_totals d ON d.user_id = p.id LEFT JOIN referral_totals r ON r.user_id = p.id WHERE COALESCE(d.donated_stars, 0) + COALESCE(r.referral_stars, 0) > 0 ORDER BY 5 DESC, p.username ASC LIMIT 10; $function$;
REVOKE EXECUTE ON FUNCTION public.get_top_supporters() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_supporters() TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.create_payout_request(p_request_id uuid, p_wallet_address text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE v_req public.requests%ROWTYPE; v_gross numeric; v_fee numeric; v_net numeric; v_payout_id uuid;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.user_id <> auth.uid() THEN RAISE EXCEPTION 'Only the request owner can withdraw funds'; END IF;
  IF v_req.status <> 'funded' THEN RAISE EXCEPTION 'Request must be funded before withdrawal'; END IF;
  IF length(trim(p_wallet_address)) < 10 THEN RAISE EXCEPTION 'Wallet address is invalid'; END IF;
  v_gross := v_req.current_stars; v_fee := round(v_gross * 0.10, 2); v_net := v_gross - v_fee;
  INSERT INTO public.payout_requests (request_id, creator_id, gross_stars, platform_fee_stars, net_stars, net_usdt, wallet_address, status) VALUES (p_request_id, auth.uid(), v_gross, v_fee, v_net, v_net, trim(p_wallet_address), 'processing') RETURNING id INTO v_payout_id;
  PERFORM public.record_referral_earning(auth.uid(), 'payout_fee', v_payout_id, v_fee); RETURN v_payout_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_payout_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payout_request(uuid, text) TO authenticated;
CREATE OR REPLACE FUNCTION public.pay_platform_fee() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE v_balance numeric; v_platform_post_id uuid := '103da574-f131-407d-899f-8f510df18cda'; v_new_total numeric; v_transaction_id uuid; v_fee numeric := 5;
BEGIN
  SELECT stars_balance INTO v_balance FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < v_fee THEN RAISE EXCEPTION 'Insufficient Stars balance'; END IF;
  UPDATE public.profiles SET stars_balance = stars_balance - v_fee, updated_at = now() WHERE id = auth.uid();
  INSERT INTO public.transactions (donor_id, request_id, stars_amount) VALUES (auth.uid(), v_platform_post_id, v_fee) RETURNING id INTO v_transaction_id;
  SELECT current_stars INTO v_new_total FROM public.requests WHERE id = v_platform_post_id FOR UPDATE;
  IF v_new_total IS NOT NULL THEN UPDATE public.requests SET current_stars = v_new_total + v_fee, updated_at = now() WHERE id = v_platform_post_id; END IF;
  PERFORM public.record_referral_earning(auth.uid(), 'platform_fee', v_transaction_id, v_fee); RETURN true;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.pay_platform_fee() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_platform_fee() TO authenticated;
NOTIFY pgrst, 'reload schema';