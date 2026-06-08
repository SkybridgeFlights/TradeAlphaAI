'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const TX_PATH = path.join(ROOT, 'data', 'intelligence', 'publication-transaction.json');

function readJson(p, fallback = {}) {
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}

function writeJson(p, data) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Expected public pages for each content type */
function expectedPublicPagesFor(contentType, slug) {
  switch (contentType) {
    case 'editorial':
      return [`insights/${slug}.html`, `ar/insights/${slug}.html`, `en/insights/${slug}.html`];
    case 'market-outlook':
      return [`market-outlook/${slug}.html`, `ar/market-outlook/${slug}.html`, `en/market-outlook/${slug}.html`];
    case 'continuous-intelligence':
      return [`intelligence/${slug}.html`, `ar/intelligence/${slug}.html`, `en/intelligence/${slug}.html`];
    case 'site_update_only':
      return [];
    default:
      return [];
  }
}

function expectedDraftFilesFor(contentType) {
  switch (contentType) {
    case 'editorial':             return ['en.html', 'ar.html', 'metadata.json'];
    case 'market-outlook':        return ['en.html', 'ar.html', 'metadata.json'];
    case 'continuous-intelligence': return ['en.html', 'ar.html', 'metadata.json'];
    case 'news-analysis':         return ['en.html', 'ar.html', 'metadata.json'];
    default:                      return ['en.html', 'ar.html'];
  }
}

/**
 * Begin a transaction — records intent.
 */
function begin({ content_type, slug, mode, run_id, actor = 'autonomous-brain' }) {
  const tx = {
    transaction_id: `tx-${Date.now()}`,
    run_id:         run_id || '',
    actor,
    content_type,
    slug:           slug || '',
    mode,
    state:          'begun',
    begun_at:       new Date().toISOString(),
    committed_at:   null,
    rolled_back_at: null,
    expected_public_pages: expectedPublicPagesFor(content_type, slug),
    expected_draft_files:  expectedDraftFilesFor(content_type),
    files_created:    [],
    files_verified:   [],
    files_missing:    [],
    sitemap_verified:  false,
    feeds_verified:    false,
    report_verified:   false,
    verification_errors: [],
    rollback_actions:    [],
  };
  writeJson(TX_PATH, tx);
  console.log(`[transaction] begun  tx_id=${tx.transaction_id} ${content_type}/${slug}`);
  return tx;
}

/**
 * Record files created during publish.
 */
function recordCreated(files = []) {
  const tx = readJson(TX_PATH, {});
  tx.files_created = [...new Set([...(tx.files_created || []), ...files])];
  tx.updated_at = new Date().toISOString();
  writeJson(TX_PATH, tx);
}

/**
 * Verify the transaction — check all expected artifacts exist.
 */
function verify({ check_sitemap = true, check_feeds = true, check_report = true } = {}) {
  const tx = readJson(TX_PATH, {});
  const errors = [];

  // Verify public pages
  const missing = [];
  const verified = [];
  for (const rel of (tx.expected_public_pages || [])) {
    const fullPath = path.join(ROOT, rel);
    if (fs.existsSync(fullPath)) {
      verified.push(rel);
    } else {
      missing.push(rel);
      errors.push(`missing public page: ${rel}`);
    }
  }

  // Verify sitemap
  let sitemapOk = false;
  if (check_sitemap && tx.slug && tx.content_type !== 'site_update_only') {
    const sitemapPath = path.join(ROOT, 'sitemap-core.xml');
    if (fs.existsSync(sitemapPath)) {
      const content = fs.readFileSync(sitemapPath, 'utf8');
      sitemapOk = content.includes(tx.slug);
      if (!sitemapOk) errors.push(`slug ${tx.slug} not found in sitemap-core.xml`);
    } else {
      errors.push('sitemap-core.xml not found');
    }
  } else {
    sitemapOk = true; // site_update_only doesn't need sitemap check
  }

  // Verify feeds
  let feedsOk = false;
  if (check_feeds) {
    const feedsDir = path.join(ROOT, 'data', 'feeds');
    feedsOk = fs.existsSync(feedsDir);
    if (!feedsOk) errors.push('data/feeds directory not found');
  } else {
    feedsOk = true;
  }

  // Verify publishing report
  let reportOk = false;
  if (check_report) {
    const reportPath = path.join(ROOT, 'data', 'intelligence', 'publishing-report.json');
    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        reportOk = report.selected_topic === tx.slug || tx.content_type === 'site_update_only';
        if (!reportOk) errors.push(`publishing-report slug mismatch: expected ${tx.slug}, got ${report.selected_topic}`);
      } catch { errors.push('publishing-report.json parse error'); }
    } else {
      errors.push('publishing-report.json not found');
    }
  } else {
    reportOk = true;
  }

  const ok = missing.length === 0 && sitemapOk && feedsOk && reportOk;

  tx.files_verified         = verified;
  tx.files_missing          = missing;
  tx.sitemap_verified       = sitemapOk;
  tx.feeds_verified         = feedsOk;
  tx.report_verified        = reportOk;
  tx.verification_errors    = errors;
  tx.state                  = ok ? 'verified' : 'verification_failed';
  tx.verified_at            = new Date().toISOString();
  writeJson(TX_PATH, tx);

  if (ok) {
    console.log(`[transaction] verified  tx_id=${tx.transaction_id}`);
  } else {
    console.error(`[transaction] VERIFICATION FAILED  tx_id=${tx.transaction_id}`);
    errors.forEach(e => console.error(`  [tx-error] ${e}`));
  }
  return { ok, errors, tx };
}

/**
 * Commit — seal the transaction after successful verification.
 */
function commit() {
  const tx = readJson(TX_PATH, {});
  if (tx.state !== 'verified') {
    console.error(`[transaction] Cannot commit — state is ${tx.state}, expected verified`);
    return { ok: false, error: `state_is_${tx.state}` };
  }
  tx.state        = 'committed';
  tx.committed_at = new Date().toISOString();
  writeJson(TX_PATH, tx);
  console.log(`[transaction] committed  tx_id=${tx.transaction_id}`);
  return { ok: true };
}

/**
 * Rollback — remove partial public files if publish wasn't confirmed.
 */
function rollback({ reason = 'transaction_failed' } = {}) {
  const tx = readJson(TX_PATH, {});
  const actions = [];

  // Remove partial public pages (only ones created this run)
  for (const rel of (tx.files_created || [])) {
    const fullPath = path.join(ROOT, rel);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        actions.push(`removed: ${rel}`);
        console.log(`[transaction] rollback removed: ${rel}`);
      } catch (e) {
        actions.push(`failed-remove: ${rel} (${e.message})`);
      }
    }
  }

  tx.state          = 'rolled_back';
  tx.rolled_back_at = new Date().toISOString();
  tx.rollback_reason= reason;
  tx.rollback_actions = actions;
  writeJson(TX_PATH, tx);
  console.log(`[transaction] rolled_back  tx_id=${tx.transaction_id}  reason=${reason}`);
  return { ok: true, actions };
}

/** Read current transaction state. */
function readTransaction() {
  return readJson(TX_PATH, { state: 'none' });
}

module.exports = { begin, recordCreated, verify, commit, rollback, readTransaction, expectedPublicPagesFor };

// CLI
if (require.main === module) {
  const arg = process.argv[2] || '--status';
  if (arg === '--status') {
    const tx = readTransaction();
    console.log(`[transaction] state=${tx.state} tx_id=${tx.transaction_id || 'none'} slug=${tx.slug || ''}`);
    if (tx.verification_errors && tx.verification_errors.length > 0) {
      tx.verification_errors.forEach(e => console.log(`  error: ${e}`));
    }
  } else if (arg === '--rollback') {
    rollback({ reason: 'manual-cli-rollback' });
  }
}
