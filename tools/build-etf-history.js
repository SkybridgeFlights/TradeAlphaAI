'use strict';

// Phase 214 CP6 - ETF history and changelog.
// Uses current ETF rankings/intelligence and an optional ETF snapshot ledger.
// If no prior ETF snapshots exist, history is reported as no_prior.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const HIST_OUT = path.join(ROOT, 'data', 'intelligence', 'etf-history.json');
const CHANGE_OUT = path.join(ROOT, 'data', 'intelligence', 'etf-changelog.json');
const LEDGER = path.join(ROOT, 'data', 'intelligence', 'etf-snapshot-ledger.json');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);

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
    no_prior: ['no prior ETF snapshot', 'لا توجد لقطة سابقة للصندوق'],
    indeterminate: ['indeterminate', 'غير محدد']
  }[state] || ['indeterminate', 'غير محدد'];
}

function build() {
  const rankings = readJson('etf-rankings.json', {});
  const intelligence = readJson('etf-intelligence.json', {});
  const ledger = readJson(LEDGER, { snapshots: [] });
  const rankingBySymbol = new Map((rankings.items || []).map((item) => [item.symbol, item]));
  const intelBySymbol = new Map((intelligence.etfs || []).map((item) => [item.symbol, item]));
  const snapshots = Array.isArray(ledger.snapshots) ? ledger.snapshots : [];
  const hasPrior = snapshots.length > 1;
  const entities = {};
  const entries = [];

  for (const etf of ETFS) {
    const rank = rankingBySymbol.get(etf.symbol);
    const intel = intelBySymbol.get(etf.symbol);
    const current = stateOf(rank);
    const movement = hasPrior ? current : 'no_prior';
    const [movement_en, movement_ar] = labels(movement);
    const [state_en, state_ar] = labels(current);
    const summary_en = hasPrior
      ? `${etf.symbol} is currently classified as ${state_en} from ETF ranking history.`
      : `${etf.symbol} has no prior ETF snapshot yet; current state is ${state_en} and history is accumulating.`;
    const summary_ar = hasPrior
      ? `${etf.symbol} مصنف حاليا كـ ${state_ar} من تاريخ ترتيبات صناديق المؤشرات.`
      : `${etf.symbol} لا يملك لقطة سابقة بعد؛ الحالة الحالية ${state_ar} والتاريخ قيد التراكم.`;
    const entry = {
      symbol: etf.symbol,
      slug: etf.slug,
      current_state: current,
      current_state_en: state_en,
      current_state_ar: state_ar,
      movement,
      movement_en,
      movement_ar,
      prior_state: hasPrior ? 'available_in_ledger' : 'no_prior',
      history_available: hasPrior,
      summary_en,
      summary_ar,
      evidence: [
        `current rank=${rank ? rank.rank_label : 'indeterminate'}`,
        `ETF intelligence confidence=${intel && intel.confidence ? intel.confidence.state : 'indeterminate'}`,
        hasPrior ? `snapshot_count=${snapshots.length}` : 'no prior ETF snapshot ledger'
      ]
    };
    entities[etf.symbol] = entry;
    entries.push(entry);
  }

  const buckets = {
    improving: entries.filter((entry) => entry.current_state === 'improving').map((entry) => entry.symbol),
    weakening: entries.filter((entry) => entry.current_state === 'weakening').map((entry) => entry.symbol),
    stable: entries.filter((entry) => entry.current_state === 'stable').map((entry) => entry.symbol),
    indeterminate: entries.filter((entry) => entry.current_state === 'indeterminate').map((entry) => entry.symbol)
  };
  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  const history = {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'etf-history',
    available: true,
    snapshot_count: snapshots.length,
    has_prior: hasPrior,
    entities,
    buckets,
    source_hash: sourceHash,
    attribution: {
      sources: ['etf-rankings', 'etf-intelligence', 'optional etf-snapshot-ledger'],
      note: 'ETF history reports no_prior until a verified ETF snapshot ledger exists.'
    }
  };
  const changelog = {
    schema_version: '1.0',
    generated_at: history.generated_at,
    source_layer: 'etf-changelog',
    available: true,
    entries,
    buckets,
    source_hash: sourceHash,
    attribution: history.attribution
  };
  return { history, changelog };
}

if (require.main === module) {
  const { history, changelog } = build();
  console.log(`[etf-history] entries=${Object.keys(history.entities).length} has_prior=${history.has_prior}`);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(HIST_OUT, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
    fs.writeFileSync(CHANGE_OUT, `${JSON.stringify(changelog, null, 2)}\n`, 'utf8');
    console.log('[etf-history] wrote etf-history.json and etf-changelog.json');
  }
}

module.exports = { build };
