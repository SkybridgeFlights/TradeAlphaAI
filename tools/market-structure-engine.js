'use strict';

// Phase 116 — Institutional Technical Structure Engine (pure, deterministic).
//
// This is NOT retail technical analysis. It is an institutional market-structure
// interpretation layer that COMPOSES already-verified upstream signals — the
// liquidity-regime engine (Phase 106), cross-asset-state (Phase 106), the
// structural-tension engine (Phase 84), multi-session memory (Phase 74) and the
// live market snapshot — into a coherent read of participation, volatility
// structure, cross-asset coherence, concentration, rotation, persistence and
// stability. It recomputes nothing it does not own: each dimension is derived
// from upstream classifications, and where the evidence is insufficient the
// dimension degrades to `indeterminate` rather than inventing a structure.
//
// No price targets, no entries/exits, no signals, no prediction — structure
// classification only, with bilingual labels and an evidence trail.

// Bilingual label maps so Arabic renders natively (no English leak in the UI).
const LABELS = {
  participation: {
    broad_participation: { en: 'broad participation', ar: 'مشاركة واسعة' },
    narrowing_participation: { en: 'narrowing participation', ar: 'مشاركة آخذة في التضيّق' },
    narrow_leadership: { en: 'narrow leadership', ar: 'قيادة ضيقة' },
    mixed_participation: { en: 'mixed participation', ar: 'مشاركة مختلطة' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  volatility_structure: {
    compression: { en: 'volatility compression', ar: 'انضغاط التذبذب' },
    expansion: { en: 'volatility expansion', ar: 'اتساع التذبذب' },
    elevated: { en: 'elevated volatility', ar: 'تذبذب مرتفع' },
    contained: { en: 'contained volatility', ar: 'تذبذب محتوى' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  cross_asset: {
    coherent: { en: 'coherent', ar: 'متسق' },
    mild_divergence: { en: 'mild cross-asset divergence', ar: 'تباعد طفيف عبر الأصول' },
    divergent: { en: 'cross-asset divergence', ar: 'تباعد عبر الأصول' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  concentration: {
    contained: { en: 'contained concentration', ar: 'تركّز محتوى' },
    elevated: { en: 'elevated concentration', ar: 'تركّز مرتفع' },
    concentrated: { en: 'concentration risk', ar: 'مخاطر تركّز' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  rotation: {
    defensive_rotation: { en: 'defensive rotation', ar: 'تدوير دفاعي' },
    cyclical_leadership: { en: 'cyclical leadership', ar: 'قيادة دورية' },
    mixed_rotation: { en: 'mixed rotation', ar: 'تدوير مختلط' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  persistence: {
    persistent: { en: 'persistent structure', ar: 'بنية مستمرة' },
    stabilizing: { en: 'stabilizing structure', ar: 'بنية آخذة في الاستقرار' },
    transitioning: { en: 'transitioning structure', ar: 'بنية في طور التحوّل' },
    single_session: { en: 'single-session read', ar: 'قراءة جلسة واحدة' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  momentum: {
    intact: { en: 'momentum intact', ar: 'زخم سليم' },
    early_deterioration: { en: 'early momentum deterioration', ar: 'تدهور مبكر في الزخم' },
    deteriorating: { en: 'momentum deterioration', ar: 'تدهور الزخم' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  liquidity_participation: {
    participating: { en: 'liquidity participating', ar: 'سيولة مشارِكة' },
    uncertain: { en: 'uncertain liquidity participation', ar: 'مشاركة سيولة غير مؤكدة' },
    exhaustion_risk: { en: 'liquidity exhaustion risk', ar: 'مخاطر استنزاف السيولة' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  stability: {
    stable: { en: 'stable structure', ar: 'بنية مستقرة' },
    fragile: { en: 'fragile structure', ar: 'بنية هشة' },
    deteriorating: { en: 'deteriorating structure', ar: 'بنية متدهورة' },
    unstable: { en: 'unstable structure', ar: 'بنية غير مستقرة' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
};

const DIMENSIONS = Object.keys(LABELS);

function label(dim, state, ar) {
  const m = LABELS[dim] && LABELS[dim][state];
  if (!m) return ar ? 'غير محدد' : 'indeterminate';
  return ar ? m.ar : m.en;
}

function val(o, k) { return o && o[k] != null ? o[k] : null; }
function num(v) { return typeof v === 'number' && !Number.isNaN(v) ? v : null; }

// Each classifier returns { state, evidence:[...] } and only asserts a
// determinate state when the upstream evidence supports it.
function classify(inputs) {
  const regime = inputs.regime || {};
  const cross = inputs.cross || {};
  const tension = inputs.tension || {};
  const session = inputs.session || {};
  const live = inputs.live || {};
  const sub = regime.sub_states || {};
  const istab = tension.internal_stability || {};
  // Session dims live per-session inside sessions[]; use the latest VERIFIED
  // session's dims (falling back to the latest session, then any top-level dims).
  const sessions = Array.isArray(session.sessions) ? session.sessions : [];
  const latestVerified = sessions.filter((s) => s && s.verified).slice(-1)[0];
  const dims = session.dims || (latestVerified && latestVerified.dims) || (sessions.slice(-1)[0] || {}).dims || {};

  const dimensions = {};

  // 1) Participation / breadth — leadership from structural-tension, breadth
  // sub-state from the regime engine, and the live small-vs-large read.
  (() => {
    const ev = [];
    let state = 'indeterminate';
    const leadership = istab.leadership; // broad | narrow | ...
    const breadth = sub.breadth;         // broad | narrow | mixed | ...
    const breadthState = dims.breadth_state; // confirming | diverging | ...
    if (leadership === 'broad' || breadth === 'broad') { state = 'broad_participation'; }
    if (breadth === 'narrow' || leadership === 'narrow') { state = 'narrow_leadership'; }
    if (breadthState === 'diverging' && state === 'broad_participation') state = 'narrowing_participation';
    if (breadth === 'mixed') state = 'mixed_participation';
    if (leadership) ev.push(`leadership=${leadership}`);
    if (breadth) ev.push(`breadth=${breadth}`);
    if (breadthState && breadthState !== 'unverified') ev.push(`session breadth=${breadthState}`);
    dimensions.participation = { state, evidence: ev };
  })();

  // 2) Volatility structure — regime volatility sub-state + tension alignment + VIX.
  (() => {
    const ev = [];
    let state = 'indeterminate';
    const v = sub.volatility; // compressed | compression | expansion | elevated | normal | indeterminate
    if (v === 'compressed' || v === 'compression') state = 'compression';
    else if (v === 'expansion') state = 'expansion';
    else if (v === 'elevated') state = 'elevated';
    else if (v === 'normal') state = 'contained';
    if (istab.volatility_alignment === 'aligned' && state === 'indeterminate') state = 'contained';
    if (v && v !== 'indeterminate') ev.push(`regime volatility=${v}`);
    if (istab.volatility_alignment) ev.push(`alignment=${istab.volatility_alignment}`);
    const vix = num(val(live.vix, 'value'));
    if (vix != null) ev.push(`VIX=${vix}`);
    dimensions.volatility_structure = { state, evidence: ev };
  })();

  // 3) Cross-asset coherence/divergence — coherence score + tension read.
  (() => {
    const ev = [];
    let state = 'indeterminate';
    const score = num(val(cross.coherence, 'score'));
    const ca = istab.cross_asset; // coherent | divergent | ...
    if (ca === 'coherent') state = 'coherent';
    if (ca === 'divergent') state = 'divergent';
    if (score != null) {
      ev.push(`coherence=${score}`);
      if (state === 'indeterminate') state = score >= 0.6 ? 'coherent' : score >= 0.3 ? 'mild_divergence' : 'divergent';
      else if (state === 'coherent' && score < 0.5) state = 'mild_divergence';
    }
    if (ca) ev.push(`tension cross_asset=${ca}`);
    const n = num(val(cross.coherence, 'n'));
    if (n != null && n < 3 && state !== 'indeterminate') ev.push(`thin sample n=${n}`);
    dimensions.cross_asset = { state, evidence: ev };
  })();

  // 4) Concentration risk — multi-session AI-concentration + momentum + dispersion.
  (() => {
    const ev = [];
    let state = 'indeterminate';
    const aiConc = dims.ai_concentration_risk; // contained | elevated | concentrated
    if (aiConc === 'contained') state = 'contained';
    else if (aiConc === 'elevated') state = 'elevated';
    else if (aiConc === 'concentrated' || aiConc === 'high') state = 'concentrated';
    if (dims.momentum_concentration === 'narrow' && state !== 'concentrated') state = 'elevated';
    if (aiConc && aiConc !== 'unverified') ev.push(`ai_concentration=${aiConc}`);
    if (dims.momentum_concentration && dims.momentum_concentration !== 'unverified') ev.push(`momentum_concentration=${dims.momentum_concentration}`);
    dimensions.concentration = { state, evidence: ev };
  })();

  // 5) Rotation — regime defensive sub-state + sector leadership composition.
  (() => {
    const ev = [];
    let state = 'indeterminate';
    const def = sub.defensive; // defensive_rotation | cyclical_leadership | ...
    if (def === 'defensive_rotation') state = 'defensive_rotation';
    else if (def === 'cyclical_leadership') state = 'cyclical_leadership';
    const lead = Array.isArray(cross.sector_leadership) ? cross.sector_leadership : (Array.isArray(live.sector_leadership) ? live.sector_leadership : []);
    const DEFENSIVE = new Set(['XLU', 'XLV', 'XLP', 'XLRE']);
    const defCount = lead.filter((s) => DEFENSIVE.has(s)).length;
    if (lead.length) {
      ev.push(`leaders=${lead.join('/')}`);
      if (state === 'indeterminate') state = defCount >= 2 ? 'defensive_rotation' : defCount === 0 ? 'cyclical_leadership' : 'mixed_rotation';
    }
    if (def) ev.push(`regime defensive=${def}`);
    dimensions.rotation = { state, evidence: ev };
  })();

  // 6) Persistence — honest about session depth. Only assert persistence when
  // multiple VERIFIED sessions agree; a lone session is a single-session read.
  (() => {
    const ev = [];
    let state = 'indeterminate';
    const verified = Array.isArray(session.sessions) ? session.sessions.filter((s) => s && s.verified) : [];
    if (verified.length >= 3) {
      const dir = cross.coherence && cross.coherence.direction;
      state = tension.regime_condition === 'stable-regime' ? 'persistent' : 'transitioning';
      if (dir) ev.push(`direction=${dir}`);
    } else if (verified.length >= 1) {
      state = tension.regime_condition === 'stable-regime' ? 'stabilizing' : 'single_session';
    }
    ev.push(`verified_sessions=${verified.length}`);
    if (tension.regime_condition) ev.push(`regime_condition=${tension.regime_condition}`);
    dimensions.persistence = { state, evidence: ev };
  })();

  // 7) Momentum deterioration — narrowing breadth + defensive rotation + concentration.
  (() => {
    const ev = [];
    let state = 'indeterminate';
    const part = dimensions.participation.state;
    const rot = dimensions.rotation.state;
    const conc = dimensions.concentration.state;
    if (part === 'broad_participation' && rot !== 'defensive_rotation' && conc !== 'concentrated') state = 'intact';
    if (part === 'narrowing_participation' || (rot === 'defensive_rotation' && part !== 'broad_participation')) state = 'early_deterioration';
    if (part === 'narrow_leadership' && (conc === 'concentrated' || rot === 'defensive_rotation')) state = 'deteriorating';
    ev.push(`participation=${part}`, `rotation=${rot}`, `concentration=${conc}`);
    dimensions.momentum = { state, evidence: ev };
  })();

  // 8) Liquidity participation / exhaustion — tension read + regime liquidity state.
  (() => {
    const ev = [];
    let state = 'indeterminate';
    const lp = istab.liquidity_participation; // participating | uncertain | ...
    if (lp === 'participating') state = 'participating';
    else if (lp === 'uncertain') state = 'uncertain';
    const liq = regime.liquidity_state;
    if ((liq === 'tightening' || regime.stability === 'deteriorating') && (sub.volatility === 'expansion' || sub.volatility === 'elevated')) state = 'exhaustion_risk';
    if (lp) ev.push(`liquidity_participation=${lp}`);
    if (liq) ev.push(`liquidity_state=${liq}`);
    dimensions.liquidity_participation = { state, evidence: ev };
  })();

  // 9) Structural stability — regime stability + tension level + fragility.
  (() => {
    const ev = [];
    let state = 'indeterminate';
    const stab = regime.stability; // stable | fragile | deteriorating | unstable | ...
    if (['stable', 'fragile', 'deteriorating', 'unstable'].includes(stab)) state = stab;
    const t = tension.tension_level; // contained | elevated | ...
    if (t === 'elevated' && state === 'stable') state = 'fragile';
    if (dims.market_fragility === 'elevated' && state === 'stable') state = 'fragile';
    if (stab) ev.push(`regime stability=${stab}`);
    if (t) ev.push(`tension=${t}`);
    if (dims.market_fragility && dims.market_fragility !== 'unverified') ev.push(`fragility=${dims.market_fragility}`);
    dimensions.stability = { state, evidence: ev };
  })();

  // Confidence: share of dimensions that are determinate, blended with the
  // regime engine's own confidence. Honest — many indeterminate → low score.
  const determinate = DIMENSIONS.filter((d) => dimensions[d].state !== 'indeterminate').length;
  const coverage = Math.round((determinate / DIMENSIONS.length) * 100);
  const regimeConf = num(regime.confidence);
  const structural_confidence = regimeConf != null ? Math.round((coverage + regimeConf) / 2) : coverage;

  // Dominant structure: the most salient non-benign classified dimension, in a
  // fixed risk-priority order (so the lead reads what matters most first).
  const PRIORITY = [
    ['stability', ['unstable', 'deteriorating', 'fragile']],
    ['liquidity_participation', ['exhaustion_risk']],
    ['momentum', ['deteriorating', 'early_deterioration']],
    ['participation', ['narrow_leadership', 'narrowing_participation']],
    ['concentration', ['concentrated', 'elevated']],
    ['cross_asset', ['divergent', 'mild_divergence']],
    ['volatility_structure', ['expansion', 'elevated', 'compression']],
    ['rotation', ['defensive_rotation']],
    ['participation', ['broad_participation']],
    ['stability', ['stable']],
  ];
  let dominant = null;
  for (const [dim, states] of PRIORITY) {
    if (states.includes(dimensions[dim].state)) { dominant = { dimension: dim, state: dimensions[dim].state }; break; }
  }

  const indeterminate_all = determinate === 0;

  return {
    available: !indeterminate_all,
    structural_confidence,
    coverage_pct: coverage,
    dominant,
    dimensions,
  };
}

module.exports = { classify, LABELS, DIMENSIONS, label };
