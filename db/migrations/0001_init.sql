-- Phase 221-Pg CP1 — initial schema.
-- One row per Clerk account. account_id is the Clerk user sub claim
-- ("user_..."). Email is NEVER stored in clear text — only a sha256 hash
-- for joining alert subscriptions. tier defaults to 'free' until Phase
-- 225 billing flips it. created_at + last_seen_at are server-set.

CREATE TABLE IF NOT EXISTS accounts (
  account_id          TEXT PRIMARY KEY,
  primary_email_hash  TEXT,
  locale              TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  tier                TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium', 'institutional')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS accounts_last_seen_idx ON accounts(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS accounts_tier_idx ON accounts(tier) WHERE deleted_at IS NULL;

-- Per-account preference overrides. Each row keys (account_id, name)
-- where name MUST be one of the ALLOWED_PREFERENCES enum keys
-- (preferred_language, preferred_homepage, preferred_entity_type,
-- preferred_research_view, preferred_workspace_layout,
-- preferred_market_focus). Validator enforces the value ∈ enum at the
-- API layer (NOT here in SQL — Postgres can't enforce an enum tied to
-- another JSON file). updated_at = audit trail.

CREATE TABLE IF NOT EXISTS preference_overrides (
  account_id   TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  value        TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, name)
);

CREATE INDEX IF NOT EXISTS preference_overrides_updated_idx ON preference_overrides(updated_at DESC);
