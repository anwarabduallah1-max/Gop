/*
# Add Platform Post Flag + Update BMW S1000RR Featured Post

## Summary
Adds an `is_platform_post` boolean column to the `requests` table so the admin
can designate any post as an "Official Platform Campaign". Updates the existing
mandatory BMW post with the correct S1000RR details, image, and platform flags.

## Changes

### Modified Tables
- `requests`
  - New column: `is_platform_post` (boolean, default false) — marks a post as an
    official platform/admin campaign, shown with a distinct badge in the UI.

### Data Updates
- Updates the existing BMW mandatory post (id = 103da574-f131-407d-899f-8f510df18cda):
  - Sets `is_platform_post = TRUE`
  - Sets `is_unlimited = TRUE` (ongoing platform fund)
  - Updates title to "BMW S1000RR — Official Platform Campaign"
  - Updates description with proper campaign copy
  - Sets the uploaded local image path
  - Sets the BMW product URL

### Security
- No new RLS policies required — column inherits existing table policies.

### Notes
1. `is_platform_post` defaults to FALSE so all existing user posts are unaffected.
2. The featured post is set to `is_unlimited = TRUE` so donations always go through.
3. Image path points to the uploaded file in the public/images folder.
*/

-- 1. Add is_platform_post column (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'is_platform_post'
  ) THEN
    ALTER TABLE requests ADD COLUMN is_platform_post BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2. Update the BMW S1000RR featured platform post
UPDATE requests SET
  is_platform_post = TRUE,
  is_unlimited     = TRUE,
  title            = 'BMW S1000RR — Official Platform Campaign',
  description      = 'The BMW S1000RR is the pinnacle of sport-bike engineering — razor-sharp handling, 210 hp inline-four, and race-proven DNA. Join the StarLift community in funding this flagship platform campaign. Every Star you donate supports this official campaign and unlocks your ability to create your own funding request.',
  image_url        = '/images/IMG_٢٠٢٦٠٨٠١_١٤٠٢٤٥.jpg',
  product_url      = 'https://www.bmw-motorrad.com/en/models/sport/s1000rr.html',
  status           = 'active'
WHERE id = '103da574-f131-407d-899f-8f510df18cda';
