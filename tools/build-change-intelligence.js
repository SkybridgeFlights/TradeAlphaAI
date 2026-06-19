'use strict';

// Phase 213 / CP6 + CP7 — change intelligence + entity changelogs. Introduces
// institutional MEMORY: what is improving, weakening, stable or deteriorating, and
// each entity's state through time. Sources ONLY the append-only snapshot ledger,
// ranking history and historical intelligence — never fabricates change history.
// With a single accumulated snapshot, movement is reported honestly as "history
// begins"; the changelog grows as the ledger grows across scheduled runs.
//
// Outputs (data/intelligence/):
//   change-intelligence.json  (CP6)
//   entity-changelog.json     (CP7)
//
// Usage: node tools/build-change-intelligence.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

const assetReg = require('./asset-registry');
const sectorReg = require('./sector-registry');
const equityReg = require('./equity-registry');

const GROUPS = {
  asset: { reg: assetReg.ASSETS, rankings: 'asset-rankings.json', hist: 'asset', research: 'assets', snapKey: 'asset_scores' },
  sector: { reg: sectorReg.SECTORS, rankings: 'sector-rankings.json', hist: 'sector', research: 'sectors', snapKey: 'sector_states' },
  equity: { reg: equityReg.EQUITIES, rankings: 'equity-rankings.json', hist: 'equity', research: 'equities', snapKey: 'equity_scores' },
};

const snapshots = readJson(J('historical-snapshots.json'), {});
const rankHistory = readJson(J('ranking-history.json'), {});
const historical = readJson(J('historical-intelligence.json'), {});
const transitions = readJson(J('regime-transitions.json'), {});

function nameOf(reg, sym) { const e = reg.find((x) => x.symbol === sym); return e ? { en: e.name_en || e.symbol, ar: e.name_ar || e.symbol } : { en: sym, ar: sym }; }
function slugOf(reg, sym) { const e = reg.find((x) => x.symbol === sym); return e ? e.slug : sym.toLowerCase(); }

const DIR_LABEL = {
  improving: { en: 'improving', ar: 'يتحسّن' }, stable: { en: 'stable', ar: 'مستقر' },
  weakening: { en: 'weakening', ar: 'يضعف' }, deteriorating: { en: 'deteriorating', ar: 'يتدهور' },
  indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
};

// Classify each entity into a change bucket from observed direction + momentum.
function classify(direction, momentumState) {
  if (direction === 'improving' || /positive/.test(momentumState || '')) return 'improving';
  if (direction === 'deteriorating' || /strong_negative/.test(momentumState || '')) return 'deteriorating';
  if (direction === 'weakening' || /negative/.test(momentumState || '')) return 'weakening';
  if (direction === 'stable' || momentumState === 'neutral') return 'stable';
  return 'indeterminate';
}

function buildChangeIntelligence() {
  const buckets = { improving: [], weakening: [], stable: [], deteriorating: [] };
  for (const [group, g] of Object.entries(GROUPS)) {
    const rankings = readJson(J(g.rankings), {});
    const histBy = new Map(((historical.groups && historical.groups[g.hist]) || []).map((x) => [x.symbol, x]));
    for (const x of (rankings.items || [])) {
      if (x.available === false) continue;
      const hist = histBy.get(x.symbol) || {};
      const bucket = classify(x.direction, hist.momentum && hist.momentum.state);
      if (bucket === 'indeterminate') continue;
      const nm = nameOf(g.reg, x.symbol);
      buckets[bucket].push({
        symbol: x.symbol, slug: x.slug, group, name_en: nm.en, name_ar: nm.ar,
        rank_label: x.rank_label, rank_label_en: x.rank_label_en, rank_label_ar: x.rank_label_ar,
        direction_en: DIR_LABEL[bucket].en, direction_ar: DIR_LABEL[bucket].ar,
        research_href: `/research/${g.research}/${x.slug}/`,
        evidence: [...(x.evidence || []).slice(0, 1), hist.momentum ? `momentum: ${hist.momentum.label_en || hist.momentum.state}` : `direction: ${x.direction}`].filter(Boolean),
      });
    }
  }
  // Recent transitions from the regime transition layer + snapshot regime history.
  const snapList = (snapshots.snapshots || []);
  const regimeTimeline = snapList.map((s) => ({ date: s.date, macro_regime: s.macro_regime })).slice(-8);
  const recent_transitions = transitions && transitions.available
    ? [{ state_en: transitions.transition_state_en, state_ar: transitions.transition_state_ar, evidence: (transitions.evidence || []).slice(0, 2) }]
    : [];
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'change-intelligence',
    available: Object.values(buckets).some((b) => b.length),
    snapshot_count: snapList.length, ranking_history_prior: rankHistory && rankHistory.has_prior === true,
    counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
    buckets, recent_transitions, regime_timeline: regimeTimeline,
    attribution: { sources: ['historical-snapshots.json', 'ranking-history.json', 'historical-intelligence.json', 'asset-rankings.json', 'sector-rankings.json', 'equity-rankings.json', 'regime-transitions.json'], note: 'Change classification from observed direction and momentum; movement across snapshots reported honestly. No fabricated history, no forecasts.' },
  };
}

function buildChangelog() {
  const snapList = (snapshots.snapshots || []);
  const entities = {};
  for (const [group, g] of Object.entries(GROUPS)) {
    const rankings = readJson(J(g.rankings), {});
    const rh = (rankHistory.groups && rankHistory.groups[g.hist]) || [];
    const rhBy = new Map(rh.map((r) => [r.symbol, r]));
    for (const x of (rankings.items || [])) {
      const nm = nameOf(g.reg, x.symbol);
      // Per-snapshot entries from the append-only ledger (state through time).
      const series = snapList.map((s) => ({ date: s.date, ts: s.ts, state: (s[g.snapKey] || {})[x.symbol] || 'indeterminate', macro_regime: s.macro_regime }))
        .filter((e) => e.state !== 'indeterminate');
      const rhx = rhBy.get(x.symbol) || {};
      entities[x.symbol] = {
        symbol: x.symbol, slug: x.slug, group, name_en: nm.en, name_ar: nm.ar,
        current: {
          state: x.rank_label, state_en: x.rank_label_en, state_ar: x.rank_label_ar,
          ranking: x.rank_label, direction: x.direction, direction_en: x.direction_en, direction_ar: x.direction_ar,
          movement: rhx.movement || 'no_prior', movement_en: rhx.movement_en || 'no prior snapshot', movement_ar: rhx.movement_ar || 'لا لقطة سابقة',
          confidence: x.confirmation === 'confirmed' ? 'high' : (x.confirmation === 'partial' || x.confirmation === 'mixed') ? 'moderate' : x.confirmation ? 'low' : 'indeterminate',
        },
        history: series,
        history_available: series.length > 1,
        research_href: `/research/${g.research}/${x.slug}/`,
      };
    }
  }
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'entity-changelog',
    available: Object.keys(entities).length > 0, snapshot_count: snapList.length,
    history_available: snapList.length > 1, entity_count: Object.keys(entities).length, entities,
    note: snapList.length > 1 ? 'Per-entity state through the accumulated snapshot ledger.' : 'History begins accumulating; a single snapshot exists, so per-entity movement is reported honestly as unavailable rather than fabricated.',
    attribution: { sources: ['historical-snapshots.json', 'ranking-history.json', 'asset-rankings.json', 'sector-rankings.json', 'equity-rankings.json'], note: 'Changelog derives from the append-only snapshot ledger and current ranking state. Never fabricated.' },
  };
}

function build() { return { change: buildChangeIntelligence(), changelog: buildChangelog() }; }

if (require.main === module) {
  const r = build();
  console.log(`[change-intelligence] counts=${JSON.stringify(r.change.counts)} snapshots=${r.change.snapshot_count} changelog_entities=${r.changelog.entity_count} history_available=${r.changelog.history_available}`);
  if (WRITE) {
    fs.writeFileSync(J('change-intelligence.json'), `${JSON.stringify(r.change, null, 2)}\n`);
    fs.writeFileSync(J('entity-changelog.json'), `${JSON.stringify(r.changelog, null, 2)}\n`);
    console.log('[change-intelligence] wrote 2 artifacts');
  }
}

module.exports = { build, buildChangeIntelligence, buildChangelog };
