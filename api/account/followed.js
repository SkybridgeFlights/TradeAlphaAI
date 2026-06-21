'use strict';

// GET    /api/account/followed       — list followed targets
// POST   /api/account/followed       body: { target_kind, target_id }
// DELETE /api/account/followed?target_kind=asset&target_id=spy

const { getSql } = require('../../db/client');
const { requireAccount, sendError } = require('../../db/auth');
const { ensureAccountSchema } = require('../../db/schema');

const ALLOWED_KINDS = new Set(['asset', 'sector', 'equity', 'etf', 'research_category', 'regime_state', 'watchlist']);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { accountId } = await requireAccount(req);
    const sql = getSql();
    await ensureAccountSchema(sql);
    if (req.method === 'GET') {
      const rows = await sql`SELECT target_kind, target_id, followed_at FROM followed_targets WHERE account_id = ${accountId} ORDER BY followed_at DESC`;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ followed: rows }));
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      const { target_kind, target_id } = body;
      if (!ALLOWED_KINDS.has(target_kind) || !target_id) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: `target_kind must be one of ${[...ALLOWED_KINDS].join(',')} and target_id required` }));
        return;
      }
      await sql`
        INSERT INTO followed_targets (account_id, target_kind, target_id)
        VALUES (${accountId}, ${target_kind}, ${target_id})
        ON CONFLICT DO NOTHING
      `;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ followed: { target_kind, target_id } }));
      return;
    }
    if (req.method === 'DELETE') {
      const url = new URL(req.url, 'http://localhost');
      const target_kind = url.searchParams.get('target_kind');
      const target_id = url.searchParams.get('target_id');
      if (!ALLOWED_KINDS.has(target_kind) || !target_id) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'target_kind + target_id query params required' }));
        return;
      }
      await sql`DELETE FROM followed_targets WHERE account_id = ${accountId} AND target_kind = ${target_kind} AND target_id = ${target_id}`;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ deleted: { target_kind, target_id } }));
      return;
    }
    res.statusCode = 405;
    res.end();
  } catch (err) {
    sendError(res, err);
  }
};
