'use strict';

// GET    /api/account/watchlists           — all watchlists for this account
// POST   /api/account/watchlists           body: { slug, title_en, title_ar, thesis_en?, thesis_ar? }
// DELETE /api/account/watchlists?slug=foo
//
// POST /api/account/watchlists/entities    body: { watchlist_slug, type, symbol, slug }
// DELETE /api/account/watchlists/entities?watchlist_slug=foo&type=asset&symbol=SPY
//
// Tier ceilings (free=3, premium=25, institutional=100) enforced here;
// entity types limited to {asset, sector, equity, etf}. Symbols are NOT
// validated against the registries — that's a future hardening pass.

const { getSql } = require('../../db/client');
const { requireAccount, sendError } = require('../../db/auth');
const { ensureAccountSchema } = require('../../db/schema');
const { ensureAccount } = require('../../db/account');

const TIER_WATCHLIST_LIMITS = { free: 3, premium: 25, institutional: 100 };
const ALLOWED_TYPES = new Set(['asset', 'sector', 'equity', 'etf']);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { accountId } = await requireAccount(req);
    const sql = getSql();
    await ensureAccountSchema(sql);
    await ensureAccount(sql, accountId);
    const url = new URL(req.url, 'http://localhost');
    const isEntities = /\/entities$/.test(url.pathname) || url.searchParams.get('entities') === '1';

    // ─── Entities sub-resource ───────────────────────────────────────
    if (isEntities) {
      if (req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
        body = body || {};
        const { watchlist_slug, type, symbol, slug } = body;
        if (!watchlist_slug || !type || !symbol || !slug) {
          res.statusCode = 400; res.end(JSON.stringify({ error: 'watchlist_slug + type + symbol + slug required' })); return;
        }
        if (!ALLOWED_TYPES.has(type)) {
          res.statusCode = 400; res.end(JSON.stringify({ error: `type must be one of ${[...ALLOWED_TYPES].join(',')}` })); return;
        }
        const wl = await sql`SELECT id FROM watchlists WHERE account_id = ${accountId} AND slug = ${watchlist_slug} LIMIT 1`;
        if (!wl.length) { res.statusCode = 404; res.end(JSON.stringify({ error: 'watchlist not found' })); return; }
        await sql`
          INSERT INTO watchlist_entities (watchlist_id, type, symbol, slug)
          VALUES (${wl[0].id}, ${type}, ${symbol}, ${slug})
          ON CONFLICT (watchlist_id, type, symbol) DO NOTHING
        `;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ added: { watchlist_slug, type, symbol, slug } }));
        return;
      }
      if (req.method === 'DELETE') {
        const watchlist_slug = url.searchParams.get('watchlist_slug');
        const type = url.searchParams.get('type');
        const symbol = url.searchParams.get('symbol');
        if (!watchlist_slug || !type || !symbol) { res.statusCode = 400; res.end(JSON.stringify({ error: 'watchlist_slug + type + symbol required' })); return; }
        const wl = await sql`SELECT id FROM watchlists WHERE account_id = ${accountId} AND slug = ${watchlist_slug} LIMIT 1`;
        if (!wl.length) { res.statusCode = 404; res.end(JSON.stringify({ error: 'watchlist not found' })); return; }
        await sql`DELETE FROM watchlist_entities WHERE watchlist_id = ${wl[0].id} AND type = ${type} AND symbol = ${symbol}`;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ deleted: { watchlist_slug, type, symbol } }));
        return;
      }
      res.statusCode = 405; res.end(); return;
    }

    // ─── Watchlists top-level ────────────────────────────────────────
    if (req.method === 'GET') {
      const lists = await sql`
        SELECT w.id, w.slug, w.title_en, w.title_ar, w.thesis_en, w.thesis_ar, w.created_at, w.updated_at,
               COALESCE(json_agg(json_build_object('type', e.type, 'symbol', e.symbol, 'slug', e.slug, 'position', e.position)
                                  ORDER BY e.position, e.symbol) FILTER (WHERE e.symbol IS NOT NULL), '[]') AS entities
        FROM watchlists w
        LEFT JOIN watchlist_entities e ON e.watchlist_id = w.id
        WHERE w.account_id = ${accountId}
        GROUP BY w.id
        ORDER BY w.created_at
      `;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ watchlists: lists }));
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      const { slug, title_en, title_ar, thesis_en, thesis_ar } = body;
      if (!slug || !title_en || !title_ar) {
        res.statusCode = 400; res.end(JSON.stringify({ error: 'slug + title_en + title_ar required' })); return;
      }
      // Enforce tier ceiling.
      const accountRows = await sql`SELECT tier FROM accounts WHERE account_id = ${accountId} LIMIT 1`;
      const tier = (accountRows[0] && accountRows[0].tier) || 'free';
      const limit = TIER_WATCHLIST_LIMITS[tier] || TIER_WATCHLIST_LIMITS.free;
      const countRows = await sql`SELECT COUNT(*)::int AS n FROM watchlists WHERE account_id = ${accountId}`;
      if (countRows[0].n >= limit) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: `tier ${tier} watchlist limit reached (${limit})` }));
        return;
      }
      try {
        const created = await sql`
          INSERT INTO watchlists (account_id, slug, title_en, title_ar, thesis_en, thesis_ar)
          VALUES (${accountId}, ${slug}, ${title_en}, ${title_ar}, ${thesis_en || null}, ${thesis_ar || null})
          RETURNING id, slug, title_en, title_ar, thesis_en, thesis_ar, created_at
        `;
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ watchlist: created[0] }));
      } catch (e) {
        if (/unique/i.test(String(e.message))) {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: 'slug already exists for this account' }));
        } else { throw e; }
      }
      return;
    }
    if (req.method === 'DELETE') {
      const slug = url.searchParams.get('slug');
      if (!slug) { res.statusCode = 400; res.end(JSON.stringify({ error: 'slug query param required' })); return; }
      await sql`DELETE FROM watchlists WHERE account_id = ${accountId} AND slug = ${slug}`;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ deleted: slug }));
      return;
    }
    res.statusCode = 405; res.end();
  } catch (err) {
    sendError(res, err);
  }
};
