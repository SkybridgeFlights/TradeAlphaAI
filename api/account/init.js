'use strict';

// POST /api/account/init
// Called once on first sign-in by clerk-bootstrap.js. Upserts the
// account row keyed by the Clerk user_id (sub claim). primary_email_hash
// is sha256(primary_email) — the raw email NEVER leaves Clerk.
//
// Body (JSON): { primary_email_hash?: string, locale?: 'en'|'ar' }
// All fields optional. The endpoint is idempotent — calling it again
// just bumps last_seen_at.

const { getSql } = require('../../db/client');
const { requireAccount, sendError } = require('../../db/auth');
const { ensureAccountSchema } = require('../../db/schema');

const ALLOWED_LOCALES = new Set(['en', 'ar']);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  // GET → read current account row without upserting (used by profile UI).
  // POST → upsert (first-sign-in flow + last_seen bump).
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.statusCode = 405;
    res.end();
    return;
  }
  try {
    const { accountId, claims } = await requireAccount(req);
    const sql = getSql();
    await ensureAccountSchema(sql);
    if (req.method === 'GET') {
      const rows = await sql`SELECT account_id, locale, tier, primary_email_hash, created_at, last_seen_at FROM accounts WHERE account_id = ${accountId} LIMIT 1`;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        account: rows[0] || null,
        clerk: { sub: accountId, iss: claims && claims.iss || null },
      }));
      return;
    }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const locale = ALLOWED_LOCALES.has(body.locale) ? body.locale : null;
    // Validate the email hash shape if provided — must be 64 lowercase hex.
    const emailHash = (typeof body.primary_email_hash === 'string' && /^[a-f0-9]{64}$/.test(body.primary_email_hash))
      ? body.primary_email_hash
      : null;
    const rows = await sql`
      INSERT INTO accounts (account_id, primary_email_hash, locale, last_seen_at)
      VALUES (${accountId}, ${emailHash}, COALESCE(${locale}, 'en'), NOW())
      ON CONFLICT (account_id) DO UPDATE
        SET last_seen_at = NOW(),
            primary_email_hash = COALESCE(EXCLUDED.primary_email_hash, accounts.primary_email_hash),
            locale = COALESCE(${locale}, accounts.locale)
      RETURNING account_id, locale, tier, created_at, last_seen_at
    `;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ account: rows[0] || null }));
  } catch (err) {
    sendError(res, err);
  }
};
