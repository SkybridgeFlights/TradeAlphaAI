'use strict';

// GET  /api/account/preferences        — current per-user overrides
// PUT  /api/account/preferences        body: { name, value }
// DELETE /api/account/preferences?name=foo
//
// Allowed names + values are loaded from data/intelligence/preferences.json
// at module load time. Any unknown name or value-outside-enum returns 400 —
// the validator-defined contract is enforced at the API boundary.

const fs = require('fs');
const path = require('path');
const { getSql } = require('../../db/client');
const { requireAccount, sendError } = require('../../db/auth');

function loadAllowed() {
  try {
    const p = path.resolve(process.cwd(), 'data', 'intelligence', 'preferences.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return j.allowed || {};
  } catch { return null; }
}
const ALLOWED = loadAllowed();

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { accountId } = await requireAccount(req);
    const sql = getSql();
    if (req.method === 'GET') {
      const rows = await sql`SELECT name, value, updated_at FROM preference_overrides WHERE account_id = ${accountId}`;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ overrides: rows }));
      return;
    }
    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      const { name, value } = body;
      if (!ALLOWED || !ALLOWED[name]) { res.statusCode = 400; res.end(JSON.stringify({ error: 'unknown preference name' })); return; }
      if (!ALLOWED[name].includes(value)) { res.statusCode = 400; res.end(JSON.stringify({ error: `value not in allowed enum for ${name}` })); return; }
      await sql`
        INSERT INTO preference_overrides (account_id, name, value, updated_at)
        VALUES (${accountId}, ${name}, ${value}, NOW())
        ON CONFLICT (account_id, name) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ name, value, updated_at: new Date().toISOString() }));
      return;
    }
    if (req.method === 'DELETE') {
      const u = new URL(req.url, 'http://localhost');
      const name = u.searchParams.get('name');
      if (!name) { res.statusCode = 400; res.end(JSON.stringify({ error: 'name query param required' })); return; }
      await sql`DELETE FROM preference_overrides WHERE account_id = ${accountId} AND name = ${name}`;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ deleted: name }));
      return;
    }
    res.statusCode = 405;
    res.end();
  } catch (err) {
    sendError(res, err);
  }
};
