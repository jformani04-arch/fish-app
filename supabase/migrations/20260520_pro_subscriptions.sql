-- Add Pro subscription fields to profiles.
-- is_pro: the canonical entitlement flag. Set true by RevenueCat webhook or manually for testing.
-- subscription_tier: 'free' | 'pro' — mirrors RevenueCat entitlement identifier.
-- subscription_expires_at: null for free, active, or lifetime; set for expiring subscriptions.
-- subscription_provider: 'revenuecat' | 'manual' — tracks how the flag was set.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_provider text;

-- Partial index: fast lookup of all Pro users (used by future admin/analytics).
CREATE INDEX IF NOT EXISTS idx_profiles_is_pro
  ON profiles (id)
  WHERE is_pro = true;

-- Constraint: subscription_tier must be a known value.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'pro'));
