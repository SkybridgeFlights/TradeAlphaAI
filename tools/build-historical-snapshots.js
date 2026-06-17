'use strict';

// Phase 207 / Workstream A — append-only historical snapshot ledger. Each run
// appends a COMPACT snapshot of the current intelligence state (macro regime,
// sector rotation, network dominants, per-entity state labels) with a timestamp.
// Real archived states only — no fabricated history. Idempotent per day (a same-
// day re-run replaces today's entry). Capped to the most recent 120 snapshots.
// On first creation the ledger honestly holds a single snapshot ("history begins
// now"); it accumulates genuine cross-run history over time.
//
// Output: data/intelligence/historical-snapshots.json
// Usage:  node tools/build-historical-snapshots.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const OUT = J('historical-snapshots.json');
const WRITE = process.argv.includes('--write');
const CAP = 120;

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function scoreMap(art, key, valKey) { const out = {}; for (const x of ((art && art[key]) || [])) out[x.symbol] = x[valKey]; return out; }

function build() {
  const macro = readJson(J('macro-regime.json'));
  const rotation = readJson(J('sector-rotation.json'));
  const network = readJson(J('cognitive-network.json'));
  const sectorNet = readJson(J('sector-cognitive-network.json'));
  const equityNet = readJson(J('equity-cognitive-network.json'));
  const assetIntel = readJson(J('asset-intelligence.json'));
  const sectorStruct = readJson(J('sector-structure.json'));
  const equityIntel = readJson(J('equity-intelligence.json'));
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const snapshot = {
    date, ts: now.toISOString(),
    macro_regime: macro && macro.available ? macro.macro_regime : 'indeterminate',
    sector_rotation: rotation && rotation.available ? rotation.rotation_state : 'indeterminate',
    network_dominant: network && network.dominant_network_state ? network.dominant_network_state.state : 'indeterminate',
    sector_network_dominant: sectorNet && sectorNet.dominant_sector_state ? sectorNet.dominant_sector_state.state : 'indeterminate',
    equity_network_dominant: equityNet && equityNet.dominant_equity_state ? equityNet.dominant_equity_state.state : 'indeterminate',
    asset_scores: scoreMap(assetIntel, 'assets', 'score_label'),
    sector_states: scoreMap(sectorStruct, 'sectors', 'state'),
    equity_scores: scoreMap(equityIntel, 'equities', 'score_label'),
  };

  const existing = readJson(OUT, null);
  let snapshots = existing && Array.isArray(existing.snapshots) ? existing.snapshots.filter((s) => s && s.date) : [];
  snapshots = snapshots.filter((s) => s.date !== date); // idempotent per day
  snapshots.push(snapshot);
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  snapshots = snapshots.slice(-CAP);

  return {
    schema_version: '1.0', generated_at: now.toISOString(), source_layer: 'historical-snapshots',
    windows: ['1W', '1M', '3M', '6M'], count: snapshots.length, snapshots,
    note: 'Append-only ledger of real archived intelligence states. No fabricated history; cross-run history accumulates over time.',
    attribution: { sources: ['macro-regime', 'sector-rotation', 'cognitive networks', 'asset/sector/equity intelligence'], note: 'Educational historical context, not a forecast or recommendation.' },
  };
}

if (require.main === module) {
  const r = build();
  console.log(`[historical-snapshots] count=${r.count} latest=${r.snapshots.at(-1).date} macro=${r.snapshots.at(-1).macro_regime} rotation=${r.snapshots.at(-1).sector_rotation}`);
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(r, null, 2)}\n`); console.log('[historical-snapshots] wrote ledger'); }
}

module.exports = { build };
