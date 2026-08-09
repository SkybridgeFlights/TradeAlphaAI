'use strict';

// Phase 228 CP2 — portfolio persistence layer.
//
// Every portfolio API route goes through this module. It exists so the two
// rules the schema depends on are written once instead of once per route:
//
//   1. OWNERSHIP. No child table stores account_id — the schema deliberately
//      keeps a single owner column on `portfolios` so a denormalised copy can
//      never drift and become a way to read someone else's rows. The cost of
//      that choice is that every child read and write must first resolve the
//      parent through requireOwnedPortfolio(), which is the ONLY function here
//      that maps (account, slug) to a portfolio id. No route builds a child
//      query from a caller-supplied portfolio_id, so there is no path to a row
//      that skipped the ownership check.
//
//   2. EXACTNESS. Money and quantity columns are NUMERIC, never float. Values
//      arrive from JSON as numbers or strings and are passed to Postgres as
//      canonical decimal STRINGS, so a value never round-trips through binary
//      floating point on the way in. 0.1 + 0.2 must not become a stored total.
//
// A portfolio that does not belong to the caller is reported as 404, never 403:
// telling an unauthorised caller that a slug exists is itself a disclosure.
//
// Nothing here interprets a portfolio. portfolio_type is a label the holder
// picked to organise their own records; no function branches on it to produce a
// judgement, and no code path turns stored rows into a recommendation.

const { resolveSymbol } = require('../tools/portfolio-artifacts');

// Tier ceilings, mirroring the watchlist limits already in production.
const TIER_PORTFOLIO_LIMITS = { free: 2, premium: 10, institutional: 50 };
// Per-portfolio position ceiling. Uniform across tiers: it is a guard against a
// runaway client, not a feature gate.
const MAX_POSITIONS_PER_PORTFOLIO = 200;

const PORTFOLIO_TYPES = new Set(['long_term', 'retirement', 'growth', 'income', 'custom']);
const INSTRUMENT_TYPES = new Set(['etf', 'asset', 'sector', 'equity', 'cash']);
const TRANSACTION_TYPES = new Set([
  'acquisition', 'disposal', 'contribution', 'withdrawal', 'fee', 'distribution', 'adjustment',
]);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const parseBody = (body) => {
  if (typeof body === 'string') {
    try { return JSON.parse(body) || {}; } catch { return {}; }
  }
  return body || {};
};

// ---------------------------------------------------------------------------
// Decimal handling
// ---------------------------------------------------------------------------

/**
 * Validate a decimal and return it as a canonical string for Postgres.
 *
 * Accepts a number or a string so a client that already holds an exact decimal
 * (from a brokerage statement, say) can send it without JSON's float conversion
 * mangling it first. Returns { value } on success, { error } on failure, and
 * { value: null } for an absent optional field — null being genuinely "not
 * recorded" rather than zero, which the analytics layer treats differently.
 */
function validateDecimal(raw, field, { precision, scale, min = 0, max = null, required = false }) {
  if (raw === null || raw === undefined || raw === '') {
    return required ? { error: `${field} is required` } : { value: null };
  }
  if (typeof raw === 'number' && !Number.isFinite(raw)) return { error: `${field} must be a finite number` };
  if (typeof raw !== 'number' && typeof raw !== 'string') return { error: `${field} must be a number` };

  // Reject exponent notation rather than expanding it: a client sending 1e21
  // for a share count is far more likely to have a bug than a real position.
  const text = String(raw).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return { error: `${field} must be a plain decimal number` };

  const [intPart, fracPart = ''] = text.replace('-', '').split('.');
  if (fracPart.length > scale) return { error: `${field} accepts at most ${scale} decimal places` };
  if (intPart.replace(/^0+(?=\d)/, '').length > precision - scale) {
    return { error: `${field} exceeds the stored precision` };
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return { error: `${field} must be a finite number` };
  if (min !== null && numeric < min) return { error: `${field} must be >= ${min}` };
  if (max !== null && numeric > max) return { error: `${field} must be <= ${max}` };

  // Canonical form, trailing zeros trimmed. Postgres parses the string exactly.
  const normalized = fracPart ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
  return { value: normalized === '-0' ? '0' : normalized };
}

const money = (raw, field, opts = {}) => validateDecimal(raw, field, { precision: 24, scale: 4, ...opts });
const units = (raw, field, opts = {}) => validateDecimal(raw, field, { precision: 24, scale: 8, ...opts });

// ---------------------------------------------------------------------------
// Input validation — pure, so the validator's self-test can exercise it without
// a database.
// ---------------------------------------------------------------------------

function normalizePortfolioBody(body) {
  const b = parseBody(body);
  return {
    slug: typeof b.slug === 'string' ? b.slug.trim().toLowerCase() : '',
    name: typeof b.name === 'string' ? b.name.trim() : '',
    base_currency: typeof b.base_currency === 'string' ? b.base_currency.trim().toUpperCase() : 'USD',
    portfolio_type: typeof b.portfolio_type === 'string' ? b.portfolio_type.trim().toLowerCase() : 'custom',
  };
}

function validatePortfolioInput(input) {
  if (!input.slug || !input.name) return 'slug + name required';
  if (!SLUG_RE.test(input.slug)) return 'slug format invalid';
  if (input.name.length > 120) return 'name must be 120 characters or fewer';
  if (!CURRENCY_RE.test(input.base_currency)) return 'base_currency must be a 3-letter ISO code';
  if (!PORTFOLIO_TYPES.has(input.portfolio_type)) {
    return `portfolio_type must be one of ${[...PORTFOLIO_TYPES].join(',')}`;
  }
  return null;
}

function normalizePositionBody(body) {
  const b = parseBody(body);
  return {
    portfolio_slug: typeof b.portfolio_slug === 'string' ? b.portfolio_slug.trim().toLowerCase() : '',
    instrument_type: typeof b.instrument_type === 'string' ? b.instrument_type.trim().toLowerCase() : '',
    symbol: typeof b.symbol === 'string' ? b.symbol.trim().toUpperCase() : '',
    quantity: b.quantity,
    average_cost: b.average_cost,
    current_value_override: b.current_value_override,
    contribution_amount: b.contribution_amount,
    note: typeof b.note === 'string' ? b.note.trim() : null,
  };
}

/**
 * Validate a position and resolve its symbol against the shipped registries.
 *
 * An unrecognised symbol is rejected here rather than stored, because the
 * analytics layer can only describe instruments it holds evidence for: a
 * position in an unknown ticker could never be valued or explained, and would
 * sit in the portfolio as a permanent hole in every coverage figure.
 *
 * Returns { error } or { value } where value carries the registry's own slug —
 * the client does not get to choose it, so a position can never point at
 * research for a different instrument.
 */
function validatePositionInput(input) {
  if (!input.portfolio_slug) return { error: 'portfolio_slug required' };
  if (!SLUG_RE.test(input.portfolio_slug)) return { error: 'portfolio_slug format invalid' };
  if (!input.symbol) return { error: 'symbol required' };
  if (input.instrument_type && !INSTRUMENT_TYPES.has(input.instrument_type)) {
    return { error: `instrument_type must be one of ${[...INSTRUMENT_TYPES].join(',')}` };
  }

  // A symbol resolves when it is a listing this platform can identify. Research
  // coverage is a separate axis, reported alongside the position — a holder
  // recording a legitimate listing we have not researched has done nothing
  // wrong, and the error path must not imply otherwise.
  const resolved = resolveSymbol(input.symbol, input.instrument_type || null);
  if (!resolved) {
    return {
      error: input.instrument_type
        ? `${input.symbol} is not listed as a ${input.instrument_type} in our symbol directory`
        : `${input.symbol} is not in our symbol directory — check the ticker, or it may be listed outside the US markets we index`,
    };
  }

  const quantity = units(input.quantity, 'quantity', { required: resolved.instrument_type !== 'cash' });
  if (quantity.error) return { error: quantity.error };
  const averageCost = units(input.average_cost, 'average_cost');
  if (averageCost.error) return { error: averageCost.error };
  const override = money(input.current_value_override, 'current_value_override');
  if (override.error) return { error: override.error };
  const contribution = money(input.contribution_amount, 'contribution_amount');
  if (contribution.error) return { error: contribution.error };

  // Cash is recorded as an amount, not a share count: a cash row with neither a
  // quantity nor an override carries no balance and would silently value at 0.
  if (resolved.instrument_type === 'cash' && quantity.value === null && override.value === null) {
    return { error: 'cash positions require quantity or current_value_override' };
  }
  if (input.note && input.note.length > 500) return { error: 'note must be 500 characters or fewer' };

  return {
    value: {
      instrument_type: resolved.instrument_type,
      symbol: resolved.symbol,
      slug: resolved.slug,
      // Not persisted — the schema stores what the holder owns, not what we
      // happen to know about it today. Coverage is recomputed on read so it
      // improves automatically as the intelligence universe grows.
      _coverage: resolved.coverage,
      quantity: quantity.value === null ? '0' : quantity.value,
      average_cost: averageCost.value,
      current_value_override: override.value,
      contribution_amount: contribution.value,
      note: input.note || null,
    },
  };
}

function validateTargetInput(entry) {
  const b = parseBody(entry);
  const symbol = typeof b.symbol === 'string' ? b.symbol.trim().toUpperCase() : '';
  if (!symbol) return { error: 'symbol required' };
  const resolved = resolveSymbol(symbol, null);
  if (!resolved) return { error: `symbol ${symbol} is not covered by this platform` };
  const weight = validateDecimal(b.target_weight, 'target_weight', {
    precision: 7, scale: 4, min: 0, max: 100, required: true,
  });
  if (weight.error) return { error: weight.error };
  return { value: { symbol: resolved.symbol, target_weight: weight.value } };
}

function normalizeTransactionBody(body) {
  const b = parseBody(body);
  return {
    portfolio_slug: typeof b.portfolio_slug === 'string' ? b.portfolio_slug.trim().toLowerCase() : '',
    symbol: typeof b.symbol === 'string' ? b.symbol.trim().toUpperCase() : '',
    transaction_type: typeof b.transaction_type === 'string' ? b.transaction_type.trim().toLowerCase() : '',
    quantity: b.quantity,
    price: b.price,
    fees: b.fees,
    executed_at: b.executed_at,
  };
}

function validateTransactionInput(input) {
  if (!input.portfolio_slug) return { error: 'portfolio_slug required' };
  if (!input.symbol) return { error: 'symbol required' };
  if (!TRANSACTION_TYPES.has(input.transaction_type)) {
    return { error: `transaction_type must be one of ${[...TRANSACTION_TYPES].join(',')}` };
  }
  const resolved = resolveSymbol(input.symbol, null);
  if (!resolved) return { error: `symbol ${input.symbol} is not covered by this platform` };

  const quantity = units(input.quantity, 'quantity');
  if (quantity.error) return { error: quantity.error };
  const price = units(input.price, 'price');
  if (price.error) return { error: price.error };
  const fees = money(input.fees, 'fees');
  if (fees.error) return { error: fees.error };

  let executedAt = null;
  if (input.executed_at !== null && input.executed_at !== undefined && input.executed_at !== '') {
    const parsed = new Date(input.executed_at);
    if (Number.isNaN(parsed.getTime())) return { error: 'executed_at must be a valid date' };
    // A ledger records what already happened. A future timestamp would let a
    // planned trade sit in history as though it had been executed.
    if (parsed.getTime() > Date.now() + 60_000) return { error: 'executed_at cannot be in the future' };
    executedAt = parsed.toISOString();
  }

  return {
    value: {
      symbol: resolved.symbol,
      transaction_type: input.transaction_type,
      quantity: quantity.value,
      price: price.value,
      fees: fees.value === null ? '0' : fees.value,
      executed_at: executedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

/**
 * The single ownership gate. Every child-table operation resolves its parent
 * here first, so a portfolio id only ever reaches a query after the caller's
 * account has been matched against it in SQL.
 *
 * Soft-deleted portfolios are invisible by default: a deleted portfolio must
 * not accept new positions or appear in a listing.
 */
async function findOwnedPortfolio(sql, accountId, slug, { includeDeleted = false } = {}) {
  if (!accountId || !slug) return null;
  const rows = includeDeleted
    ? await sql`
        SELECT id, slug, name, base_currency, portfolio_type, created_at, updated_at, deleted_at
        FROM portfolios
        WHERE account_id = ${accountId} AND slug = ${slug}
        LIMIT 1`
    : await sql`
        SELECT id, slug, name, base_currency, portfolio_type, created_at, updated_at, deleted_at
        FROM portfolios
        WHERE account_id = ${accountId} AND slug = ${slug} AND deleted_at IS NULL
        LIMIT 1`;
  return rows[0] || null;
}

/** findOwnedPortfolio, or a 404. Used by every route that touches a child row. */
async function requireOwnedPortfolio(sql, accountId, slug, opts) {
  const portfolio = await findOwnedPortfolio(sql, accountId, slug, opts);
  if (!portfolio) throw httpError(404, 'portfolio not found');
  return portfolio;
}

// ---------------------------------------------------------------------------
// Portfolios
// ---------------------------------------------------------------------------

async function listPortfolios(sql, accountId) {
  return sql`
    SELECT p.id, p.slug, p.name, p.base_currency, p.portfolio_type, p.created_at, p.updated_at,
           COUNT(pos.id)::int AS position_count
    FROM portfolios p
    LEFT JOIN portfolio_positions pos ON pos.portfolio_id = p.id
    WHERE p.account_id = ${accountId} AND p.deleted_at IS NULL
    GROUP BY p.id
    ORDER BY p.created_at
  `;
}

async function createPortfolio(sql, accountId, input, tier) {
  const error = validatePortfolioInput(input);
  if (error) throw httpError(400, error);

  const limit = TIER_PORTFOLIO_LIMITS[tier] || TIER_PORTFOLIO_LIMITS.free;
  const countRows = await sql`
    SELECT COUNT(*)::int AS n FROM portfolios WHERE account_id = ${accountId} AND deleted_at IS NULL
  `;
  if (countRows[0].n >= limit) {
    throw httpError(403, `tier ${tier || 'free'} portfolio limit reached (${limit})`);
  }

  // A soft-deleted portfolio still holds its slug, because restoring it must
  // bring back the positions that came with it. Rather than silently reviving
  // rows the caller has forgotten about, say what happened and let them choose.
  const existing = await findOwnedPortfolio(sql, accountId, input.slug, { includeDeleted: true });
  if (existing && existing.deleted_at) {
    throw httpError(409, 'slug belongs to a deleted portfolio — restore it or delete it permanently');
  }
  if (existing) throw httpError(409, 'slug already exists for this account');

  const rows = await sql`
    INSERT INTO portfolios (account_id, slug, name, base_currency, portfolio_type)
    VALUES (${accountId}, ${input.slug}, ${input.name}, ${input.base_currency}, ${input.portfolio_type})
    RETURNING id, slug, name, base_currency, portfolio_type, created_at, updated_at
  `;
  return rows[0];
}

async function updatePortfolio(sql, accountId, slug, body) {
  const b = parseBody(body);
  const restore = b.restore === true;
  const portfolio = await requireOwnedPortfolio(sql, accountId, slug, { includeDeleted: restore });
  if (!restore && portfolio.deleted_at) throw httpError(404, 'portfolio not found');

  const name = typeof b.name === 'string' ? b.name.trim() : null;
  if (name !== null && (!name || name.length > 120)) throw httpError(400, 'name must be 1-120 characters');
  const type = typeof b.portfolio_type === 'string' ? b.portfolio_type.trim().toLowerCase() : null;
  if (type !== null && !PORTFOLIO_TYPES.has(type)) {
    throw httpError(400, `portfolio_type must be one of ${[...PORTFOLIO_TYPES].join(',')}`);
  }
  // base_currency is deliberately immutable. Changing it would reinterpret every
  // stored amount as a different unit without converting any of them.
  if (b.base_currency && b.base_currency.toUpperCase() !== portfolio.base_currency) {
    throw httpError(400, 'base_currency cannot be changed after creation');
  }

  // The casts are load-bearing: Postgres cannot infer a type for a parameter
  // that arrives as NULL inside COALESCE, and a partial update legitimately
  // sends NULL for the fields it is not changing.
  const rows = await sql`
    UPDATE portfolios
    SET name           = COALESCE(${name}::text, name),
        portfolio_type = COALESCE(${type}::text, portfolio_type),
        deleted_at     = CASE WHEN ${restore}::boolean THEN NULL ELSE deleted_at END,
        updated_at     = NOW()
    WHERE id = ${portfolio.id} AND account_id = ${accountId}
    RETURNING id, slug, name, base_currency, portfolio_type, created_at, updated_at, deleted_at
  `;
  return rows[0];
}

/**
 * Soft delete by default; `purge` removes the row and cascades every child away.
 * Soft delete is reversible and keeps the holder's records intact, so it is what
 * an ordinary DELETE does — a portfolio is somebody's own data, and destroying
 * it on a single unqualified call is not a recoverable mistake.
 */
async function deletePortfolio(sql, accountId, slug, { purge = false } = {}) {
  const portfolio = await requireOwnedPortfolio(sql, accountId, slug, { includeDeleted: true });
  if (purge) {
    await sql`DELETE FROM portfolios WHERE id = ${portfolio.id} AND account_id = ${accountId}`;
    return { deleted: slug, purged: true };
  }
  await sql`
    UPDATE portfolios SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${portfolio.id} AND account_id = ${accountId} AND deleted_at IS NULL
  `;
  return { deleted: slug, purged: false, restorable: true };
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

async function listPositions(sql, portfolioId) {
  return sql`
    SELECT instrument_type, symbol, slug, quantity, average_cost, current_value_override,
           contribution_amount, note, created_at, updated_at
    FROM portfolio_positions
    WHERE portfolio_id = ${portfolioId}
    ORDER BY symbol
  `;
}

async function upsertPosition(sql, accountId, input) {
  const checked = validatePositionInput(input);
  if (checked.error) throw httpError(400, checked.error);
  const position = checked.value;
  const portfolio = await requireOwnedPortfolio(sql, accountId, input.portfolio_slug);

  const countRows = await sql`
    SELECT COUNT(*)::int AS n FROM portfolio_positions WHERE portfolio_id = ${portfolio.id}
  `;
  const existing = await sql`
    SELECT id FROM portfolio_positions
    WHERE portfolio_id = ${portfolio.id} AND instrument_type = ${position.instrument_type} AND symbol = ${position.symbol}
    LIMIT 1
  `;
  if (!existing.length && countRows[0].n >= MAX_POSITIONS_PER_PORTFOLIO) {
    throw httpError(403, `portfolio position limit reached (${MAX_POSITIONS_PER_PORTFOLIO})`);
  }

  const rows = await sql`
    INSERT INTO portfolio_positions (
      portfolio_id, instrument_type, symbol, slug, quantity, average_cost,
      current_value_override, contribution_amount, note
    )
    VALUES (
      ${portfolio.id}, ${position.instrument_type}, ${position.symbol}, ${position.slug},
      ${position.quantity}, ${position.average_cost}, ${position.current_value_override},
      ${position.contribution_amount}, ${position.note}
    )
    ON CONFLICT (portfolio_id, instrument_type, symbol) DO UPDATE
      SET quantity               = EXCLUDED.quantity,
          average_cost           = EXCLUDED.average_cost,
          current_value_override = EXCLUDED.current_value_override,
          contribution_amount    = EXCLUDED.contribution_amount,
          note                   = EXCLUDED.note,
          slug                   = EXCLUDED.slug,
          updated_at             = NOW()
    RETURNING instrument_type, symbol, slug, quantity, average_cost,
              current_value_override, contribution_amount, note, updated_at
  `;
  await touchPortfolio(sql, portfolio.id, accountId);
  return { position: rows[0], positions: await listPositions(sql, portfolio.id) };
}

async function deletePosition(sql, accountId, { portfolio_slug, instrument_type, symbol }) {
  if (!portfolio_slug || !symbol) throw httpError(400, 'portfolio_slug + symbol required');
  if (instrument_type && !INSTRUMENT_TYPES.has(instrument_type)) {
    throw httpError(400, `instrument_type must be one of ${[...INSTRUMENT_TYPES].join(',')}`);
  }
  const portfolio = await requireOwnedPortfolio(sql, accountId, portfolio_slug);
  const deleted = instrument_type
    ? await sql`
        DELETE FROM portfolio_positions
        WHERE portfolio_id = ${portfolio.id} AND instrument_type = ${instrument_type} AND symbol = ${symbol}
        RETURNING symbol`
    : await sql`
        DELETE FROM portfolio_positions
        WHERE portfolio_id = ${portfolio.id} AND symbol = ${symbol}
        RETURNING symbol`;
  if (!deleted.length) throw httpError(404, 'position not found');
  await touchPortfolio(sql, portfolio.id, accountId);
  return { deleted: symbol, positions: await listPositions(sql, portfolio.id) };
}

async function touchPortfolio(sql, portfolioId, accountId) {
  await sql`UPDATE portfolios SET updated_at = NOW() WHERE id = ${portfolioId} AND account_id = ${accountId}`;
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

async function listTargets(sql, portfolioId) {
  return sql`
    SELECT symbol, target_weight, created_at, updated_at
    FROM portfolio_targets WHERE portfolio_id = ${portfolioId} ORDER BY symbol
  `;
}

/**
 * Replace the target set wholesale. The sum is reported, never enforced: a
 * holder may deliberately set targets for part of a portfolio, and rejecting
 * that would force them to invent the remainder. Drift is then read against a
 * total they stated rather than one this code assumed.
 */
async function setTargets(sql, accountId, portfolioSlug, entries) {
  if (!Array.isArray(entries)) throw httpError(400, 'targets must be an array');
  if (entries.length > MAX_POSITIONS_PER_PORTFOLIO) throw httpError(400, 'too many targets');
  const portfolio = await requireOwnedPortfolio(sql, accountId, portfolioSlug);

  const validated = [];
  const seen = new Set();
  for (const entry of entries) {
    const checked = validateTargetInput(entry);
    if (checked.error) throw httpError(400, checked.error);
    if (seen.has(checked.value.symbol)) throw httpError(400, `duplicate target for ${checked.value.symbol}`);
    seen.add(checked.value.symbol);
    validated.push(checked.value);
  }

  await sql`DELETE FROM portfolio_targets WHERE portfolio_id = ${portfolio.id}`;
  for (const t of validated) {
    await sql`
      INSERT INTO portfolio_targets (portfolio_id, symbol, target_weight)
      VALUES (${portfolio.id}, ${t.symbol}, ${t.target_weight})
    `;
  }
  await touchPortfolio(sql, portfolio.id, accountId);

  const targets = await listTargets(sql, portfolio.id);
  const stated = targets.reduce((acc, t) => acc + Number(t.target_weight), 0);
  return {
    targets,
    stated_total_weight: Math.round(stated * 10000) / 10000,
    covers_whole_portfolio: Math.abs(stated - 100) < 0.0001,
  };
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

async function listTransactions(sql, portfolioId, limit = 200) {
  return sql`
    SELECT id, symbol, transaction_type, quantity, price, fees, executed_at, created_at
    FROM portfolio_transactions
    WHERE portfolio_id = ${portfolioId}
    ORDER BY executed_at DESC, id DESC
    LIMIT ${limit}
  `;
}

async function addTransaction(sql, accountId, input) {
  const checked = validateTransactionInput(input);
  if (checked.error) throw httpError(400, checked.error);
  const tx = checked.value;
  const portfolio = await requireOwnedPortfolio(sql, accountId, input.portfolio_slug);

  const rows = tx.executed_at
    ? await sql`
        INSERT INTO portfolio_transactions (portfolio_id, symbol, transaction_type, quantity, price, fees, executed_at)
        VALUES (${portfolio.id}, ${tx.symbol}, ${tx.transaction_type}, ${tx.quantity}, ${tx.price}, ${tx.fees}, ${tx.executed_at})
        RETURNING id, symbol, transaction_type, quantity, price, fees, executed_at, created_at`
    : await sql`
        INSERT INTO portfolio_transactions (portfolio_id, symbol, transaction_type, quantity, price, fees)
        VALUES (${portfolio.id}, ${tx.symbol}, ${tx.transaction_type}, ${tx.quantity}, ${tx.price}, ${tx.fees})
        RETURNING id, symbol, transaction_type, quantity, price, fees, executed_at, created_at`;
  await touchPortfolio(sql, portfolio.id, accountId);
  return { transaction: rows[0] };
}

async function deleteTransaction(sql, accountId, portfolioSlug, transactionId) {
  const id = Number(transactionId);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'valid transaction id required');
  const portfolio = await requireOwnedPortfolio(sql, accountId, portfolioSlug);
  const deleted = await sql`
    DELETE FROM portfolio_transactions WHERE id = ${id} AND portfolio_id = ${portfolio.id} RETURNING id
  `;
  if (!deleted.length) throw httpError(404, 'transaction not found');
  return { deleted: id };
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

async function listSnapshots(sql, portfolioId, limit = 365) {
  return sql`
    SELECT snapshot_date, total_value, invested_capital, position_count,
           allocation_json, analytics_json, created_at
    FROM portfolio_snapshots
    WHERE portfolio_id = ${portfolioId}
    ORDER BY snapshot_date DESC
    LIMIT ${limit}
  `;
}

/**
 * Store a computed result AS IT WAS READ.
 *
 * The analytics blob is written verbatim, including its coverage and basis
 * fields, and is never recomputed on the way out. That is the whole point of
 * the table: a snapshot is a record of what the platform could see on a given
 * day, and rebuilding it from today's data would turn history into a restatement.
 *
 * One row per portfolio per day — re-saving updates that day rather than
 * appending, so the series measures the portfolio and not how often somebody
 * pressed save.
 */
async function saveSnapshot(sql, accountId, portfolioSlug, computed) {
  const portfolio = await requireOwnedPortfolio(sql, accountId, portfolioSlug);
  const rows = await sql`
    INSERT INTO portfolio_snapshots (
      portfolio_id, total_value, invested_capital, position_count, allocation_json, analytics_json
    )
    VALUES (
      ${portfolio.id}, ${computed.total_value}::numeric, ${computed.invested_capital}::numeric,
      ${computed.position_count}, ${JSON.stringify(computed.allocation || null)}::jsonb,
      ${JSON.stringify(computed.analytics || null)}::jsonb
    )
    ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE
      SET total_value      = EXCLUDED.total_value,
          invested_capital = EXCLUDED.invested_capital,
          position_count   = EXCLUDED.position_count,
          allocation_json  = EXCLUDED.allocation_json,
          analytics_json   = EXCLUDED.analytics_json
    RETURNING snapshot_date, total_value, invested_capital, position_count, created_at
  `;
  return rows[0];
}

/**
 * Annotate stored positions with their CURRENT coverage level.
 *
 * Computed on read rather than stored, so a holding automatically gains
 * research or full-intelligence coverage the day the intelligence universe
 * reaches it — without a migration and without rewriting anyone's rows.
 */
function withCoverage(positions, artifacts = null) {
  const registry = require('../tools/symbol-registry');
  return (positions || []).map((p) => {
    const hit = registry.resolve(p.symbol, null, artifacts);
    return {
      ...p,
      coverage: hit ? hit.coverage : registry.COVERAGE.BASIC,
      listing_name: hit ? hit.name : null,
      exchange: hit ? hit.exchange : null,
    };
  });
}

// Invested capital is deliberately NOT computed here. The CP5 engine already
// reports it, from holder-recorded contribution amounts, with an availability
// flag and a stated basis. A second definition in the persistence layer — say,
// quantity times average cost — would be a different number under the same
// name, and whichever one a caller happened to read would look authoritative.
// Routes take it from the engine's `invested_capital` block.

module.exports = {
  TIER_PORTFOLIO_LIMITS,
  MAX_POSITIONS_PER_PORTFOLIO,
  PORTFOLIO_TYPES,
  INSTRUMENT_TYPES,
  TRANSACTION_TYPES,
  httpError,
  parseBody,
  validateDecimal,
  normalizePortfolioBody,
  validatePortfolioInput,
  normalizePositionBody,
  validatePositionInput,
  validateTargetInput,
  normalizeTransactionBody,
  validateTransactionInput,
  findOwnedPortfolio,
  requireOwnedPortfolio,
  listPortfolios,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  listPositions,
  upsertPosition,
  deletePosition,
  listTargets,
  setTargets,
  listTransactions,
  addTransaction,
  deleteTransaction,
  listSnapshots,
  saveSnapshot,
  withCoverage,
};
