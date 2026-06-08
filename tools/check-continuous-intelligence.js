'use strict';

/**
 * Phase 70 Part E — Continuous Intelligence Validator
 * Validates:
 *   - data/continuous-intelligence-queue.json schema and cooldown logic
 *   - drafts/continuous-intelligence/<slug>/en.html + ar.html parity
 *   - No advice wording, no fabricated live data claims
 *   - intelligence/ and ar/intelligence/ listing pages exist
 *   - Published articles have matching public paths
 * Exit 0 = all pass, Exit 1 = any failure
 */

const fs   = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '..');
const QUEUE_PATH   = path.join(ROOT, 'data', 'continuous-intelligence-queue.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'continuous-intelligence-history.json');
const LISTING_EN   = path.join(ROOT, 'intelligence', 'index.html');
const LISTING_AR   = path.join(ROOT, 'ar', 'intelligence', 'index.html');

const VALID_STATUSES   = new Set(['planned', 'queued', 'draft', 'in_review', 'reviewed', 'published', 'manual_revision_required']);
const VALID_FAMILIES   = new Set([
  'breadth_divergence', 'volatility_compression', 'volatility_expansion',
  'sector_leadership_transition', 'ai_concentration_risk',
  'yield_curve_pressure', 'yield_curve_support', 'defensive_rotation',
  'liquidity_deterioration', 'cross_asset_divergence', 'etf_relationship_change',
  'macro_transmission_chain', 'confidence_trend_shift', 'narrative_reversal',
  'narrative_persistence', 'rate_path_clarity',
]);
const ADVICE_PATTERNS  = [/buy\s+now/i, /sell\s+now/i, /guaranteed\s+return/i, /you\s+should\s+invest/i, /invest\s+in\s+this/i];
const FABRICATED_PATTERNS = [/live\s+price[:\s]/i, /real-time\s+quote/i, /current\s+bid[:\s]/i];
const MIN_CONFIDENCE   = 40;
const FAMILY_COOLDOWN_DAYS = 10;

let passed = 0;
let failed = 0;

function ok(msg)   { console.log(`  ✓ ${msg}`); passed++; }
function fail(msg) { console.error(`  ✗ ${msg}`); failed++; }
function warn(msg) { console.warn(`  ~ ${msg}`); }

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00Z');
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

// ── 1. Queue schema ───────────────────────────────────────────────────────────

console.log('\n[check-continuous-intelligence] Checking queue schema...');

const queue = readJson(QUEUE_PATH);
if (!queue) {
  warn('data/continuous-intelligence-queue.json not found — skipping (created on first pipeline run)');
} else {
  if (queue.schema_version) ok('schema_version present');
  else fail('schema_version missing');

  if (Array.isArray(queue.topics)) {
    ok(`topics array present (${queue.topics.length} entries)`);

    // Duplicate slugs
    const slugs = queue.topics.map(t => t.slug);
    const unique = new Set(slugs);
    if (unique.size === slugs.length) ok('No duplicate slugs');
    else fail(`Duplicate slugs: ${slugs.filter((s, i) => slugs.indexOf(s) !== i).join(', ')}`);

    // Required fields per topic
    let fieldErrors = 0;
    for (const topic of queue.topics) {
      const required = ['slug', 'title_en', 'title_ar', 'family', 'trigger', 'confidence', 'status', 'created_at'];
      for (const f of required) {
        if (topic[f] == null || topic[f] === '') {
          fail(`Topic ${topic.slug || '?'}: missing ${f}`);
          fieldErrors++;
        }
      }

      // Status valid
      if (topic.status && !VALID_STATUSES.has(topic.status)) {
        fail(`Topic ${topic.slug}: invalid status "${topic.status}"`);
        fieldErrors++;
      }

      // Family valid
      if (topic.family && !VALID_FAMILIES.has(topic.family)) {
        warn(`Topic ${topic.slug}: unknown family "${topic.family}"`);
      }

      // Confidence in range
      if (typeof topic.confidence !== 'number' || topic.confidence < 0 || topic.confidence > 100) {
        fail(`Topic ${topic.slug}: confidence out of range (${topic.confidence})`);
        fieldErrors++;
      }

      // Confidence meets threshold
      if (typeof topic.confidence === 'number' && topic.confidence < MIN_CONFIDENCE) {
        fail(`Topic ${topic.slug}: confidence ${topic.confidence} below threshold ${MIN_CONFIDENCE}`);
        fieldErrors++;
      }

      // Evidence count
      if (!Array.isArray(topic.evidence) || topic.evidence.length < 1) {
        fail(`Topic ${topic.slug}: evidence must have at least 1 entry`);
        fieldErrors++;
      }
    }
    if (!fieldErrors) ok('All topic fields valid');

    // Family cooldown: no two published entries in same family within FAMILY_COOLDOWN_DAYS
    const publishedByFamily = {};
    for (const topic of queue.topics) {
      if (topic.status === 'published' && topic.family) {
        const dateStr = (topic.published_at || '').slice(0, 10);
        const age = daysSince(dateStr);
        if (publishedByFamily[topic.family] !== undefined) {
          const prev = publishedByFamily[topic.family];
          if (prev < FAMILY_COOLDOWN_DAYS) {
            warn(`Family "${topic.family}" published twice within ${FAMILY_COOLDOWN_DAYS} days (${age}d ago)`);
          }
        } else {
          publishedByFamily[topic.family] = age;
        }
      }
    }
    ok('Family cooldown checked');

  } else {
    fail('topics is not an array');
  }
}

// ── 2. Draft parity checks ────────────────────────────────────────────────────

console.log('\n[check-continuous-intelligence] Checking draft parity...');

const draftsDir = path.join(ROOT, 'drafts', 'continuous-intelligence');
if (!fs.existsSync(draftsDir)) {
  warn('drafts/continuous-intelligence/ not found — no drafts yet');
} else {
  const draftSlugs = fs.readdirSync(draftsDir).filter(d => {
    const full = path.join(draftsDir, d);
    return fs.statSync(full).isDirectory();
  });
  ok(`${draftSlugs.length} draft(s) found`);

  let pairErrors = 0;
  for (const slug of draftSlugs) {
    const dir = path.join(draftsDir, slug);
    const enExists = fs.existsSync(path.join(dir, 'en.html'));
    const arExists = fs.existsSync(path.join(dir, 'ar.html'));
    if (!enExists || !arExists) {
      fail(`Draft ${slug}: missing ${!enExists ? 'en.html' : ''} ${!arExists ? 'ar.html' : ''}`.trim());
      pairErrors++;
    } else {
      // EN/AR parity: check AR has RTL
      const arHtml = fs.readFileSync(path.join(dir, 'ar.html'), 'utf8');
      if (!arHtml.includes('lang="ar"')) {
        fail(`Draft ${slug}/ar.html: missing lang="ar"`);
        pairErrors++;
      }
      if (!arHtml.includes('dir="rtl"')) {
        fail(`Draft ${slug}/ar.html: missing dir="rtl"`);
        pairErrors++;
      }

      // AR language purity: no EN-only section headings
      const enOnlyPhrases = ['Executive Intelligence Summary', 'What Changed', 'Evidence Map', 'Scenario Framework'];
      for (const phrase of enOnlyPhrases) {
        if (arHtml.includes(phrase)) {
          fail(`Draft ${slug}/ar.html: contains EN string "${phrase}"`);
          pairErrors++;
        }
      }

      // No advice wording
      const enHtml = fs.readFileSync(path.join(dir, 'en.html'), 'utf8');
      for (const pattern of ADVICE_PATTERNS) {
        if (pattern.test(enHtml)) {
          fail(`Draft ${slug}/en.html: contains advice wording matching ${pattern}`);
          pairErrors++;
        }
      }

      // No fabricated live data
      for (const pattern of FABRICATED_PATTERNS) {
        if (pattern.test(enHtml)) {
          fail(`Draft ${slug}/en.html: contains fabricated live data pattern ${pattern}`);
          pairErrors++;
        }
      }

      // Canonical link check
      if (!enHtml.includes('rel="canonical"')) {
        fail(`Draft ${slug}/en.html: missing canonical link`);
        pairErrors++;
      }
      if (!enHtml.includes('hreflang')) {
        fail(`Draft ${slug}/en.html: missing hreflang`);
        pairErrors++;
      }

      // Global header marker
      if (!enHtml.includes('GLOBAL_HEADER_START')) {
        fail(`Draft ${slug}/en.html: GLOBAL_HEADER_START missing`);
        pairErrors++;
      }

      // Disclaimer present
      if (!enHtml.includes('Educational Disclaimer') && !enHtml.includes('educational commentary only')) {
        fail(`Draft ${slug}/en.html: educational disclaimer missing`);
        pairErrors++;
      }
    }
  }
  if (!pairErrors) ok('All draft pairs valid');
}

// ── 3. Listing pages ──────────────────────────────────────────────────────────

console.log('\n[check-continuous-intelligence] Checking listing pages...');

function checkListingPage(filepath, locale) {
  if (!fs.existsSync(filepath)) {
    fail(`${locale} listing page missing: ${path.relative(ROOT, filepath)}`);
    return;
  }
  ok(`${locale} listing page exists`);
  const html = fs.readFileSync(filepath, 'utf8');
  const lang = locale === 'AR' ? 'ar' : 'en';
  if (html.includes(`lang="${lang}"`)) ok(`${locale}: lang="${lang}" set`);
  else fail(`${locale}: lang="${lang}" not found`);
  if (html.includes('GLOBAL_HEADER_START')) ok(`${locale}: GLOBAL_HEADER_START present`);
  else fail(`${locale}: GLOBAL_HEADER_START missing`);
  if (locale === 'AR') {
    const enPhrases = ['Market Intelligence', 'Latest Articles'];
    for (const phrase of enPhrases) {
      if (html.includes(phrase)) warn(`AR listing: contains EN string "${phrase}"`);
    }
    if (!html.includes('ذكاء السوق')) warn('AR listing: missing Arabic title "ذكاء السوق"');
  }
}

checkListingPage(LISTING_EN, 'EN');
checkListingPage(LISTING_AR, 'AR');

// ── 4. Published articles present in public directories ───────────────────────

console.log('\n[check-continuous-intelligence] Checking published article public paths...');

const history = readJson(HISTORY_PATH);
if (!history) {
  warn('data/continuous-intelligence-history.json not found — no published articles yet');
} else {
  ok(`History file present (${(history.publications || []).length} publication(s))`);
  let pubErrors = 0;
  for (const pub of (history.publications || [])) {
    for (const rel of (pub.public_pages || [])) {
      if (!fs.existsSync(path.join(ROOT, rel))) {
        fail(`Published article missing public file: ${rel}`);
        pubErrors++;
      }
    }
  }
  if (!pubErrors) ok('All published articles have public files');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n[check-continuous-intelligence] ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  console.error(`[check-continuous-intelligence] FAIL — ${failed} check(s) failed.`);
  process.exit(1);
} else {
  console.log('[check-continuous-intelligence] PASS — all checks passed.');
  process.exit(0);
}
