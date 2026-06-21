'use strict';

/**
 * Phase 69 Part A — Historical Intelligence Memory Builder
 * Reads regime-engine-v2.json, market-intelligence-context.json, narrative-memory.json
 * and appends today's snapshot to data/intelligence/historical-memory.json.
 * Rolling retention: 365 days. Idempotent per date (upserts today's entry).
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const WRITE         = process.argv.includes('--write');
const MAX_SNAPSHOTS = 365;

const REGIME_V2_PATH  = path.join(ROOT, 'data', 'intelligence', 'regime-engine-v2.json');
const INTEL_CTX_PATH  = path.join(ROOT, 'data', 'intelligence', 'market-intelligence-context.json');
const NARRATIVE_PATH  = path.join(ROOT, 'data', 'narrative-memory.json');
const HISTORY_PATH    = path.join(ROOT, 'data', 'intelligence', 'historical-memory.json');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildSnapshot(date, regimeV2, intelCtx, narrative) {
  const cls  = regimeV2?.classifications || {};
  const snap = narrative?.latest_snapshot || {};

  const marketTone     = cls.risk_appetite?.label       || snap.dominant_risk_regime || 'unknown';
  const volatilityState = cls.volatility_regime?.label  || snap.volatility_environment || 'unknown';
  const yieldCurveState = cls.yield_curve?.label        || snap.yield_curve_condition || 'unknown';
  const breadthCond    = cls.breadth_conditions?.label  || snap.breadth_state || 'unverified';
  const ratePath       = cls.rate_path?.label           || 'unknown';
  const inflationReg   = cls.inflation_regime?.label    || 'unknown';
  const growthReg      = cls.growth_regime?.label       || 'unknown';

  // Sector leadership: prefer narrative memory, else empty
  const sectorLeadership = snap.sector_leadership && snap.sector_leadership.length
    ? snap.sector_leadership
    : [];

  // Dominant narratives: extract from narrative memory or regime reasons
  const dominantNarratives = [];
  if (snap.dominant_macro_narrative && snap.dominant_macro_narrative !== 'Macro signals remain mixed, with no single regime dominant.') {
    dominantNarratives.push(snap.dominant_macro_narrative);
  }
  if (cls.rate_path?.reason_en && dominantNarratives.length < 3) {
    dominantNarratives.push(cls.rate_path.reason_en);
  }
  if (cls.inflation_regime?.reason_en && dominantNarratives.length < 3) {
    dominantNarratives.push(cls.inflation_regime.reason_en);
  }
  if (!dominantNarratives.length) {
    dominantNarratives.push('data-dependent policy environment');
  }

  // Overall confidence: average available dimension confidences
  const dims = Object.values(cls).filter((d) => d && typeof d.confidence === 'number');
  const confidence = dims.length
    ? Math.round(dims.reduce((s, d) => s + d.confidence, 0) / dims.length)
    : 30;

  const dataQuality = regimeV2?.data_quality || intelCtx?.data_quality || 'structural';
  const sourceGenId = regimeV2?.generated_at || new Date().toISOString();

  return {
    date,
    snapshot_id:         `snap-${date}`,
    market_tone:         marketTone,
    volatility_state:    volatilityState,
    yield_curve_state:   yieldCurveState,
    breadth_condition:   breadthCond,
    rate_path:           ratePath,
    inflation_regime:    inflationReg,
    growth_regime:       growthReg,
    sector_leadership:   sectorLeadership,
    dominant_narratives: dominantNarratives,
    confidence,
    data_quality:        dataQuality,
    source_generation_id: sourceGenId,
    regime_classifications: {
      risk_appetite:    { label: cls.risk_appetite?.label    || 'unknown', confidence: cls.risk_appetite?.confidence    || 0 },
      volatility_regime:{ label: cls.volatility_regime?.label|| 'unknown', confidence: cls.volatility_regime?.confidence|| 0 },
      yield_curve:      { label: cls.yield_curve?.label      || 'unknown', confidence: cls.yield_curve?.confidence      || 0 },
      rate_path:        { label: cls.rate_path?.label        || 'unknown', confidence: cls.rate_path?.confidence        || 0 },
      inflation_regime: { label: cls.inflation_regime?.label || 'unknown', confidence: cls.inflation_regime?.confidence || 0 },
      growth_regime:    { label: cls.growth_regime?.label    || 'unknown', confidence: cls.growth_regime?.confidence    || 0 },
      breadth_conditions:{ label: cls.breadth_conditions?.label|| 'unknown', confidence: cls.breadth_conditions?.confidence|| 0 },
    },
  };
}

function main() {
  const regimeV2  = readJson(REGIME_V2_PATH, null);
  const intelCtx  = readJson(INTEL_CTX_PATH, null);
  const narrative = readJson(NARRATIVE_PATH, null);

  if (!regimeV2 && !narrative) {
    console.error('[historical-memory] No regime or narrative data available — skipping.');
    process.exit(0);
  }

  const today    = todayDate();
  const snapshot = buildSnapshot(today, regimeV2, intelCtx, narrative);

  // Load existing history
  const existing = readJson(HISTORY_PATH, { schema_version: '1.0', snapshots: [] });
  if (!Array.isArray(existing.snapshots)) existing.snapshots = [];

  // Upsert today's entry
  const idx = existing.snapshots.findIndex((s) => s.date === today);
  if (idx >= 0) {
    existing.snapshots[idx] = snapshot;
    console.log(`[historical-memory] Updated existing snapshot for ${today}`);
  } else {
    existing.snapshots.push(snapshot);
    console.log(`[historical-memory] Appended new snapshot for ${today}`);
  }

  // Sort by date ascending, then trim to MAX_SNAPSHOTS
  existing.snapshots.sort((a, b) => a.date.localeCompare(b.date));
  if (existing.snapshots.length > MAX_SNAPSHOTS) {
    const dropped = existing.snapshots.length - MAX_SNAPSHOTS;
    existing.snapshots = existing.snapshots.slice(dropped);
    console.log(`[historical-memory] Trimmed ${dropped} oldest snapshot(s) (retention: ${MAX_SNAPSHOTS} days)`);
  }

  const output = {
    schema_version: '1.0',
    generated_at:   new Date().toISOString(),
    total_snapshots: existing.snapshots.length,
    date_range: existing.snapshots.length
      ? { from: existing.snapshots[0].date, to: existing.snapshots[existing.snapshots.length - 1].date }
      : null,
    snapshots: existing.snapshots,
  };

  if (WRITE) {
    fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(output, null, 2), 'utf8');
    console.log(`[historical-memory] Written ${output.total_snapshots} snapshot(s) → ${path.relative(ROOT, HISTORY_PATH)}`);
  } else {
    console.log('[historical-memory] Dry run — pass --write to persist.');
    console.log(JSON.stringify(output, null, 2).slice(0, 600) + '\n...');
  }
}

main();
