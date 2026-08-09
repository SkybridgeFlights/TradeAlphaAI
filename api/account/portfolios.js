'use strict';

// Phase 228 CP2 — portfolio surface, served by ONE serverless function.
//
// The sub-resources live in db/portfolio-handlers/ rather than as sibling files
// under api/, because every .js under api/ becomes its own Serverless Function
// and six of them pushed this project past its per-deployment function ceiling
// — the build succeeded and the deploy step failed. Keeping them as plain
// modules behind a path dispatch costs nothing at runtime (one warm function
// instead of six cold ones) and mirrors what api/account/watchlists.js already
// does for its /entities sub-resource.
//
// vercel.json rewrites /api/account/portfolios/<sub> onto this file; the
// dispatch below routes on that suffix.
//
// GET    /api/account/portfolios              — portfolios for this account
// GET    /api/account/portfolios?slug=x       — one portfolio with its children
// POST   /api/account/portfolios              body: { slug, name, base_currency?, portfolio_type? }
// PATCH  /api/account/portfolios?slug=x       body: { name?, portfolio_type?, restore? }
// DELETE /api/account/portfolios?slug=x       — soft delete (add &purge=1 to destroy)
//
// Requires a verified Clerk session. Every row this route touches is reached
// through db/portfolios.js, which resolves ownership in SQL before any read or
// write. A portfolio belonging to another account is reported as 404.

const { getSql } = require('../../db/client');
const { requireAccount, sendError } = require('../../db/auth');
const { ensureAccountSchema } = require('../../db/schema');
const { ensureAccount } = require('../../db/account');
const {
  normalizePortfolioBody,
  listPortfolios,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  requireOwnedPortfolio,
  listPositions,
  listTargets,
  listTransactions,
} = require('../../db/portfolios');

const SUB_HANDLERS = {
  positions: require('../../db/portfolio-handlers/positions'),
  targets: require('../../db/portfolio-handlers/targets'),
  transactions: require('../../db/portfolio-handlers/transactions'),
  analytics: require('../../db/portfolio-handlers/analytics'),
  snapshots: require('../../db/portfolio-handlers/snapshots'),
};

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Sub-resource dispatch happens before anything else, including auth, because
  // each sub-handler performs its own verification. Routing on the path alone
  // reads no request state and cannot leak anything.
  const sub = /\/portfolios\/([a-z]+)\/?$/.exec(new URL(req.url, 'http://localhost').pathname);
  if (sub && SUB_HANDLERS[sub[1]]) return SUB_HANDLERS[sub[1]](req, res);
  if (sub) { json(res, 404, { error: 'no such portfolio sub-resource' }); return undefined; }

  try {
    const { accountId } = await requireAccount(req);
    const sql = getSql();
    await ensureAccountSchema(sql);
    const account = await ensureAccount(sql, accountId);
    const url = new URL(req.url, 'http://localhost');
    const slug = (url.searchParams.get('slug') || '').trim().toLowerCase();

    if (req.method === 'GET') {
      if (!slug) {
        json(res, 200, { portfolios: await listPortfolios(sql, accountId) });
        return;
      }
      const portfolio = await requireOwnedPortfolio(sql, accountId, slug);
      const [positions, targets, transactions] = await Promise.all([
        listPositions(sql, portfolio.id),
        listTargets(sql, portfolio.id),
        listTransactions(sql, portfolio.id, 50),
      ]);
      json(res, 200, { portfolio: { ...portfolio, positions, targets, transactions } });
      return;
    }

    if (req.method === 'POST') {
      const input = normalizePortfolioBody(req.body);
      const created = await createPortfolio(sql, accountId, input, account && account.tier);
      json(res, 201, { portfolio: created });
      return;
    }

    if (req.method === 'PATCH') {
      if (!slug) { json(res, 400, { error: 'slug query param required' }); return; }
      json(res, 200, { portfolio: await updatePortfolio(sql, accountId, slug, req.body) });
      return;
    }

    if (req.method === 'DELETE') {
      if (!slug) { json(res, 400, { error: 'slug query param required' }); return; }
      const purge = url.searchParams.get('purge') === '1';
      json(res, 200, await deletePortfolio(sql, accountId, slug, { purge }));
      return;
    }

    res.statusCode = 405;
    res.end();
  } catch (err) {
    sendError(res, err);
  }
};
