'use strict';

// Phase 116 — Market Structure builder.
//
// Reads the canonical verified artifacts, runs the deterministic structure
// engine, and writes data/intelligence/market-structure.json (the full
// classified read + an evidence trail) plus a compact structure-summary block
// for FUTURE homepage integration (no homepage redesign this phase). Honest
// degradation: when the upstream regime read is indeterminate, the artifact is
// written with available=false and no fabricated dimensions.
//
// Usage: node tools/build-market-structure.js [--write]

const fs = require('fs');
const path = require('path');
const { classify, LABELS, DIMENSIONS, label } = require('./market-structure-engine');

const ROOT = path.resolve(__dirname, '..');
const I = (f) => path.join(ROOT, 'data', 'intelligence', f);
const OUT = I('market-structure.json');

function readJson(p, f) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function build() {
  const regime = readJson(I('liquidity-regime.json'), {});
  const cross = readJson(I('cross-asset-state.json'), {});
  const tension = readJson(I('structural-tension.json'), {});
  const session = readJson(I('session-history.json'), {});
  const live = readJson(path.join(ROOT, 'data', 'live-market-state.json'), {});

  const result = classify({ regime, cross, tension, session, live });

  // Freshness comes from the live snapshot age the regime engine already tracks.
  const ageH = regime.attribution && typeof regime.attribution.market_state_age_hours === 'number'
    ? regime.attribution.market_state_age_hours : null;

  // Attach bilingual labels to each dimension so consumers never re-map.
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

  // Compact homepage-prep summary (artifact only; not wired into any page yet).
  const summary = {
    dominant_structure: result.dominant,
    participation: dimensions.participation.state,
    volatility_structure: dimensions.volatility_structure.state,
    cross_asset: dimensions.cross_asset.state,
    structural_stability: dimensions.stability.state,
    structural_confidence: result.structural_confidence,
  };

  const artifact = {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'market-structure',
    available: result.available,
    structural_confidence: result.structural_confidence,
    coverage_pct: result.coverage_pct,
    dominant: result.dominant,
    dimensions,
    homepage_summary: summary,
    attribution: {
      sources: ['liquidity-regime', 'cross-asset-state', 'structural-tension', 'session-history', 'live-market-state'],
      market_state_age_hours: ageH,
      note: 'Deterministic composition of verified upstream structure signals. No fabricated values; insufficient evidence degrades to indeterminate.',
    },
  };
  return artifact;
}

if (require.main === module) {
  const artifact = build();
  const write = process.argv.includes('--write');
  const det = DIMENSIONS.filter((d) => artifact.dimensions[d].state !== 'indeterminate').length;
  console.log(`[market-structure] available=${artifact.available} confidence=${artifact.structural_confidence} determinate=${det}/${DIMENSIONS.length} dominant=${artifact.dominant ? artifact.dominant.dimension + ':' + artifact.dominant.state : 'none'}`);
  if (write) {
    fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
    console.log(`[market-structure] wrote ${path.relative(ROOT, OUT)}`);
  } else {
    console.log('[market-structure] dry-run (no --write).');
  }
  process.exit(0);
}

module.exports = { build, OUT };
