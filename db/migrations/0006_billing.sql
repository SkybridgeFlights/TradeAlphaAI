-- Phase 234 - Stripe billing persistence.
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  account_id TEXT PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','premium','institutional')),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS billing_subscriptions_customer_idx ON billing_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS billing_subscriptions_status_idx ON billing_subscriptions(status);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
