'use strict';

// GET /api/account/dashboard — aggregated account snapshot used by the
// /account/ overview UI. Returns everything the dashboard needs in one
// round-trip: account row + counts (watchlists, entities, preferences,
// alerts, followed) + recent activity (last 5 preference changes).
//
// Requires a verified Clerk session. Self-healing schema + ensure-row.

const { getSql } = require('../../db/client');
const { requireAccount, sendError } = require('../../db/auth');
const { ensureAccountSchema } = require('../../db/schema');
const { ensureAccount } = require('../../db/account');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
  try {
    const { accountId } = await requireAccount(req);
    const sql = getSql();
    await ensureAccountSchema(sql);
    await ensureAccount(sql, accountId);

    const [account, counts, recentPrefs] = await Promise.all([
      sql`SELECT account_id, locale, tier, primary_email_hash, created_at, last_seen_at FROM accounts WHERE account_id = ${accountId} LIMIT 1`,
      sql`
        SELECT
          (SELECT COUNT(*)::int FROM watchlists WHERE account_id = ${accountId}) AS watchlists,
          (SELECT COUNT(*)::int FROM watchlist_entities e JOIN watchlists w ON e.watchlist_id = w.id WHERE w.account_id = ${accountId}) AS watchlist_entities,
          (SELECT COUNT(*)::int FROM preference_overrides WHERE account_id = ${accountId}) AS preference_overrides,
          (SELECT COUNT(*)::int FROM followed_targets WHERE account_id = ${accountId}) AS followed,
          (SELECT COUNT(*)::int FROM alert_subscriptions WHERE account_id = ${accountId} AND enabled) AS alert_subscriptions,
          (SELECT COUNT(*)::int FROM alert_dispatch_history WHERE account_id = ${accountId}) AS alerts_dispatched
      `,
      sql`SELECT name, value, updated_at FROM preference_overrides WHERE account_id = ${accountId} ORDER BY updated_at DESC LIMIT 5`,
    ]);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      account: account[0] || null,
      counts: counts[0] || {},
      recent_preference_changes: recentPrefs,
    }));
  } catch (err) {
    sendError(res, err);
  }
};
