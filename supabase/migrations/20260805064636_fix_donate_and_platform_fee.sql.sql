/*
# Fix donate_stars, create pay_platform_fee, and reload schema cache

## Summary
This migration fixes three critical issues:
  1. `donate_stars` now updates `requests.current_stars` and auto-marks funded.
  2. New `pay_platform_fee()` deducts 5 stars and records the fee payment.
  3. Notifies PostgREST to reload the schema cache so `buy_stars(integer)` is found.

## Changes

### 1. donate_stars (replaced)
- Old version only inserted into `transactions` — never updated `requests.current_stars`.
- New version: deducts from donor balance, inserts transaction, increments
  `requests.current_stars`, and auto-sets status to 'funded' when goal is met.
- Returns the new `current_stars` so the frontend can update the progress bar.
- Added `SET search_path = public, pg_temp` for security.
- Added FOR UPDATE lock on profile balance to prevent race conditions.

### 2. pay_platform_fee (new)
- Checks if user has >= 5 stars balance.
- Deducts 5 stars from `profiles.stars_balance`.
- Records the payment in `transactions` with `request_id` = the mandatory
  platform post ID (103da574-f131-407d-899f-8f510df18cda) so it doubles
  as a donation to the featured campaign.
- Returns true on success.
- Raises exception if insufficient balance.

### 3. Schema cache reload
- `NOTIFY pgrst, 'reload schema'` forces PostgREST to pick up the new
  function signatures, fixing the "Could not find the function" error.

## Security
- Both functions are SECURITY DEFINER with locked search_path.
- Both use auth.uid() for ownership — users can only affect their own balance.
- EXECUTE restricted to authenticated only.
*/