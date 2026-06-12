'use strict';

// Phase 84 - verified structural tension aggregation.
// This layer assesses current internal strain and persistence. It does not
// forecast direction, assign transition probabilities, or produce trade calls.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'structural-tension.json');
const HISTORY_CAP = 40;

const REGIME_CONDITIONS = [
  'stable-regime',
  'pressured-regime',
  'unstable-regime',
  'transition-forming-regime',
  'internally-conflicted-regime',
  'unverified',
];
const TENSION_LEVELS = ['contained', 'building', 'elevated', 'acute', 'unverified'];
const TRACK_STATES = ['emerging', 'accumulating', 'persistent', 'intensifying', 'resolving'];

const TRACKS = {
  'participation-strain': {
    weight: 14,
    active: (ctx) => ctx.dims.breadth_state === 'deteriorating' || ctx.dims.momentum_concentration === 'narrow-megacap',
    severity: (ctx) => ctx.dims.breadth_state === 'deteriorating' && ctx.dims.momentum_concentration === 'narrow-megacap' ? 2 : 1,
    en: 'Participation remains narrower than the headline tape.',
    ar: 'تبقى المشاركة أضيق من الصورة التي تعكسها المؤشرات الرئيسية.',
  },
  'volatility-compression-strain': {
    weight: 12,
    active: (ctx) => ctx.dims.volatility_regime === 'compressed'
      && (ctx.pressure.volatility_pressure >= 2 || ctx.memorySessions('volatility-compression') >= 2),
    severity: (ctx) => ctx.pressure.volatility_pressure >= 3 || ctx.memorySessions('volatility-compression') >= 3 ? 2 : 1,
    en: 'Volatility compression persists while structural confirmation remains incomplete.',
    ar: 'يستمر انضغاط التقلب فيما لا يزال التأكيد الهيكلي غير مكتمل.',
  },
  'failed-confirmation-strain': {
    weight: 13,
    active: (ctx) => ctx.failedExpectations.length > 0,
    severity: (ctx) => ctx.failedExpectations.length >= 2 ? 2 : 1,
    en: 'Repeated confirmation tests have not materialized.',
    ar: 'لم تتحقق اختبارات التأكيد المتكررة حتى الآن.',
  },
  'positioning-strain': {
    weight: 11,
    active: (ctx) => ctx.memorySessions('speculative-momentum') >= 2
      || ctx.memoryState('narrow-leadership') === 'crowded'
      || ctx.pressure.concentration_pressure >= 3,
    severity: (ctx) => ctx.memoryState('narrow-leadership') === 'crowded' || ctx.pressure.concentration_pressure >= 4 ? 2 : 1,
    en: 'Positioning remains concentrated rather than broadly distributed.',
    ar: 'تظل التمركزات مركزة بدلاً من أن تستند إلى مشاركة واسعة.',
  },
  'cross-asset-strain': {
    weight: 15,
    active: (ctx) => ctx.divergences.length > 0 || ['tense', 'conflicted'].includes(ctx.coherence.band),
    severity: (ctx) => ctx.coherence.band === 'conflicted' || ctx.divergences.some((item) => item.chain_strength >= 2) ? 2 : 1,
    en: 'Cross-asset relationships remain strained and do not support one clean regime reading.',
    ar: 'تبقى العلاقات بين الأصول مشدودة ولا تدعم قراءة واحدة صافية للنظام السوقي.',
  },
  'contradiction-strain': {
    weight: 14,
    active: (ctx) => ctx.contradictions.length > 0,
    severity: (ctx) => ctx.contradictions.some((item) => item.escalated) || ctx.contradictions.length >= 2 ? 2 : 1,
    en: 'Internal market signals continue to contradict the headline move.',
    ar: 'تواصل الإشارات الداخلية للسوق مناقضة الحركة الظاهرة في المؤشرات.',
  },
  'liquidity-strain': {
    weight: 12,
    active: (ctx) => ['tightening', 'stressed'].includes(ctx.dims.liquidity_stress) || ctx.pressure.liquidity_pressure >= 3,
    severity: (ctx) => ctx.dims.liquidity_stress === 'stressed' || ctx.pressure.liquidity_pressure >= 4 ? 2 : 1,
    en: 'Liquidity participation is thinning at the margin.',
    ar: 'تتراجع مساهمة السيولة عند الهامش.',
  },
  'defensive-nonconfirmation': {
    weight: 9,
    active: (ctx) => ctx.dims.defensive_rotation === 'active' && ctx.dims.risk_state !== 'risk_off',
    severity: () => 1,
    en: 'Defensive demand is active without broader risk-off confirmation.',
    ar: 'ينشط الطلب الدفاعي من دون تأكيد أوسع لحالة العزوف عن المخاطر.',
  },
};

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

function sameRunDate(items) {
  const dates = items.map((item) => item && item.run_date).filter(Boolean);
  return dates.length === items.length && new Set(dates).size === 1;
}

function buildContext(input) {
  const pulse = input.pulse || {};
  const cognition = input.cognition || {};
  const macro = input.macro || {};
  const convergence = input.convergence || {};
  const memory = input.memory || {};
  const verified = pulse.verified === true
    && cognition.verified === true
    && macro.verified === true
    && convergence.verified === true
    && memory.verified === true
    && sameRunDate([cognition, macro, convergence, memory]);
  const narratives = memory.narratives || [];
  const tracks = (macro.pressure && macro.pressure.tracks) || {};
  return {
    verified,
    date: cognition.run_date || new Date().toISOString().slice(0, 10),
    now: input.now || new Date(),
    dims: pulse.dimensions || {},
    coherence: convergence.coherence || { score: null, band: 'unverified' },
    divergences: convergence.diverges || [],
    contradictions: (macro.contradictions || []).filter((item) => item.active_today),
    failedExpectations: memory.failed_expectations || [],
    narratives,
    catalysts: convergence.preparing_for || [],
    pressure: Object.fromEntries(Object.entries(tracks).map(([key, value]) => [key, Number(value.score) || 0])),
    memorySessions: (id) => {
      const item = narratives.find((entry) => entry.id === id);
      return item && item.active ? item.sessions : 0;
    },
    memoryState: (id) => {
      const item = narratives.find((entry) => entry.id === id);
      return item ? item.state : null;
    },
  };
}

function evolveTracks(context, previous = {}) {
  const prior = previous.tracks || {};
  const tracks = {};
  for (const [id, definition] of Object.entries(TRACKS)) {
    const old = prior[id] || null;
    const active = definition.active(context);
    if (active) {
      const continuing = Boolean(old && old.active);
      const sameDay = continuing && old.last_evaluated === context.date;
      const sessions = continuing ? old.sessions + (sameDay ? 0 : 1) : 1;
      const severity = definition.severity(context);
      const priorSeverity = old && old.active ? old.severity : 0;
      const state = sessions === 1 ? 'emerging'
        : severity > priorSeverity ? 'intensifying'
          : sessions >= 3 ? 'persistent' : 'accumulating';
      tracks[id] = {
        id, active: true, state, sessions, severity,
        first_seen: continuing ? old.first_seen : context.date,
        last_seen: context.date,
        last_evaluated: context.date,
        en: definition.en,
        ar: definition.ar,
      };
    } else if (old && old.active) {
      tracks[id] = {
        ...old,
        active: false,
        state: 'resolving',
        severity: 0,
        last_evaluated: context.date,
      };
    }
  }
  return tracks;
}

function scoreTension(context, tracks) {
  const active = Object.values(tracks).filter((item) => item.active);
  let score = 0;
  for (const item of active) {
    const definition = TRACKS[item.id];
    const persistence = item.sessions >= 3 ? 1 : item.sessions === 2 ? 0.75 : 0.5;
    const severity = item.severity >= 2 ? 1 : 0.7;
    score += definition.weight * persistence * severity;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function classifyCondition(context, tracks, score) {
  const active = Object.values(tracks).filter((item) => item.active);
  const persistent = active.filter((item) => item.sessions >= 2);
  const crossAsset = tracks['cross-asset-strain'];
  const contradiction = tracks['contradiction-strain'];
  if (context.coherence.band === 'conflicted' && crossAsset && crossAsset.active
    && contradiction && contradiction.active) return 'internally-conflicted-regime';
  if (score >= 68 && persistent.length >= 3) return 'transition-forming-regime';
  if (score >= 50 || persistent.length >= 3) return 'unstable-regime';
  if (score >= 25 || active.length >= 2) return 'pressured-regime';
  return 'stable-regime';
}

function tensionLevel(score) {
  if (score >= 70) return 'acute';
  if (score >= 50) return 'elevated';
  if (score >= 25) return 'building';
  return 'contained';
}

function internalStability(context) {
  const broad = context.dims.breadth_state === 'confirming' && context.dims.momentum_concentration !== 'narrow-megacap';
  const volMismatch = context.dims.volatility_regime === 'compressed'
    && (context.contradictions.length > 0 || context.dims.breadth_state === 'deteriorating');
  return {
    leadership: broad ? 'broad' : context.dims.breadth_state === 'deteriorating' ? 'fragile' : 'narrow',
    cross_asset: context.coherence.band === 'coherent' ? 'coherent' : context.coherence.band === 'unverified' ? 'unverified' : 'strained',
    volatility_alignment: volMismatch ? 'mismatched' : 'aligned',
    risk_appetite: context.dims.risk_state === 'risk_on' && !broad ? 'narrow' : context.dims.risk_state || 'unverified',
    liquidity_participation: ['tightening', 'stressed'].includes(context.dims.liquidity_stress) ? 'thinning' : context.dims.liquidity_stress === 'supportive' ? 'supportive' : 'uncertain',
  };
}

function narrativeStability(context) {
  const active = context.narratives.filter((item) => item.active);
  const strained = active.filter((item) => ['unresolved', 'crowded'].includes(item.state));
  const losing = context.narratives.filter((item) => ['weakening', 'fading'].includes(item.state));
  if (context.failedExpectations.length >= 2 || (strained.length && losing.length)) return 'internally-inconsistent';
  if (context.failedExpectations.length || strained.length >= 2) return 'strained';
  if (losing.length) return 'losing-confirmation';
  return 'stable';
}

function catalystFragility(context, score) {
  const now = context.now.getTime();
  const upcoming = context.catalysts
    .map((item) => ({ ...item, hours: (Date.parse(item.time) - now) / 3600000 }))
    .filter((item) => Number.isFinite(item.hours) && item.hours >= 0 && item.hours <= 72)
    .sort((a, b) => a.hours - b.hours);
  if (!upcoming.length) return { level: 'none', next: null, en: 'No major catalyst sits inside the 72-hour structural window.', ar: 'لا يوجد محفز رئيسي ضمن نافذة الحساسية الهيكلية البالغة 72 ساعة.' };
  const level = score >= 50 ? 'elevated' : score >= 25 ? 'moderate' : 'contained';
  return {
    level,
    next: { name: upcoming[0].name, time: upcoming[0].time, hours: Math.round(upcoming[0].hours * 10) / 10 },
    en: level === 'elevated'
      ? `${upcoming[0].name} approaches while internal coherence is already strained.`
      : `${upcoming[0].name} is the next scheduled test of the current structure.`,
    ar: level === 'elevated'
      ? `يقترب ${upcoming[0].name} فيما الاتساق الداخلي للسوق واقع تحت ضغط قائم.`
      : `يمثل ${upcoming[0].name} الاختبار المجدول التالي للبنية الحالية.`,
  };
}

function summary(condition, score, tracks) {
  const strongest = Object.values(tracks)
    .filter((item) => item.active)
    .sort((a, b) => b.severity - a.severity || b.sessions - a.sessions)[0];
  const labels = {
    'stable-regime': {
      en: 'The verified regime remains internally stable; structural pressure is contained.',
      ar: 'يبقى النظام الموثق مستقراً من الداخل، فيما تظل الضغوط الهيكلية محتواة.',
    },
    'pressured-regime': {
      en: 'Structural pressure is building, but the regime has not entered an unstable condition.',
      ar: 'تتراكم ضغوط هيكلية، إلا أن النظام لم يدخل حالة عدم استقرار.',
    },
    'unstable-regime': {
      en: 'The regime remains intact but internally fragile as several pressure tracks persist.',
      ar: 'يبقى النظام قائماً، لكنه هش داخلياً مع استمرار عدة مسارات ضغط.',
    },
    'transition-forming-regime': {
      en: 'Multiple persistent strains are forming a regime-transition condition without establishing direction.',
      ar: 'تتجمع ضغوط مستمرة لتشكيل حالة انتقال في النظام من دون أن تحدد اتجاهاً.',
    },
    'internally-conflicted-regime': {
      en: 'The regime is internally conflicted; cross-asset relationships and market internals are not confirming one another.',
      ar: 'النظام متضارب داخلياً؛ فالعلاقات بين الأصول ومؤشرات السوق الداخلية لا يؤكد بعضها بعضاً.',
    },
  };
  return {
    score,
    en: strongest ? `${labels[condition].en} ${strongest.en}` : labels[condition].en,
    ar: strongest ? `${labels[condition].ar} ${strongest.ar}` : labels[condition].ar,
  };
}

function updatePressureMemory(previous, context, condition, score) {
  const history = (previous.pressure_memory || []).filter((item) => item.date !== context.date);
  const prior = history[history.length - 1] || null;
  const change = !prior ? 'initialized'
    : score > prior.score ? 'intensified'
      : score < prior.score ? 'faded' : 'stable';
  history.push({ date: context.date, condition, score, change });
  return history.slice(-HISTORY_CAP);
}

function buildStructuralTension(input, previous = {}) {
  const context = buildContext(input);
  const now = input.now || new Date();
  if (!context.verified) {
    return {
      version: '1.0',
      updated_at: now.toISOString(),
      run_date: context.date,
      verified: false,
      status: 'holding_unverified',
      regime_condition: 'unverified',
      tension_level: 'unverified',
      tension_score: null,
      tracks: previous.tracks || {},
      active_strains: [],
      internal_stability: null,
      narrative_stability: 'unverified',
      catalyst_fragility: { level: 'unverified', next: null },
      strain_map: [],
      pressure_memory: previous.pressure_memory || [],
      summary_en: 'Structural tension assessment is held until the intelligence stack is fully verified.',
      summary_ar: 'يظل تقييم التوتر الهيكلي معلقاً إلى حين اكتمال توثيق منظومة الاستخبارات.',
    };
  }
  const tracks = evolveTracks(context, previous);
  const score = scoreTension(context, tracks);
  const condition = classifyCondition(context, tracks, score);
  const active = Object.values(tracks).filter((item) => item.active);
  const catalyst = catalystFragility(context, score);
  const text = summary(condition, score, tracks);
  return {
    version: '1.0',
    updated_at: now.toISOString(),
    run_date: context.date,
    verified: true,
    status: 'verified',
    regime_condition: condition,
    tension_level: tensionLevel(score),
    tension_score: score,
    tracks,
    active_strains: active.map((item) => item.id),
    internal_stability: internalStability(context),
    narrative_stability: narrativeStability(context),
    catalyst_fragility: catalyst,
    strain_map: active
      .sort((a, b) => b.severity - a.severity || b.sessions - a.sessions)
      .slice(0, 6)
      .map((item) => ({ id: item.id, state: item.state, sessions: item.sessions, severity: item.severity, en: item.en, ar: item.ar })),
    pressure_memory: updatePressureMemory(previous, context, condition, score),
    summary_en: text.en,
    summary_ar: text.ar,
  };
}

function main() {
  const previous = readJson('data/intelligence/structural-tension.json', {});
  const output = buildStructuralTension({
    pulse: readJson('data/intelligence/market-pulse.json', {}),
    cognition: readJson('data/intelligence/market-cognition.json', {}),
    macro: readJson('data/intelligence/macro-cognition.json', {}),
    convergence: readJson('data/intelligence/narrative-convergence.json', {}),
    memory: readJson('data/intelligence/editorial-market-memory.json', {}),
  }, previous);
  console.log(`[structural-tension] status=${output.status}; condition=${output.regime_condition}; score=${output.tension_score}; strains=${output.active_strains.length}`);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`[structural-tension] wrote ${path.relative(ROOT, OUT_PATH)}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

if (require.main === module) main();

module.exports = {
  REGIME_CONDITIONS,
  TENSION_LEVELS,
  TRACK_STATES,
  TRACKS,
  buildContext,
  evolveTracks,
  scoreTension,
  classifyCondition,
  buildStructuralTension,
};
