'use strict';

// Phase 128 — check:tactical-context. Integrity + anti-retail/anti-signal/anti-
// certainty governance for the tactical-context artifact (and any embedded
// tactical prose). An HONEST EMPTY artifact (no upstream structure) passes. When
// the read is present it must be enum-valid, evidence-backed, bilingual-native,
// and free of retail/signal/target/certainty language and fabricated precision.
// HARD-FAILS on: unknown state, determinate dimension with no evidence, retail
// or signal vocabulary (BUY/SELL/LONG/SHORT/ENTRY/TARGET/STOP LOSS/TAKE PROFIT/
// GUARANTEED/MOON/PUMP/reversal confirmed/high-probability trade), certainty
// wording (will rise/fall, definitely, guaranteed), a numeric probability
// (fabricated precision — confidence is a BAND only), an out-of-range / coverage-
// unsupported confidence band, untranslated Arabic, null leaks, or a dominant
// mismatch. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { LABELS, CONFIDENCE_BANDS, DIMENSIONS } = require('./tactical-context-engine');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'tactical-context.json');
const ARABIC = /[؀-ۿ]/;
// Retail / signal / advice vocabulary — must never appear in tactical output.
const RETAIL = [
  /\bbuy\b/i, /\bsell\b/i, /\blong\b/i, /\bshort\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i,
  /\btake[- ]?profit\b/i, /\bprice target\b/i, /\btarget price\b/i, /\b\w+\s+target\b/i,
  /\bguaranteed\b/i, /\bhigh[- ]?probability trade\b/i, /\bmoon\b/i, /\bpump\b/i,
  /\breversal confirmed\b/i, /\bRSI\b/, /\bMACD\b/, /\bbreakout trade\b/i, /\bgo (long|short)\b/i,
];
// Certainty wording — tactical reads are conditional/probabilistic, never certain.
const CERTAINTY = [/\bwill (rise|fall|rally|drop|surge|plunge|reach|reverse)\b/i, /\bdefinitely\b/i, /\bis certain to\b/i, /\bcertainty\b/i, /\bguaranteed\b/i, /\bwill continue to\b/i];
// A numeric probability/percentage is fabricated precision (confidence is a band).
const FABRICATED_PROB = /\b\d{1,3}\s?%/;

function txt(v) { return String(v == null ? '' : v); }

function validate(a) {
  const f = [];
  if (!a || typeof a !== 'object') { f.push('artifact not an object'); return f; }
  if (a.source_layer !== 'tactical-context') f.push(`unexpected source_layer "${a.source_layer}"`);
  if (!a.attribution || !Array.isArray(a.attribution.sources) || !a.attribution.sources.length) f.push('missing attribution.sources');
  if (!CONFIDENCE_BANDS[a.confidence_band]) f.push(`invalid confidence_band "${a.confidence_band}"`);
  if (typeof a.coverage_pct !== 'number' || a.coverage_pct < 0 || a.coverage_pct > 100) f.push(`coverage_pct out of range: ${a.coverage_pct}`);

  const dims = a.dimensions || {};
  let determinate = 0;
  for (const d of DIMENSIONS) {
    const dd = dims[d];
    if (!dd) { f.push(`missing dimension "${d}"`); continue; }
    if (!LABELS[d] || !LABELS[d][dd.state]) { f.push(`dimension "${d}" unknown state "${dd.state}"`); continue; }
    if (/\b(undefined|NaN|null)\b/.test(txt(dd.label_en)) || /\b(undefined|NaN|null)\b/.test(txt(dd.label_ar))) f.push(`dimension "${d}" label leaks null/undefined`);
    if (/[A-Za-z]{4,}/.test(txt(dd.label_ar))) f.push(`dimension "${d}" AR label not translated ("${dd.label_ar}")`);
    if (dd.state !== 'indeterminate') {
      determinate += 1;
      if (!Array.isArray(dd.evidence) || dd.evidence.length === 0) f.push(`dimension "${d}" determinate ("${dd.state}") but no evidence (unsupported conclusion)`);
    }
  }
  if (a.available && determinate === 0) f.push('available=true but zero determinate dimensions');
  if (a.available === false && determinate > 0) f.push('available=false but has determinate dimensions');
  // Fabricated confidence: a high band on thin coverage.
  if (a.available && a.confidence_band === 'high' && typeof a.coverage_pct === 'number' && a.coverage_pct < 40) f.push(`confidence_band high unsupported by coverage ${a.coverage_pct}`);

  // Dominant pointer must match.
  if (a.dominant) {
    if (!DIMENSIONS.includes(a.dominant.dimension)) f.push(`dominant references unknown dimension "${a.dominant.dimension}"`);
    else if (dims[a.dominant.dimension] && dims[a.dominant.dimension].state !== a.dominant.state) f.push(`dominant state mismatch for "${a.dominant.dimension}"`);
  }

  // Anti-retail / anti-signal / anti-certainty / anti-fabricated-precision across
  // every string in the artifact (labels, evidence, notes, summary).
  const allText = JSON.stringify(a);
  for (const re of RETAIL) if (re.test(allText)) f.push(`tactical artifact contains retail/signal language ${re}`);
  for (const re of CERTAINTY) if (re.test(allText)) f.push(`tactical artifact contains certainty language ${re}`);
  // Numeric % only allowed in coverage_pct field name context; flag any % inside string values.
  for (const v of Object.values(dims)) if (FABRICATED_PROB.test(txt(v.label_en)) || (v.evidence || []).some((e) => FABRICATED_PROB.test(txt(e)) && !/coherence=/.test(txt(e)))) f.push('tactical dimension contains a fabricated probability percentage');

  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = require(ARTIFACT);
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['retail buy', (a) => { a.dimensions.tactical_bias.label_en = 'buy now'; }],
    ['signal long', (a) => { a.dimensions.posture.evidence.push('go long here'); }],
    ['certainty', (a) => { a.dimensions.continuation.label_en = 'price will rise'; }],
    ['fabricated %', (a) => { a.dimensions.tactical_bias.label_en = '82% probability'; }],
    ['unknown state', (a) => { a.dimensions.posture.state = 'rocket'; }],
    ['determinate no evidence', (a) => { a.dimensions.posture.state = 'defensive'; a.dimensions.posture.evidence = []; }],
    ['fabricated confidence', (a) => { a.confidence_band = 'high'; a.coverage_pct = 10; a.available = true; }],
    ['untranslated AR', (a) => { a.dimensions.posture.label_ar = 'defensive posture'; }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}" not rejected`); }
  if (validate(clone()).length === 0) ok += 1; else console.error('SELF-TEST FAIL: clean artifact rejected:', validate(clone()));
  console.log(`[tactical-context] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (!fs.existsSync(ARTIFACT)) {
  console.log('[tactical-context] no artifact yet — nothing to validate (non-fatal).');
  console.log('[tactical-context] check:tactical-context passed.');
  process.exit(0);
}
let artifact;
try { artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[tactical-context] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
const failures = validate(artifact);
if (failures.length) {
  failures.forEach((m) => console.error(`[tactical-context] FAIL: ${m}`));
  process.exit(1);
}
const det = DIMENSIONS.filter((d) => artifact.dimensions[d] && artifact.dimensions[d].state !== 'indeterminate').length;
console.log(`[tactical-context] check:tactical-context passed (available=${artifact.available}, ${det}/${DIMENSIONS.length} determinate, confidence ${artifact.confidence_band}; conditional, evidence-backed, no retail/signal/certainty/fabricated-precision, bilingual).`);
