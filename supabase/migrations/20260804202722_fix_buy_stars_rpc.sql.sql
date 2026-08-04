/*
# Fix buy_stars RPC function

## Summary
Replaces the existing `public.buy_stars(numeric)` function with a corrected
`public.buy_stars(integer)` version that:
  - Accepts an integer amount (matching the frontend's JS number type).
  - Returns the user's new star balance (integer) so the frontend can update
    the UI immediately without a second query.
  - Uses a fixed `search_path` for security (prevents search_path injection
    on the SECURITY DEFINER function).
  - Revokes EXECUTE from the `anon` role and grants it only to `authenticated`.
  - Validates that the amount is positive before updating.

## Changes
1. **Function `public.buy_stars(integer)`**
   - Drops the old `buy_stars(numeric)` signature.
   - New signature: `buy_stars(amount integer) RETURNS integer`.
   - `SECURITY DEFINER`, `LANGUAGE plpgsql`, `SET search_path = public, pg_temp`.
   - Increments `profiles.stars_balance` for `auth.uid()` and returns the new value.
   - Raises exception if amount <= 0 or if no profile row is found.

2. **Permissions**
   - `REVOKE EXECUTE ON public.buy_stars FROM PUBLIC, anon`.
   - `GRANT EXECUTE ON public.buy_stars TO authenticated`.

## Security
- The function is SECURITY DEFINER so it can update `profiles.stars_balance`
  even though the RLS UPDATE policy on profiles scopes to `auth.uid() = id`.
  Since the function's WHERE clause also uses `auth.uid() = id`, a user can
  only add stars to their own balance — the SECURITY DEFINER privilege does
  not widen access.
- `search_path` is locked to `public, pg_temp` to prevent injection.
- `anon` can no longer call this function.

## Notes
1. The old function `buy_stars(numeric)` is dropped via `DROP FUNCTION IF EXISTS`
   before creating the new one, so the signature change is clean.
2. The function is idempotent-safe to re-run (CREATE OR REPLACE).
*/