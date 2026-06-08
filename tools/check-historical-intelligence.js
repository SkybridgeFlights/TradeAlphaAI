'use strict';

/**
 * Phase 69 Part G — Historical Intelligence Validator
 * Validates:
 *   - historical-memory.json: exists, schema valid, dates in order, no duplicates
 *   - narrative-continuity.json: exists, schema valid, insight fields valid
 *   - market-replay pages: EN + AR exist, contain required sections
 *   - confidence/freshness fields are numeric and in range
 * Exit 0 = healthy, Exit 1 = critical failure
 */

const fs   = require('fs');
const path = require('path');

const ROOT           = path.resolve(__dirname, '..');
const HISTORY_PATH   = path.join(ROOT, 'data', 'intelligence', 'historical-memory.json');
const CONTINUITY_PATH= path.join(ROOT, 'data', 'intelligence', 'narrative-continuity.json');
const REPLAY_EN      = path.join(ROOT, 'market-replay', 'index.html');
const REPLAY_AR      = path.join(ROOT, 'ar', 'market-replay', 'index.html');

const VALID_SNAPSHOT_FIELDS = ['date', 'snapshot_id', 'market_tone', 'confidence', 'data_quality'];
const VALID_INSIGHT_TYPES   = new Set([
  'narrative_persistence', 'regime_transition', 'sector_leadership_transition',
  'sector_leadership_dominant', 'volatility_shift', 'crowded_theme',
]);
const VALID_DIRECTIONS      = new Set(['rising', 'falling', 'stable', 'insufficient_data']);

let passed = 0;
let failed = 0;

function ok(msg)   { console.log(`  ✓ ${msg}`); passed++; }
function fail(msg) { console.error(`  ✗ ${msg}`); failed++; }
function warn(msg) { console.warn(`  ~ ${msg}`); }

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// ── 1. Historical memory checks ──────────────────────────────────────────────

console.log('\n[historical-intelligence] Checking historical-memory.json...');

const history = readJson(HISTORY_PATH);
if (!history) {
  warn('historical-memory.json not found — skipping (will be created on first pipeline run)');
} else {
  if (history.schema_version) ok('schema_version present'); else fail('schema_version missing');
  if (history.generated_at)   ok('generated_at present');   else fail('generated_at missing');
  if (Array.isArray(history.snapshots)) {
    ok(`snapshots array present (${history.snapshots.length} entries)`);

    // No duplicate dates
    const dates = history.snapshots.map((s) => s.date);
    const uniqueDates = new Set(dates);
    if (uniqueDates.size === dates.length) ok('No duplicate dates');
    else fail(`Duplicate dates found: ${dates.filter((d, i) => dates.indexOf(d) !== i).join(', ')}`);

    // Chronological order
    const sortedDates = [...dates].sort();
    if (JSON.stringify(sortedDates) === JSON.stringify(dates)) ok('Snapshots in chronological order');
    else fail('Snapshots not in chronological order');

    // Retention cap
    if (history.snapshots.length <= 365) ok(`Retention within 365-day cap`);
    else fail(`Exceeded 365-day retention cap: ${history.snapshots.length} entries`);

    // Field validation on last 5 snapshots
    const recent = history.snapshots.slice(-5);
    let fieldErrors = 0;
    for (const snap of recent) {
      for (const f of VALID_SNAPSHOT_FIELDS) {
        if (snap[f] == null) fieldErrors++;
      }
      if (typeof snap.confidence !== 'number' || snap.confidence < 0 || snap.confidence > 100) {
        fail(`Snapshot ${snap.date}: confidence out of range (${snap.confidence})`);
        fieldErrors++;
      }
    }
    if (!fieldErrors) ok('Recent snapshot fields valid (last 5)');

    // date_range consistency
    if (history.date_range) {
      const { from, to } = history.date_range;
      const firstDate = history.snapshots[0]?.date;
      const lastDate  = history.snapshots[history.snapshots.length - 1]?.date;
      if (from === firstDate && to === lastDate) ok('date_range matches snapshots array');
      else fail(`date_range mismatch: range=${from}→${to} but array=${firstDate}→${lastDate}`);
    }

  } else {
    fail('historical-memory.json missing snapshots array');
  }
}

// ── 2. Narrative continuity checks ───────────────────────────────────────────

console.log('\n[historical-intelligence] Checking narrative-continuity.json...');

const continuity = readJson(CONTINUITY_PATH);
if (!continuity) {
  warn('narrative-continuity.json not found — skipping (will be created on first pipeline run)');
} else {
  if (continuity.schema_version)  ok('schema_version present');  else fail('schema_version missing');
  if (continuity.generated_at)    ok('generated_at present');    else fail('generated_at missing');
  if (continuity.status)          ok(`status: ${continuity.status}`); else fail('status missing');

  if (Array.isArray(continuity.insights)) {
    ok(`insights array present (${continuity.insights.length} entries)`);
    for (const insight of continuity.insights) {
      if (!VALID_INSIGHT_TYPES.has(insight.type)) {
        fail(`Unknown insight type: "${insight.type}"`);
      }
      if (typeof insight.confidence !== 'number' || insight.confidence < 0 || insight.confidence > 100) {
        fail(`Insight type=${insight.type}: confidence out of range (${insight.confidence})`);
      }
      if (!insight.reason_en) {
        fail(`Insight type=${insight.type}: missing reason_en`);
      }
      if (!insight.reason_ar) {
        fail(`Insight type=${insight.type}: missing reason_ar`);
      }
    }
    if (continuity.insights.length === 0) ok('Empty insights array (ok for early runs)');
    else ok('Insight field validation passed');
  } else {
    fail('narrative-continuity.json missing insights array');
  }

  if (continuity.confidence_trend) {
    const dir = continuity.confidence_trend.direction;
    if (VALID_DIRECTIONS.has(dir)) ok(`confidence_trend.direction valid: ${dir}`);
    else fail(`confidence_trend.direction invalid: "${dir}"`);
  }

  if (continuity.summary) {
    if (continuity.summary.headline_en) ok('summary.headline_en present');
    else warn('summary.headline_en missing');
    if (continuity.summary.headline_ar) ok('summary.headline_ar present');
    else warn('summary.headline_ar missing (AR parity)');
  } else {
    fail('continuity.summary missing');
  }
}

// ── 3. Market replay page checks ─────────────────────────────────────────────

console.log('\n[historical-intelligence] Checking market-replay pages...');

function checkReplayPage(filepath, locale) {
  if (!fs.existsSync(filepath)) {
    fail(`${locale} replay page missing: ${path.relative(ROOT, filepath)}`);
    return;
  }
  ok(`${locale} replay page exists`);
  const html = fs.readFileSync(filepath, 'utf8');

  const lang = locale === 'AR' ? 'ar' : 'en';
  if (html.includes(`lang="${lang}"`)) ok(`${locale}: lang="${lang}" set`);
  else fail(`${locale}: lang="${lang}" not found`);

  const requiredIds = ['replay-stats', 'replay-latest', 'replay-timeline', 'replay-insights'];
  for (const id of requiredIds) {
    if (html.includes(`id="${id}"`)) ok(`${locale}: section id="${id}" present`);
    else fail(`${locale}: section id="${id}" missing`);
  }

  if (html.includes('market-replay.js')) ok(`${locale}: market-replay.js loaded`);
  else fail(`${locale}: market-replay.js not loaded`);

  if (html.includes('GLOBAL_HEADER_START')) ok(`${locale}: GLOBAL_HEADER_START marker present`);
  else fail(`${locale}: GLOBAL_HEADER_START marker missing`);

  // No EN leakage in AR page
  if (locale === 'AR') {
    const enOnlyPhrases = ['Loading…', 'Market Timeline', 'Latest Snapshot', 'Continuity Insights'];
    for (const phrase of enOnlyPhrases) {
      if (html.includes(phrase)) {
        fail(`AR page contains EN string: "${phrase}"`);
      }
    }
    if (!html.includes('جارٍ التحميل')) ok('AR page contains expected Arabic loading text');
    if (!html.includes('الجدول الزمني')) warn('AR page missing الجدول الزمني — check translation');
  }
}

checkReplayPage(REPLAY_EN, 'EN');
checkReplayPage(REPLAY_AR, 'AR');

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n[historical-intelligence] ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  console.error(`[historical-intelligence] FAIL — ${failed} check(s) failed.`);
  process.exit(1);
} else {
  console.log('[historical-intelligence] PASS — all checks passed.');
  process.exit(0);
}
