-- Phase 221-Pg CP1 — alert subscriptions + dispatch history.
-- Subscriptions: which classes + channels each account opted into.
-- History: every dispatch (or attempted dispatch) for dedup + audit.

CREATE TABLE IF NOT EXISTS alert_subscriptions (
  account_id    TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  alert_class   TEXT NOT NULL CHECK (alert_class IN ('regime_change', 'ranking_change', 'leadership_change', 'narrative_change', 'watchlist_change', 'research_change', 'change_event')),
  channel       TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'telegram')),
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, alert_class, channel)
);

CREATE INDEX IF NOT EXISTS alert_subscriptions_account_idx ON alert_subscriptions(account_id) WHERE enabled;

-- Dispatch ledger — one row per (account, event, class). The unique
-- constraint prevents double-sending the same event to the same
-- account on the same class even if a worker retries.

CREATE TABLE IF NOT EXISTS alert_dispatch_history (
  id            BIGSERIAL PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  alert_class   TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  channel       TEXT NOT NULL,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome       TEXT NOT NULL DEFAULT 'sent' CHECK (outcome IN ('sent', 'failed', 'skipped_throttle', 'skipped_confidence')),
  detail        TEXT,
  UNIQUE (account_id, alert_class, event_id, channel)
);

CREATE INDEX IF NOT EXISTS alert_dispatch_history_account_idx ON alert_dispatch_history(account_id, dispatched_at DESC);
CREATE INDEX IF NOT EXISTS alert_dispatch_history_event_idx ON alert_dispatch_history(event_id);
