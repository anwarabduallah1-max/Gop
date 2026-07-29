DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_orders' AND column_name = 'plisio_currency') THEN
    ALTER TABLE payment_orders ADD COLUMN plisio_currency text DEFAULT 'USDT_BSC';
  END IF;
END $$;
