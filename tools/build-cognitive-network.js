'use strict';

// Phase 201 / Workstream C — deterministic cognitive market intelligence network.
// Connects assets, regime, tactical state, liquidity and market structure into
// confirmation / contradiction / stress / fragility chains over VERIFIED
// upstream artifacts. No prediction, no buy/sell, no fabricated precision —
// confidence is a qualitative band and every chain carries evidence[].
//
// Output: data/intelligence/cognitive-network.json
// Usage:  node tools/build-cognitive-network.js [--write]

const fs = require('fs');
const path = require('path');
const { RELATIONSHIPS, BY_SYMBOL, RISK_LEG, DEFENSIVE_LEG } = require('./asset-registry');

const ROOT = path.resolve(__dirname, '..');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
const REGIME = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const TACTICAL = path.join(ROOT, 'data', 'intelligence', 'tactical-context.json');
const STRUCTURE = path.join(ROOT, 'data', 'intelligence', 'market-structure.json');
const OUT = path.join(ROOT, 'data', 'intelligence', 'cognitive-network.json');
const WRITE = process.argv.includes('--write');

const NETWORK_LABELS = {
  coherent_risk_expansion: ['coherent risk expansion', 'توسّع مخاطر متّسق'],
  selective_risk_appetite: ['selective risk appetite', 'إقبال انتقائي على المخاطر'],
  defensive_rotation: ['defensive rotation', 'تدوير دفاعي'],
  liquidity_stress: ['liquidity stress', 'ضغط سيولة'],
  cross_asset_divergence: ['cross-asset divergence', 'تباعد عبر الأصول'],
  macro_fragility: ['macro fragility', 'هشاشة كلية'],
  confirmation_incomplete: ['confirmation incomplete', 'تأكيد غير مكتمل'],
  evidence_unavailable: ['evidence unavailable', 'الأدلة غير متاحة'],
};
const REL_STATE_LABELS = {
  confirmation: ['confirmation', 'تأكيد'],
  contradiction: ['contradiction', 'تناقض'],
  stress: ['stress', 'ضغط'],
  evidence_unavailable: ['evidence unavailable', 'الأدلة غير متاحة'],
};
const BAND_LABELS = {
  high: ['high', 'عالية'], moderate: ['moderate', 'متوسطة'], low: ['low', 'منخفضة'], indeterminate: ['indeterminate', 'غير محددة'],
};
const SIG = 0.5; // % move treated as a meaningful leg

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }

function changeFor(cross, crossKey) {
  const row = ((cross && cross.assets) || []).find((a) => a.asset === crossKey);
  if (!row || typeof row.change_pct !== 'number' || !Number.isFinite(row.change_pct)) return null;
  return row.change_pct;
}

function classify(aChg, bChg, mode) {
  if (aChg === null || bChg === null) return 'evidence_unavailable';
  const same = sign(aChg) === sign(bChg) && sign(aChg) !== 0;
  const opposite = sign(aChg) === -sign(bChg) && sign(aChg) !== 0;
  if (mode === 'risk_inverse') {
    if (opposite) return 'confirmation';
    if (same && aChg < 0 && bChg < 0 && (Math.abs(aChg) >= SIG || Math.abs(bChg) >= SIG)) return 'stress';
    return 'contradiction';
  }
  if (mode === 'risk_same' || mode === 'leadership' || mode === 'haven') {
    if (same) return 'confirmation';
    return 'contradiction';
  }
  // macro_inverse (gold vs dollar)
  if (opposite) return 'confirmation';
  return 'contradiction';
}

function tacticalFragile(tactical) {
  if (!tactical || tactical.available !== true) return false;
  const d = tactical.dimensions || {};
  const st = (k) => (d[k] ? d[k].state : null);
  return ['fragile_continuation', 'exhaustion_risk'].includes(st('continuation'))
    || ['fragile', 'elevated'].includes(st('positioning_fragility'))
    || st('directional_pressure') === 'fading';
}

function build() {
  const cross = readJson(CROSS, {});
  const regime = readJson(REGIME, {});
  const tactical = readJson(TACTICAL, {});
  const structure = readJson(STRUCTURE, {});
  const coherence = (cross && cross.coherence) || {};
  const direction = coherence.direction || 'indeterminate';

  const relationships = RELATIONSHIPS.map((rel) => {
    const a = BY_SYMBOL.get(rel.a); const b = BY_SYMBOL.get(rel.b);
    const aChg = changeFor(cross, a.cross_key);
    const bChg = changeFor(cross, b.cross_key);
    const state = classify(aChg, bChg, rel.mode);
    const evidence = state === 'evidence_unavailable'
      ? [`cross-asset-state: ${a.cross_key} or ${b.cross_key} change unavailable`]
      : [`cross-asset-state: ${a.cross_key}=${aChg}% , ${b.cross_key}=${bChg}% (${rel.mode})`];
    return {
      id: rel.id, mode: rel.mode, state,
      label_en: rel.en, label_ar: rel.ar,
      state_en: REL_STATE_LABELS[state][0], state_ar: REL_STATE_LABELS[state][1],
      evidence,
    };
  });

  const withData = relationships.filter((r) => r.state !== 'evidence_unavailable');
  const chainOf = (st) => relationships.filter((r) => r.state === st).map((r) => ({ id: r.id, label_en: r.label_en, label_ar: r.label_ar, evidence: r.evidence }));
  const confirmation_chains = chainOf('confirmation');
  const contradiction_chains = chainOf('contradiction');
  const stress_chains = chainOf('stress');

  // Defensive chains — a defensive leg bid while its risk leg is offered (a
  // flight-to-safety read). Leadership chains — which cohort leads on relative
  // strength. Both deterministic from observed change_pct; skip when unavailable.
  const defensive_chains = [];
  const leadership_chains = [];
  for (const rel of RELATIONSHIPS) {
    const a = BY_SYMBOL.get(rel.a); const b = BY_SYMBOL.get(rel.b);
    const aChg = changeFor(cross, a.cross_key); const bChg = changeFor(cross, b.cross_key);
    if (aChg === null || bChg === null) continue;
    if (rel.defensive) {
      const defSym = DEFENSIVE_LEG.has(rel.a) ? rel.a : DEFENSIVE_LEG.has(rel.b) ? rel.b : null;
      const riskSym = RISK_LEG.has(rel.a) ? rel.a : RISK_LEG.has(rel.b) ? rel.b : null;
      if (defSym && riskSym) {
        const defChg = defSym === rel.a ? aChg : bChg;
        const riskChg = riskSym === rel.a ? aChg : bChg;
        if (defChg > 0 && riskChg < 0) defensive_chains.push({ id: `defensive:${rel.id}`, label_en: rel.en, label_ar: rel.ar, evidence: [`${defSym}=${defChg}% (defensive bid) vs ${riskSym}=${riskChg}% (risk offered)`] });
      }
    }
    if (rel.mode === 'leadership') {
      const leader = aChg >= bChg ? rel.a : rel.b;
      leadership_chains.push({ id: `leadership:${rel.id}`, label_en: rel.en, label_ar: rel.ar, leader, evidence: [`${rel.a}=${aChg}% , ${rel.b}=${bChg}% → leader ${leader}`] });
    }
  }

  const fragile = tacticalFragile(tactical);
  const structureStability = structure && structure.dimensions && structure.dimensions.stability ? structure.dimensions.stability.state : null;
  const fragility_chains = (fragile || ['deteriorating', 'fragile'].includes(structureStability))
    ? contradiction_chains.concat(stress_chains).map((c) => ({
      id: `fragility:${c.id}`, label_en: c.label_en, label_ar: c.label_ar,
      evidence: c.evidence.concat([`tactical-context: fragile=${fragile}`, `market-structure: stability=${structureStability || 'n/a'}`]),
    }))
    : [];

  // Dominant network state (allowed labels only).
  let state;
  if (!withData.length) state = 'evidence_unavailable';
  else if (stress_chains.length >= 2 || (stress_chains.length >= 1 && direction === 'risk_off' && fragile)) state = 'liquidity_stress';
  else if (direction === 'risk_off' && confirmation_chains.length >= 1) state = 'defensive_rotation';
  else if (direction === 'risk_on' && contradiction_chains.some((c) => c.id === 'spy_vs_iwm')) state = 'selective_risk_appetite';
  else if (direction === 'risk_on' && contradiction_chains.length === 0 && confirmation_chains.length >= 2) state = 'coherent_risk_expansion';
  else if (contradiction_chains.length > confirmation_chains.length) state = 'cross_asset_divergence';
  else if (fragile && (contradiction_chains.length || stress_chains.length)) state = 'macro_fragility';
  else state = 'confirmation_incomplete';

  const coverage = withData.length / RELATIONSHIPS.length;
  const band = !withData.length ? 'indeterminate' : coverage >= 0.8 ? 'high' : coverage >= 0.5 ? 'moderate' : 'low';

  const evidence = [
    `cross-asset coherence: score=${coherence.score != null ? coherence.score : 'n/a'} direction=${direction} n=${coherence.n != null ? coherence.n : 'n/a'}`,
    `liquidity-regime: regime=${regime.regime || 'n/a'} liquidity=${regime.liquidity_state || 'n/a'} stability=${regime.stability || 'n/a'}`,
    `tactical-context: available=${tactical && tactical.available === true} fragile=${fragile}`,
    `relationships with data: ${withData.length}/${RELATIONSHIPS.length}`,
  ];

  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'cognitive-network',
    available: withData.length > 0,
    dominant_network_state: { state, label_en: NETWORK_LABELS[state][0], label_ar: NETWORK_LABELS[state][1] },
    confidence_band: band, confidence_band_en: BAND_LABELS[band][0], confidence_band_ar: BAND_LABELS[band][1],
    coverage_pct: Math.round(coverage * 100),
    confirmation_chains,
    contradiction_chains,
    stress_chains,
    fragility_chains,
    defensive_chains,
    leadership_chains,
    relationships,
    evidence,
    attribution: {
      sources: ['data/intelligence/cross-asset-state.json', 'data/intelligence/liquidity-regime.json', 'data/intelligence/tactical-context.json', 'data/intelligence/market-structure.json'],
      note: 'Deterministic cross-asset relationship composition over verified artifacts. Educational context, not a forecast or recommendation.',
    },
  };
}

if (require.main === module) {
  const result = build();
  console.log(`[cognitive-network] available=${result.available} state=${result.dominant_network_state.state} band=${result.confidence_band} (conf=${result.confirmation_chains.length} contra=${result.contradiction_chains.length} stress=${result.stress_chains.length} fragility=${result.fragility_chains.length})`);
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8'); console.log(`[cognitive-network] wrote ${path.relative(ROOT, OUT)}`); }
}

module.exports = { build, classify, NETWORK_LABELS, REL_STATE_LABELS, BAND_LABELS };
