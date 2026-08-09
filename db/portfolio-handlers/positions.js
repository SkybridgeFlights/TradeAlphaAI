'use strict';

// Phase 228 CP2 — portfolio positions.
//
// GET    /api/account/portfolios/positions?portfolio_slug=x
// POST   /api/account/portfolios/positions   body: { portfolio_slug, symbol, instrument_type?,
//                                                    quantity, average_cost?, current_value_override?,
//                                                    contribution_amount?, note? }
// DELETE /api/account/portfolios/positions?portfolio_slug=x&symbol=SPY[&instrument_type=etf]
//
// POST upserts on (portfolio, instrument_type, symbol), so a client that sends
// the same holding twice corrects it rather than duplicating it.
//
// Symbols are resolved against the shipped registries before storage: a symbol
// this platform does not cover is rejected, because a position it cannot value
// would be a permanent hole in every coverage figure the analytics report.
//
// instrument_type is optional and best omitted — the registry decides it. A
// sector ETF such as XLK resolves as 'etf' rather than 'sector', since that is
// what it is; sending instrument_type='sector' for it is rejected as a mismatch.

const { getSql } = require('../client');
const { requireAccount, sendError } = require('../auth');
const { ensureAccountSchema } = require('../schema');
const { ensureAccount } = require('../account');
const {
  normalizePositionBody,
  upsertPosition,
  deletePosition,
  requireOwnedPortfolio,
  listPositions,
} = require('../portfolios');

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { accountId } = await requireAccount(req);
    const sql = getSql();
    await ensureAccountSchema(sql);
    await ensureAccount(sql, accountId);
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET') {
      const portfolioSlug = (url.searchParams.get('portfolio_slug') || '').trim().toLowerCase();
      if (!portfolioSlug) { json(res, 400, { error: 'portfolio_slug query param required' }); return; }
      const portfolio = await requireOwnedPortfolio(sql, accountId, portfolioSlug);
      json(res, 200, { positions: await listPositions(sql, portfolio.id) });
      return;
    }

    if (req.method === 'POST') {
      const result = await upsertPosition(sql, accountId, normalizePositionBody(req.body));
      json(res, 200, result);
      return;
    }

    if (req.method === 'DELETE') {
      const result = await deletePosition(sql, accountId, {
        portfolio_slug: (url.searchParams.get('portfolio_slug') || '').trim().toLowerCase(),
        instrument_type: (url.searchParams.get('instrument_type') || '').trim().toLowerCase() || null,
        symbol: (url.searchParams.get('symbol') || '').trim().toUpperCase(),
      });
      json(res, 200, result);
      return;
    }

    res.statusCode = 405;
    res.end();
  } catch (err) {
    sendError(res, err);
  }
};
