'use strict';

// Account persistence guard.
//
// Every authenticated account API route must call ensureAccount() after Clerk
// token verification and schema ensure, before reading or writing child tables.
// This prevents FK failures when a client reaches preferences/watchlists before
// /api/account/init has run.

const ALLOWED_LOCALES = new Set(['en', 'ar']);

async function ensureAccount(sql, accountId, opts = {}) {
  if (!accountId) throw new Error('accountId required');
  const locale = ALLOWED_LOCALES.has(opts.locale) ? opts.locale : null;
  const emailHash = (typeof opts.primary_email_hash === 'string' && /^[a-f0-9]{64}$/.test(opts.primary_email_hash))
    ? opts.primary_email_hash
    : null;
  const rows = await sql`
    INSERT INTO accounts (account_id, primary_email_hash, locale, last_seen_at)
    VALUES (${accountId}, ${emailHash}, COALESCE(${locale}, 'en'), NOW())
    ON CONFLICT (account_id) DO UPDATE
      SET last_seen_at = NOW(),
          primary_email_hash = COALESCE(EXCLUDED.primary_email_hash, accounts.primary_email_hash),
          locale = COALESCE(${locale}, accounts.locale)
    RETURNING account_id, locale, tier, primary_email_hash, created_at, last_seen_at
  `;
  return rows[0] || null;
}

module.exports = { ensureAccount, ALLOWED_LOCALES };
