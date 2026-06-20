-- Phase 221-Pg CP1 — followed surfaces.
-- A "follow" is a lightweight subscription to ANY existing public
-- surface (an entity page, a research category, a regime state, or
-- a watchlist). target_kind disambiguates the target_id namespace.
-- Used by personalized research (Phase 223) + future alert routing.

CREATE TABLE IF NOT EXISTS followed_targets (
  account_id    TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  target_kind   TEXT NOT NULL CHECK (target_kind IN ('asset', 'sector', 'equity', 'etf', 'research_category', 'regime_state', 'watchlist')),
  target_id     TEXT NOT NULL,
  followed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, target_kind, target_id)
);

CREATE INDEX IF NOT EXISTS followed_targets_account_idx ON followed_targets(account_id);
CREATE INDEX IF NOT EXISTS followed_targets_target_idx ON followed_targets(target_kind, target_id);
