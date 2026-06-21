'use strict';

const ALLOWED_TYPES = new Set(['asset', 'sector', 'equity', 'etf']);

function normalizeEntityBody(body) {
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const watchlist_slug = typeof body.watchlist_slug === 'string' ? body.watchlist_slug.trim() : '';
  const type = typeof body.type === 'string' ? body.type.trim().toLowerCase() : '';
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  return { watchlist_slug, type, symbol, slug };
}

function validateEntityInput(input) {
  if (!input.watchlist_slug || !input.type || !input.symbol || !input.slug) {
    return 'watchlist_slug + type + symbol + slug required';
  }
  if (!ALLOWED_TYPES.has(input.type)) {
    return `type must be one of ${[...ALLOWED_TYPES].join(',')}`;
  }
  if (!/^[A-Z0-9._-]{1,16}$/.test(input.symbol)) return 'symbol format invalid';
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.slug)) return 'slug format invalid';
  return null;
}

async function findOwnedWatchlist(sql, accountId, watchlistSlug) {
  const rows = await sql`
    SELECT id, slug, title_en, title_ar, thesis_en, thesis_ar, created_at, updated_at
    FROM watchlists
    WHERE account_id = ${accountId} AND slug = ${watchlistSlug}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function listWatchlistEntities(sql, watchlistId) {
  return sql`
    SELECT type, symbol, slug, position, added_at
    FROM watchlist_entities
    WHERE watchlist_id = ${watchlistId}
    ORDER BY position, symbol
  `;
}

async function addWatchlistEntity(sql, accountId, input) {
  const error = validateEntityInput(input);
  if (error) {
    const err = new Error(error);
    err.status = 400;
    throw err;
  }
  const watchlist = await findOwnedWatchlist(sql, accountId, input.watchlist_slug);
  if (!watchlist) {
    const err = new Error('watchlist not found');
    err.status = 404;
    throw err;
  }
  const rows = await sql`
    INSERT INTO watchlist_entities (watchlist_id, type, symbol, slug)
    VALUES (${watchlist.id}, ${input.type}, ${input.symbol}, ${input.slug})
    ON CONFLICT (watchlist_id, type, symbol) DO UPDATE
      SET slug = EXCLUDED.slug
    RETURNING type, symbol, slug, position, added_at
  `;
  const entities = await listWatchlistEntities(sql, watchlist.id);
  return {
    entity: rows[0] || { type: input.type, symbol: input.symbol, slug: input.slug },
    watchlist: { ...watchlist, entities },
  };
}

async function removeWatchlistEntity(sql, accountId, input) {
  if (!input.watchlist_slug || !input.type || !input.symbol) {
    const err = new Error('watchlist_slug + type + symbol required');
    err.status = 400;
    throw err;
  }
  if (!ALLOWED_TYPES.has(input.type)) {
    const err = new Error(`type must be one of ${[...ALLOWED_TYPES].join(',')}`);
    err.status = 400;
    throw err;
  }
  const watchlist = await findOwnedWatchlist(sql, accountId, input.watchlist_slug);
  if (!watchlist) {
    const err = new Error('watchlist not found');
    err.status = 404;
    throw err;
  }
  await sql`DELETE FROM watchlist_entities WHERE watchlist_id = ${watchlist.id} AND type = ${input.type} AND symbol = ${input.symbol}`;
  const entities = await listWatchlistEntities(sql, watchlist.id);
  return {
    deleted: { watchlist_slug: input.watchlist_slug, type: input.type, symbol: input.symbol },
    watchlist: { ...watchlist, entities },
  };
}

module.exports = {
  ALLOWED_TYPES,
  normalizeEntityBody,
  validateEntityInput,
  addWatchlistEntity,
  removeWatchlistEntity,
};
