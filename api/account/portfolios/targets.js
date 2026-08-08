'use strict';

// Phase 228 CP2 — portfolio target weights.
//
// GET /api/account/portfolios/targets?portfolio_slug=x
// PUT /api/account/portfolios/targets   body: { portfolio_slug, targets: [{ symbol, target_weight }] }
//
// PUT replaces the whole set, which is the only way to edit weights without a
// moment where the stored set is internally inconsistent.
//
// The weights are NOT required to sum to 100. A holder may deliberately record
// targets for part of a portfolio, and rejecting that would force them to
// fabricate the remainder. The response reports the stated total instead, so
// drift is read against a number they chose rather than one assumed here.
//
// A target is a holder's own intent. Nothing in this route or below it compares
// a target to a market view, ranks one allocation against another, or suggests
// a change.

const { getSql } = require('../../../db/client');
const { requireAccount, sendError } = require('../../../db/auth');
const { ensureAccountSchema } = require('../../../db/schema');
const { ensureAccount } = require('../../../db/account');
const {
  parseBody,
  setTargets,
  requireOwnedPortfolio,
  listTargets,
} = require('../../../db/portfolios');

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
      const targets = await listTargets(sql, portfolio.id);
      const stated = targets.reduce((acc, t) => acc + Number(t.target_weight), 0);
      json(res, 200, {
        targets,
        stated_total_weight: Math.round(stated * 10000) / 10000,
        covers_whole_portfolio: Math.abs(stated - 100) < 0.0001,
      });
      return;
    }

    if (req.method === 'PUT') {
      const body = parseBody(req.body);
      const portfolioSlug = typeof body.portfolio_slug === 'string'
        ? body.portfolio_slug.trim().toLowerCase()
        : '';
      if (!portfolioSlug) { json(res, 400, { error: 'portfolio_slug required' }); return; }
      json(res, 200, await setTargets(sql, accountId, portfolioSlug, body.targets));
      return;
    }

    res.statusCode = 405;
    res.end();
  } catch (err) {
    sendError(res, err);
  }
};
