'use strict';

// Phase 228 CP2 — portfolio snapshots.
//
// GET  /api/account/portfolios/snapshots?portfolio_slug=x[&limit=365]
// POST /api/account/portfolios/snapshots   body: { portfolio_slug }
//
// POST computes today's analytics and stores the result AS IT WAS READ,
// including its coverage and basis fields. GET returns stored rows verbatim.
//
// The reason this route never recomputes on read is that a snapshot is a record
// of what the platform could see on a given day. Rebuilding an old row from
// today's data would present a restatement as history — the series would show
// the portfolio changing when in fact only the reference data had. Where a
// figure was withheld for want of evidence, it stays withheld in that row.
//
// One row per portfolio per day: re-saving updates that day rather than
// appending, so the series measures the portfolio and not how often somebody
// pressed save.

const { getSql } = require('../client');
const { requireAccount, sendError } = require('../auth');
const { ensureAccountSchema } = require('../schema');
const { ensureAccount } = require('../account');
const {
  parseBody,
  requireOwnedPortfolio,
  listPositions,
  listSnapshots,
  saveSnapshot,
} = require('../portfolios');
const { loadArtifacts } = require('../../tools/portfolio-artifacts');
const { analysePortfolio } = require('../../tools/portfolio-analytics');

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
      const requested = Number(url.searchParams.get('limit'));
      const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 3650) : 365;
      const snapshots = await listSnapshots(sql, portfolio.id, limit);
      json(res, 200, {
        snapshots,
        basis: 'Each row is the analysis as it was computed on that date, stored unchanged. Rows are never recomputed from current data.',
      });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req.body);
      const portfolioSlug = typeof body.portfolio_slug === 'string'
        ? body.portfolio_slug.trim().toLowerCase()
        : '';
      if (!portfolioSlug) { json(res, 400, { error: 'portfolio_slug required' }); return; }

      const portfolio = await requireOwnedPortfolio(sql, accountId, portfolioSlug);
      const positions = await listPositions(sql, portfolio.id);
      if (!positions.length) { json(res, 400, { error: 'cannot snapshot an empty portfolio' }); return; }

      const analytics = analysePortfolio(positions, loadArtifacts(), { baseCurrency: portfolio.base_currency });
      // The scalar columns are filled only where the engine actually produced a
      // figure. Writing a 0 where one was withheld — across mixed currencies, or
      // with no contributions recorded — would put a false reading into history
      // that no later reader could distinguish from a real one.
      const value = (analytics && analytics.value) || {};
      const invested = (analytics && analytics.invested_capital) || {};

      const saved = await saveSnapshot(sql, accountId, portfolioSlug, {
        total_value: value.available && Number.isFinite(Number(value.total)) ? String(value.total) : null,
        invested_capital: invested.available && Number.isFinite(Number(invested.total)) ? String(invested.total) : null,
        position_count: positions.length,
        allocation: (analytics && analytics.allocation) || null,
        analytics,
      });
      json(res, 200, { snapshot: saved });
      return;
    }

    res.statusCode = 405;
    res.end();
  } catch (err) {
    sendError(res, err);
  }
};
