'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'data', 'telegram-delivery-ledger.json');

let issues = 0;
let warns  = 0;

function pass(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.warn(`  ⚠ ${msg}`); warns++; }
function fail(msg) { console.error(`  ✗ ${msg}`); issues++; }

const SUPPORTED_TYPES = ['editorial', 'market-outlook', 'continuous-intelligence', 'daily-research', 'market-structure'];

const EXPECTED_URL_PREFIX = {
  'editorial':               '/insights/',
  'market-outlook':          '/market-outlook/',
  'continuous-intelligence': '/intelligence/',
  'daily-research':          '/market-news/',
  'market-structure':        '/market-structure/',
};

// ── Load ledger ──────────────────────────────────────────────────────────────

console.log('[check:telegram-ledger] Reading ledger...');

let ledger;
try {
  ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
} catch (err) {
  fail(`Cannot read ledger at ${LEDGER_PATH}: ${err.message}`);
  process.exit(1);
}

// ── Schema ───────────────────────────────────────────────────────────────────

console.log('\n[check:telegram-ledger] Schema validation');

if (ledger.schema_version) pass(`schema_version = ${ledger.schema_version}`);
else fail('Missing schema_version');

if (!Array.isArray(ledger.deliveries)) {
  fail('deliveries must be an array');
  process.exit(1);
}
pass(`${ledger.deliveries.length} delivery record(s)`);

// ── Entry validation ─────────────────────────────────────────────────────────

console.log('\n[check:telegram-ledger] Entry validation');

const seenSent = new Map();

for (let i = 0; i < ledger.deliveries.length; i++) {
  const d  = ledger.deliveries[i];
  const id = `[${i}] slug=${d.slug || '?'} type=${d.content_type || '?'}`;

  if (!d.slug)         fail(`${id}: missing slug`);
  if (!d.content_type) fail(`${id}: missing content_type`);
  if (!d.source)       fail(`${id}: missing source`);
  if (!d.status)       fail(`${id}: missing status`);

  if (d.content_type && !SUPPORTED_TYPES.includes(d.content_type)) {
    fail(`${id}: unsupported content_type "${d.content_type}"`);
  }

  if (d.source && !['primary', 'recovery'].includes(d.source)) {
    fail(`${id}: source must be primary|recovery, got "${d.source}"`);
  }

  if (d.status && !['sent', 'failed'].includes(d.status)) {
    fail(`${id}: status must be sent|failed, got "${d.status}"`);
  }

  if (d.status === 'sent') {
    if (!d.message_id) fail(`${id}: sent entry missing message_id`);
    if (!d.sent_at)    fail(`${id}: sent entry missing sent_at`);
    if (!d.url)        fail(`${id}: sent entry missing url`);
    if (!d.ar_url)     fail(`${id}: sent entry missing ar_url`);

    if (d.content_type && d.url) {
      const prefix = EXPECTED_URL_PREFIX[d.content_type];
      if (prefix && !d.url.includes(prefix)) {
        fail(`${id}: url "${d.url}" does not match content_type "${d.content_type}" (expected path prefix: ${prefix})`);
      }
    }

    // Duplicate detection across sent entries only
    if (d.slug && d.content_type) {
      const key = `${d.slug}::${d.content_type}`;
      if (seenSent.has(key)) {
        fail(`Duplicate sent delivery: ${key} at indices ${seenSent.get(key)} and ${i}`);
      } else {
        seenSent.set(key, i);
      }
    }
  }
}

// ── Summary stats ────────────────────────────────────────────────────────────

const sentCount   = ledger.deliveries.filter(d => d.status === 'sent').length;
const failedCount = ledger.deliveries.filter(d => d.status === 'failed').length;

console.log('\n[check:telegram-ledger] Delivery stats');

if (ledger.deliveries.length === 0) {
  warn('Ledger is empty — no deliveries recorded yet');
} else {
  pass(`sent=${sentCount}  failed=${failedCount}`);
  if (failedCount > 0) {
    warn(`${failedCount} failed delivery(ies) present — run telegram-backfill to retry`);
  }
}

// ── Result ───────────────────────────────────────────────────────────────────

console.log(`\n[check:telegram-ledger] ${issues} error(s), ${warns} warning(s).`);

if (issues > 0) {
  console.error('[FAIL] Telegram delivery ledger has structural issues — fix before deploying.');
  process.exit(1);
}

console.log('[PASS] Telegram delivery ledger is valid.');
process.exit(0);
