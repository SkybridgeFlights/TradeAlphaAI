-- Phase 228 CP1 — personal portfolio persistence.
--
-- Five tables behind a single owner: portfolios belong to an account, and every
-- child cascades from the portfolio. Ownership is therefore expressible as one
-- join back to portfolios.account_id, which is what every API route checks
-- before it reads or writes a row. No child table stores account_id
-- independently — a denormalised copy could drift and become a way to read
-- another account's rows.
--
-- Money and quantity columns are NUMERIC, never float. Portfolio values are
-- summed and compared; binary floating point would make two equal portfolios
-- differ in the last place and make a stored total disagree with a recomputed
-- one.
--
-- This file is re-executed on every cold start by db/schema.js, so every
-- statement is IF NOT EXISTS and safe to run repeatedly.

-- One portfolio per row. `slug` gives the client a stable, non-enumerable-ish
-- routing key that is unique per account, matching the watchlists pattern.
-- portfolio_type is an ORGANISATIONAL LABEL the user picks to name their own
-- intent. It is never a recommendation, drives no calculation, and no code
-- branches on it to produce advice.

CREATE TABLE IF NOT EXISTS portfolios (
  id             BIGSERIAL PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  slug           TEXT NOT NULL,
  name           TEXT NOT NULL,
  base_currency  TEXT NOT NULL DEFAULT 'USD' CHECK (base_currency ~ '^[A-Z]{3}$'),
  portfolio_type TEXT NOT NULL DEFAULT 'custom'
                 CHECK (portfolio_type IN ('long_term', 'retirement', 'growth', 'income', 'custom')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  UNIQUE (account_id, slug)
);

CREATE INDEX IF NOT EXISTS portfolios_account_idx ON portfolios(account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS portfolios_updated_idx ON portfolios(updated_at DESC);

-- Holdings. instrument_type is the same closed set the watchlist tables use,
-- plus 'cash'. symbol/slug are validated at the API layer against the shipped
-- registries (ETF universe, asset, sector, equity) — an unrecognised symbol is
-- rejected before it reaches Postgres, because the analytics layer can only
-- describe instruments it has evidence for.
--
-- quantity and average_cost are NUMERIC(24,8): fractional-share brokers quote
-- to 8 decimal places. current_value_override lets a holder record a value the
-- platform cannot verify (an unlisted holding, or a stale market) without that
-- number ever being mistaken for observed market data — the API records which
-- of the two produced any figure it reports.

CREATE TABLE IF NOT EXISTS portfolio_positions (
  id                     BIGSERIAL PRIMARY KEY,
  portfolio_id           BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  instrument_type        TEXT NOT NULL CHECK (instrument_type IN ('etf', 'asset', 'sector', 'equity', 'cash')),
  symbol                 TEXT NOT NULL,
  slug                   TEXT NOT NULL,
  quantity               NUMERIC(24,8) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  average_cost           NUMERIC(24,8) CHECK (average_cost IS NULL OR average_cost >= 0),
  current_value_override NUMERIC(24,4) CHECK (current_value_override IS NULL OR current_value_override >= 0),
  contribution_amount    NUMERIC(24,4) CHECK (contribution_amount IS NULL OR contribution_amount >= 0),
  note                   TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portfolio_id, instrument_type, symbol)
);

CREATE INDEX IF NOT EXISTS portfolio_positions_portfolio_idx ON portfolio_positions(portfolio_id);

-- Optional target weights, expressed in percent. The sum is NOT constrained to
-- 100 in SQL: a holder may deliberately record targets for part of a portfolio,
-- and rejecting that would force them to fabricate the remainder. The API
-- reports the sum so drift is read against a stated total rather than an
-- assumed one.

CREATE TABLE IF NOT EXISTS portfolio_targets (
  id            BIGSERIAL PRIMARY KEY,
  portfolio_id  BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol        TEXT NOT NULL,
  target_weight NUMERIC(7,4) NOT NULL CHECK (target_weight >= 0 AND target_weight <= 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portfolio_id, symbol)
);

CREATE INDEX IF NOT EXISTS portfolio_targets_portfolio_idx ON portfolio_targets(portfolio_id);

-- Transaction ledger. The enum uses neutral accounting terms — a record of what
-- happened, never an instruction. This platform does not execute, suggest or
-- time transactions; it only lets a holder record ones they already made so
-- contribution and fee totals are real rather than inferred.

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id               BIGSERIAL PRIMARY KEY,
  portfolio_id     BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol           TEXT NOT NULL,
  transaction_type TEXT NOT NULL
                   CHECK (transaction_type IN ('acquisition', 'disposal', 'contribution', 'withdrawal', 'fee', 'distribution', 'adjustment')),
  quantity         NUMERIC(24,8) CHECK (quantity IS NULL OR quantity >= 0),
  price            NUMERIC(24,8) CHECK (price IS NULL OR price >= 0),
  fees             NUMERIC(24,4) NOT NULL DEFAULT 0 CHECK (fees >= 0),
  executed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portfolio_transactions_portfolio_idx ON portfolio_transactions(portfolio_id, executed_at DESC);

-- Point-in-time snapshots. One per portfolio per day: re-saving the same day
-- updates that row rather than accumulating duplicates, so history is a real
-- series and never a log of how often someone pressed save.
--
-- allocation_json and analytics_json store the computed result AS IT WAS,
-- including its coverage and provenance. A later snapshot must never be
-- recomputed from today's data and presented as history — the point of the
-- table is that past readings stay as they were read.

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id               BIGSERIAL PRIMARY KEY,
  portfolio_id     BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  snapshot_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  total_value      NUMERIC(24,4),
  invested_capital NUMERIC(24,4),
  position_count   INTEGER NOT NULL DEFAULT 0 CHECK (position_count >= 0),
  allocation_json  JSONB,
  analytics_json   JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portfolio_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS portfolio_snapshots_portfolio_idx ON portfolio_snapshots(portfolio_id, snapshot_date DESC);
