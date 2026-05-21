-- RevenueCat webhook audit log
--
-- Stores every subscription lifecycle event received from the RC webhook.
-- Useful for debugging entitlement issues and auditing purchase history.
-- Only the service role (webhook Edge Function) can insert/select rows.
--
-- Run: supabase db push  (or apply via Supabase dashboard SQL editor)

CREATE TABLE IF NOT EXISTS subscription_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  event_type       text        NOT NULL,
  product_id       text,
  entitlement_ids  text[]      NOT NULL DEFAULT '{}',
  store            text,
  environment      text,       -- 'PRODUCTION' | 'SANDBOX'
  created_at       timestamptz NOT NULL DEFAULT now(),
  raw              jsonb       NOT NULL DEFAULT '{}'
);

-- Index for fast per-user event lookups (e.g. support queries)
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id
  ON subscription_events (user_id, created_at DESC);

-- Index for event type analytics
CREATE INDEX IF NOT EXISTS idx_subscription_events_type
  ON subscription_events (event_type, created_at DESC);

-- RLS: no direct user access — service role only (webhook function)
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Prevent any authenticated or anon access. The webhook function uses the
-- service role key which bypasses RLS entirely.
-- (No policies = deny-all for non-service-role roles.)
