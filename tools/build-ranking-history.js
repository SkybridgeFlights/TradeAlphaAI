'use strict';

// Phase 209 / Workstream E — ranking movement (transitions). Uses the append-only
// snapshot ledger ONLY (no invented history): compares each entity's archived
// state label across the two most recent snapshots → rising / falling / stable.
// When fewer than 2 snapshots exist it reports `no_prior` and falls back to the
// entity's observed historical direction. No forecast.
//
// Output: data/intelligence/ranking-history.json
// Usage:  node tools/build-ranking-history.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const OUT = J('ranking-history.json');
const WRITE = process.argv.includes('--write');

const MOVE = { rising: ['rising', 'يصعد'], falling: ['falling', 'يهبط'], stable: ['stable', 'مستقر'], no_prior: ['no prior snapshot', 'لا لقطة سابقة'], indeterminate: ['indeterminate', 'غير محدد'] };
const ORDINAL = {
  asset: { very_weak: 0, weak: 1, neutral: 2, constructive: 3, strong: 4 },
  equity: { very_weak: 0, weak: 1, neutral: 2, constructive: 3, strong: 4 },
  sector: { weak: 0, fragile: 1, neutral: 2, cyclical: 2, defensive: 2, constructive: 3, strong: 4 },
};
const SNAP_FIELD = { asset: 'asset_scores', sector: 'sector_states', equity: 'equity_scores' };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function lab(k) { return { state: k, label_en: MOVE[k][0], label_ar: MOVE[k][1] }; }

function groupHistory(type, snaps, rankings) {
  const field = SNAP_FIELD[type];
  const ord = ORDINAL[type];
  const rankItems = ((rankings && rankings.items) || []);
  const latest = snaps.at(-1); const prev = snaps.length >= 2 ? snaps.at(-2) : null;
  return rankItems.map((r) => {
    const cur = latest && latest[field] ? latest[field][r.symbol] : null;
    const old = prev && prev[field] ? prev[field][r.symbol] : null;
    let move = 'no_prior'; const evidence = [];
    if (prev && cur != null && old != null && cur in ord && old in ord) {
      move = ord[cur] > ord[old] ? 'rising' : ord[cur] < ord[old] ? 'falling' : 'stable';
      evidence.push(`${old} → ${cur} (snapshots ${prev.date} → ${latest.date})`);
    } else {
      evidence.push(`single snapshot — observed direction ${r.direction || 'indeterminate'}`);
    }
    return {
      symbol: r.symbol, slug: r.slug, current_rank: r.rank_label, current_rank_en: r.rank_label_en, current_rank_ar: r.rank_label_ar,
      movement: move, movement_en: MOVE[move][0], movement_ar: MOVE[move][1],
      observed_direction: r.direction || 'indeterminate', from_state: old, to_state: cur, evidence,
    };
  });
}

function build() {
  const snapsArt = readJson(J('historical-snapshots.json'), {});
  const snaps = Array.isArray(snapsArt.snapshots) ? snapsArt.snapshots : [];
  const groups = {};
  for (const t of ['asset', 'sector', 'equity']) groups[t] = groupHistory(t, snaps, readJson(J(`${t}-rankings.json`), {}));
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'ranking-history',
    available: snaps.length > 0, snapshot_count: snaps.length, has_prior: snaps.length >= 2,
    groups,
    attribution: { sources: ['historical-snapshots.json', 'rankings'], note: 'Ranking movement from the real snapshot ledger only. Cross-run history accumulates over time; no invented history. Educational context, not a forecast.' },
  };
}

if (require.main === module) {
  const r = build();
  console.log(`[ranking-history] snapshots=${r.snapshot_count} has_prior=${r.has_prior} | asset moves: ${r.groups.asset.slice(0, 3).map((x) => x.symbol + '=' + x.movement).join(', ')}`);
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(r, null, 2)}\n`); console.log('[ranking-history] wrote artifact'); }
}

module.exports = { build, MOVE };
