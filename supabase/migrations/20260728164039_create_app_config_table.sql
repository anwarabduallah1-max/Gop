/*
# App config table for third-party API keys

Stores sensitive API keys (like Plisio secret key) that edge functions
need to access. Only service-role can read this table; RLS blocks
anon and authenticated access entirely.
*/

CREATE TABLE IF NOT EXISTS app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- No policies = locked down for anon/authenticated.
-- Only the service role (used by edge functions) can read/write,
-- since service role bypasses RLS.

INSERT INTO app_config (key, value)
VALUES ('plisio_secret_key', 'WKJ6Lz7wBReLCj04KpxVI7J-PwK9KjG1ehSSgg4kUF3GSWHY73RdchlDwhvuNrVp')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
