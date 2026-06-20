'use strict';

// Phase 214 CP6 + Phase 215 CP6 — ETF history and changelog.
// Append-only ETF snapshot ledger captures each run's per-ETF current state.
// Window-derived intraseries history (real OHLCV windows from each ETF's OWN
// chart, no proxy) supplies an immediate honest direction even before the
// ledger has accumulated multiple snapshots. Ledger-derived movement only
// fires once a second real snapshot exists.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');
const { seriesHistory } = require('./history-engine');

const ROOT = path.resolve(__dirname, '..');
const HIST_OUT = path.join(ROOT, 'data', 'intelligence', 'etf-history.json');
const CHANGE_OUT = path.join(ROOT, 'data', 'intelligence', 'etf-changelog.json');
const LEDGER = path.join(ROOT, 'data', 'intelligence', 'etf-snapshot-ledger.json');
const CHARTS = path.join(ROOT, 'data', 'intelligence', 'etf-charts.json');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);
const WRITE = process.argv.includes('--write');
const LEDGER_CAP = 120;

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.isAbsolute(file) ? file : J(file), 'utf8')); } catch { return fallback; }
}

function stateOf(rank) {
  if (!rank || rank.available !== true) return 'indeterminate';
  if (['strongest', 'strong', 'constructive'].includes(rank.rank_label)) return 'improving';
  if (['weakening', 'weak', 'weakest'].includes(rank.rank_label)) return 'weakening';
  return 'stable';
}

function labels(state) {
  return {
    improving: ['improving', 'يتحسن'],
    weakening: ['weakening', 'يضعف'],
    stable: ['stable', 'مستقر'],
    deteriorating: ['deteriorating', 'يتدهور'],
    accelerating: ['accelerating', 'يتسارع'],
    no_prior: ['no prior ETF snapshot', 'لا توجد لقطة سابقة للصندوق'],
    indeterminate: ['indeterminate', 'غير محدد'],
  }[state] || ['indeterminate', 'غير محدد'];
}

function chartFor(charts, symbol) {
  return ((charts && charts.charts) || []).find((c) => c.verified === true && c.symbol === symbol) || null;
}

function appendSnapshot(rankings, write) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = readJson(LEDGER, { snapshots: [] });
  const snapshots = Array.isArray(existing.snapshots) ? existing.snapshots.slice() : [];
  const entry = {
    captured_on: today,
    captured_at: new Date().toISOString(),
    items: (rankings.items || []).map((item) => ({
      symbol: item.symbol,
      rank_label: item.rank_label,
      direction: item.direction,
      source_group: item.source_group,
      available: item.available,
    })),
  };
  const idx = snapshots.findIndex((s) => s.captured_on === today);
  if (idx >= 0) snapshots[idx] = entry; else snapshots.push(entry);
  const capped = snapshots.slice(-LEDGER_CAP);
  const ledger = { schema_version: '1.0', source_layer: 'etf-snapshot-ledger', cap: LEDGER_CAP, snapshots: capped };
  if (write) fs.writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  return ledger;
}

function priorEntryFor(ledger, symbol) {
  const snapshots = ledger.snapshots || [];
  if (snapshots.length < 2) return null;
  const today = new Date().toISOString().slice(0, 10);
  for (let i = snapshots.length - 1; i >= 0; i -= 1) {
    if (snapshots[i].captured_on === today) continue;
    const item = (snapshots[i].items || []).find((x) => x.symbol === symbol);
    if (item) return { snapshot: snapshots[i], item };
  }
  return null;
}

function build({ write = WRITE } = {}) {
  const rankings = readJson('etf-rankings.json', {});
  const intelligence = readJson('etf-intelligence.json', {});
  const charts = readJson(CHARTS, { charts: [] });
  const ledger = appendSnapshot(rankings, write);
  const snapshots = ledger.snapshots || [];
  const rankingBySymbol = new Map((rankings.items || []).map((item) => [item.symbol, item]));
  const intelBySymbol = new Map((intelligence.etfs || []).map((item) => [item.symbol, item]));
  const hasPrior = snapshots.length > 1;
  const entities = {};
  const entries = [];

  for (const etf of ETFS) {
    const rank = rankingBySymbol.get(etf.symbol);
    const intel = intelBySymbol.get(etf.symbol);
    const chart = chartFor(charts, etf.symbol);
    const current = stateOf(rank);

    let window = null;
    if (chart && Array.isArray(chart.series) && chart.series.length >= 35) {
      try { window = seriesHistory(chart.series); } catch { window = null; }
    }
    const windowTrend = window ? window.overall : 'indeterminate';
    const [window_en, window_ar] = labels(windowTrend);

    const prior = priorEntryFor(ledger, etf.symbol);
    const order = { strongest: 6, strong: 5, constructive: 4, neutral: 3, weakening: 2, weak: 1, weakest: 0, indeterminate: -1 };
    let ledgerMovement = null;
    if (prior) {
      const diff = (order[rank ? rank.rank_label : 'indeterminate'] || -1) - (order[prior.item.rank_label] || -1);
      if (diff >= 2) ledgerMovement = 'accelerating';
      else if (diff > 0) ledgerMovement = 'improving';
      else if (diff <= -2) ledgerMovement = 'deteriorating';
      else if (diff < 0) ledgerMovement = 'weakening';
      else ledgerMovement = 'stable';
    }

    const movement = ledgerMovement || (window ? windowTrend : (hasPrior ? current : 'no_prior'));
    const [movement_en, movement_ar] = labels(movement);
    const [state_en, state_ar] = labels(current);

    let summary_en; let summary_ar;
    if (ledgerMovement) {
      summary_en = `${etf.symbol} ranking moved ${movement_en} since the prior ETF snapshot (${prior.snapshot.captured_on}); current state is ${state_en}.`;
      summary_ar = `${etf.symbol} انتقل تصنيفه إلى ${movement_ar} منذ اللقطة السابقة (${prior.snapshot.captured_on})؛ الحالة الحالية ${state_ar}.`;
    } else if (window) {
      summary_en = `${etf.symbol} intraseries window trend is ${window_en} from its own verified OHLCV; current ranking state is ${state_en}; cross-run ledger is accumulating.`;
      summary_ar = `${etf.symbol} اتجاه نافذة السلسلة الزمنية الخاصة بالصندوق هو ${window_ar} من بيانات OHLCV الموثقة؛ الحالة الحالية ${state_ar}؛ السجل عبر التشغيلات في طور التراكم.`;
    } else {
      summary_en = `${etf.symbol} has no verified chart and no prior ETF snapshot; current state is ${state_en} and history is accumulating.`;
      summary_ar = `${etf.symbol} لا يملك مخططا موثقا ولا لقطة سابقة؛ الحالة الحالية ${state_ar} والتاريخ قيد التراكم.`;
    }

    const evidence = [
      `current rank=${rank ? rank.rank_label : 'indeterminate'}`,
      `ETF intelligence confidence=${intel && intel.confidence ? intel.confidence.state : 'indeterminate'}`,
      window ? `intraseries trend=${windowTrend} band=${window.band}` : 'window trend unavailable (no verified chart with >=35 bars)',
      ledgerMovement ? `prior snapshot ${prior.snapshot.captured_on} rank=${prior.item.rank_label}` : `snapshot_count=${snapshots.length}`,
    ];

    const entry = {
      symbol: etf.symbol,
      slug: etf.slug,
      current_state: current,
      current_state_en: state_en,
      current_state_ar: state_ar,
      movement,
      movement_en,
      movement_ar,
      window_trend: windowTrend,
      window_trend_en: window_en,
      window_trend_ar: window_ar,
      window_band: window ? window.band : 'indeterminate',
      window_score: window ? window.now : null,
      prior_state: prior ? prior.item.rank_label : (hasPrior ? 'available_in_ledger' : 'no_prior'),
      prior_captured_on: prior ? prior.snapshot.captured_on : null,
      history_available: Boolean(ledgerMovement) || Boolean(window),
      summary_en,
      summary_ar,
      evidence,
    };
    entities[etf.symbol] = entry;
    entries.push(entry);
  }

  const buckets = {
    improving: entries.filter((entry) => ['improving', 'accelerating'].includes(entry.movement)).map((entry) => entry.symbol),
    weakening: entries.filter((entry) => ['weakening', 'deteriorating'].includes(entry.movement)).map((entry) => entry.symbol),
    stable: entries.filter((entry) => entry.movement === 'stable').map((entry) => entry.symbol),
    indeterminate: entries.filter((entry) => ['indeterminate', 'no_prior'].includes(entry.movement)).map((entry) => entry.symbol),
  };
  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  const history = {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'etf-history',
    available: true,
    snapshot_count: snapshots.length,
    has_prior: hasPrior,
    window_history_available: entries.filter((e) => e.window_trend !== 'indeterminate').length,
    entities,
    buckets,
    source_hash: sourceHash,
    attribution: {
      sources: ['etf-rankings', 'etf-intelligence', 'etf-charts (intraseries windows)', 'etf-snapshot-ledger'],
      note: 'ETF history combines an append-only per-run snapshot ledger (movement vs prior ledger entry) with intraseries window trends derived from each ETF own verified OHLCV. No proxy substitution; ETFs without a verified chart and without a prior snapshot remain no_prior.',
    },
  };
  const changelog = {
    schema_version: '1.0',
    generated_at: history.generated_at,
    source_layer: 'etf-changelog',
    available: true,
    snapshot_count: snapshots.length,
    has_prior: hasPrior,
    entries,
    buckets,
    source_hash: sourceHash,
    attribution: history.attribution,
  };
  return { history, changelog };
}

if (require.main === module) {
  const { history, changelog } = build({ write: WRITE });
  console.log(`[etf-history] entries=${Object.keys(history.entities).length} has_prior=${history.has_prior} window_history=${history.window_history_available} snapshots=${history.snapshot_count}`);
  console.log(`  buckets: improving=${history.buckets.improving.length} weakening=${history.buckets.weakening.length} stable=${history.buckets.stable.length} indeterminate=${history.buckets.indeterminate.length}`);
  if (WRITE) {
    fs.writeFileSync(HIST_OUT, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
    fs.writeFileSync(CHANGE_OUT, `${JSON.stringify(changelog, null, 2)}\n`, 'utf8');
    console.log('[etf-history] wrote etf-history.json + etf-changelog.json + etf-snapshot-ledger.json');
  }
}

module.exports = { build };
