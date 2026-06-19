'use strict';

// Phase 209 / Workstream B — deterministic relative-strength comparisons. For each
// pair, compares the two entities' observed strength scalars now vs ~1 month ago to
// classify the RELATIVE trend (improving/stable/deteriorating, from the first leg's
// perspective). Real OHLCV windows only; indeterminate when data is missing. No
// signals, no forecast.
//
// Output: data/intelligence/relative-strength.json
// Usage:  node tools/build-relative-strength.js [--write]

const fs = require('fs');
const path = require('path');
const { features } = require('./build-asset-layers');
const { strengthScore, windowFeatures, WINDOWS } = require('./history-engine');
const { EQUITIES } = require('./equity-registry');
const { BY_SYMBOL: SECTOR_BY_SYMBOL } = require('./sector-registry');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'intelligence', 'relative-strength.json');
const WRITE = process.argv.includes('--write');

const STATE = { improving: ['improving', 'يتحسّن'], stable: ['stable', 'مستقر'], deteriorating: ['deteriorating', 'يتدهور'], indeterminate: ['indeterminate', 'غير محدد'] };
const SECTOR_OF = new Map(EQUITIES.map((e) => [e.symbol, e.sector]));
const SLUG_TO_SECTOR_SYMBOL = new Map([...SECTOR_BY_SYMBOL.values()].map((s) => [s.slug, s.symbol]));

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function loadSeries() {
  const map = new Map();
  for (const file of ['institutional-charts.json', 'sector-charts.json', 'equity-charts.json']) {
    const m = readJson(path.join(ROOT, 'data', 'visual', file), {});
    for (const c of (m.charts || [])) if (c.verified === true && Array.isArray(c.series)) map.set(c.symbol, c.series);
  }
  return map;
}

function classify(seriesMap, a, b) {
  const sa = seriesMap.get(a); const sb = seriesMap.get(b);
  if (!sa || !sb) return { state: 'indeterminate', evidence: [`${a} or ${b} series unavailable`] };
  const aNow = strengthScore(features(sa)); const bNow = strengthScore(features(sb));
  const aAgoF = windowFeatures(sa, WINDOWS['1M']); const bAgoF = windowFeatures(sb, WINDOWS['1M']);
  const aAgo = aAgoF ? strengthScore(aAgoF) : null; const bAgo = bAgoF ? strengthScore(bAgoF) : null;
  if (aNow === null || bNow === null || aAgo === null || bAgo === null) return { state: 'indeterminate', evidence: [`${a}/${b} window unavailable`] };
  const delta = (aNow - bNow) - (aAgo - bAgo);
  const state = delta >= 0.75 ? 'improving' : delta <= -0.75 ? 'deteriorating' : 'stable';
  return { state, evidence: [`${a} vs ${b}: now diff ${(aNow - bNow).toFixed(2)} vs 1M-ago diff ${(aAgo - bAgo).toFixed(2)} → ${a} ${state} relative`] };
}

function pair(seriesMap, a, b, en, ar) {
  const r = classify(seriesMap, a, b);
  return { id: `${a}_vs_${b}`.toLowerCase(), a, b, label_en: en, label_ar: ar, state: r.state, state_en: STATE[r.state][0], state_ar: STATE[r.state][1], evidence: r.evidence };
}

function build() {
  const sm = loadSeries();
  const assets = [
    pair(sm, 'SPY', 'QQQ', 'S&P 500 vs Nasdaq', 'إس آند بي مقابل ناسداك'),
    pair(sm, 'SPY', 'IWM', 'Large-cap vs small-cap', 'كبيرة مقابل صغيرة رأس المال'),
    pair(sm, 'GLD', 'TLT', 'Gold vs Treasuries', 'الذهب مقابل سندات الخزانة'),
    pair(sm, 'UUP', 'GLD', 'Dollar vs gold', 'الدولار مقابل الذهب'),
  ];
  const sectors = [...SECTOR_BY_SYMBOL.values()].map((s) => pair(sm, s.symbol, 'SPY', `${s.name_en} vs the market`, `${s.name_ar} مقابل السوق`));
  const equities = [];
  for (const e of EQUITIES) {
    const secSym = SLUG_TO_SECTOR_SYMBOL.get(e.sector);
    if (secSym) equities.push(pair(sm, e.symbol, secSym, `${e.symbol} vs its sector`, `${e.symbol} مقابل قطاعه`));
    equities.push(pair(sm, e.symbol, 'SPY', `${e.symbol} vs the market`, `${e.symbol} مقابل السوق`));
  }
  const all = assets.concat(sectors, equities);
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'relative-strength',
    available: all.some((p) => p.state !== 'indeterminate'),
    groups: { asset: assets, sector: sectors, equity: equities },
    attribution: { sources: ['data/visual/institutional-charts.json', 'data/visual/sector-charts.json', 'data/visual/equity-charts.json'], note: 'Deterministic relative-strength from observed OHLCV windows. Educational context, not a recommendation, forecast or signal.' },
  };
}

if (require.main === module) {
  const r = build();
  console.log(`[relative-strength] asset pairs: ${r.groups.asset.map((p) => p.id + '=' + p.state).join(', ')}`);
  console.log(`[relative-strength] sectors=${r.groups.sector.length} equities=${r.groups.equity.length}`);
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(r, null, 2)}\n`); console.log('[relative-strength] wrote artifact'); }
}

module.exports = { build, STATE };
