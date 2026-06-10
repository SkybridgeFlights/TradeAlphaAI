'use strict';

// Aggregates historical-reactions.json into two summary datasets:
//   - data/market-brief/event-performance-memory.json  (per-event-type summaries)
//   - data/market-brief/calibration-stats.json         (accuracy calibration)
//
// Run after reaction recording or on-demand.
// Usage: node tools/build-reaction-memory.js [--write] [--dry-run]

const fs   = require('fs');
const path = require('path');

const { buildCalibration, globalStats, normalizeEventType } = require('./providers/market-brief/calibration-engine');
const { getHistoricalPattern } = require('./providers/market-brief/historical-tracker');

const ROOT            = path.resolve(__dirname, '..');
const BRIEF_DIR       = path.join(ROOT, 'data', 'market-brief');
const REACTIONS_PATH  = path.join(BRIEF_DIR, 'historical-reactions.json');
const MEMORY_PATH     = path.join(BRIEF_DIR, 'event-performance-memory.json');
const CALIBRATION_PATH = path.join(BRIEF_DIR, 'calibration-stats.json');

const doWrite = process.argv.includes('--write');
const dryRun  = process.argv.includes('--dry-run');

main();

function main() {
  console.log('[memory] Building event performance memory and calibration stats');

  const data = readJson(REACTIONS_PATH, { entries: [] });
  const entries = data.entries || [];

  console.log(`[memory] ${entries.length} total reactions in history`);
  if (!entries.length) {
    console.log('[memory] No reactions to process.');
    return;
  }

  // Build calibration
  const calibration = buildCalibration(entries);
  const global      = globalStats(calibration);

  const calibrationOutput = {
    version:    '1.0',
    updated_at: new Date().toISOString(),
    global:     global,
    by_event_type: calibration,
  };

  // Build event performance memory per event type
  const eventTypes = [...new Set(entries.map((e) => normalizeEventType(e.event_name)))];
  const memory     = {};

  for (const eventType of eventTypes) {
    const typeEntries = entries.filter((e) => normalizeEventType(e.event_name) === eventType);
    if (!typeEntries.length) continue;

    const cal = calibration[eventType] || {};

    // Compute beat rate, avg surprise magnitude
    const withSurprise = typeEntries.filter((e) => e.surprise?.direction && e.surprise.direction !== 'pending');
    const beats  = withSurprise.filter((e) => e.surprise.direction === 'beat').length;
    const misses = withSurprise.filter((e) => e.surprise.direction === 'miss').length;
    const avgMag = withSurprise.length
      ? Math.round(withSurprise.reduce((s, e) => s + (e.surprise?.magnitude || 0), 0) / withSurprise.length * 10) / 10
      : null;

    // Average actual moves per window per asset (for beat events)
    const beatEntries = withSurprise.filter((e) => e.surprise.direction === 'beat' && e.actual_moves);
    const assetMoves  = buildAssetMoveStats(beatEntries, 'beat');
    const missEntries = withSurprise.filter((e) => e.surprise.direction === 'miss' && e.actual_moves);
    const assetMovesMiss = buildAssetMoveStats(missEntries, 'miss');

    // Most recent events
    const recent = typeEntries.slice(0, 5).map((e) => ({
      date:      e.date,
      actual:    e.actual,
      forecast:  e.forecast,
      surprise:  e.surprise?.label || null,
      accuracy:  e.overall_accuracy?.label || null,
    }));

    memory[eventType] = {
      event_type:      eventType,
      sample_count:    typeEntries.length,
      beat_rate:       withSurprise.length ? Math.round((beats / withSurprise.length) * 100) / 100 : null,
      miss_rate:       withSurprise.length ? Math.round((misses / withSurprise.length) * 100) / 100 : null,
      avg_magnitude:   avgMag,
      accuracy_rate:   cal.accuracy_rate ?? null,
      confidence_multiplier: cal.confidence_multiplier ?? 1.0,
      avg_asset_moves_on_beat: assetMoves,
      avg_asset_moves_on_miss: assetMovesMiss,
      by_asset:        cal.by_asset   || {},
      by_window:       cal.by_window  || {},
      recent_events:   recent,
    };
  }

  const memoryOutput = {
    version:    '1.0',
    updated_at: new Date().toISOString(),
    total_tracked: entries.length,
    event_types:   memory,
  };

  if (doWrite && !dryRun) {
    fs.mkdirSync(BRIEF_DIR, { recursive: true });
    fs.writeFileSync(MEMORY_PATH,      JSON.stringify(memoryOutput, null, 2) + '\n', 'utf8');
    fs.writeFileSync(CALIBRATION_PATH, JSON.stringify(calibrationOutput, null, 2) + '\n', 'utf8');
    console.log(`[memory] Written: ${MEMORY_PATH}`);
    console.log(`[memory] Written: ${CALIBRATION_PATH}`);
  } else {
    console.log('[memory] [DRY-RUN] event-performance-memory.json:');
    console.log(JSON.stringify(memoryOutput, null, 2).slice(0, 2000) + '...');
    console.log('[memory] [DRY-RUN] calibration-stats.json:');
    console.log(JSON.stringify(calibrationOutput, null, 2).slice(0, 1000) + '...');
  }

  // Print summary
  console.log(`\n[memory] Summary:`);
  console.log(`  Total events tracked:  ${global.total_events_tracked}`);
  console.log(`  Overall accuracy rate: ${global.overall_accuracy_rate ?? 'N/A'}`);
  console.log(`  Event types profiled:  ${Object.keys(memory).length}`);
  for (const [type, m] of Object.entries(memory)) {
    const acc = m.accuracy_rate !== null ? `${Math.round(m.accuracy_rate * 100)}%` : 'no accuracy data';
    console.log(`    ${type.padEnd(22)} n=${m.sample_count}  accuracy=${acc}  beat_rate=${m.beat_rate !== null ? Math.round(m.beat_rate * 100) + '%' : '?'}`);
  }
}

// Build average pct move by asset and window for a set of entries
function buildAssetMoveStats(entries, label) {
  if (!entries.length) return {};
  const accum = {};
  const count = {};

  for (const e of entries) {
    for (const [window, moves] of Object.entries(e.actual_moves || {})) {
      if (!accum[window]) { accum[window] = {}; count[window] = {}; }
      for (const [key, val] of Object.entries(moves)) {
        const asset = key.replace('_pct', '');
        if (!accum[window][asset]) { accum[window][asset] = 0; count[window][asset] = 0; }
        accum[window][asset] += val;
        count[window][asset]++;
      }
    }
  }

  const result = {};
  for (const [window, assets] of Object.entries(accum)) {
    result[window] = {};
    for (const [asset, sum] of Object.entries(assets)) {
      const n = count[window][asset];
      result[window][asset] = Math.round((sum / n) * 100) / 100;
    }
  }
  return result;
}

function readJson(p, fallback = {}) {
  try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback; }
  catch (_) { return fallback; }
}
