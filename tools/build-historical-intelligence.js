'use strict';

// Phase 207 / Workstream F — historical intelligence scoring. For each asset /
// sector / equity, summarizes the history artifacts into qualitative momentum
// (direction), stability (window dispersion) and persistence (dimension-trend
// consensus). Qualitative labels only — no fabricated precision, no forecast.
//
// Output: data/intelligence/historical-intelligence.json
// Usage:  node tools/build-historical-intelligence.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const OUT = J('historical-intelligence.json');
const WRITE = process.argv.includes('--write');

const MOMENTUM = { strong_positive: ['strong positive', 'إيجابي قوي'], positive: ['positive', 'إيجابي'], neutral: ['neutral', 'محايد'], negative: ['negative', 'سلبي'], strong_negative: ['strong negative', 'سلبي قوي'], indeterminate: ['indeterminate', 'غير محدد'] };
const STABILITY = { stable: ['stable', 'مستقر'], variable: ['variable', 'متغيّر'], indeterminate: ['indeterminate', 'غير محدد'] };
const PERSISTENCE = { persistent: ['persistent', 'مستمر'], mixed: ['mixed', 'مختلط'], indeterminate: ['indeterminate', 'غير محدد'] };
const MOM_FROM_TREND = { accelerating: 'strong_positive', improving: 'positive', stable: 'neutral', deteriorating: 'negative', weakening: 'strong_negative', indeterminate: 'indeterminate' };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function lab(map, k) { return { state: k, label_en: map[k][0], label_ar: map[k][1] }; }

function entityScore(item) {
  if (!item || !item.available) return { symbol: item ? item.symbol : '?', slug: item ? item.slug : '', available: false, momentum: lab(MOMENTUM, 'indeterminate'), stability: lab(STABILITY, 'indeterminate'), persistence: lab(PERSISTENCE, 'indeterminate'), evidence: ['history unavailable'] };
  const momentum = MOM_FROM_TREND[item.overall.state] || 'indeterminate';
  const wins = Object.values(item.windows || {}).filter((v) => v !== null && Number.isFinite(v));
  let stability = 'indeterminate';
  if (wins.length >= 2) { const range = Math.max(...wins) - Math.min(...wins); stability = range <= 1.0 ? 'stable' : 'variable'; }
  const dt = item.dimension_trends || {};
  const dirs = ['structure', 'tactical', 'liquidity', 'participation', 'score'].map((d) => dt[d] && dt[d].state).filter(Boolean);
  const up = dirs.filter((s) => s === 'improving' || s === 'accelerating').length;
  const down = dirs.filter((s) => s === 'deteriorating' || s === 'weakening').length;
  const flat = dirs.filter((s) => s === 'stable').length;
  const dominant = Math.max(up, down, flat);
  const persistence = dirs.length ? (dominant >= 4 ? 'persistent' : 'mixed') : 'indeterminate';
  return {
    symbol: item.symbol, slug: item.slug, available: true,
    momentum: lab(MOMENTUM, momentum), stability: lab(STABILITY, stability), persistence: lab(PERSISTENCE, persistence),
    evidence: [`overall trend ${item.overall.state}`, `window dispersion ${wins.length >= 2 ? (Math.max(...wins) - Math.min(...wins)).toFixed(2) : 'n/a'}`, `dimension consensus ${dominant}/${dirs.length}`],
  };
}

function build() {
  const groups = {};
  for (const type of ['asset', 'sector', 'equity']) {
    const h = readJson(J(`${type}-history.json`), {});
    groups[type] = ((h && h.items) || []).map(entityScore);
  }
  const scored = Object.values(groups).reduce((n, g) => n + g.filter((x) => x.available).length, 0);
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'historical-intelligence',
    available: scored > 0, scored, groups,
    attribution: { sources: ['asset-history', 'sector-history', 'equity-history'], note: 'Qualitative momentum / stability / persistence of intelligence over observed history. Educational context, not a forecast or recommendation.' },
  };
}

if (require.main === module) {
  const r = build();
  console.log(`[historical-intelligence] scored=${r.scored} | asset sample:`, r.groups.asset.slice(0, 3).map((x) => `${x.symbol}=${x.momentum.state}/${x.persistence.state}`).join(', '));
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(r, null, 2)}\n`); console.log('[historical-intelligence] wrote artifact'); }
}

module.exports = { build, MOMENTUM, STABILITY, PERSISTENCE };
