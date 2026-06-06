'use strict';

// Phase 60.2: Macro Intelligence Quality Gate
// Validates that all macro intelligence data files are present, current,
// structurally correct, and free from generic/low-quality narrative patterns.
//
// Exit 0 on pass, exit 1 on failure.
// Usage: node tools/check-macro-intelligence.js

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT           = path.resolve(__dirname, '..');
const MEMORY_PATH    = path.join(ROOT, 'data', 'intelligence', 'event-reaction-memory.json');
const NARRATIVE_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-narrative.json');
const CAL_PATH       = path.join(ROOT, 'data', 'economic-calendar.json');
const HEALTH_PATH    = path.join(ROOT, 'data', 'provider-health.json');
const INTELLIGENCE_FILES = [
  {
    name: 'market-regime.json',
    path: path.join(ROOT, 'data', 'intelligence', 'market-regime.json'),
    required: ['regime', 'regime_label', 'data_quality', 'supporting_signals', 'contradictory_signals']
  },
  {
    name: 'cross-asset-transmission.json',
    path: path.join(ROOT, 'data', 'intelligence', 'cross-asset-transmission.json'),
    required: ['data_quality', 'regime_context', 'transmission_library', 'event_analyses']
  },
  {
    name: 'etf-flow-intelligence.json',
    path: path.join(ROOT, 'data', 'intelligence', 'etf-flow-intelligence.json'),
    required: ['data_quality', 'regime_context', 'etf_profiles', 'rotation_analysis']
  },
  {
    name: 'rate-path-intelligence.json',
    path: path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json'),
    required: ['data_quality', 'yield_curve', 'fed_path', 'duration_sensitivity', 'cross_asset_implications']
  }
];

const STALE_HOURS = 26;
const failures = [];
const warnings = [];

// Generic filler patterns that indicate low-quality or unsafe narrative
const BANNED_PHRASES = [
  /markets await/i, /all eyes on/i, /investors will be watching/i,
  /could go either way/i, /time will tell/i, /the market will decide/i,
  /\bpredict\b/i, /we recommend/i, /you should buy/i, /you should sell/i,
  /guaranteed/i, /certain to/i, /will definitely/i
];

// ── 1. event-reaction-memory.json ─────────────────────────────────────────────
if (!fs.existsSync(MEMORY_PATH)) {
  warnings.push('data/intelligence/event-reaction-memory.json does not exist — run build-event-reaction-memory.js --write');
} else {
  let mem;
  try { mem = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8')); }
  catch (err) { failures.push(`event-reaction-memory.json invalid JSON: ${err.message}`); }

  if (mem) {
    if (!Array.isArray(mem.event_reactions)) failures.push('event-reaction-memory.json: event_reactions must be an array');
    if (typeof mem.historical_patterns !== 'object' || mem.historical_patterns === null) {
      failures.push('event-reaction-memory.json: historical_patterns must be an object');
    }
    if (mem.updated_at) {
      const ageHours = (Date.now() - Date.parse(mem.updated_at)) / 3600000;
      if (ageHours > STALE_HOURS) warnings.push(`event-reaction-memory.json is ${Math.round(ageHours)}h old — consider refreshing`);
    }

    // Validate event entries
    const badEntries = (mem.event_reactions || []).filter(
      (e) => !e.event_id || !e.event_name || !e.event_date || !e.surprise_direction
    );
    if (badEntries.length) failures.push(`${badEntries.length} event-reaction entry(ies) missing required fields`);

    // Check for data quality
    const withPriceData = (mem.event_reactions || []).filter((e) => e.reaction_quality === 'observed');
    const total = (mem.event_reactions || []).length;
    if (total > 5 && withPriceData.length / total < 0.3) {
      warnings.push(`Only ${withPriceData.length}/${total} reaction entries have price data (FMP_API_KEY may not have been active)`);
    }

    console.log(`[macro-intelligence] event-reaction-memory: ${total} entries, ${withPriceData.length} with price data`);
    if (mem.historical_patterns) {
      const types = Object.keys(mem.historical_patterns);
      console.log(`[macro-intelligence] historical patterns: ${types.length} event type(s) — ${types.join(', ') || 'none'}`);
    }
  }
}

// ── 2. macro-narrative.json ───────────────────────────────────────────────────
if (!fs.existsSync(NARRATIVE_PATH)) {
  warnings.push('data/intelligence/macro-narrative.json does not exist — run generate-macro-narrative.js --write');
} else {
  let narr;
  try { narr = JSON.parse(fs.readFileSync(NARRATIVE_PATH, 'utf8')); }
  catch (err) { failures.push(`macro-narrative.json invalid JSON: ${err.message}`); }

  if (narr) {
    if (!Array.isArray(narr.release_narratives)) failures.push('macro-narrative.json: release_narratives must be an array');
    if (!Array.isArray(narr.preview_narratives)) failures.push('macro-narrative.json: preview_narratives must be an array');

    if (narr.generated_at) {
      const ageHours = (Date.now() - Date.parse(narr.generated_at)) / 3600000;
      if (ageHours > STALE_HOURS) warnings.push(`macro-narrative.json is ${Math.round(ageHours)}h old`);
    }

    // Scan narrative blocks for banned phrases and unsourced claims
    for (const n of [...(narr.release_narratives || []), ...(narr.preview_narratives || [])]) {
      const text = (n.narrative_blocks || []).join(' ');
      for (const pattern of BANNED_PHRASES) {
        if (pattern.test(text)) {
          failures.push(`Narrative quality gate: banned phrase "${pattern}" found in ${n.event_name}`);
          break;
        }
      }

      // Release narratives about material surprises must have supporting text
      if (n.surprise_direction && n.surprise_direction !== 'near_consensus' && n.surprise_direction !== 'pending') {
        if (!n.narrative_blocks || n.narrative_blocks.length < 2) {
          warnings.push(`Thin narrative for ${n.event_name} (${n.surprise_direction}) — fewer than 2 narrative blocks`);
        }
        if (!n.evidence_sources || !n.evidence_sources.length) {
          warnings.push(`${n.event_name}: no evidence sources recorded`);
        }
      }
    }

    console.log(`[macro-intelligence] macro-narrative: ${narr.release_narratives?.length || 0} releases, ${narr.preview_narratives?.length || 0} previews`);
  }
}

// ── 3. Safety: calendar data completeness ─────────────────────────────────────
if (fs.existsSync(CAL_PATH)) {
  const cal = JSON.parse(fs.readFileSync(CAL_PATH, 'utf8'));
  const events = cal.events || [];
  const released = events.filter((e) => e.status === 'released');
  const missingActual = released.filter((e) => e.actual === null || e.actual === undefined);
  const missingForecast = released.filter((e) => e.forecast === null || e.forecast === undefined);
  if (missingActual.length) warnings.push(`${missingActual.length} released event(s) missing actual value`);
  if (missingForecast.length) warnings.push(`${missingForecast.length} released event(s) missing forecast value`);

  // Unsupported event types
  const ALLOWED = new Set(['CPI','Core CPI','PCE','Core PCE','NFP','Unemployment Rate',
    'FOMC Rate Decision','Fed Statement','Powell Speech','GDP','Retail Sales','ISM PMI',
    'Jobless Claims','Treasury Auction','ECB Rate Decision','BoJ Rate Decision','BoE Rate Decision']);
  const unsupported = events.filter((e) => e.type && !ALLOWED.has(e.type));
  if (unsupported.length) warnings.push(`${unsupported.length} event(s) with unsupported types: ${[...new Set(unsupported.map((e) => e.type))].join(', ')}`);
}

// ── 4. Provider health ────────────────────────────────────────────────────────
if (fs.existsSync(HEALTH_PATH)) {
  const health = JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf8'));
  const fmp = health.providers?.fmp;
  if (fmp && fmp.status === 'error') {
    warnings.push(`FMP provider health: last status=error (${fmp.last_error || 'unknown'})`);
  }
  if (fmp) {
    console.log(`[macro-intelligence] FMP provider: status=${fmp.status}, last_checked=${fmp.last_checked?.slice(0, 16) || 'never'}`);
  }
}

// ── Report ─────────────────────────────────────────────────────────────────────
for (const spec of INTELLIGENCE_FILES) {
  if (!fs.existsSync(spec.path)) {
    failures.push(`${spec.name} does not exist`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(spec.path, 'utf8'));
  } catch (err) {
    failures.push(`${spec.name} invalid JSON: ${err.message}`);
    continue;
  }
  for (const key of spec.required) {
    if (data[key] === undefined || data[key] === null) failures.push(`${spec.name}: missing ${key}`);
  }
  const generatedAt = data.generated_at || data.detected_at;
  if (generatedAt) {
    const ageHours = (Date.now() - Date.parse(generatedAt)) / 3600000;
    if (ageHours > STALE_HOURS) warnings.push(`${spec.name} is ${Math.round(ageHours)}h old`);
  }
  if (spec.name === 'market-regime.json' && data.data_quality === 'insufficient' && data.regime !== 'unverified') {
    failures.push('market-regime.json: insufficient data quality must use regime=unverified');
  }
  console.log(`[macro-intelligence] ${spec.name}: data_quality=${data.data_quality || 'unknown'}`);
}

if (warnings.length) warnings.forEach((w) => console.warn(`[macro-intelligence] WARN: ${w}`));

if (failures.length) {
  failures.forEach((f) => console.error(`[macro-intelligence] FAIL: ${f}`));
  process.exit(1);
}

console.log('[macro-intelligence] check:macro-intelligence passed.');
