'use strict';

// Phase 228 CP2 — portfolio transaction ledger.
//
// GET    /api/account/portfolios/transactions?portfolio_slug=x[&limit=200]
// POST   /api/account/portfolios/transactions   body: { portfolio_slug, symbol, transaction_type,
//                                                       quantity?, price?, fees?, executed_at? }
// DELETE /api/account/portfolios/transactions?portfolio_slug=x&id=123
//
// The ledger records what a holder already did, so contribution and fee totals
// are real rather than inferred. The type vocabulary is deliberately accounting
// language — acquisition/disposal, not buy/sell — because this platform does not
// execute, time or propose transactions, and a ledger written in instruction
// verbs invites being read as one. `executed_at` cannot be in the future for the
// same reason: a planned trade must not sit in history as though it happened.

const { getSql } = require('../../../db/client');
const { requireAccount, sendError } = require('../../../db/auth');
const { ensureAccountSchema } = require('../../../db/schema');
const { ensureAccount } = require('../../../db/account');
const {
  normalizeTransactionBody,
  addTransaction,
  deleteTransaction,
  requireOwnedPortfolio,
  listTransactions,
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
    const portfolioSlug = (url.searchParams.get('portfolio_slug') || '').trim().toLowerCase();

    if (req.method === 'GET') {
      if (!portfolioSlug) { json(res, 400, { error: 'portfolio_slug query param required' }); return; }
      const portfolio = await requireOwnedPortfolio(sql, accountId, portfolioSlug);
      const requested = Number(url.searchParams.get('limit'));
      const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 500) : 200;
      json(res, 200, { transactions: await listTransactions(sql, portfolio.id, limit) });
      return;
    }

    if (req.method === 'POST') {
      json(res, 201, await addTransaction(sql, accountId, normalizeTransactionBody(req.body)));
      return;
    }

    if (req.method === 'DELETE') {
      if (!portfolioSlug) { json(res, 400, { error: 'portfolio_slug query param required' }); return; }
      json(res, 200, await deleteTransaction(sql, accountId, portfolioSlug, url.searchParams.get('id')));
      return;
    }

    res.statusCode = 405;
    res.end();
  } catch (err) {
    sendError(res, err);
  }
};
