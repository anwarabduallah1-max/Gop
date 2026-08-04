DROP FUNCTION IF EXISTS public.buy_stars(numeric);

CREATE OR REPLACE FUNCTION public.buy_stars(amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  new_balance integer;
BEGIN
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be a positive integer';
  END IF;

  UPDATE profiles
  SET stars_balance = stars_balance + amount,
      updated_at = now()
  WHERE id = auth.uid()
  RETURNING stars_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'No profile found for the current user';
  END IF;

  RETURN new_balance;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.buy_stars(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.buy_stars(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.buy_stars(integer) TO authenticated;