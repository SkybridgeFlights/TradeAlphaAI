'use strict';

// Regression validator for account API persistence.
// Any authenticated API route touching account child tables must upsert the
// parent accounts row server-side before child reads/writes. The client-side
// /api/account/init call is not sufficient because requests can race or arrive
// independently.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const ROUTES = [
  'api/account/init.js',
  'api/account/preferences.js',
  'api/account/watchlists.js',
  'api/account/followed.js',
];

const CHILD_TABLES = [
  'preference_overrides',
  'watchlists',
  'watchlist_entities',
  'followed_targets',
  'alert_subscriptions',
  'alert_dispatch_history',
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function firstIndexOfAny(text, needles) {
  let idx = Infinity;
  for (const n of needles) {
    const i = text.indexOf(n);
    if (i >= 0 && i < idx) idx = i;
  }
  return idx === Infinity ? -1 : idx;
}

function stripJsComments(text) {
  return String(text || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function checkRoute(rel, text) {
  const fails = [];
  const code = stripJsComments(text);
  if (!code.includes('requireAccount(req)')) fails.push(`${rel}: missing requireAccount(req)`);
  if (!code.includes("require('../../db/schema')")) fails.push(`${rel}: missing db/schema import`);
  if (!code.includes('ensureAccountSchema(sql)')) fails.push(`${rel}: missing ensureAccountSchema(sql)`);

  const childIdx = firstIndexOfAny(code, CHILD_TABLES);
  if (childIdx >= 0) {
    if (!code.includes("require('../../db/account')")) fails.push(`${rel}: touches child tables but missing db/account import`);
    const ensureIdx = code.indexOf('ensureAccount(sql, accountId');
    if (ensureIdx < 0) fails.push(`${rel}: touches child tables but never calls ensureAccount(sql, accountId)`);
    else if (ensureIdx > childIdx) fails.push(`${rel}: ensureAccount runs after first child-table reference`);
  }

  if (rel.endsWith('init.js') && !code.includes('ensureAccount(sql, accountId')) {
    fails.push(`${rel}: init route must use shared ensureAccount helper`);
  }
  return fails;
}

function runCheck(files = ROUTES) {
  const fails = [];
  for (const rel of files) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) { fails.push(`${rel}: missing`); continue; }
    fails.push(...checkRoute(rel, read(rel)));
  }
  return fails;
}

function selfTest() {
  const good = `
    const { ensureAccountSchema } = require('../../db/schema');
    const { ensureAccount } = require('../../db/account');
    async function h(req){ const { accountId } = await requireAccount(req); const sql = getSql(); await ensureAccountSchema(sql); await ensureAccount(sql, accountId); await sql\`INSERT INTO preference_overrides(account_id) VALUES (\${accountId})\`; }
  `;
  const bad = `
    const { ensureAccountSchema } = require('../../db/schema');
    async function h(req){ const { accountId } = await requireAccount(req); const sql = getSql(); await ensureAccountSchema(sql); await sql\`INSERT INTO preference_overrides(account_id) VALUES (\${accountId})\`; }
  `;
  const late = `
    const { ensureAccountSchema } = require('../../db/schema');
    const { ensureAccount } = require('../../db/account');
    async function h(req){ const { accountId } = await requireAccount(req); const sql = getSql(); await ensureAccountSchema(sql); await sql\`SELECT * FROM watchlists\`; await ensureAccount(sql, accountId); }
  `;
  const cases = [
    ['good passes', checkRoute('api/account/preferences.js', good).length === 0],
    ['missing ensure fails', checkRoute('api/account/preferences.js', bad).some((f) => f.includes('never calls ensureAccount'))],
    ['late ensure fails', checkRoute('api/account/watchlists.js', late).some((f) => f.includes('after first child-table reference'))],
  ];
  let ok = 0;
  for (const [name, pass] of cases) {
    if (pass) ok += 1;
    else console.error('[account-api-persistence] self-test failed:', name);
  }
  console.log(`[account-api-persistence] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  const fails = runCheck();
  if (fails.length) {
    fails.forEach((f) => console.error('[account-api-persistence] FAIL:', f));
    process.exit(1);
  }
  console.log('[account-api-persistence] OK');
}

module.exports = { checkRoute, runCheck };
