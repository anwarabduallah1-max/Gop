-- Adds an "unlimited goal" flag so a request can accept donations with no cap.
-- When is_unlimited is true, the post never reaches 'funded' status and the UI hides the progress bar / target.

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS is_unlimited boolean NOT NULL DEFAULT false;

-- Update the transaction trigger so unlimited posts never auto-close.
CREATE OR REPLACE FUNCTION handle_new_transaction()
RETURNS trigger AS $$
BEGIN
  UPDATE requests
  SET
    current_stars = current_stars + NEW.stars_amount,
    status = CASE
      WHEN is_unlimited THEN status
      WHEN (current_stars + NEW.stars_amount) >= final_target THEN 'funded'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.request_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark the mandatory community fund post as unlimited and attach the BMW motorcycle image + Facebook link.
UPDATE requests
SET
  is_unlimited = true,
  title = 'BMW Motorcycle Dream',
  description = 'Help us fund the ultimate BMW motorcycle. Every Star counts — this is an open, unlimited goal so anyone can contribute any amount, anytime.',
  image_url = '/bmw-motorcycle-featured.webp',
  product_url = 'https://www.facebook.com/share/198yfK1kDT/',
  final_target = 999999999,
  base_target = 999999999
WHERE id = '103da574-f131-407d-899f-8f510df18cda';