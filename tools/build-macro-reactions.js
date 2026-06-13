'use strict';

// Phase 105 — Live Macro Reaction Intelligence builder.
//
// Joins the economic-intelligence events (surprise + expected cross-asset
// transmission) with OBSERVED market reactions captured by record-event-reactions
// (data/market-brief/historical-reactions.json), runs the deterministic
// reaction-intelligence engine, and writes the canonical artifacts:
//   data/intelligence/macro-reactions.json
//   data/intelligence/cross-asset-reactions.json
//   data/intelligence/reaction-summary.json
//
// No fetching, no fabrication. Events without observed reaction data are marked
// 'awaiting_data'. Only high/medium-impact released/parsed events are considered.
//
// Usage: node tools/build-macro-reactions.js [--write]

const fs = require('fs');
const path = require('path');
const engine = require('./reaction-intelligence');

const ROOT = path.resolve(__dirname, '..');
const INTEL_PATH = path.join(ROOT, 'data', 'intelligence', 'economic-intelligence.json');
const REACTIONS_CAPTURE = path.join(ROOT, 'data', 'market-brief', 'historical-reactions.json');
const OUT_REACTIONS = path.join(ROOT, 'data', 'intelligence', 'macro-reactions.json');
const OUT_CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-reactions.json');
const OUT_SUMMARY = path.join(ROOT, 'data', 'intelligence', 'reaction-summary.json');

// Captured-reaction asset keys → tracked asset symbols.
const OBSERVED_MAP = { gold: 'GOLD', usd: 'DXY', spy: 'SPY', nasdaq: 'QQQ', vix: 'VIX', us10y: 'US10Y', oil: 'OIL' };
const WINDOW_ALIAS = { p1m: '+1m', p5m: '+5m', p15m: '+15m', p1h: '+1h', '1m': '+1m', '5m': '+5m', '15m': '+15m', '1h': '+1h', '+1m': '+1m', '+5m': '+5m', '+15m': '+15m', '+1h': '+1h' };

function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function num(x) { return typeof x === 'number' && Number.isFinite(x) ? x : (x != null && Number.isFinite(Number(x)) ? Number(x) : null); }

// Index captured reactions by event id (and a fallback type|date key).
function indexCaptures(capture) {
  const byId = new Map();
  const byKey = new Map();
  const entries = (capture && (capture.entries || capture.reactions || capture.records)) || [];
  for (const e of entries) {
    if (e.event_id) byId.set(e.event_id, e);
    const key = `${(e.type || e.event_type || '').toLowerCase()}|${String(e.event_time || e.date || '').slice(0, 10)}`;
    byKey.set(key, e);
  }
  return { byId, byKey, count: entries.length };
}

// Normalize a captured entry's actual_moves into the engine's observed shape:
//   { ASSET: { '+1m':pct, '+5m':pct, '+15m':pct, '+1h':pct } }
function normalizeObserved(entry) {
  if (!entry || !entry.actual_moves || typeof entry.actual_moves !== 'object') return null;
  const observed = {};
  for (const [k, v] of Object.entries(entry.actual_moves)) {
    const asset = OBSERVED_MAP[k.toLowerCase()];
    if (!asset || !v || typeof v !== 'object') continue;
    const windows = {};
    for (const [wk, wv] of Object.entries(v)) {
      const w = WINDOW_ALIAS[wk.toLowerCase()];
      const pct = num(wv);
      if (w && pct !== null) windows[w] = pct;
    }
    if (Object.keys(windows).length) observed[asset] = windows;
  }
  return Object.keys(observed).length ? observed : null;
}

function build() {
  const intel = readJson(INTEL_PATH, { events: [] });
  const capture = readJson(REACTIONS_CAPTURE, { entries: [] });
  const idx = indexCaptures(capture);

  const considered = (intel.events || []).filter(
    (e) => ['high', 'medium'].includes(e.importance) && ['released', 'parsed', 'revised', 'delayed'].includes(e.release_state),
  );

  const reactions = [];
  for (const e of considered) {
    const expected = (e.cross_asset && e.cross_asset.directional) || {};
    const entry = idx.byId.get(e.id) || idx.byKey.get(`${(e.event_type || e.category || '').toLowerCase()}|${String(e.release_time).slice(0, 10)}`);
    const observed = normalizeObserved(entry);
    const result = engine.classify({ expected, observed, surprise: e.surprise, category: e.category });
    const conv = engine.conviction(result);
    const narrative = engine.narrate(e, result, conv);
    reactions.push({
      event_id: e.id,
      event: e.event,
      category: e.category,
      country: e.country,
      release_time: e.release_time,
      release_state: e.release_state,
      surprise_label: e.surprise && e.surprise.surprise_label || 'pending',
      classification: result.classification,
      secondary_tags: result.secondary || [],
      alignment_ratio: result.alignment_ratio,
      conviction: conv.level,
      conviction_score: conv.score,
      narrative,
      cross_asset_matrix: result.matrix,
      windows_available: observed ? Object.keys(observed) : [],
      observed_source: observed ? (entry && entry.source ? entry.source : 'historical-reactions') : null,
      has_reaction_data: Boolean(observed),
    });
  }

  // Cross-asset aggregate (confirmations vs rejections per asset).
  const cross = {};
  for (const a of engine.TRACKED) cross[a] = { asset: a, confirmations: 0, rejections: 0, observed: 0 };
  for (const r of reactions) {
    for (const m of r.cross_asset_matrix) {
      if (m.confirms === null) continue;
      cross[m.asset].observed += 1;
      if (m.confirms) cross[m.asset].confirmations += 1; else cross[m.asset].rejections += 1;
    }
  }

  const byClass = {}; const byConv = {};
  for (const r of reactions) {
    byClass[r.classification] = (byClass[r.classification] || 0) + 1;
    byConv[r.conviction] = (byConv[r.conviction] || 0) + 1;
  }
  const withData = reactions.filter((r) => r.has_reaction_data).length;

  const now = new Date().toISOString();
  const macroReactions = {
    schema_version: '1.0', generated_at: now, source_layer: 'macro-reactions',
    tracked_assets: engine.TRACKED, reaction_windows: engine.WINDOWS,
    observed_capture: { source: 'data/market-brief/historical-reactions.json', captured_entries: idx.count },
    counts: { considered: reactions.length, with_reaction_data: withData, by_classification: byClass, by_conviction: byConv },
    note: withData ? null : 'No observed reaction windows captured yet — reactions are awaiting_data (no fabrication). record-event-reactions populates windows end-of-session with FINNHUB_API_KEY.',
    reactions,
  };
  const crossAsset = {
    schema_version: '1.0', generated_at: now, source_layer: 'cross-asset-reactions',
    tracked_assets: engine.TRACKED, assets: Object.values(cross),
  };
  const summary = {
    schema_version: '1.0', generated_at: now, source_layer: 'reaction-summary',
    total_considered: reactions.length, with_reaction_data: withData,
    by_classification: byClass, by_conviction: byConv,
    confirmed: (byClass.confirmed_reaction || 0) + (byClass.delayed_confirmation || 0),
    rejected: byClass.rejected_reaction || 0,
    awaiting: byClass.awaiting_data || 0,
  };
  return { macroReactions, crossAsset, summary };
}

function main() {
  const write = process.argv.includes('--write');
  const { macroReactions, crossAsset, summary } = build();
  console.log(`[macro-reactions] considered=${macroReactions.counts.considered} with_data=${macroReactions.counts.with_reaction_data} by_class=${JSON.stringify(macroReactions.counts.by_classification)}`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_REACTIONS), { recursive: true });
    fs.writeFileSync(OUT_REACTIONS, JSON.stringify(macroReactions, null, 2) + '\n', 'utf8');
    fs.writeFileSync(OUT_CROSS, JSON.stringify(crossAsset, null, 2) + '\n', 'utf8');
    fs.writeFileSync(OUT_SUMMARY, JSON.stringify(summary, null, 2) + '\n', 'utf8');
    console.log('[macro-reactions] wrote macro-reactions.json + cross-asset-reactions.json + reaction-summary.json');
  }
}

if (require.main === module) main();

module.exports = { build, normalizeObserved, indexCaptures };
