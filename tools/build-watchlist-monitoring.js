'use strict';

// Phase 218 - Watchlist monitoring layer.
// Derives watchlist changes, leadership, deterioration and improvement from
// existing change/ranking/history artifacts only.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = (name) => path.join(ROOT, 'data', 'intelligence', name);
const WRITE = process.argv.includes('--write');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function scoreDirection(v) {
  if (['strongest', 'strong', 'improving', 'leadership_gain'].includes(v)) return 1;
  if (['weak', 'weakest', 'weakening', 'deteriorating', 'leadership_loss'].includes(v)) return -1;
  return 0;
}

function classifyEntity(entity) {
  const rank = entity.ranking || {};
  const hist = entity.history || {};
  const score = scoreDirection(rank.rank_label) + scoreDirection(rank.direction) + scoreDirection(hist.observed_direction);
  const changes = entity.recent_changes || [];
  const changeScore = changes.reduce((sum, c) => sum + scoreDirection(c.change_type), 0);
  const total = score + changeScore;
  const state = total > 1 ? 'improving' : total < -1 ? 'deteriorating' : total > 0 ? 'leadership' : total < 0 ? 'watching' : 'stable';
  return {
    symbol: entity.symbol,
    type: entity.type,
    slug: entity.slug,
    name_en: entity.name_en,
    name_ar: entity.name_ar,
    href: entity.href,
    research_href: entity.research_href,
    monitor_state: state,
    rank_label: rank.rank_label || 'indeterminate',
    direction: rank.direction || hist.observed_direction || 'indeterminate',
    confirmation: rank.confirmation || 'indeterminate',
    recent_change_count: changes.length,
    latest_changes: changes.slice(0, 3),
    evidence_refs: [
      ...(rank.evidence || []),
      ...(hist.evidence || []),
      ...changes.flatMap((c) => c.evidence || []),
    ].slice(0, 8),
  };
}

function buildMonitoring(watchlists, regime, changeIntelligence) {
  const rows = watchlists.map((w) => {
    const entities = (w.entities || []).map(classifyEntity);
    const leadership = entities.filter((e) => ['leadership', 'improving'].includes(e.monitor_state));
    const deterioration = entities.filter((e) => ['deteriorating', 'watching'].includes(e.monitor_state));
    const changes = entities.flatMap((e) => e.latest_changes.map((c) => ({ ...c, symbol: e.symbol, type: e.type })));
    return {
      id: w.id,
      title_en: w.title_en,
      title_ar: w.title_ar,
      entities,
      latest_changes: changes.slice(0, 8),
      leadership: leadership.slice(0, 5),
      improvement: entities.filter((e) => e.monitor_state === 'improving').slice(0, 5),
      deterioration: deterioration.slice(0, 5),
      regime_alignment: regime.current_regime ? regime.current_regime.state : 'indeterminate',
      evidence_refs: [
        'data/intelligence/watchlists.json',
        'data/intelligence/change-events.json',
        'data/intelligence/rankings.json',
        'data/intelligence/ranking-history.json',
      ],
    };
  });
  const all = rows.flatMap((r) => r.entities);
  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'watchlist-monitoring',
    available: true,
    dedupe_hash: hash(rows.map((r) => [r.id, r.entities.map((e) => [e.symbol, e.monitor_state])])),
    watchlists: rows,
    aggregate: {
      monitored_count: all.length,
      leadership: all.filter((e) => ['leadership', 'improving'].includes(e.monitor_state)).slice(0, 10),
      deterioration: all.filter((e) => ['deteriorating', 'watching'].includes(e.monitor_state)).slice(0, 10),
      latest_changes: rows.flatMap((r) => r.latest_changes).slice(0, 20),
      regime_state: regime.current_regime || { state: 'indeterminate', label_en: 'indeterminate', label_ar: 'غير محدد' },
      change_intelligence_available: !!changeIntelligence.available,
    },
    evidence_refs: [
      'data/intelligence/watchlists.json',
      'data/intelligence/change-events.json',
      'data/intelligence/change-intelligence.json',
      'data/intelligence/market-regime-dashboard.json',
    ],
  };
}

function main() {
  const watchlists = readJson(OUT('watchlists.json'), { watchlists: [] });
  const regime = readJson(OUT('market-regime-dashboard.json'), {});
  const changeIntelligence = readJson(OUT('change-intelligence.json'), {});
  const monitoring = buildMonitoring(watchlists.watchlists || [], regime, changeIntelligence);
  if (WRITE) fs.writeFileSync(OUT('watchlist-monitoring.json'), `${JSON.stringify(monitoring, null, 2)}\n`, 'utf8');
  console.log(`[watchlist-monitoring] watchlists=${monitoring.watchlists.length} monitored=${monitoring.aggregate.monitored_count}`);
}

if (require.main === module) main();

module.exports = { buildMonitoring, classifyEntity };
