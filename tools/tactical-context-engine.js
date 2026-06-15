'use strict';

// Phase 128 — Institutional Tactical Context & Bias engine (pure, deterministic).
//
// This is NOT retail technical analysis, signals, or advice. It is an
// institutional desk-tone interpretation layer that COMPOSES already-verified
// upstream signals — the market-structure engine (Phase 116), the liquidity-
// regime engine (Phase 106), cross-asset coherence, the structural-tension
// layer (Phase 84) and reaction persistence (Phase 105) — into a probabilistic,
// CONDITIONAL tactical read: bias, directional pressure, continuation vs
// exhaustion, participation quality, confirmation quality, liquidity support/
// drain, posture and positioning fragility, plus a qualitative confidence BAND.
//
// It fabricates nothing: every dimension is derived from upstream classifications
// and degrades to `indeterminate` when the evidence is insufficient. There are NO
// numeric probabilities (only qualitative bands), NO price targets, NO entries/
// exits, NO buy/sell/long/short language — interpretation only.

// Bilingual label maps (native Arabic — no English leak in the UI).
const LABELS = {
  tactical_bias: {
    supportive: { en: 'tactically supportive', ar: 'داعم تكتيكياً' },
    neutral: { en: 'tactically neutral', ar: 'محايد تكتيكياً' },
    cautious: { en: 'tactically cautious', ar: 'حذِر تكتيكياً' },
    defensive: { en: 'tactically defensive', ar: 'دفاعي تكتيكياً' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  directional_pressure: {
    building: { en: 'building', ar: 'متصاعد' },
    steady: { en: 'steady', ar: 'ثابت' },
    fading: { en: 'fading', ar: 'متلاشٍ' },
    stalling: { en: 'stalling', ar: 'متعثّر' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  continuation: {
    continuation: { en: 'continuation favored', ar: 'الاستمرار مرجّح' },
    fragile_continuation: { en: 'fragile continuation', ar: 'استمرار هش' },
    exhaustion_risk: { en: 'exhaustion risk', ar: 'مخاطر إنهاك' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  participation_quality: {
    broad: { en: 'broad participation', ar: 'مشاركة واسعة' },
    narrowing: { en: 'narrowing participation', ar: 'مشاركة آخذة في التضيّق' },
    narrow: { en: 'narrow participation', ar: 'مشاركة ضيقة' },
    mixed: { en: 'mixed participation', ar: 'مشاركة مختلطة' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  confirmation_quality: {
    confirmed: { en: 'broad confirmation', ar: 'تأكيد واسع' },
    partial: { en: 'partial confirmation', ar: 'تأكيد جزئي' },
    divergent: { en: 'cross-asset divergence', ar: 'تباعد عبر الأصول' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  liquidity_support: {
    supportive: { en: 'liquidity supportive', ar: 'سيولة داعمة' },
    neutral: { en: 'liquidity neutral', ar: 'سيولة محايدة' },
    draining: { en: 'liquidity draining', ar: 'سيولة تنزف' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  posture: {
    risk_seeking: { en: 'risk-seeking posture', ar: 'موقف باحث عن المخاطر' },
    balanced: { en: 'balanced posture', ar: 'موقف متوازن' },
    defensive: { en: 'defensive posture', ar: 'موقف دفاعي' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
  positioning_fragility: {
    contained: { en: 'contained fragility', ar: 'هشاشة محتواة' },
    elevated: { en: 'elevated fragility', ar: 'هشاشة مرتفعة' },
    fragile: { en: 'fragile positioning', ar: 'تموضع هش' },
    indeterminate: { en: 'indeterminate', ar: 'غير محدد' },
  },
};
const DIMENSIONS = Object.keys(LABELS);

// Confidence is a qualitative BAND, never a fabricated number.
const CONFIDENCE_BANDS = {
  high: { en: 'high', ar: 'مرتفعة' },
  moderate: { en: 'moderate', ar: 'متوسطة' },
  low: { en: 'low', ar: 'منخفضة' },
  indeterminate: { en: 'indeterminate', ar: 'غير محددة' },
};

function label(dim, state, ar) {
  const m = LABELS[dim] && LABELS[dim][state];
  return m ? (ar ? m.ar : m.en) : (ar ? 'غير محدد' : 'indeterminate');
}
function num(v) { return typeof v === 'number' && !Number.isNaN(v) ? v : null; }

function classify(inputs) {
  const ms = inputs.structure || {};
  const md = ms.dimensions || {};
  const regime = inputs.regime || {};
  const tension = inputs.tension || {};
  const istab = tension.internal_stability || {};
  const cross = inputs.cross || {};
  const reaction = inputs.reaction || {};
  const sub = regime.sub_states || {};

  const sState = (d) => (md[d] && md[d].state) || null; // market-structure dim state
  const dims = {};

  // 1) Participation quality — directly from market-structure participation.
  (() => {
    const ev = []; let state = 'indeterminate';
    const p = sState('participation');
    if (p === 'broad_participation') state = 'broad';
    else if (p === 'narrowing_participation') state = 'narrowing';
    else if (p === 'narrow_leadership') state = 'narrow';
    else if (p === 'mixed_participation') state = 'mixed';
    if (p) ev.push(`structure participation=${p}`);
    if (istab.leadership) ev.push(`leadership=${istab.leadership}`);
    if (istab.leadership === 'narrow' && state === 'broad') { state = 'narrowing'; }
    dims.participation_quality = { state, evidence: ev };
  })();

  // 2) Confirmation quality — cross-asset coherence.
  (() => {
    const ev = []; let state = 'indeterminate';
    const ca = sState('cross_asset');
    if (ca === 'coherent') state = 'confirmed';
    else if (ca === 'mild_divergence') state = 'partial';
    else if (ca === 'divergent') state = 'divergent';
    if (ca) ev.push(`cross_asset=${ca}`);
    const coh = num(cross.coherence && cross.coherence.score);
    if (coh != null) ev.push(`coherence=${coh}`);
    dims.confirmation_quality = { state, evidence: ev };
  })();

  // 3) Liquidity support/drain — liquidity participation + regime liquidity.
  (() => {
    const ev = []; let state = 'indeterminate';
    const lp = sState('liquidity_participation');
    if (lp === 'participating') state = 'supportive';
    else if (lp === 'uncertain') state = 'neutral';
    else if (lp === 'exhaustion_risk') state = 'draining';
    const liq = regime.liquidity_state;
    if (liq === 'tightening' || regime.stability === 'deteriorating') { if (state !== 'draining') state = 'draining'; }
    if (lp) ev.push(`liquidity_participation=${lp}`);
    if (liq && liq !== 'indeterminate') ev.push(`regime liquidity=${liq}`);
    if (regime.stability) ev.push(`regime stability=${regime.stability}`);
    dims.liquidity_support = { state, evidence: ev };
  })();

  // 4) Posture — rotation / defensive leadership.
  (() => {
    const ev = []; let state = 'indeterminate';
    const rot = sState('rotation');
    if (rot === 'defensive_rotation') state = 'defensive';
    else if (rot === 'cyclical_leadership') state = 'risk_seeking';
    else if (rot === 'mixed_rotation') state = 'balanced';
    if (rot) ev.push(`rotation=${rot}`);
    if (sub.defensive) ev.push(`regime defensive=${sub.defensive}`);
    dims.posture = { state, evidence: ev };
  })();

  // 5) Positioning fragility — concentration + stability + tension.
  (() => {
    const ev = []; let state = 'indeterminate';
    const conc = sState('concentration');
    const stab = sState('stability');
    if (conc === 'contained' && (stab === 'stable' || !stab)) state = 'contained';
    if (conc === 'elevated' || stab === 'fragile') state = 'elevated';
    if (conc === 'concentrated' || stab === 'unstable' || stab === 'deteriorating') state = 'fragile';
    const t = tension.tension_level;
    if (t === 'elevated' && state === 'contained') state = 'elevated';
    if (conc) ev.push(`concentration=${conc}`);
    if (stab) ev.push(`structure stability=${stab}`);
    if (t) ev.push(`tension=${t}`);
    dims.positioning_fragility = { state, evidence: ev };
  })();

  // 6) Directional pressure — momentum + persistence + participation.
  (() => {
    const ev = []; let state = 'indeterminate';
    const mom = sState('momentum');
    const pers = sState('persistence');
    const pq = dims.participation_quality.state;
    if (mom === 'intact' && pq === 'broad') state = 'building';
    else if (mom === 'intact' || pers === 'persistent') state = 'steady';
    if (mom === 'early_deterioration' || pq === 'narrowing') state = 'fading';
    if (mom === 'deteriorating' || pq === 'narrow') state = 'fading';
    if (pers === 'single_session' && state === 'indeterminate') state = 'stalling';
    if (mom) ev.push(`momentum=${mom}`);
    if (pers) ev.push(`persistence=${pers}`);
    ev.push(`participation=${pq}`);
    dims.directional_pressure = { state, evidence: ev };
  })();

  // 7) Continuation vs exhaustion — persistence + participation + fragility.
  (() => {
    const ev = []; let state = 'indeterminate';
    const pers = sState('persistence');
    const pq = dims.participation_quality.state;
    const frag = dims.positioning_fragility.state;
    if ((pers === 'persistent' || pers === 'stabilizing') && pq === 'broad' && frag !== 'fragile') state = 'continuation';
    if (pq === 'narrowing' || frag === 'elevated') state = 'fragile_continuation';
    if (pq === 'narrow' || frag === 'fragile') state = 'exhaustion_risk';
    if (pers) ev.push(`persistence=${pers}`);
    ev.push(`participation=${pq}`, `fragility=${frag}`);
    dims.continuation = { state, evidence: ev };
  })();

  // 8) Tactical bias — composite of posture, liquidity, confirmation, fragility.
  (() => {
    const ev = []; let state = 'indeterminate';
    const posture = dims.posture.state;
    const liq = dims.liquidity_support.state;
    const conf = dims.confirmation_quality.state;
    const frag = dims.positioning_fragility.state;
    const score = (
      (posture === 'risk_seeking' ? 1 : posture === 'defensive' ? -1 : 0)
      + (liq === 'supportive' ? 1 : liq === 'draining' ? -1 : 0)
      + (conf === 'confirmed' ? 1 : conf === 'divergent' ? -1 : 0)
      + (frag === 'contained' ? 1 : frag === 'fragile' ? -1 : 0)
    );
    const known = [posture, liq, conf, frag].filter((x) => x !== 'indeterminate').length;
    if (known >= 2) {
      if (score >= 2) state = 'supportive';
      else if (score <= -2) state = 'defensive';
      else if (score < 0) state = 'cautious';
      else state = 'neutral';
    }
    ev.push(`posture=${posture}`, `liquidity=${liq}`, `confirmation=${conf}`, `fragility=${frag}`);
    dims.tactical_bias = { state, evidence: ev };
  })();

  // Confidence BAND from determinate-coverage + the structure engine's own
  // confidence — qualitative, never a fabricated percentage.
  const determinate = DIMENSIONS.filter((d) => dims[d].state !== 'indeterminate').length;
  const coverage = determinate / DIMENSIONS.length;
  const sc = num(ms.structural_confidence);
  let band = 'indeterminate';
  if (determinate >= 1) {
    const blended = sc != null ? (coverage * 100 + sc) / 2 : coverage * 100;
    band = blended >= 65 ? 'high' : blended >= 40 ? 'moderate' : 'low';
  }

  const available = determinate > 0;
  // Dominant tactical read: highest-priority non-benign dimension.
  const PRIORITY = [
    ['continuation', ['exhaustion_risk', 'fragile_continuation']],
    ['positioning_fragility', ['fragile', 'elevated']],
    ['liquidity_support', ['draining']],
    ['participation_quality', ['narrow', 'narrowing']],
    ['confirmation_quality', ['divergent', 'partial']],
    ['posture', ['defensive', 'risk_seeking']],
    ['tactical_bias', ['supportive', 'cautious', 'defensive']],
  ];
  let dominant = null;
  for (const [d, states] of PRIORITY) if (states.includes(dims[d].state)) { dominant = { dimension: d, state: dims[d].state }; break; }

  return { available, confidence_band: band, coverage_pct: Math.round(coverage * 100), dominant, dimensions: dims };
}

module.exports = { classify, LABELS, CONFIDENCE_BANDS, DIMENSIONS, label };
