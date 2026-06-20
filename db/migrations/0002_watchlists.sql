-- Phase 221-Pg CP1 — personal watchlists.
-- Each account may own up to its tier ceiling (free=3, premium=25,
-- institutional=100 — enforced at the API layer, not in SQL). Each
-- watchlist has a title (EN + AR), an optional thesis, and a stable
-- slug for client routing.

CREATE TABLE IF NOT EXISTS watchlists (
  id           BIGSERIAL PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  title_en     TEXT NOT NULL,
  title_ar     TEXT NOT NULL,
  thesis_en    TEXT,
  thesis_ar    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, slug)
);

CREATE INDEX IF NOT EXISTS watchlists_account_idx ON watchlists(account_id);

-- Entities inside a watchlist. type ∈ {asset, sector, equity, etf} —
-- the same closed set the foundation contracts validate. position lets
-- the client order items.

CREATE TABLE IF NOT EXISTS watchlist_entities (
  watchlist_id  BIGINT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('asset', 'sector', 'equity', 'etf')),
  symbol        TEXT NOT NULL,
  slug          TEXT NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (watchlist_id, type, symbol)
);

CREATE INDEX IF NOT EXISTS watchlist_entities_symbol_idx ON watchlist_entities(symbol);
