'use strict';

// Phase 218 - Workspace core and default watchlists.
// Composes existing intelligence artifacts into a monitoring workspace
// foundation. It does not create forecasts, alerts, recommendations or
// synthetic rankings.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = (name) => path.join(ROOT, 'data', 'intelligence', name);
const WRITE = process.argv.includes('--write');

const { ASSETS } = require('./asset-registry');
const { SECTORS } = require('./sector-registry');
const { EQUITIES } = require('./equity-registry');
const { ETFS } = require('./etf-registry');

const DEFAULT_WATCHLISTS = [
  {
    id: 'market-core',
    title_en: 'Market Core',
    title_ar: 'محور السوق',
    thesis_en: 'Broad equity participation and index leadership monitored through SPY, QQQ and IWM.',
    thesis_ar: 'متابعة مشاركة الأسهم وقيادة المؤشرات عبر SPY وQQQ وIWM.',
    entities: [
      { type: 'asset', symbol: 'SPY' },
      { type: 'asset', symbol: 'QQQ' },
      { type: 'asset', symbol: 'IWM' },
    ],
  },
  {
    id: 'technology',
    title_en: 'Technology',
    title_ar: 'التكنولوجيا',
    thesis_en: 'Growth leadership and AI concentration monitored through XLK, NVDA, AMD and MSFT.',
    thesis_ar: 'متابعة قيادة النمو وتركز الذكاء الاصطناعي عبر XLK وNVDA وAMD وMSFT.',
    entities: [
      { type: 'sector', symbol: 'XLK' },
      { type: 'equity', symbol: 'NVDA' },
      { type: 'equity', symbol: 'AMD' },
      { type: 'equity', symbol: 'MSFT' },
    ],
  },
  {
    id: 'defensive',
    title_en: 'Defensive',
    title_ar: 'الدفاعي',
    thesis_en: 'Defensive rotation monitored through duration, utilities and staples.',
    thesis_ar: 'متابعة الدوران الدفاعي عبر المدة والمرافق والسلع الأساسية.',
    entities: [
      { type: 'asset', symbol: 'TLT' },
      { type: 'sector', symbol: 'XLU' },
      { type: 'sector', symbol: 'XLP' },
    ],
  },
  {
    id: 'etf-core',
    title_en: 'ETF Core',
    title_ar: 'محور الصناديق',
    thesis_en: 'Core ETF wrappers monitored across broad beta, total market, dividend quality and semiconductors.',
    thesis_ar: 'متابعة أغلفة الصناديق الأساسية عبر بيتا السوق، والسوق الكلي، وجودة التوزيعات، وأشباه الموصلات.',
    entities: [
      { type: 'etf', symbol: 'VOO' },
      { type: 'etf', symbol: 'VTI' },
      { type: 'etf', symbol: 'SCHD' },
      { type: 'etf', symbol: 'SOXX' },
    ],
  },
];

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function now() { return new Date().toISOString(); }

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function registry() {
  const rows = [];
  for (const x of ASSETS) rows.push({ type: 'asset', symbol: x.symbol, slug: x.slug, name_en: x.symbol, name_ar: x.symbol, href: `/markets/${x.slug}/`, research_href: `/research/assets/${x.slug}/`, evidence: ['tools/asset-registry.js'] });
  for (const x of SECTORS) rows.push({ type: 'sector', symbol: x.symbol, slug: x.slug, name_en: x.name_en || x.symbol, name_ar: x.name_ar || x.symbol, href: `/sectors/${x.slug}/`, research_href: `/research/sectors/${x.slug}/`, evidence: ['tools/sector-registry.js'] });
  for (const x of EQUITIES) rows.push({ type: 'equity', symbol: x.symbol, slug: x.slug, name_en: x.name_en || x.symbol, name_ar: x.name_ar || x.symbol, href: `/equities/${x.slug}/`, research_href: `/research/equities/${x.slug}/`, evidence: ['tools/equity-registry.js'] });
  for (const x of ETFS) rows.push({ type: 'etf', symbol: x.symbol, slug: x.slug, name_en: x.fund_name || x.symbol, name_ar: x.fund_name || x.symbol, href: `/etfs/${x.slug}.html`, research_href: `/research/etfs/${x.slug}/`, evidence: ['tools/etf-registry.js'] });
  return new Map(rows.map((x) => [`${x.type}:${x.symbol}`, x]));
}

function rankFor(type, symbol, rankings, etfRankings) {
  let row = null;
  if (type === 'asset') row = (((rankings.groups || {}).asset || {}).items || []).find((x) => x.symbol === symbol);
  if (type === 'sector') row = (((rankings.groups || {}).sector || {}).items || []).find((x) => x.symbol === symbol);
  if (type === 'equity') row = (((rankings.groups || {}).equity || {}).items || []).find((x) => x.symbol === symbol);
  if (type === 'etf') row = (etfRankings.items || []).find((x) => x.symbol === symbol);
  if (!row) return { rank_label: 'indeterminate', direction: 'indeterminate', confirmation: 'indeterminate', evidence: [] };
  return {
    rank_label: row.rank_label || row.current_rank || 'ranked',
    direction: row.direction || row.observed_direction || row.historical_direction || 'indeterminate',
    confirmation: row.confirmation || row.confirmation_state || 'indeterminate',
    evidence: (row.evidence || []).slice(0, 4),
  };
}

function historyFor(type, symbol, rankingHistory) {
  const key = type === 'asset' ? 'asset' : type === 'sector' ? 'sector' : type === 'equity' ? 'equity' : null;
  const row = key ? (((rankingHistory.groups || {})[key] || []).find((x) => x.symbol === symbol)) : null;
  if (!row) return { movement: 'indeterminate', observed_direction: 'indeterminate', evidence: [] };
  return {
    movement: row.movement || 'indeterminate',
    observed_direction: row.observed_direction || 'indeterminate',
    evidence: (row.evidence || []).slice(0, 3),
  };
}

function eventsFor(type, symbol, changeEvents) {
  return (changeEvents.events || [])
    .filter((e) => e.entity === symbol && (!e.entity_type || e.entity_type === type || (type === 'asset' && e.entity_type === 'asset')))
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      entity: e.entity,
      entity_type: e.entity_type,
      change_type: e.change_type,
      confidence: e.confidence || 'low',
      label_en: e.label_en || e.change_type,
      label_ar: e.label_ar || e.change_type,
      href: e.href || e.research_href || '/changes/',
      evidence: (e.evidence || []).slice(0, 3),
    }));
}

function buildWatchlists(state) {
  const reg = registry();
  return DEFAULT_WATCHLISTS.map((watchlist) => {
    const entities = watchlist.entities.map((input) => {
      const base = reg.get(`${input.type}:${input.symbol}`);
      if (!base) throw new Error(`unsupported watchlist entity: ${input.type}:${input.symbol}`);
      const ranking = rankFor(input.type, input.symbol, state.rankings, state.etfRankings);
      const history = historyFor(input.type, input.symbol, state.rankingHistory);
      const events = eventsFor(input.type, input.symbol, state.changeEvents);
      return {
        ...base,
        ranking,
        history,
        recent_changes: events,
        evidence_refs: [...base.evidence, ...ranking.evidence, ...history.evidence, ...events.flatMap((e) => e.evidence)].slice(0, 10),
      };
    });
    return {
      ...watchlist,
      entity_count: entities.length,
      entities,
      evidence_refs: [
        'tools/asset-registry.js',
        'tools/sector-registry.js',
        'tools/equity-registry.js',
        'tools/etf-registry.js',
        'data/intelligence/rankings.json',
        'data/intelligence/change-events.json',
      ],
    };
  });
}

function buildWorkspace(watchlists, state) {
  const all = watchlists.flatMap((w) => w.entities);
  const monitoredSymbols = [...new Set(all.map((e) => e.symbol))];
  const latestChanges = all.flatMap((e) => e.recent_changes.map((c) => ({ ...c, watchlist_symbols: [e.symbol] }))).slice(0, 20);
  const regime = state.marketRegime || {};
  return {
    schema_version: '1.0',
    generated_at: now(),
    source_layer: 'workspace',
    available: true,
    dedupe_hash: hash({ monitoredSymbols, regime: regime.current_regime && regime.current_regime.state }),
    sections: ['watchlists', 'monitoring', 'research', 'changes', 'regime'],
    counts: {
      watchlists: watchlists.length,
      monitored_entities: all.length,
      unique_symbols: monitoredSymbols.length,
      latest_changes: latestChanges.length,
    },
    watchlists: watchlists.map((w) => ({ id: w.id, title_en: w.title_en, title_ar: w.title_ar, entity_count: w.entity_count, href: `/workspace/watchlists/${w.id}/` })),
    monitoring: {
      latest_changes: latestChanges,
      evidence_refs: ['data/intelligence/change-events.json', 'data/intelligence/ranking-history.json'],
    },
    research: {
      href: '/workspace/research/',
      evidence_refs: ['data/intelligence/research-hub.json', 'data/intelligence/entity-research-graph.json'],
    },
    changes: {
      href: '/workspace/monitoring/',
      evidence_refs: ['data/intelligence/change-events.json', 'data/intelligence/change-intelligence.json'],
    },
    regime: {
      href: '/workspace/regime/',
      current_regime: regime.current_regime || { state: 'indeterminate', label_en: 'indeterminate', label_ar: 'غير محدد' },
      confidence_band: regime.confidence_band || { state: 'indeterminate', label_en: 'indeterminate', label_ar: 'غير محدد' },
      dominant_story: regime.dominant_story || { state: 'indeterminate', label_en: 'indeterminate', label_ar: 'غير محدد' },
      evidence_refs: ['data/intelligence/market-regime-dashboard.json', 'data/intelligence/regime-history.json'],
    },
    evidence_refs: [
      'data/intelligence/watchlists.json',
      'data/intelligence/change-events.json',
      'data/intelligence/rankings.json',
      'data/intelligence/etf-rankings.json',
      'data/intelligence/market-regime-dashboard.json',
    ],
  };
}

function main() {
  const state = {
    rankings: readJson(OUT('rankings.json'), {}),
    etfRankings: readJson(OUT('etf-rankings.json'), {}),
    rankingHistory: readJson(OUT('ranking-history.json'), {}),
    changeEvents: readJson(OUT('change-events.json'), { events: [] }),
    marketRegime: readJson(OUT('market-regime-dashboard.json'), {}),
    researchHub: readJson(OUT('research-hub.json'), {}),
  };
  const watchlists = buildWatchlists(state);
  const watchlistArtifact = {
    schema_version: '1.0',
    generated_at: now(),
    source_layer: 'watchlists',
    available: true,
    watchlists,
    evidence_refs: ['tools/build-workspace.js', 'data/intelligence/rankings.json', 'data/intelligence/change-events.json'],
  };
  const workspace = buildWorkspace(watchlists, state);
  if (WRITE) {
    fs.writeFileSync(OUT('watchlists.json'), `${JSON.stringify(watchlistArtifact, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT('workspace.json'), `${JSON.stringify(workspace, null, 2)}\n`, 'utf8');
  }
  console.log(`[workspace] watchlists=${watchlists.length} monitored=${workspace.counts.monitored_entities} unique=${workspace.counts.unique_symbols}`);
}

if (require.main === module) main();

module.exports = { buildWatchlists, buildWorkspace, DEFAULT_WATCHLISTS };
