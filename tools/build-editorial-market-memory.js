'use strict';

// Phase 83 - verified editorial market memory.
// Converts the current pulse/cognition/convergence stack into date-idempotent
// narrative lifecycles. Unverified runs preserve prior history but never
// extend persistence, failed expectations, ignored warnings, or catalysts.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'editorial-market-memory.json');
const MAX_TIMELINE = 90;
const MAX_ARCHIVE = 24;

const LIFECYCLE_STATES = [
  'emerging', 'strengthening', 'dominant', 'crowded',
  'weakening', 'fading', 'unresolved', 'invalidated',
];

const NARRATIVE_DEFINITIONS = {
  'narrow-leadership': {
    family: 'leadership',
    crowdable: true,
    active: (ctx) => ctx.dims.momentum_concentration === 'narrow-megacap' || ctx.dims.breadth_state === 'deteriorating',
    invalidated: (ctx) => ctx.dims.momentum_concentration === 'broadening' && ctx.dims.breadth_state === 'confirming',
    en: 'Headline strength remains dependent on narrow leadership while breadth confirmation is incomplete.',
    ar: 'لا تزال قوة المؤشرات معتمدة على قيادة ضيقة، فيما لم يكتمل تأكيد اتساع المشاركة.',
    expectation: { id: 'breadth-broadening', dimension: 'breadth_state', values: ['confirming'], en: 'Breadth confirmation', ar: 'تأكيد اتساع المشاركة' },
  },
  'volatility-compression': {
    family: 'volatility',
    active: (ctx) => ctx.dims.volatility_regime === 'compressed',
    invalidated: (ctx) => ['elevated', 'stressed'].includes(ctx.dims.volatility_regime),
    en: 'Volatility compression persists without resolving the underlying cross-asset tension.',
    ar: 'يستمر انضغاط التقلب من دون حسم التوتر القائم بين الأصول.',
    expectation: { id: 'volatility-expansion', dimension: 'volatility_regime', values: ['elevated', 'stressed'], en: 'Volatility-expansion confirmation', ar: 'تأكيد اتساع التقلب' },
  },
  'dollar-strength': {
    family: 'macro',
    active: (ctx) => ctx.dims.dollar_pressure === 'firming',
    invalidated: (ctx) => ctx.dims.dollar_pressure === 'easing',
    en: 'Dollar pressure continues to shape the cross-asset backdrop.',
    ar: 'يواصل ضغط الدولار تشكيل الخلفية العامة للعلاقات بين الأصول.',
  },
  'yield-pressure': {
    family: 'macro',
    active: (ctx) => ctx.dims.duration_pressure === 'building',
    invalidated: (ctx) => ctx.dims.duration_pressure === 'relaxing',
    en: 'Yield pressure remains a constraint on long-duration assets.',
    ar: 'يبقى ضغط العوائد قيداً قائماً على الأصول طويلة الأجل.',
  },
  'defensive-rotation': {
    family: 'risk',
    active: (ctx) => ctx.dims.defensive_rotation === 'active',
    invalidated: (ctx) => ctx.dims.defensive_rotation === 'dormant',
    en: 'Defensive participation remains present beneath the headline tape.',
    ar: 'تظل المشاركة الدفاعية حاضرة تحت السطح العام لحركة السوق.',
    expectation: { id: 'risk-off-confirmation', dimension: 'risk_state', values: ['risk_off'], en: 'Risk-off confirmation', ar: 'تأكيد العزوف عن المخاطر' },
  },
  'speculative-momentum': {
    family: 'positioning',
    crowdable: true,
    active: (ctx) => ctx.dims.speculative_appetite === 'expanding' || ctx.dims.ai_concentration_risk === 'elevated',
    invalidated: (ctx) => ctx.dims.speculative_appetite === 'dormant' && ctx.dims.ai_concentration_risk !== 'elevated',
    en: 'Speculative momentum remains concentrated rather than broadly distributed.',
    ar: 'يبقى الزخم المضاربي متركزاً بدلاً من أن يتحول إلى مشاركة واسعة.',
  },
  'liquidity-compression': {
    family: 'liquidity',
    tension: true,
    active: (ctx) => ['tightening', 'stressed'].includes(ctx.dims.liquidity_stress),
    invalidated: (ctx) => ctx.dims.liquidity_stress === 'supportive',
    en: 'Liquidity conditions remain restrictive at the margin.',
    ar: 'تظل أوضاع السيولة مقيدة عند الهامش.',
  },
  'market-fragility': {
    family: 'risk',
    tension: true,
    active: (ctx) => ['building', 'elevated'].includes(ctx.dims.market_fragility),
    invalidated: (ctx) => ctx.dims.market_fragility === 'contained',
    en: 'Market fragility remains unresolved across breadth, concentration, and volatility inputs.',
    ar: 'تبقى هشاشة السوق بلا حسم عبر مؤشرات الاتساع والتركيز والتقلب.',
  },
  'cross-asset-conflict': {
    family: 'cross-asset',
    tension: true,
    active: (ctx) => ctx.divergences.length > 0 || ctx.coherence === 'conflicted',
    invalidated: (ctx) => ctx.divergences.length === 0 && ['coherent', 'strong'].includes(ctx.coherence),
    en: 'Cross-asset relationships continue to resist a single coherent regime reading.',
    ar: 'لا تزال العلاقات بين الأصول تقاوم قراءة موحدة ومتسقة للنظام السوقي.',
  },
  'gold-resilience': {
    family: 'cross-asset',
    tension: true,
    active: (ctx) => ctx.divergences.some((item) => item.id === 'dollar-gold' || item.id === 'gold-vs-dollar'),
    invalidated: (ctx) => ctx.confirmations.some((item) => item.id === 'dollar-gold'),
    en: 'Gold continues to resist the pressure normally associated with dollar strength.',
    ar: 'يواصل الذهب مقاومة الضغط الذي يقترن عادة بقوة الدولار.',
  },
};

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

function sameRunDate(...items) {
  const dates = items.map((item) => item && item.run_date).filter(Boolean);
  return dates.length >= 3 && new Set(dates).size === 1;
}

function buildContext(input) {
  const { pulse = {}, cognition = {}, macro = {}, convergence = {} } = input;
  const verified = pulse.verified === true
    && cognition.verified === true
    && macro.verified === true
    && convergence.verified === true
    && sameRunDate(cognition, macro, convergence);
  return {
    verified,
    date: cognition.run_date || new Date().toISOString().slice(0, 10),
    dims: pulse.dimensions || {},
    divergences: convergence.diverges || [],
    confirmations: convergence.confirms || [],
    coherence: convergence.coherence && convergence.coherence.band,
    underpriced: convergence.underpriced || [],
    catalysts: convergence.preparing_for || pulse.catalysts_today || [],
  };
}

function lifecycleFor(definition, prior, active, invalidated, date) {
  if (active) {
    const sessions = prior
      ? prior.last_seen === date ? prior.sessions : prior.sessions + 1
      : 1;
    let state = sessions === 1 ? 'emerging' : sessions === 2 ? 'strengthening' : 'dominant';
    if (definition.tension && sessions >= 2) state = 'unresolved';
    if (definition.crowdable && sessions >= 4) state = 'crowded';
    return { state, sessions, inactive_sessions: 0, first_seen: prior ? prior.first_seen : date, last_seen: date };
  }
  if (!prior) return null;
  const inactive = prior.last_evaluated === date ? (prior.inactive_sessions || 0) : (prior.inactive_sessions || 0) + 1;
  const state = invalidated ? 'invalidated' : inactive === 1 ? 'weakening' : inactive === 2 ? 'fading' : 'invalidated';
  return { state, sessions: prior.sessions, inactive_sessions: inactive, first_seen: prior.first_seen, last_seen: prior.last_seen };
}

function evolveNarratives(context, previous = {}) {
  const priorById = Object.fromEntries([...(previous.narratives || []), ...(previous.archive || [])].map((item) => [item.id, item]));
  const narratives = [];
  const archive = [];

  for (const [id, definition] of Object.entries(NARRATIVE_DEFINITIONS)) {
    const prior = priorById[id] || null;
    const active = definition.active(context);
    const invalidated = !active && definition.invalidated(context);
    const lifecycle = lifecycleFor(definition, prior, active, invalidated, context.date);
    if (!lifecycle) continue;
    const item = {
      id,
      family: definition.family,
      state: lifecycle.state,
      sessions: lifecycle.sessions,
      inactive_sessions: lifecycle.inactive_sessions,
      first_seen: lifecycle.first_seen,
      last_seen: lifecycle.last_seen,
      last_evaluated: context.date,
      active,
      en: definition.en,
      ar: definition.ar,
      evidence: active ? evidenceFor(id, context) : [],
    };
    if (item.state === 'invalidated' && item.inactive_sessions >= 3) archive.push(item);
    else narratives.push(item);
  }
  return {
    narratives,
    archive: [...archive, ...(previous.archive || []).filter((old) => !archive.some((item) => item.id === old.id))]
      .slice(-MAX_ARCHIVE),
  };
}

function evidenceFor(id, context) {
  const map = {
    'narrow-leadership': ['momentum_concentration', 'breadth_state'],
    'volatility-compression': ['volatility_regime'],
    'dollar-strength': ['dollar_pressure'],
    'yield-pressure': ['duration_pressure'],
    'defensive-rotation': ['defensive_rotation', 'risk_state'],
    'speculative-momentum': ['speculative_appetite', 'ai_concentration_risk'],
    'liquidity-compression': ['liquidity_stress'],
    'market-fragility': ['market_fragility'],
  };
  if (id === 'cross-asset-conflict' || id === 'gold-resilience') {
    return context.divergences.map((item) => `convergence:${item.id}`).slice(0, 4);
  }
  return (map[id] || [])
    .filter((key) => context.dims[key] && context.dims[key] !== 'unverified')
    .map((key) => `pulse:${key}=${context.dims[key]}`);
}

function expectationKey(narrativeId, expectationId) {
  return `${narrativeId}:${expectationId}`;
}

function evolveExpectations(context, narratives, previous = {}) {
  const priorById = Object.fromEntries((previous.expectations || []).map((item) => [item.id, item]));
  const expectations = [];
  const failed = [];

  for (const narrative of narratives.filter((item) => item.active)) {
    const definition = NARRATIVE_DEFINITIONS[narrative.id];
    if (!definition.expectation) continue;
    const test = definition.expectation;
    const id = expectationKey(narrative.id, test.id);
    const prior = priorById[id];
    const actual = context.dims[test.dimension];
    const fulfilled = test.values.includes(actual);
    const age = prior ? Math.max(0, narrative.sessions - (prior.opened_at_session || 1)) : 0;
    const status = fulfilled ? 'fulfilled' : age >= 1 ? 'failed' : 'monitoring';
    const item = {
      id,
      narrative_id: narrative.id,
      status,
      opened_on: prior ? prior.opened_on : context.date,
      opened_at_session: prior ? prior.opened_at_session : narrative.sessions,
      evaluated_on: context.date,
      expected_dimension: test.dimension,
      expected_values: test.values,
      observed_value: actual || 'unverified',
      en: status === 'failed'
        ? `${test.en} did not materialize while the underlying narrative persisted.`
        : status === 'fulfilled'
          ? `${test.en} materialized in the verified state.`
          : `${test.en} remains an open confirmation test.`,
      ar: status === 'failed'
        ? `لم يتحقق ${test.ar} بينما استمرت الرواية الأساسية.`
        : status === 'fulfilled'
          ? `تحقق ${test.ar} في الحالة الموثقة.`
          : `يبقى ${test.ar} اختباراً مفتوحاً للتأكيد.`,
    };
    expectations.push(item);
    if (status === 'failed') failed.push(item);
  }
  return { expectations, failed };
}

function evolveUnderpriced(context, previous = {}) {
  const priorById = Object.fromEntries((previous.underpriced_memory || []).map((item) => [item.id, item]));
  return context.underpriced.map((item) => {
    const id = item.kind === 'pressure' ? `pressure:${item.track}` : `divergence:${item.id || item.flag || 'cross-asset'}`;
    const prior = priorById[id];
    const sessions = prior
      ? prior.last_seen === context.date ? prior.sessions : prior.sessions + 1
      : 1;
    const ignored = sessions >= 2 && context.dims.risk_state === 'risk_on';
    return {
      id,
      kind: item.kind,
      sessions,
      status: ignored ? 'ignored-by-price' : sessions >= 2 ? 'persistent' : 'emerging',
      first_seen: prior ? prior.first_seen : context.date,
      last_seen: context.date,
      en: ignored
        ? `${item.en} The verified risk state has not yet reflected the warning.`
        : `${item.en} The tension remains unresolved.`,
      ar: ignored
        ? `${item.ar} ولم تعكس حالة المخاطر الموثقة هذا التحذير حتى الآن.`
        : `${item.ar} ولا يزال هذا التوتر بلا حسم.`,
    };
  });
}

function deriveMarketCharacter(narratives) {
  const active = new Set(narratives.filter((item) => item.active && item.sessions >= 2).map((item) => item.id));
  if (active.has('narrow-leadership') && active.has('market-fragility')) {
    return { id: 'fragile-optimism', en: 'Fragile optimism', ar: 'تفاؤل هش' };
  }
  if (active.has('speculative-momentum') && active.has('narrow-leadership')) {
    return { id: 'crowded-momentum', en: 'Crowded momentum', ar: 'زخم مزدحم' };
  }
  if (active.has('defensive-rotation')) {
    return { id: 'defensive-resilience', en: 'Defensive resilience', ar: 'تماسك دفاعي' };
  }
  if (active.has('liquidity-compression')) {
    return { id: 'reluctant-risk-appetite', en: 'Reluctant risk appetite', ar: 'شهية مخاطر مترددة' };
  }
  if (active.has('cross-asset-conflict') || active.has('volatility-compression')) {
    return { id: 'unresolved-tension', en: 'Unresolved tension', ar: 'توتر غير محسوم' };
  }
  return { id: 'measured-continuity', en: 'Measured continuity', ar: 'استمرارية منضبطة' };
}

function buildTimelineEvents(context, narratives, failed, underpriced, previous = {}) {
  const events = [];
  const priorById = Object.fromEntries((previous.narratives || []).map((item) => [item.id, item]));
  for (const item of narratives) {
    const prior = priorById[item.id];
    let kind = null;
    if (!prior && item.active) kind = 'changed';
    else if (prior && prior.state !== item.state) {
      if (item.state === 'invalidated') kind = 'repriced';
      else if (['weakening', 'fading'].includes(item.state)) kind = 'changed';
      else if (['dominant', 'crowded', 'unresolved'].includes(item.state)) kind = 'intensified';
    } else if (item.active && prior && prior.last_seen !== context.date) kind = 'persisted';
    if (!kind) continue;
    events.push({
      id: `${context.date}:${kind}:${item.id}`,
      date: context.date,
      kind,
      narrative_id: item.id,
      en: item.en,
      ar: item.ar,
      // State-change events (repriced/changed/intensified) derive from an
      // invalidated/transitioning narrative whose own evidence list is empty;
      // record the structural transition itself as the evidence (deterministic,
      // not fabricated) so the timeline always carries an attributable basis.
      evidence: (item.evidence && item.evidence.length) ? item.evidence : [`state-transition:${kind}:${item.id}`],
    });
  }
  for (const item of failed) {
    events.push({ id: `${context.date}:failed:${item.id}`, date: context.date, kind: 'failed', narrative_id: item.narrative_id, en: item.en, ar: item.ar, evidence: [`expectation:${item.id}`] });
  }
  for (const item of underpriced.filter((entry) => entry.status === 'ignored-by-price')) {
    events.push({ id: `${context.date}:ignored:${item.id}`, date: context.date, kind: 'ignored', narrative_id: item.id, en: item.en, ar: item.ar, evidence: [`underpriced:${item.id}`] });
  }
  const priorEvents = (previous.timeline || []).filter((item) => !events.some((next) => next.id === item.id));
  // Defense-in-depth: never emit (or carry forward) a timeline entry without
  // evidence — the validator requires an attributable basis for every entry.
  return [...priorEvents, ...events]
    .filter((e) => (e.evidence || []).length)
    .sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-MAX_TIMELINE);
}

function catalystMemory(reactions = {}) {
  const events = (reactions.event_reactions || []).filter((item) => item && item.date && item.event_name);
  return events.slice(-20).map((item) => ({
    id: `${item.date}:${item.event_name}`,
    date: item.date,
    catalyst: item.event_name,
    classification: item.regime_changed === true ? 'regime-changing'
      : item.material_reaction === false ? 'failed-to-matter'
        : 'reaction-recorded',
    evidence: ['event-reaction-memory'],
  }));
}

function currentFocus(narratives, failed, underpriced) {
  const rank = { crowded: 0, unresolved: 1, dominant: 2, strengthening: 3, emerging: 4, weakening: 5, fading: 6, invalidated: 7 };
  const focus = narratives
    .filter((item) => item.active || ['weakening', 'fading'].includes(item.state))
    .sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || b.sessions - a.sessions)
    .slice(0, 4)
    .map((item) => ({ kind: 'narrative', id: item.id, state: item.state, sessions: item.sessions, en: item.en, ar: item.ar }));
  for (const item of failed.slice(0, 1)) focus.push({ kind: 'failed-expectation', id: item.id, state: 'failed', sessions: null, en: item.en, ar: item.ar });
  for (const item of underpriced.filter((entry) => entry.sessions >= 2).slice(0, 1)) {
    focus.push({ kind: 'underpriced-memory', id: item.id, state: item.status, sessions: item.sessions, en: item.en, ar: item.ar });
  }
  return focus.slice(0, 5);
}

function buildEditorialMemory(input, previous = {}) {
  const context = buildContext(input);
  const now = input.now || new Date();
  if (!context.verified) {
    return {
      version: '1.0',
      updated_at: now.toISOString(),
      run_date: context.date,
      verified: false,
      status: 'holding_unverified',
      continuity_available: false,
      memory_note_en: 'Editorial memory is held at the last verified state; this run does not extend historical claims.',
      memory_note_ar: 'تظل الذاكرة التحريرية مثبتة عند آخر حالة موثقة؛ ولا تمدد هذه الدورة أي ادعاء تاريخي.',
      narratives: previous.narratives || [],
      archive: previous.archive || [],
      expectations: previous.expectations || [],
      failed_expectations: [],
      unresolved_tensions: [],
      underpriced_memory: previous.underpriced_memory || [],
      market_character: null,
      current_focus: [],
      timeline: previous.timeline || [],
      catalyst_memory: previous.catalyst_memory || [],
    };
  }

  const evolved = evolveNarratives(context, previous);
  const expectationState = evolveExpectations(context, evolved.narratives, previous);
  const underpriced = evolveUnderpriced(context, previous);
  const timeline = buildTimelineEvents(context, evolved.narratives, expectationState.failed, underpriced, previous);
  const reactions = input.reactions || {};
  const catalysts = catalystMemory(reactions);
  const focus = currentFocus(evolved.narratives, expectationState.failed, underpriced);

  return {
    version: '1.0',
    updated_at: now.toISOString(),
    run_date: context.date,
    verified: true,
    status: 'verified',
    continuity_available: focus.length > 0,
    memory_note_en: focus.length ? 'Verified editorial memory advanced for this market date.' : 'Verified state recorded; no persistent narrative qualifies for emphasis.',
    memory_note_ar: focus.length ? 'تقدمت الذاكرة التحريرية الموثقة لهذه الجلسة السوقية.' : 'سُجلت الحالة الموثقة؛ ولا توجد رواية مستمرة تستحق الإبراز حالياً.',
    narratives: evolved.narratives,
    archive: evolved.archive,
    expectations: expectationState.expectations,
    failed_expectations: expectationState.failed,
    unresolved_tensions: evolved.narratives.filter((item) => item.state === 'unresolved'),
    underpriced_memory: underpriced,
    market_character: deriveMarketCharacter(evolved.narratives),
    current_focus: focus,
    timeline,
    catalyst_memory: catalysts.length ? catalysts : (previous.catalyst_memory || []),
  };
}

function main() {
  const previous = readJson('data/intelligence/editorial-market-memory.json', {});
  const output = buildEditorialMemory({
    pulse: readJson('data/intelligence/market-pulse.json', {}),
    cognition: readJson('data/intelligence/market-cognition.json', {}),
    macro: readJson('data/intelligence/macro-cognition.json', {}),
    convergence: readJson('data/intelligence/narrative-convergence.json', {}),
    reactions: readJson('data/intelligence/event-reaction-memory.json', {}),
  }, previous);
  console.log(`[editorial-memory] status=${output.status}; narratives=${output.narratives.length}; focus=${output.current_focus.length}; timeline=${output.timeline.length}`);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`[editorial-memory] wrote ${path.relative(ROOT, OUT_PATH)}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

if (require.main === module) main();

module.exports = {
  LIFECYCLE_STATES,
  NARRATIVE_DEFINITIONS,
  buildContext,
  evolveNarratives,
  evolveExpectations,
  buildEditorialMemory,
};
