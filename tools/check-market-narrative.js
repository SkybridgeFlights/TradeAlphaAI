'use strict';

// Phase 208 / Workstream H — check:market-narrative (default) + check:narrative-prose
// (--prose). Validates the market-narrative artifact + its bilingual prose.
// HARD-FAILS on: dominant story outside the allowed set, a driver/story without
// evidence, invalid confidence band, untranslated Arabic, null leaks, retail/
// advice/forecast language, English leak in the AR prose, or missing EN/AR prose.
// Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { STORY, BAND } = require('./build-market-narrative-engine');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'market-narrative.json');
const ARABIC = /[؀-ۿ]/;
const DRIVERS = ['macro_driver', 'asset_driver', 'sector_driver', 'equity_driver', 'historical_change'];
// Retail/advice/prediction — scoped so the disclaimer ("not a forecast or a
// recommendation") does not self-trip (no bare forecast/signal/target).
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btake[- ]?profit\b/i,
  /\bprice target\b/i, /\btarget price\b/i, /\bstrong buy\b/i, /\bguaranteed\b/i,
  /\bwill (rise|fall|rally|drop|surge|plunge|reach)\b/i, /\bRSI\b/, /\bMACD\b/,
  /(?:\bشراء\b|\bبيع\b|وقف\s*الخسارة|هدف\s*سعري|اشترِ|بِع)/,
];

function validateArtifact(a) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  if (a.source_layer !== 'market-narrative') f.push('bad source_layer');
  if (!STORY[a.dominant_story && a.dominant_story.state]) f.push(`dominant_story "${a.dominant_story && a.dominant_story.state}" not in allowed set`);
  else if (!ARABIC.test(String(a.dominant_story.label_ar || ''))) f.push('dominant_story label_ar not native');
  if (!BAND[a.confidence_band]) f.push(`invalid confidence_band "${a.confidence_band}"`);
  const d = a.drivers || {};
  for (const k of DRIVERS) {
    if (!d[k]) { f.push(`missing driver ${k}`); continue; }
    if (!d[k].label_en || !d[k].label_ar) f.push(`${k}: missing bilingual label`);
    else if (!ARABIC.test(String(d[k].label_ar))) f.push(`${k}: label_ar not native`);
    if (!Array.isArray(d[k].evidence) || !d[k].evidence.length) f.push(`${k}: missing evidence`);
  }
  for (const k of ['confirmation_story', 'contradiction_story', 'risk_context']) { if (!a[k] || !Array.isArray(a[k].evidence) || !a[k].evidence.length) f.push(`${k}: missing evidence`); }
  if (!Array.isArray(a.evidence) || !a.evidence.length) f.push('missing top-level evidence');
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text)) f.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/advice language ${re}`);
  return f;
}

function validateProse(a) {
  const f = [];
  const n = a && a.narrative;
  if (!n || !n.en || !n.ar) { f.push('missing EN or AR narrative prose'); return f; }
  if (n.en.length < 200) f.push('EN prose too short (filler risk)');
  if (n.ar.length < 180) f.push('AR prose too short');
  if (!ARABIC.test(n.ar)) f.push('AR prose not native Arabic');
  // English leak in AR prose (allow tickers / brand / OHLCV).
  const arStripped = n.ar.replace(/(TradeAlphaAI|SPY|QQQ|IWM|GLD|TLT|UUP|VIXY|XL[A-Z]+|NVDA|MSFT|AAPL|AMZN|META|GOOGL|TSLA|AMD|AVGO|PLTR|SMCI|OHLCV)/g, '');
  if (/[A-Za-z]{4,}/.test(arStripped)) f.push(`AR prose contains untranslated English: "${(arStripped.match(/[A-Za-z]{4,}/) || [])[0]}"`);
  if (!/not a forecast or a recommendation/i.test(n.en)) f.push('EN prose missing the advice-free disclaimer');
  if (!/ليس توقعاً ولا توصية/.test(n.ar)) f.push('AR prose missing the advice-free disclaimer');
  for (const re of FORBIDDEN) { if (re.test(n.en)) f.push(`EN prose forbidden language ${re}`); if (re.test(n.ar)) f.push(`AR prose forbidden language ${re}`); }
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-market-narrative-engine').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  T('artifact clean', validateArtifact(base).length === 0);
  T('prose clean', validateProse(base).length === 0);
  const a1 = clone(); a1.dominant_story.state = 'zzz'; T('off-label story', validateArtifact(a1).length > 0);
  const a2 = clone(); a2.drivers.macro_driver.evidence = []; T('driver no evidence', validateArtifact(a2).length > 0);
  const a3 = clone(); a3.evidence.push('strong buy now'); T('forbidden artifact', validateArtifact(a3).length > 0);
  const p1 = clone(); p1.narrative.en += ' set a price target here'; T('forbidden prose', validateProse(p1).length > 0);
  const p2 = clone(); p2.narrative.ar += ' this is English leakage text'; T('AR english leak', validateProse(p2).length > 0);
  const p3 = clone(); p3.narrative.en = p3.narrative.en.replace('not a forecast or a recommendation', 'a great pick'); T('missing disclaimer', validateProse(p3).length > 0);
  console.log(`[market-narrative] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const prose = process.argv.includes('--prose');
  const name = prose ? 'narrative-prose' : 'market-narrative';
  if (!fs.existsSync(ARTIFACT)) { console.log(`[${name}] no artifact yet (non-fatal).`); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[${name}] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = prose ? validateProse(a) : validateArtifact(a);
  if (failures.length) { failures.forEach((m) => console.error(`[${name}] FAIL: ${m}`)); process.exit(1); }
  console.log(`[${name}] check:${name} passed${prose ? ' (bilingual institutional prose, native AR, advice-free)' : ` (story=${a.dominant_story.state}, band=${a.confidence_band}; evidence-backed)`}.`);
}

module.exports = { validateArtifact, validateProse };
