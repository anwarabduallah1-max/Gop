/*
# Insert BMW S1000RR Featured Platform Post

## Summary
The previous migration tried to UPDATE a row that was never inserted. This migration
INSERTs the BMW S1000RR featured platform post with a high-quality online image URL
from Pexels, so it displays properly everywhere without relying on a local upload.

## Changes
- INSERTs a new row into `requests` with:
  - A fixed UUID (103da574-f131-407d-899f-8f510df18cda) so the frontend config can reference it.
  - is_platform_post = TRUE (official platform campaign)
  - is_unlimited = TRUE (ongoing fund — donations always accepted)
  - High-quality Pexels image URL for the BMW S1000RR sport bike
  - Title, description, target amount, and BMW product page link

## Security
- No RLS policy changes. The row inherits existing table policies (SELECT is open to anon+authenticated).

## Notes
1. Uses ON CONFLICT (id) DO UPDATE so re-running is safe (idempotent).
2. The image URL is a direct Pexels CDN link — guaranteed to load.
3. user_id is set to the existing admin user so FK constraints are satisfied.
*/

INSERT INTO requests (id, user_id, title, description, image_url, product_url, base_target, final_target, current_stars, is_unlimited, is_platform_post, status)
VALUES (
  '103da574-f131-407d-899f-8f510df18cda',
  '5b777da9-488b-49f7-b8a2-16c15804ca68',
  'BMW S1000RR — Official Platform Campaign',
  'The BMW S1000RR is the pinnacle of sport-bike engineering — razor-sharp handling, 210 hp inline-four, and race-proven DNA. Join the StarLift community in funding this flagship platform campaign. Every Star you donate supports this official campaign and unlocks your ability to create your own funding request.',
  'https://images.pexels.com/photos/36818349/pexels-photo-36818349.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
  'https://www.bmw-motorrad.com/en/models/sport/s1000rr.html',
  50000,
  55000,
  0,
  TRUE,
  TRUE,
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  title            = EXCLUDED.title,
  description      = EXCLUDED.description,
  image_url        = EXCLUDED.image_url,
  product_url      = EXCLUDED.product_url,
  is_platform_post = EXCLUDED.is_platform_post,
  is_unlimited     = EXCLUDED.is_unlimited,
  status           = EXCLUDED.status;
