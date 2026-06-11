'use strict';

// Hard publish integrity gate — [PUBLISH_VERIFY].
// A topic must never be treated as published (history, Telegram, ledgers,
// commit) unless its EN and AR public pages actually exist on disk, are
// readable, non-empty, and structurally complete at their expected routes.
//
// Library: const { verifyPublishIntegrity } = require('./verify-publish-integrity');
// CLI:     node tools/verify-publish-integrity.js
//          Reads data/intelligence/publishing-report.json. Exits 1 when the
//          report claims published=true but the public pages are missing —
//          this blocks the workflow commit step on phantom publishes.

const fs = require('fs');
const path = require('path');
const { expectedPublicPagesFor } = require('./publication-transaction');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'intelligence', 'publishing-report.json');
const LEDGER_PATH = path.join(ROOT, 'data', 'telegram-delivery-ledger.json');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function pageRouteOk(relPath) {
  const full = path.join(ROOT, relPath);
  try {
    if (!fs.existsSync(full)) return { exists: false, route_ok: false };
    fs.accessSync(full, fs.constants.R_OK);
    const content = fs.readFileSync(full, 'utf8');
    // Complete document: non-trivial size and a closing html tag guard against
    // zero-byte or truncated writes being treated as a successful publish.
    const routeOk = content.length > 500 && /<\/html>/i.test(content);
    return { exists: true, route_ok: routeOk };
  } catch {
    return { exists: true, route_ok: false };
  }
}

function verifyPublishIntegrity({ contentType, slug }) {
  const expected = expectedPublicPagesFor(contentType, slug);
  const failures = [];

  const enPages = expected.filter((p) => !p.startsWith('ar/'));
  const arPages = expected.filter((p) => p.startsWith('ar/'));

  const checkSet = (pages) => {
    let exists = pages.length > 0;
    let routeOk = pages.length > 0;
    for (const rel of pages) {
      const result = pageRouteOk(rel);
      if (!result.exists) { exists = false; failures.push(`missing: ${rel}`); }
      if (!result.route_ok) { routeOk = false; if (result.exists) failures.push(`unreadable/incomplete: ${rel}`); }
    }
    return { exists, routeOk };
  };

  const en = checkSet(enPages);
  const ar = checkSet(arPages);

  const ledger = readJson(LEDGER_PATH, { deliveries: [] });
  const ledgerEntry = (ledger.deliveries || []).find(
    (d) => d.slug === slug && d.content_type === contentType && d.status === 'sent'
  );

  const publishAllowed = en.exists && ar.exists && en.routeOk && ar.routeOk;

  console.log('[PUBLISH_VERIFY]');
  console.log(`slug=${slug}`);
  console.log(`en_exists=${en.exists}`);
  console.log(`ar_exists=${ar.exists}`);
  console.log(`en_route_ok=${en.routeOk}`);
  console.log(`ar_route_ok=${ar.routeOk}`);
  console.log(`telegram_sent=${Boolean(ledgerEntry)}`);
  console.log(`ledger_written=${Boolean(ledgerEntry)}`);
  console.log(`publish_allowed=${publishAllowed}`);
  if (failures.length) console.log(`verify_failures=${failures.join('; ')}`);

  return {
    slug,
    content_type: contentType,
    en_exists: en.exists,
    ar_exists: ar.exists,
    en_route_ok: en.routeOk,
    ar_route_ok: ar.routeOk,
    telegram_sent: Boolean(ledgerEntry),
    ledger_written: Boolean(ledgerEntry),
    publish_allowed: publishAllowed,
    failures,
  };
}

if (require.main === module) {
  const report = readJson(REPORT_PATH, {});
  if (report.published !== true || !report.selected_topic) {
    console.log('[PUBLISH_VERIFY]');
    console.log('slug=none');
    console.log('publish_allowed=true');
    console.log('verify_note=no published article reported this run — nothing to verify');
    process.exit(0);
  }
  const outcome = verifyPublishIntegrity({
    contentType: report.selected_content_type,
    slug: report.selected_topic,
  });
  if (!outcome.publish_allowed) {
    console.error('[PUBLISH_VERIFY] FAIL: report claims published=true but public pages are missing or incomplete. Blocking commit to prevent phantom publish.');
    process.exit(1);
  }
}

module.exports = { verifyPublishIntegrity };
