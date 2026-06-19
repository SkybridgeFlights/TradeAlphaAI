'use strict';

// Phase 210 / CP1 validator for data/intelligence/market-regime-dashboard.json.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'intelligence', 'market-regime-dashboard.json');
const REQUIRED = [
  'current_regime',
  'confidence_band',
  'risk_state',
  'dollar_state',
  'yield_state',
  'volatility_state',
  'dominant_story',
  'dominant_confirmation_state',
  'dominant_contradiction_state',
  'historical_transition_state'
];
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /(?:\bشراء\b|\bبيع\b|هدف\s*سعري|إشارة\s*تداول|وقف\s*الخسارة)/
];
const ALLOWED_BANDS = new Set(['high', 'moderate', 'low', 'indeterminate']);
const ALLOWED_RISK = new Set(['calm', 'elevated', 'fragile', 'stressed', 'mixed', 'indeterminate']);
const EXPECTED_SOURCES = [
  'macro-regime.json',
  'cognitive-network.json',
  'market-narrative.json',
  'rankings.json',
  'relative-strength.json',
  'ranking-history.json',
  'regime-transitions.json'
];

function hasEvidenceRefs(node) {
  return Array.isArray(node && node.evidence_refs) && node.evidence_refs.length > 0 && node.evidence_refs.every((ref) => ref.source && ref.field);
}

function validate(artifact) {
  const failures = [];
  if (!artifact || artifact.source_layer !== 'market-regime-dashboard') failures.push('bad source_layer');
  if (artifact.schema_version !== '1.0') failures.push('schema_version must be 1.0');
  if (!artifact.generated_at) failures.push('missing generated_at');
  for (const key of REQUIRED) {
    const node = artifact && artifact[key];
    if (!node || typeof node !== 'object') failures.push(`missing ${key}`);
    else {
      if (!node.state) failures.push(`${key}: missing state`);
      if (!node.label_en) failures.push(`${key}: missing label_en`);
      if (!node.label_ar) failures.push(`${key}: missing label_ar`);
      if (!hasEvidenceRefs(node) && !['current_regime', 'confidence_band', 'dominant_story', 'historical_transition_state'].includes(key)) {
        failures.push(`${key}: missing evidence_refs`);
      }
    }
  }
  if (artifact && artifact.confidence_band && !ALLOWED_BANDS.has(artifact.confidence_band.state)) failures.push(`invalid confidence_band ${artifact.confidence_band.state}`);
  if (artifact && artifact.risk_state && !ALLOWED_RISK.has(artifact.risk_state.state)) failures.push(`invalid risk_state ${artifact.risk_state.state}`);
  if (!Array.isArray(artifact && artifact.evidence_refs) || artifact.evidence_refs.length < EXPECTED_SOURCES.length) failures.push('top-level evidence_refs incomplete');
  const sources = (((artifact || {}).attribution || {}).sources || []);
  for (const source of EXPECTED_SOURCES) if (!sources.includes(source)) failures.push(`missing attribution source ${source}`);
  const leadership = artifact && artifact.leadership_snapshot;
  if (!leadership || !Array.isArray(leadership.strongest_assets) || !Array.isArray(leadership.weakest_assets)) failures.push('leadership_snapshot incomplete');
  const text = JSON.stringify(artifact || {});
  if (/\b(undefined|NaN)\b/.test(text)) failures.push('undefined/NaN leak');
  for (const re of FORBIDDEN) if (re.test(text)) failures.push(`forbidden advice/forecast language ${re}`);
  return failures;
}

function run() {
  try { return validate(JSON.parse(fs.readFileSync(FILE, 'utf8'))); }
  catch (error) { return [`malformed or missing artifact: ${error.message}`]; }
}

if (require.main === module && process.argv.includes('--self-test')) {
  const sample = require('./build-market-regime-dashboard').build();
  let ok = 0; let total = 0;
  const T = (name, condition) => { total += 1; if (condition) ok += 1; else console.error(`SELF-TEST FAIL: ${name}`); };
  T('clean build validates', validate(sample).length === 0);
  const badSource = { ...sample, source_layer: 'x' };
  T('bad source detected', validate(badSource).length > 0);
  const noEvidence = JSON.parse(JSON.stringify(sample)); noEvidence.risk_state.evidence_refs = [];
  T('missing evidence detected', validate(noEvidence).length > 0);
  const badBand = JSON.parse(JSON.stringify(sample)); badBand.confidence_band.state = 'certain';
  T('bad confidence detected', validate(badBand).length > 0);
  const forbidden = JSON.parse(JSON.stringify(sample)); forbidden.attribution.note = 'buy signal';
  T('forbidden language detected', validate(forbidden).length > 0);
  console.log(`[regime-dashboard] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const failures = run();
  if (failures.length) {
    failures.forEach((failure) => console.error(`[regime-dashboard] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log('[regime-dashboard] check:regime-dashboard passed (required fields, evidence refs, attribution, no advice/forecast language).');
}

module.exports = { validate, run };
