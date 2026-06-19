'use strict';

// Phase 209 / Workstream A — institutional ranking engine. Ranks each asset /
// sector / equity using existing intelligence layers only (observed-OHLCV strength
// scalar + historical trend + cognitive confirmation). Qualitative labels only
// (strongest…weakest); strongest/weakest lists are by scalar. No prediction, no
// numeric forecast, no advice. Honest indeterminate without a chart.
//
// Outputs: data/intelligence/{rankings,asset-rankings,sector-rankings,equity-rankings}.json
// Usage:   node tools/build-rankings.js [--write]

const fs = require('fs');
const path = require('path');
const { features } = require('./build-asset-layers');
const { strengthScore } = require('./history-engine');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

const RANK = {
  strongest: ['strongest', 'الأقوى'], strong: ['strong', 'قوي'], constructive: ['constructive', 'بنّاء'],
  neutral: ['neutral', 'محايد'], weakening: ['weakening', 'يضعف'], weak: ['weak', 'ضعيف'], weakest: ['weakest', 'الأضعف'],
  indeterminate: ['indeterminate', 'غير محدد'],
};
const DIR = { improving: ['improving', 'يتحسّن'], stable: ['stable', 'مستقر'], deteriorating: ['deteriorating', 'يتدهور'], indeterminate: ['indeterminate', 'غير محدد'] };
const CONF = { confirmed: ['confirmed', 'مؤكَّد'], mixed: ['mixed', 'مختلط'], divergent: ['divergent', 'متباعد'], indeterminate: ['indeterminate', 'غير محدد'] };

const GROUPS = {
  asset: { registry: './asset-registry', key: 'ASSETS', charts: 'data/visual/institutional-charts.json', history: 'asset-history.json', net: 'cognitive-network.json' },
  sector: { registry: './sector-registry', key: 'SECTORS', charts: 'data/visual/sector-charts.json', history: 'sector-history.json', net: 'sector-cognitive-network.json' },
  equity: { registry: './equity-registry', key: 'EQUITIES', charts: 'data/visual/equity-charts.json', history: 'equity-history.json', net: 'equity-cognitive-network.json' },
};

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function scalarToLabel(s) {
  if (s === null) return 'indeterminate';
  if (s >= 2) return 'strongest'; if (s >= 1.25) return 'strong'; if (s >= 0.5) return 'constructive';
  if (s > -0.5) return 'neutral'; if (s > -1.25) return 'weakening'; if (s > -2) return 'weak'; return 'weakest';
}
function dirOf(overall) { return ['accelerating', 'improving'].includes(overall) ? 'improving' : ['deteriorating', 'weakening'].includes(overall) ? 'deteriorating' : overall === 'stable' ? 'stable' : 'indeterminate'; }
function lab(map, k) { return { state: k, label_en: map[k][0], label_ar: map[k][1] }; }

function confirmationFor(symbol, net) {
  const rels = (net && net.relationships) || [];
  const sym = symbol.toLowerCase();
  const mine = rels.filter((r) => String(r.id || '').toLowerCase().split(/[_:]/).includes(sym) && r.state !== 'evidence_unavailable');
  if (!mine.length) return 'indeterminate';
  const conf = mine.filter((r) => r.state === 'confirmation').length;
  const contra = mine.filter((r) => r.state === 'contradiction').length;
  return conf > contra ? 'confirmed' : contra > conf ? 'divergent' : 'mixed';
}

function rankGroup(type) {
  const g = GROUPS[type];
  const reg = require(g.registry)[g.key];
  const charts = new Map(((readJson(path.join(ROOT, g.charts), {}).charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const history = readJson(J(g.history), {});
  const net = readJson(J(g.net), {});
  const histBy = new Map(((history && history.items) || []).map((x) => [x.symbol, x]));

  const items = reg.map((e) => {
    const chart = charts.get(e.symbol);
    const scalar = chart ? strengthScore(features(chart.series)) : null;
    const h = histBy.get(e.symbol);
    const direction = h ? dirOf(h.overall && h.overall.state) : 'indeterminate';
    const confirmation = confirmationFor(e.symbol, net);
    const rl = scalarToLabel(scalar);
    return {
      symbol: e.symbol, slug: e.slug, available: scalar !== null,
      scalar, rank_label: rl, rank_label_en: RANK[rl][0], rank_label_ar: RANK[rl][1],
      direction, direction_en: DIR[direction][0], direction_ar: DIR[direction][1],
      confirmation, confirmation_en: CONF[confirmation][0], confirmation_ar: CONF[confirmation][1],
      evidence: chart ? [`observed strength scalar=${scalar} (from ${e.symbol} OHLCV)`, `historical ${direction}`, `cognitive ${confirmation}`] : ['no verified chart'],
    };
  }).sort((a, b) => (b.scalar ?? -99) - (a.scalar ?? -99));

  const ranked = items.filter((x) => x.available);
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: `${type}-rankings`,
    available: ranked.length > 0, total: items.length, ranked_count: ranked.length,
    strongest: ranked.slice(0, 3).map((x) => x.symbol), weakest: ranked.slice(-3).reverse().map((x) => x.symbol),
    items,
    attribution: { sources: [g.charts, g.history, g.net], note: 'Deterministic ranking from observed strength + historical trend + cognitive confirmation. Educational context, not a recommendation, forecast or signal.' },
  };
}

function build() {
  const asset = rankGroup('asset'); const sector = rankGroup('sector'); const equity = rankGroup('equity');
  const combined = {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'rankings',
    groups: { asset, sector, equity },
    attribution: { sources: ['asset-rankings', 'sector-rankings', 'equity-rankings'], note: 'Combined institutional rankings. Educational context, not a recommendation or signal.' },
  };
  return { rankings: combined, asset, sector, equity };
}

if (require.main === module) {
  const r = build();
  for (const t of ['asset', 'sector', 'equity']) console.log(`[rankings] ${t}: strongest=${r[t].strongest.join(',')} weakest=${r[t].weakest.join(',')}`);
  if (WRITE) {
    fs.writeFileSync(J('rankings.json'), `${JSON.stringify(r.rankings, null, 2)}\n`);
    for (const t of ['asset', 'sector', 'equity']) fs.writeFileSync(J(`${t}-rankings.json`), `${JSON.stringify(r[t], null, 2)}\n`);
    console.log('[rankings] wrote 4 artifacts');
  }
}

module.exports = { build, rankGroup, RANK, DIR, CONF };
