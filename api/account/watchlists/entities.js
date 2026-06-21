'use strict';

// POST   /api/account/watchlists/entities
// DELETE /api/account/watchlists/entities?watchlist_slug=foo&type=asset&symbol=SPY

const { getSql } = require('../../../db/client');
const { requireAccount, sendError } = require('../../../db/auth');
const { ensureAccountSchema } = require('../../../db/schema');
const { ensureAccount } = require('../../../db/account');
const {
  normalizeEntityBody,
  addWatchlistEntity,
  removeWatchlistEntity,
} = require('../../../db/watchlist-entities');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { accountId } = await requireAccount(req);
    const sql = getSql();
    await ensureAccountSchema(sql);
    await ensureAccount(sql, accountId);

    if (req.method === 'POST') {
      const result = await addWatchlistEntity(sql, accountId, normalizeEntityBody(req.body));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ added: result.entity, watchlist: result.watchlist }));
      return;
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url, 'http://localhost');
      const input = {
        watchlist_slug: url.searchParams.get('watchlist_slug') || '',
        type: (url.searchParams.get('type') || '').toLowerCase(),
        symbol: (url.searchParams.get('symbol') || '').toUpperCase(),
      };
      const result = await removeWatchlistEntity(sql, accountId, input);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      return;
    }

    res.statusCode = 405;
    res.end();
  } catch (err) {
    sendError(res, err);
  }
};
