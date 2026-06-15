'use strict';

// Phase 128 — Tactical Context & Bias builder.
//
// Reads the verified upstream artifacts, runs the deterministic tactical engine,
// and writes data/intelligence/tactical-context.json (full classified read +
// evidence trail + a compact summary for surface integration). Honest
// degradation: when the upstream structure read is unavailable, the artifact is
// written with available=false and no fabricated tactical conclusions.
//
// Usage: node tools/build-tactical-context.js [--write]

const fs = require('fs');
const path = require('path');
const { classify, CONFIDENCE_BANDS, DIMENSIONS, label } = require('./tactical-context-engine');

const ROOT = path.resolve(__dirname, '..');
const I = (f) => path.join(ROOT, 'data', 'intelligence', f);
const OUT = I('tactical-context.json');

function readJson(p, f) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function build() {
  const structure = readJson(I('market-structure.json'), {});
  const regime = readJson(I('liquidity-regime.json'), {});
  const tension = readJson(I('structural-tension.json'), {});
  const cross = readJson(I('cross-asset-state.json'), {});
  const reaction = readJson(I('reaction-summary.json'), {});

  const result = classify({ structure, regime, tension, cross, reaction });

  const ageH = regime.attribution && typeof regime.attribution.market_state_age_hours === 'number'
    ? regime.attribution.market_state_age_hours : null;

  const dimensions = {};
  for (const d of DIMENSIONS) {
    const dd = result.dimensions[d];
    dimensions[d] = {
      state: dd.state,
      label_en: label(d, dd.state, false),
      label_ar: label(d, dd.state, true),
      evidence: dd.evidence,
    };
  }

  const summary = {
    tactical_bias: dimensions.tactical_bias.state,
    directional_pressure: dimensions.directional_pressure.state,
    continuation: dimensions.continuation.state,
    participation_quality: dimensions.participation_quality.state,
    confidence_band: result.confidence_band,
    dominant: result.dominant,
  };

  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'tactical-context',
    available: result.available,
    confidence_band: result.confidence_band,
    confidence_band_en: CONFIDENCE_BANDS[result.confidence_band].en,
    confidence_band_ar: CONFIDENCE_BANDS[result.confidence_band].ar,
    coverage_pct: result.coverage_pct,
    dominant: result.dominant,
    dimensions,
    summary,
    attribution: {
      sources: ['market-structure', 'liquidity-regime', 'structural-tension', 'cross-asset-state', 'reaction-summary'],
      market_state_age_hours: ageH,
      note: 'Deterministic, conditional composition of verified upstream signals. Probabilistic institutional context, not advice, signals, price targets or forecasts. Insufficient evidence degrades to indeterminate.',
    },
  };
}

if (require.main === module) {
  const artifact = build();
  const det = DIMENSIONS.filter((d) => artifact.dimensions[d].state !== 'indeterminate').length;
  console.log(`[tactical-context] available=${artifact.available} bias=${artifact.summary.tactical_bias} confidence=${artifact.confidence_band} determinate=${det}/${DIMENSIONS.length} dominant=${artifact.dominant ? artifact.dominant.dimension + ':' + artifact.dominant.state : 'none'}`);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
    console.log(`[tactical-context] wrote ${path.relative(ROOT, OUT)}`);
  } else {
    console.log('[tactical-context] dry-run (no --write).');
  }
  process.exit(0);
}

module.exports = { build, OUT };
