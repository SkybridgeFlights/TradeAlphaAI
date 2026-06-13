'use strict';

// Phase 105 — check:macro-reactions. Integrity gate for the macro reaction
// intelligence artifacts. HARD-FAILS on:
//   * a classified reaction without observed data (fabricated reaction)
//   * impossible timestamps (invalid / future release for a released state)
//   * an empty/missing narrative
//   * missing observed-source attribution where reaction data is claimed
//   * contradictory classification/conviction (awaiting_data with conviction,
//     or a confirmed reaction with conviction 'none')
//   * an unknown classification or conviction value
//   * duplicate event ids / duplicated window entries
//   * null/NaN propagation in numeric fields
//   * a reaction whose event id is not in the economic-intelligence artifact
//     (release/reaction mismatch)
//   * an unsupported asset symbol in the cross-asset matrix
// Unbuilt artifacts pass (CI builds them each run).

const fs = require('fs');
const path = require('path');
const { TRACKED, CLASSIFICATIONS, CONVICTION } = require('./reaction-intelligence');

const ROOT = path.resolve(__dirname, '..');
const RX = path.join(ROOT, 'data', 'intelligence', 'macro-reactions.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-reactions.json');
const SUMMARY = path.join(ROOT, 'data', 'intelligence', 'reaction-summary.json');
const INTEL = path.join(ROOT, 'data', 'intelligence', 'economic-intelligence.json');

const failures = [];
const fail = (m) => failures.push(m);
const readJson = (p, f) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } };
const finiteOrNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));

const rx = readJson(RX, null);
if (!rx) {
  console.log('[macro-reactions] artifact not built yet — CI builds it each run (non-fatal).');
  console.log('[macro-reactions] check:macro-reactions passed.');
  process.exit(0);
}

const intel = readJson(INTEL, { events: [] });
const intelIds = new Set((intel.events || []).map((e) => e.id));
const TRACKED_SET = new Set(TRACKED);
const now = Date.now();

const reactions = Array.isArray(rx.reactions) ? rx.reactions : [];
const seenIds = new Set();

for (const r of reactions) {
  const lbl = `reaction:${r.event_id || '<no-id>'}`;

  if (!CLASSIFICATIONS.includes(r.classification)) fail(`${lbl}: unknown classification "${r.classification}"`);
  if (!CONVICTION.includes(r.conviction)) fail(`${lbl}: unknown conviction "${r.conviction}"`);

  // Fabrication guard: a real classification requires observed data.
  if (r.classification !== 'awaiting_data' && !r.has_reaction_data) {
    fail(`${lbl}: classified "${r.classification}" without observed reaction data (fabrication)`);
  }
  // Contradiction guards.
  if (r.classification === 'awaiting_data' && r.conviction !== 'none') fail(`${lbl}: awaiting_data but conviction "${r.conviction}"`);
  if (['confirmed_reaction', 'partial_confirmation', 'delayed_confirmation'].includes(r.classification) && r.conviction === 'none') {
    fail(`${lbl}: confirmed-type reaction with conviction 'none'`);
  }
  if (r.has_reaction_data && !r.observed_source) fail(`${lbl}: reaction data without observed_source attribution`);

  // Numerics.
  if (!finiteOrNull(r.alignment_ratio)) fail(`${lbl}: alignment_ratio not finite/null`);
  if (!finiteOrNull(r.conviction_score)) fail(`${lbl}: conviction_score not finite/null`);
  if (r.classification !== 'awaiting_data' && r.alignment_ratio === null) fail(`${lbl}: classified but alignment_ratio null`);

  // Narrative.
  if (typeof r.narrative !== 'string' || !r.narrative.trim()) fail(`${lbl}: empty narrative`);

  // Timestamps.
  if (!r.release_time || Number.isNaN(Date.parse(r.release_time))) fail(`${lbl}: invalid release_time`);
  else if (['released', 'parsed', 'revised', 'delayed'].includes(r.release_state) && Date.parse(r.release_time) > now + 3600000) {
    fail(`${lbl}: released state but release_time is in the future`);
  }

  // Release/reaction linkage.
  if (r.event_id && intelIds.size && !intelIds.has(r.event_id)) fail(`${lbl}: event_id not present in economic-intelligence (mismatch)`);
  if (r.event_id) { if (seenIds.has(r.event_id)) fail(`${lbl}: duplicate reaction event_id`); seenIds.add(r.event_id); }

  // Matrix integrity.
  const seenAssets = new Set();
  for (const m of r.cross_asset_matrix || []) {
    if (!TRACKED_SET.has(m.asset)) fail(`${lbl}: unsupported asset "${m.asset}"`);
    if (seenAssets.has(m.asset)) fail(`${lbl}: duplicate asset row "${m.asset}"`);
    seenAssets.add(m.asset);
    if (!finiteOrNull(m.observed_pct)) fail(`${lbl}: observed_pct NaN for ${m.asset}`);
    if (m.confirms !== null && typeof m.confirms !== 'boolean') fail(`${lbl}: confirms not boolean/null for ${m.asset}`);
  }
  // Duplicate window entries.
  const w = r.windows_available || [];
  if (new Set(w).size !== w.length) fail(`${lbl}: duplicated reaction windows`);
}

// Cross-asset + summary sanity.
const cross = readJson(CROSS, null);
if (cross) for (const a of cross.assets || []) {
  if (!TRACKED_SET.has(a.asset)) fail(`cross-asset: unsupported asset "${a.asset}"`);
  if (a.confirmations + a.rejections > a.observed) fail(`cross-asset ${a.asset}: confirmations+rejections exceed observed`);
}
const summary = readJson(SUMMARY, null);
if (summary && summary.total_considered !== reactions.length) fail(`summary total_considered (${summary.total_considered}) != reactions (${reactions.length})`);

if (failures.length) {
  failures.forEach((f) => console.error(`[macro-reactions] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[macro-reactions] check:macro-reactions passed (${reactions.length} considered, ${rx.counts.with_reaction_data} with data; no fabrication, linkage + assets valid).`);
