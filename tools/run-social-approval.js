'use strict';

// Phase 100 — Social Distribution Approval Runner (engine).
//
// Reads the approval queue and attempts delivery for APPROVED items only,
// through the gated adapters. Honors every safety rail:
//   * platform posting flag must be true (else adapter mode 'disabled' → preview)
//   * SOCIAL_DRY_RUN must be false for a genuine attempt (else 'dry_run')
//   * approval_status must be 'approved'
//   * credentials must preflight ok
//   * source URL must return 200 (live check, only reached in live mode)
//   * posting ledger must be clear of this duplicate_key
//   * payload must pass platform content rules
//
// Default posture (no env): nothing is approved-and-flagged, so this is a safe
// read-only report. It writes the ledger ONLY for genuine outcomes (posted/
// failed) and records dry-run rehearsals as status=dry_run for audit. It never
// touches an external network in non-live mode.
//
// Usage: node tools/run-social-approval.js [--write]

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getAdapter } = require('./social/adapters');
const ledgerModule = require('./social/social-ledger');
const flags = require('./social/social-flags');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'social', 'approval-queue.json');
const PROD_ORIGIN = 'https://www.tradealphaai.com';

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

// Live HTTP 200 check. Only ever invoked from inside the adapter's live path
// (which is unreachable unless flags + dry-run are explicitly set for posting),
// so default CI runs never hit the network.
function urlIs200(url) {
  return new Promise((resolve) => {
    let target = url;
    if (target.startsWith('/')) target = PROD_ORIGIN + target;
    let lib;
    try { lib = new URL(target).protocol === 'http:' ? http : https; } catch { return resolve(false); }
    const req = lib.request(target, { method: 'HEAD', timeout: 8000 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 300);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function run({ write = false, env = process.env } = {}) {
  const queue = readJson(QUEUE_PATH, null);
  const resolved = flags.resolveAll(env);
  const ledger = ledgerModule.load();

  console.log(`[approval-runner] flags: ${JSON.stringify(resolved.platforms)} dry_run=${resolved.dry_run} require_approval=${resolved.require_approval}`);

  if (!queue || !Array.isArray(queue.items)) {
    console.log('[approval-runner] no approval queue built yet — nothing to do (safe exit).');
    return { attempted: 0, posted: 0, blocked: 0, outcomes: [] };
  }

  const outcomes = [];
  let posted = 0;
  let blocked = 0;
  let attempted = 0;
  let ledgerChanged = false;

  for (const item of queue.items) {
    // Only approved items are even considered for delivery.
    if (item.approval_status !== 'approved') {
      outcomes.push({ duplicate_key: item.duplicate_key, platform: item.platform, skipped: item.approval_status });
      continue;
    }
    const adapter = getAdapter(item.platform);
    if (!adapter) {
      outcomes.push({ duplicate_key: item.duplicate_key, platform: item.platform, status: 'no_adapter' });
      continue;
    }
    attempted += 1;
    const result = await adapter.post(item, { env, ledger, urlChecker: urlIs200 });
    outcomes.push({ duplicate_key: item.duplicate_key, platform: item.platform, language: item.language, status: result.status, posted: result.posted, network_attempted: result.network_attempted });

    if (result.status === 'posted') {
      posted += 1;
      ledgerModule.record(ledger, {
        platform: item.platform, source_url: item.source_url, content_hash: item.content_hash,
        graphic_hash: null, language: item.language, status: 'posted', external_post_id: result.external_post_id,
      });
      item.approval_status = 'posted';
      item.posted_at = new Date().toISOString();
      ledgerChanged = true;
    } else if (result.status === 'failed') {
      ledgerModule.record(ledger, {
        platform: item.platform, source_url: item.source_url, content_hash: item.content_hash,
        language: item.language, status: 'failed', error: result.error, retry_count: 0,
      });
      item.approval_status = 'failed';
      ledgerChanged = true;
    } else if (result.status === 'dry_run') {
      // Rehearsal that passed every gate — record for audit, never counts as posted.
      ledgerModule.record(ledger, {
        platform: item.platform, source_url: item.source_url, content_hash: item.content_hash,
        language: item.language, status: 'dry_run',
      });
      ledgerChanged = true;
    } else {
      blocked += 1;
    }
  }

  console.log(`[approval-runner] attempted=${attempted} posted=${posted} blocked=${blocked}`);
  for (const o of outcomes.filter((x) => x.status)) {
    console.log(`  - ${o.platform}/${o.language || ''} [${o.duplicate_key}] → ${o.status}${o.network_attempted ? ' (network_attempted)' : ''}`);
  }

  if (write && ledgerChanged) {
    ledgerModule.save(ledger);
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
    console.log('[approval-runner] ledger + queue updated.');
  } else if (write) {
    console.log('[approval-runner] no genuine outcomes — ledger unchanged.');
  }

  return { attempted, posted, blocked, outcomes };
}

if (require.main === module) {
  run({ write: process.argv.includes('--write') }).then((r) => {
    // Never fail CI on a safe no-post outcome.
    process.exit(0);
  }).catch((e) => { console.error('[approval-runner] error:', e.message); process.exit(1); });
}

module.exports = { run, urlIs200 };
