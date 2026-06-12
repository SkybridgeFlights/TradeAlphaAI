'use strict';

// Phase 72/73/74 — Newsroom & terminal module renderer.
// Injects the live terminal section into index.html and ar/index.html between
// <!-- generated:newsroom-modules:start/end --> markers (idempotent).
//
// Phase 73 additions: hero intelligence ribbon, live asset intelligence strip
// (contextual labels, not bare numbers), terminal macro monitor, top-movers
// classification, session editions (Morning Brief / Midday Pulse / Closing
// Flow / Weekend Macro Outlook) with emphasis-based module ordering, and
// institutional desk identities (Macro Desk View, Risk Desk, Flow Monitor,
// Fed Watch). Newsroom framing only — no fabricated analysts or institutions.
//
// Phase 74 additions: cognition layer — Desk Alerts (verified state
// transitions only), Market Memory (cross-session observations), Market State
// Evolution timeline, regime phase markers on the macro monitor, and a
// continuity indicator. All cognition content derives from
// data/intelligence/market-cognition.json built by build-market-cognition.js.
//
// Phase 75 additions: macro cognition layer — Desk Conviction (confidence
// analysis + structural contradictions + pressure accumulation), Scenario
// Monitor (conditional institutional scenarios, never predictions), hero
// conviction slot, adaptive desk-focus module ordering, and a desk focus
// indicator. Derives from data/intelligence/macro-cognition.json built by
// build-macro-cognition.js.
//
// Honesty rules: only verified, fresh pulse output carries urgency styling;
// stale pulse (>48h) degrades to monitoring mode; assets without sourced data
// render as awaiting-data; timestamps are real artifact times.
//
// Run: node tools/render-newsroom-modules.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKER_KEY = 'generated:newsroom-modules';
const PULSE_MAX_AGE_HOURS = 48;
const MEMORY_STATES = ['emerging', 'strengthening', 'dominant', 'crowded', 'weakening', 'fading', 'unresolved', 'invalidated'];
const REGIME_PRESSURE_LABELS = {
  en: {
    'stable-regime': 'stable',
    'pressured-regime': 'pressured',
    'unstable-regime': 'unstable',
    'transition-forming-regime': 'transition forming',
    'internally-conflicted-regime': 'internally conflicted',
  },
  ar: {
    'stable-regime': 'مستقر',
    'pressured-regime': 'تحت ضغط',
    'unstable-regime': 'غير مستقر',
    'transition-forming-regime': 'تتشكل فيه ضغوط انتقال',
    'internally-conflicted-regime': 'متضارب داخلياً',
  },
};

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Market session engine (UTC, clock-derived — never a data claim) ─────────

function marketSession(now = new Date()) {
  const day = now.getUTCDay();
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60;
  if (day === 6 || (day === 0 && hour < 22)) return 'weekend';
  if (day === 5 && hour >= 21) return 'weekend';
  if (hour >= 13.5 && hour < 20) return 'us-cash';
  if (hour >= 9 && hour < 13.5) return 'us-premarket';
  if (hour >= 7 && hour < 9) return 'europe';
  if (hour >= 20 && hour < 22) return 'after-hours';
  return 'asia';
}

const SESSION_LABELS = {
  en: {
    'weekend': 'Weekend desk', 'us-cash': 'US cash session', 'us-premarket': 'US premarket',
    'europe': 'European session', 'after-hours': 'US after-hours', 'asia': 'Asia session',
  },
  ar: {
    'weekend': 'مكتب نهاية الأسبوع', 'us-cash': 'الجلسة الأمريكية الرئيسية', 'us-premarket': 'ما قبل الافتتاح الأمريكي',
    'europe': 'الجلسة الأوروبية', 'after-hours': 'ما بعد الإغلاق الأمريكي', 'asia': 'الجلسة الآسيوية',
  },
};

// Newsroom editions — session-aware rhythm.
const EDITIONS = {
  en: {
    'us-premarket': 'Morning Brief', 'europe': 'Morning Brief',
    'us-cash': 'Midday Pulse', 'after-hours': 'Closing Flow',
    'asia': 'Overnight Monitor', 'weekend': 'Weekend Macro Outlook',
  },
  ar: {
    'us-premarket': 'الموجز الصباحي', 'europe': 'الموجز الصباحي',
    'us-cash': 'نبض منتصف الجلسة', 'after-hours': 'تدفقات الإغلاق',
    'asia': 'مراقبة الجلسات الآسيوية', 'weekend': 'نظرة الماكرو الأسبوعية',
  },
};

const DIM_LABELS = {
  en: {
    risk_state: 'Risk', liquidity_stress: 'Liquidity', volatility_regime: 'Volatility',
    breadth_state: 'Breadth', momentum_concentration: 'Momentum', ai_concentration_risk: 'AI Concentration',
    speculative_appetite: 'Speculative Appetite', defensive_rotation: 'Defensive Rotation',
    dollar_pressure: 'Dollar', duration_pressure: 'Duration', market_fragility: 'Fragility',
  },
  ar: {
    risk_state: 'المخاطر', liquidity_stress: 'السيولة', volatility_regime: 'التقلب',
    breadth_state: 'الاتساع', momentum_concentration: 'تركز الزخم', ai_concentration_risk: 'تركز الذكاء الاصطناعي',
    speculative_appetite: 'شهية المضاربة', defensive_rotation: 'التناوب الدفاعي',
    dollar_pressure: 'الدولار', duration_pressure: 'حساسية الفائدة', market_fragility: 'الهشاشة',
  },
};

const STATE_AR = {
  'risk_on': 'إقبال على المخاطر', 'risk_off': 'تجنب المخاطر', 'neutral': 'محايد',
  'compressed': 'منضغط', 'normal': 'طبيعي', 'elevated': 'مرتفع', 'stressed': 'مضغوط بشدة',
  'firming': 'يتقوى', 'easing': 'يتراجع', 'stable': 'مستقر',
  'building': 'يتصاعد', 'relaxing': 'ينحسر', 'contained': 'محتوى',
  'narrow-megacap': 'ضيق حول الكبرى', 'broadening': 'يتسع', 'balanced': 'متوازن',
  'deteriorating': 'يتدهور', 'confirming': 'مؤكِّد', 'mixed': 'متباين',
  'active': 'نشط', 'dormant': 'خامل', 'supportive': 'داعمة', 'tightening': 'متشددة',
  'rising': 'صاعد', 'falling': 'هابط', 'sideways': 'عرضي', 'expanding': 'يتوسع',
  'accumulating': 'يتراكم', 'steady': 'ثابت', 'releasing': 'ينفرج',
  'unverified': '—',
};

function stateLabel(value, ar) {
  if (!value || value === 'unverified') return '—';
  return ar ? (STATE_AR[value] || value) : value.replace(/_/g, '-');
}

// Calendar asset sensitivity names arrive in English; localize the common
// names for Arabic readers (tickers stay Latin — Arabic financial-media
// convention).
const ASSET_NAME_AR = {
  'Treasury yields': 'عوائد الخزانة',
  'Oil': 'النفط',
  'Gold': 'الذهب',
  'Defensive sectors': 'القطاعات الدفاعية',
  'Equities': 'الأسهم',
  'Dollar': 'الدولار',
  'Crypto': 'العملات الرقمية',
};

const CATALYST_NAME_AR = {
  'Retail Sales': 'مبيعات التجزئة',
  'FOMC Rate Decision': 'قرار الفائدة للاحتياطي الفيدرالي',
  'Initial Jobless Claims': 'طلبات إعانة البطالة الأولية',
  'PCE': 'مؤشر نفقات الاستهلاك الشخصي',
  'CPI': 'مؤشر أسعار المستهلك',
  'Core CPI': 'مؤشر أسعار المستهلك الأساسي',
  'Nonfarm Payrolls': 'الوظائف غير الزراعية',
  'Unemployment Rate': 'معدل البطالة',
  'GDP': 'الناتج المحلي الإجمالي',
};

function assetName(name, ar) {
  if (!ar) return String(name || '');
  return ASSET_NAME_AR[String(name || '').trim()] || String(name || '');
}

function catalystName(name, ar) {
  if (!ar) return String(name || '');
  return CATALYST_NAME_AR[String(name || '').trim()] || String(name || '');
}

function localizeCatalystsInText(value, ar) {
  let text = String(value || '');
  if (!ar) return text;
  for (const [en, localized] of Object.entries(CATALYST_NAME_AR)) {
    text = text.replaceAll(`بـ${en}`, `ب${localized}`);
    text = text.replaceAll(en, localized);
  }
  return text;
}

const SEVERITY_LABELS = {
  en: { high: 'HIGH', elevated: 'ELEVATED', watch: 'WATCH' },
  ar: { high: 'مرتفع', elevated: 'متصاعد', watch: 'مراقبة' },
};

const SCENARIO_STATUS_LABELS = {
  en: { primary: 'BASE', active: 'ACTIVE', watch: 'WATCH', monitor: 'MONITOR', dormant: 'DORMANT' },
  ar: { primary: 'أساسي', active: 'نشط', watch: 'مراقبة', monitor: 'متابعة', dormant: 'خامل' },
};
const SCENARIO_STATUS_TIER = { primary: 'medium', active: 'high', watch: 'low', monitor: 'low', dormant: 'low' };

const CONVICTION_LABELS = {
  en: {
    'healthy-trend-structure': 'healthy trend structure', 'increasingly-confirmed': 'increasingly confirmed',
    'strengthening-conviction': 'strengthening', 'fragile-conviction': 'fragile',
    'unconfirmed-move': 'unconfirmed move', 'deteriorating-confirmation': 'deteriorating confirmation',
    'unstable-continuation': 'unstable continuation', 'crowded-positioning': 'crowded positioning',
    'unverified': '—',
  },
  ar: {
    'healthy-trend-structure': 'بنية اتجاه صحية', 'increasingly-confirmed': 'تأكيد متزايد',
    'strengthening-conviction': 'قناعة تتعزز', 'fragile-conviction': 'قناعة هشة',
    'unconfirmed-move': 'تحرك غير مؤكد', 'deteriorating-confirmation': 'تأكيد يتدهور',
    'unstable-continuation': 'استمرارية غير مستقرة', 'crowded-positioning': 'تمركزات مزدحمة',
    'unverified': '—',
  },
};

const FOCUS_LABELS = {
  en: { monitoring: 'monitoring', contradictions: 'contradiction watch', risk: 'risk desk', concentration: 'concentration watch', pressure: 'pressure watch', macro: 'macro desk', balanced: 'balanced' },
  ar: { monitoring: 'مراقبة', contradictions: 'رصد التناقضات', risk: 'مكتب المخاطر', concentration: 'رصد التركز', pressure: 'رصد الضغوط', macro: 'مكتب الماكرو', balanced: 'متوازن' },
};

// Move the named modules to the front of the order, preserving relative order
// of everything else (adaptive desk-focus elevation).
function promote(order, ids) {
  const lead = ids.filter((id) => order.includes(id));
  return [...lead, ...order.filter((id) => !lead.includes(id))];
}

const SEVERITY_TIER = { high: 'high', elevated: 'medium', watch: 'low' };

// Regime phase marker shown next to macro monitor chips.
function phaseMarker(shift, ar) {
  if (!shift || !shift.phase) return '';
  if (shift.phase === 'emerging') {
    return `<em class="nr-phase" data-phase="emerging">${ar ? 'تحول' : 'shift'}</em>`;
  }
  if (['strengthening', 'established', 'extended'].includes(shift.phase) && shift.sessions_in_state >= 2) {
    return `<em class="nr-phase" data-phase="${shift.phase}">×${shift.sessions_in_state}</em>`;
  }
  return '';
}

function urgencyTier(urgency) {
  if (urgency >= 80) return 'high';
  if (urgency >= 55) return 'medium';
  return 'low';
}

const CLUSTER_BADGES = {
  en: { fed: 'Fed Watch', inflation: 'Inflation Watch', labor: 'Labor Watch', volatility: 'Volatility', 'ai-momentum': 'AI Momentum', rates: 'Rates', growth: 'Growth', macro: 'Macro Desk', tape: 'Tape' },
  ar: { fed: 'مراقبة الفيدرالي', inflation: 'مراقبة التضخم', labor: 'سوق العمل', volatility: 'التقلب', 'ai-momentum': 'زخم الذكاء الاصطناعي', rates: 'الفائدة', growth: 'النمو', macro: 'مكتب الماكرو', tape: 'حركة السوق' },
};

// ── Asset intelligence strip ─────────────────────────────────────────────────

const STRIP_ASSETS = [
  { key: 'gold', symbol: 'GOLD' },
  { key: 'dxy', symbol: 'DXY' },
  { key: 'us10y_yield', symbol: 'US10Y', isYield: true },
  { key: 'sp500', symbol: 'SPY' },
  { key: 'nasdaq', symbol: 'QQQ' },
  { key: 'bitcoin', symbol: 'BTC' },
  { key: 'vix', symbol: 'VIX' },
  { key: 'nvda', symbol: 'NVDA' },
  // OIL is populated by the live quote feed (/api/live-quotes — sourced CL=F
  // quote); the CI snapshot has no oil node, so it server-renders as
  // awaiting-data and only ever shows sourced values.
  { key: 'oil', symbol: 'OIL' },
];

// Contextual intelligence per asset, derived only from sourced direction +
// verified pulse dimensions. No data -> awaiting-data label.
function assetContext(symbol, changePct, dims, ar) {
  const t = (en, arText) => (ar ? arText : en);
  if (!Number.isFinite(changePct)) return { label: t('awaiting sourced data', 'بانتظار بيانات موثقة'), state: 'flat' };
  const up = changePct > 0.05;
  const down = changePct < -0.05;
  switch (symbol) {
    case 'GOLD':
      if (up) return { label: t('Gold bid returning', 'عودة الطلب على الذهب'), state: 'up' };
      if (down) return { label: t('Gold momentum fading', 'تراجع زخم الذهب'), state: 'down' };
      return { label: t('Gold holding range', 'الذهب في نطاق مستقر'), state: 'flat' };
    case 'DXY':
      if (up) return { label: t('Dollar pressure building', 'ضغط الدولار يتصاعد'), state: 'up' };
      if (down) return { label: t('Dollar pressure easing', 'ضغط الدولار يتراجع'), state: 'down' };
      return { label: t('Dollar steady', 'الدولار مستقر'), state: 'flat' };
    case 'US10Y':
      if (up) return { label: t('Yield pressure building', 'ضغط العوائد يتصاعد'), state: 'up' };
      if (down) return { label: t('Yield pressure stabilizing', 'ضغط العوائد يستقر'), state: 'down' };
      return { label: t('Yields anchored', 'العوائد مستقرة'), state: 'flat' };
    case 'SPY':
      if (up && dims.breadth_state === 'deteriorating') return { label: t('Index up, breadth thin', 'المؤشر صاعد والاتساع ضعيف'), state: 'up' };
      if (up) return { label: t('Broad bid intact', 'الطلب العام قائم'), state: 'up' };
      if (down) return { label: t('Risk reduction visible', 'تقليص المخاطر ظاهر'), state: 'down' };
      return { label: t('Tape balanced', 'حركة متوازنة'), state: 'flat' };
    case 'QQQ':
      if (up && dims.ai_concentration_risk === 'elevated') return { label: t('AI leadership extended', 'قيادة الذكاء الاصطناعي ممتدة'), state: 'up' };
      if (up) return { label: t('Duration risk rewarded', 'مكافأة المخاطرة في النمو'), state: 'up' };
      if (down) return { label: t('Valuation tolerance tightening', 'تشدد في تقبل التقييمات'), state: 'down' };
      return { label: t('Growth complex steady', 'قطاع النمو مستقر'), state: 'flat' };
    case 'BTC':
      if (up) return { label: t('Liquidity beta firm', 'بيتا السيولة قوية'), state: 'up' };
      if (down) return { label: t('Liquidity beta soft', 'بيتا السيولة ضعيفة'), state: 'down' };
      return { label: t('Crypto liquidity neutral', 'سيولة الكريبتو محايدة'), state: 'flat' };
    case 'VIX':
      if (down) return { label: t('Volatility compression', 'انضغاط التقلب'), state: 'down' };
      if (up) return { label: t('Hedging demand rising', 'طلب التحوط يرتفع'), state: 'up' };
      return { label: t('Vol regime steady', 'نظام التقلب مستقر'), state: 'flat' };
    case 'NVDA':
      if (up) return { label: t('AI momentum extended', 'زخم الذكاء الاصطناعي ممتد'), state: 'up' };
      if (down) return { label: t('AI momentum cooling', 'زخم الذكاء الاصطناعي يهدأ'), state: 'down' };
      return { label: t('AI complex consolidating', 'قطاع الذكاء الاصطناعي يتماسك'), state: 'flat' };
    case 'OIL':
      if (up) return { label: t('Energy bid firming', 'الطلب على الطاقة يتقوى'), state: 'up' };
      if (down) return { label: t('Energy complex soft', 'قطاع الطاقة ضعيف'), state: 'down' };
      return { label: t('Crude rangebound', 'الخام في نطاق محدود'), state: 'flat' };
    default:
      return { label: '—', state: 'flat' };
  }
}

function fmtChange(changePct) {
  if (!Number.isFinite(changePct)) return '—';
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

// ── Top movers classification (interpretive framing of sourced moves only) ──

function classifyMove(symbol, changePct, dims, ar) {
  const t = (en, arText) => (ar ? arText : en);
  const abs = Math.abs(changePct);
  if (symbol === 'NVDA' && abs >= 1.5) {
    return changePct > 0 ? t('AI speculation flow', 'تدفق مضاربي نحو الذكاء الاصطناعي') : t('AI positioning unwind', 'تفكيك تمركزات الذكاء الاصطناعي');
  }
  if (symbol === 'VIX') {
    return changePct < 0 ? t('volatility unwind', 'تفكيك التحوطات') : t('hedging demand', 'طلب على التحوط');
  }
  if (symbol === 'BTC') return t('liquidity chase', 'مطاردة السيولة');
  if (symbol === 'US10Y' || symbol === 'TLT') return t('rate-sensitive move', 'تحرك حساس للفائدة');
  if (symbol === 'GOLD') return changePct > 0 ? t('defensive flow', 'تدفق دفاعي') : t('momentum fade', 'خفوت الزخم');
  if (symbol === 'QQQ' && dims.duration_pressure === 'building') return t('rate-sensitive rotation', 'تناوب حساس للفائدة');
  return t('macro-sensitive rotation', 'تناوب حساس للماكرو');
}

// ── Section renderer ─────────────────────────────────────────────────────────

function liveNode(live, key) {
  const node = live && live[key];
  if (!node || typeof node !== 'object') return { value: null, change: null };
  return {
    value: Number.isFinite(node.value) ? node.value : null,
    change: Number.isFinite(node.change_pct) ? node.change_pct : null,
  };
}

const BEHAVIOR_MODES = [
  'calm-monitoring',
  'elevated-volatility',
  'major-catalyst',
  'cross-asset-conflict',
  'speculative-momentum',
  'defensive-rotation',
];
const EDITORIAL_INTENSITIES = ['quiet', 'measured', 'elevated'];
const PACING_DENSITIES = ['open', 'balanced', 'compressed'];
const CATALYST_FOCUS_LEVELS = ['none', 'watch', 'near', 'imminent'];
const DIVERGENCE_FOCUS_LEVELS = ['none', 'watch', 'elevated'];
const BEHAVIOR_LABELS = {
  en: {
    'calm-monitoring': 'Continuity lead',
    'elevated-volatility': 'Risk lead',
    'major-catalyst': 'Catalyst lead',
    'cross-asset-conflict': 'Conflict lead',
    'speculative-momentum': 'Positioning lead',
    'defensive-rotation': 'Defensive lead',
  },
  ar: {
    'calm-monitoring': 'محور الاستمرارية',
    'elevated-volatility': 'محور المخاطر',
    'major-catalyst': 'محور المحفز',
    'cross-asset-conflict': 'محور التباعد',
    'speculative-momentum': 'محور التمركزات',
    'defensive-rotation': 'محور التحول الدفاعي',
  },
};

function catalystHoursUntil(catalyst, now = new Date()) {
  const timestamp = Date.parse(catalyst && catalyst.time);
  if (!Number.isFinite(timestamp)) return null;
  return Math.round(((timestamp - now.getTime()) / 3600000) * 10) / 10;
}

function deriveNewsroomBehavior(input = {}) {
  const {
    verified = false,
    dimensions = {},
    cognition = {},
    macro = {},
    convergence = {},
    catalysts = [],
    session = 'asia',
    now = new Date(),
  } = input;

  // Behavioral escalation is forbidden unless the full live reasoning stack
  // is verified. Session personality remains clock-derived but cannot elevate
  // market intensity on its own.
  if (!verified) {
    return {
      behavioral_mode: 'calm-monitoring',
      editorial_intensity: 'quiet',
      desk_priority_bias: ['memory', 'macro', 'catalysts'],
      pacing_density: 'open',
      catalyst_focus: 'none',
      divergence_focus: 'none',
      stress_level: 0,
      session_personality: session,
      catalyst_hours: null,
      verified_inputs: false,
    };
  }

  const alerts = cognition.alerts || [];
  const divergences = convergence.diverges || [];
  const contradictions = (macro.contradictions || []).filter((item) => item.active_today);
  const pressure = (macro.pressure && macro.pressure.tracks) || {};
  const coherenceBand = convergence.coherence && convergence.coherence.band;
  const nextCatalyst = catalysts
    .map((item) => ({ item, hours: catalystHoursUntil(item, now) }))
    .filter(({ hours }) => hours !== null && hours >= 0)
    .sort((a, b) => a.hours - b.hours)[0] || null;
  const majorCatalyst = nextCatalyst && /fomc|fed|cpi|pce|payroll|nfp|gdp|retail sales/i.test(String(nextCatalyst.item.name || ''));
  const catalystFocus = !nextCatalyst ? 'none'
    : nextCatalyst.hours <= 6 ? 'imminent'
      : nextCatalyst.hours <= 24 ? 'near'
        : nextCatalyst.hours <= 72 ? 'watch'
          : 'none';

  const volatilityStress = ['elevated', 'stressed'].includes(dimensions.volatility_regime);
  const liquidityStress = ['tightening', 'stressed', 'elevated'].includes(dimensions.liquidity_stress)
    || Number(pressure.liquidity_pressure && pressure.liquidity_pressure.score) >= 3;
  const fragilityStress = ['elevated', 'stressed', 'building'].includes(dimensions.market_fragility);
  const highAlert = alerts.some((item) => item.severity === 'high');
  const elevatedAlert = alerts.some((item) => item.severity === 'elevated');
  const conflict = divergences.length > 0 || coherenceBand === 'conflicted' || contradictions.length >= 2;
  const speculative = dimensions.speculative_appetite === 'active'
    || dimensions.ai_concentration_risk === 'elevated'
    || dimensions.momentum_concentration === 'narrow-megacap'
    || Number(pressure.speculative_pressure && pressure.speculative_pressure.score) >= 3
    || Number(pressure.concentration_pressure && pressure.concentration_pressure.score) >= 3;
  const defensive = dimensions.defensive_rotation === 'active'
    || dimensions.risk_state === 'risk_off'
    || Number(pressure.defensive_pressure && pressure.defensive_pressure.score) >= 3;

  let stressLevel = 0;
  if (volatilityStress || elevatedAlert) stressLevel += 1;
  if (liquidityStress || fragilityStress) stressLevel += 1;
  if (highAlert || dimensions.volatility_regime === 'stressed') stressLevel += 1;
  stressLevel = Math.min(3, stressLevel);

  let behavioralMode = 'calm-monitoring';
  if (volatilityStress || liquidityStress || stressLevel >= 2) behavioralMode = 'elevated-volatility';
  else if (majorCatalyst && ['imminent', 'near', 'watch'].includes(catalystFocus)) behavioralMode = 'major-catalyst';
  else if (conflict) behavioralMode = 'cross-asset-conflict';
  else if (speculative) behavioralMode = 'speculative-momentum';
  else if (defensive) behavioralMode = 'defensive-rotation';

  const biasByMode = {
    'calm-monitoring': ['memory', 'macro', 'catalysts'],
    'elevated-volatility': ['risk', 'alerts', 'crossasset', 'conviction'],
    'major-catalyst': ['catalysts', 'crossasset', 'risk', 'scenarios'],
    'cross-asset-conflict': ['crossasset', 'conviction', 'risk', 'positioning'],
    'speculative-momentum': ['positioning', 'rotation', 'conviction', 'risk'],
    'defensive-rotation': ['risk', 'rotation', 'crossasset', 'memory'],
  };

  return {
    behavioral_mode: behavioralMode,
    editorial_intensity: behavioralMode === 'elevated-volatility' ? 'elevated' : behavioralMode === 'calm-monitoring' ? 'quiet' : 'measured',
    desk_priority_bias: biasByMode[behavioralMode],
    pacing_density: behavioralMode === 'elevated-volatility' ? 'compressed' : behavioralMode === 'calm-monitoring' ? 'open' : 'balanced',
    catalyst_focus: catalystFocus,
    divergence_focus: divergences.length >= 2 || coherenceBand === 'conflicted' ? 'elevated' : divergences.length ? 'watch' : 'none',
    stress_level: stressLevel,
    session_personality: session,
    catalyst_hours: nextCatalyst ? nextCatalyst.hours : null,
    verified_inputs: true,
  };
}

function renderSection(locale) {
  const ar = locale === 'ar';
  const t = (en, arText) => (ar ? arText : en);
  const pulseRaw = readJson('data/intelligence/market-pulse.json', null);
  const wire = readJson('data/newswire/wire-events.json', { items: [], status: 'quiet' });
  const feed = readJson('data/feeds/newsroom-pulse.json', { modules: {} });
  const live = readJson('data/live-market-state.json', {});
  const session = marketSession();
  const liveOk = live.metadata && ['live', 'partial'].includes(live.metadata.status);

  // Stale-pulse guard: an old pulse degrades to monitoring mode.
  const pulseAgeHours = pulseRaw && pulseRaw.updated_at
    ? (Date.now() - new Date(pulseRaw.updated_at).getTime()) / 3600000
    : Infinity;
  const pulse = pulseRaw && pulseAgeHours <= PULSE_MAX_AGE_HOURS ? pulseRaw : (pulseRaw ? { ...pulseRaw, verified: false } : null);

  // Cognition layer (Phase 74) — same stale guard; stale cognition keeps its
  // memory/timeline (history is real) but drops live alerts.
  const cogRaw = readJson('data/intelligence/market-cognition.json', null);
  const cogAgeHours = cogRaw && cogRaw.updated_at
    ? (Date.now() - new Date(cogRaw.updated_at).getTime()) / 3600000
    : Infinity;
  const cogFresh = Boolean(cogRaw && cogAgeHours <= PULSE_MAX_AGE_HOURS);
  const cognition = cogRaw || {};
  const cogShifts = Object.fromEntries((cognition.regime_shifts || []).map((s) => [s.dimension, s]));
  const cogAlerts = cogFresh && cognition.verified === true ? (cognition.alerts || []) : [];

  // Macro cognition layer (Phase 75) — same stale guard.
  const macroRaw = readJson('data/intelligence/macro-cognition.json', null);
  const macroAgeHours = macroRaw && macroRaw.updated_at
    ? (Date.now() - new Date(macroRaw.updated_at).getTime()) / 3600000
    : Infinity;
  const macroFresh = Boolean(macroRaw && macroAgeHours <= PULSE_MAX_AGE_HOURS);
  const macro = macroFresh ? macroRaw : null;
  const macroVerified = Boolean(macro && macro.verified === true);

  // Narrative convergence layer (Phase 79) — same stale guard.
  const convRaw = readJson('data/intelligence/narrative-convergence.json', null);
  const convAgeHours = convRaw && convRaw.updated_at
    ? (Date.now() - new Date(convRaw.updated_at).getTime()) / 3600000
    : Infinity;
  const convergence = convRaw && convAgeHours <= PULSE_MAX_AGE_HOURS ? convRaw : null;
  const convVerified = Boolean(convergence && convergence.verified === true);

  // Phase 83 editorial memory. Historical artifacts may outlive a live-data
  // cycle, but only a verified artifact aligned to the current cognition date
  // may influence today's lead or desk emphasis.
  const editorialMemory = readJson('data/intelligence/editorial-market-memory.json', null);
  const memoryCurrent = Boolean(
    editorialMemory && editorialMemory.verified === true &&
    cognition.run_date && editorialMemory.run_date === cognition.run_date
  );
  const memoryFocus = memoryCurrent ? (editorialMemory.current_focus || []) : [];
  const memoryCharacter = memoryCurrent && editorialMemory.market_character
    ? editorialMemory.market_character
    : null;

  // Phase 84 structural tension sits above convergence and editorial memory.
  // It may influence hierarchy only when verified and date-aligned.
  const tensionRaw = readJson('data/intelligence/structural-tension.json', null);
  const tensionCurrent = Boolean(
    tensionRaw && tensionRaw.verified === true &&
    cognition.run_date && tensionRaw.run_date === cognition.run_date
  );
  const tension = tensionCurrent ? tensionRaw : null;
  const tensionElevated = Boolean(tension && ['elevated', 'acute'].includes(tension.tension_level));

  // Phase 80 product layer. The artifact is rebuilt before this renderer in
  // both daily and intraday workflows. Missing/stale output degrades to a
  // compact monitoring block rather than inventing a market read.
  const briefRaw = readJson('data/intelligence/daily-intelligence-brief.json', null);
  const briefAgeHours = briefRaw && briefRaw.updated_at
    ? (Date.now() - new Date(briefRaw.updated_at).getTime()) / 3600000
    : Infinity;
  const dailyBrief = briefRaw && briefAgeHours <= PULSE_MAX_AGE_HOURS ? briefRaw : null;

  const updatedAt = (pulse && pulse.updated_at) || (feed && feed.updated_at) || null;
  const updatedLabel = updatedAt ? new Date(updatedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : null;

  const verified = Boolean(pulse && pulse.verified === true);
  const dims = (pulse && pulse.dimensions) || {};
  const stressed = dims.volatility_regime === 'stressed';

  // ── Hero intelligence ribbon ────────────────────────────────────────────
  const topStory = (wire.top_story && wire.top_story.headline)
    || (feed.modules && feed.modules.top_market_story && feed.modules.top_market_story.headline)
    || null;
  const catalysts = (pulse && pulse.catalysts_today) || [];
  const topCatalyst = catalysts[0] || null;
  const behaviorVerified = Boolean(
    verified && cogFresh && cognition.verified === true &&
    macroVerified && convVerified
  );
  const behavior = deriveNewsroomBehavior({
    verified: behaviorVerified,
    dimensions: dims,
    cognition,
    macro: macro || {},
    convergence: convergence || {},
    catalysts,
    session,
  });
  // Emerging regime transition (verified) earns a hero ribbon slot.
  const emergingShift = cogFresh && cognition.verified === true
    ? (cognition.regime_shifts || []).find((s) => s.phase === 'emerging' && s.from)
    : null;
  const transitionItem = emergingShift
    ? `\n            <span class="nr-hero-item"><span class="nr-hero-key">${t('Transition', 'التحول')}</span>${escapeHtml(DIM_LABELS[locale][emergingShift.dimension] || emergingShift.dimension)}: ${ar ? `من ${escapeHtml(stateLabel(emergingShift.from.state, true))} إلى ${escapeHtml(stateLabel(emergingShift.state, true))}` : `${escapeHtml(stateLabel(emergingShift.from.state, false))} → ${escapeHtml(stateLabel(emergingShift.state, false))}`}</span>`
    : '';
  const catalystWindowItem = behavior.verified_inputs && behavior.catalyst_focus !== 'none' && behavior.catalyst_hours !== null
    ? `\n            <span class="nr-hero-item nr-catalyst-window"><span class="nr-hero-key">${t('Catalyst window', 'نافذة المحفز')}</span>${behavior.catalyst_hours < 1 ? t('under 1h', 'أقل من ساعة') : t(`${Math.round(behavior.catalyst_hours)}h`, `خلال ${Math.round(behavior.catalyst_hours)} س`)}</span>`
    : '';
  const tensionItem = tension
    ? `\n            <span class="nr-hero-item nr-tension-window"><span class="nr-hero-key">${t('Regime pressure', 'ضغط النظام')}</span>${escapeHtml(REGIME_PRESSURE_LABELS[locale][tension.regime_condition] || tension.regime_condition)} · ${tension.tension_score}/100</span>`
    : '';
  const heroRibbon = `
          <div class="nr-hero-ribbon">
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Top story', 'القصة الأبرز')}</span>${escapeHtml(topStory || t('Desk monitoring — no dominant wire story', 'وضع المراقبة — لا قصة مهيمنة في الموجز'))}</span>
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Next catalyst', 'المحفز التالي')}</span>${topCatalyst ? escapeHtml(catalystName(topCatalyst.name, ar)) : t('none scheduled', 'لا شيء مجدول')}</span>
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Regime', 'النظام')}</span>${escapeHtml(stateLabel(dims.risk_state || 'unverified', ar))} · ${escapeHtml(stateLabel(dims.volatility_regime || 'unverified', ar))}</span>${macroVerified && macro.conviction && macro.conviction.state !== 'unverified' ? `
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Conviction', 'القناعة')}</span>${escapeHtml(CONVICTION_LABELS[locale][macro.conviction.state] || macro.conviction.state)}</span>` : ''}${tensionItem}${catalystWindowItem}${transitionItem}
          </div>`;

  // ── Banner ──────────────────────────────────────────────────────────────
  const banner = verified
    ? escapeHtml(pulse.pulse_banner)
    : t('Desk monitoring mode — regime inputs await the next sourced data cycle.',
        'وضع المراقبة — مؤشرات النظام بانتظار دورة البيانات الموثقة التالية.');
  const bannerTone = !verified ? 'quiet' : stressed ? 'alert' : 'info';

  // ── Desk lead — the dominant story (Phase 78 continuity layer) ──────────
  // One coherent institutional read: what changed, why it matters, which
  // assets, what the desk awaits, and the cross-session continuity thread.
  // Every line derives from a verified artifact; missing pieces are omitted,
  // never invented.
  const topDivergence = convVerified ? ((convergence.diverges || [])[0] || null) : null;
  const topObservation = cogFresh ? ((cognition.memory_observations || [])[0] || null) : null;
  const topMemory = memoryFocus[0] || null;
  let leadHeadline;
  if (!behavior.verified_inputs) {
    leadHeadline = t(
      'Desk monitoring — the structural watch continues while regime inputs await the next sourced cycle.',
      'مراقبة المكتب مستمرة؛ وتبقى القراءة الهيكلية معلّقة إلى حين اكتمال دورة البيانات الموثقة التالية.'
    );
  } else if (behavior.behavioral_mode === 'elevated-volatility') {
    leadHeadline = (cogAlerts.length ? (ar ? cogAlerts[0].headline_ar : cogAlerts[0].headline_en) : null)
      || pulse.pulse_banner;
  } else if (behavior.behavioral_mode === 'major-catalyst' && topCatalyst) {
    leadHeadline = t(
      `The desk is positioned around ${topCatalyst.name}; confirmation now depends on the cross-asset response.`,
      `تتركز قراءة المكتب حول ${catalystName(topCatalyst.name, true)}؛ ويعتمد التأكيد الآن على استجابة الأصول المرتبطة.`
    );
  } else if (behavior.behavioral_mode === 'cross-asset-conflict' && topDivergence) {
    leadHeadline = ar ? topDivergence.ar : topDivergence.en;
  } else if (tensionElevated) {
    leadHeadline = ar ? tension.summary_ar : tension.summary_en;
  } else if (behavior.behavioral_mode === 'calm-monitoring' && (topMemory || topObservation)) {
    leadHeadline = topMemory ? (ar ? topMemory.ar : topMemory.en) : (ar ? topObservation.ar : topObservation.en);
  } else {
    leadHeadline = topStory
      || (verified ? pulse.pulse_banner : null)
      || t('The desk is maintaining a measured structural watch.', 'يحافظ المكتب على متابعة هيكلية منضبطة.');
  }

  const leadLines = [];
  const latestTransition = cogFresh ? ((cognition.timeline_tail || [])[0] || null) : null;
  if (latestTransition && latestTransition.dimension) {
    const dimLabel = DIM_LABELS[locale][latestTransition.dimension] || String(latestTransition.dimension).replace(/_/g, ' ');
    leadLines.push([
      t('What changed', 'ما الذي تغيّر'),
      ar
        ? `${dimLabel}: من ${stateLabel(latestTransition.from, true)} إلى ${stateLabel(latestTransition.to, true)} (${latestTransition.date})`
        : `${dimLabel}: ${stateLabel(latestTransition.from, false)} → ${stateLabel(latestTransition.to, false)} (${latestTransition.date})`,
    ]);
  }
  if (macroVerified && macro.conviction && macro.conviction.state !== 'unverified') {
    leadLines.push([t('Why it matters', 'لماذا يهم'), ar ? macro.conviction.ar : macro.conviction.en]);
  }
  const divergingLegs = cogFresh && cognition.verified === true
    ? (cognition.causal_links || []).filter((l) => l.state === 'diverging').map((l) => l.legs.join('/').toUpperCase())
    : [];
  const focusAssets = divergingLegs.length
    ? divergingLegs.slice(0, 3).join(' · ')
    : (topCatalyst && topCatalyst.assets && topCatalyst.assets.length
      ? topCatalyst.assets.slice(0, 4).map((a) => assetName(a, ar)).join(' · ')
      : null);
  if (focusAssets) {
    leadLines.push([
      divergingLegs.length ? t('Links under stress', 'روابط تحت الضغط') : t('Assets in focus', 'أصول تحت المجهر'),
      focusAssets,
    ]);
  }
  if (topCatalyst) {
    const when = String(topCatalyst.time || '').includes('T') ? String(topCatalyst.time).slice(11, 16) + ' UTC' : String(topCatalyst.time || '');
    leadLines.push([t('What the desk awaits', 'ما ينتظره المكتب'), `${catalystName(topCatalyst.name, ar)}${when ? ` — ${when}` : ''}`]);
  }
  if (topObservation) {
    leadLines.push([t('Continuity', 'الاستمرارية'), ar ? topObservation.ar : topObservation.en]);
  }
  const persistentMemory = memoryFocus.find((item) => item.kind === 'narrative' && item.id !== (topMemory && topMemory.id));
  if (persistentMemory) {
    leadLines.push([t('What persists', 'ما الذي يستمر'), ar ? persistentMemory.ar : persistentMemory.en]);
  }
  const failedMemory = memoryCurrent ? ((editorialMemory.failed_expectations || [])[0] || null) : null;
  if (failedMemory) {
    leadLines.push([t('What failed to confirm', 'ما لم يتأكد'), ar ? failedMemory.ar : failedMemory.en]);
  }
  if (tension) {
    leadLines.push([t('Structural tension', 'التوتر الهيكلي'), ar ? tension.summary_ar : tension.summary_en]);
  }
  if (convVerified && convergence.coherence && convergence.coherence.score !== null) {
    leadLines.push([t('Regime coherence', 'اتساق النظام'), ar ? convergence.coherence.ar : convergence.coherence.en]);
  }
  const topUnderpriced = convVerified ? ((convergence.underpriced || [])[0] || null) : null;
  if (topUnderpriced) {
    leadLines.push([t('Quietly building', 'يتراكم بهدوء'), ar ? topUnderpriced.ar : topUnderpriced.en]);
  }
  const leadHtml = `
          <div class="nr-lead" data-lead-mode="${behavior.behavioral_mode}">
            <span class="nr-lead-kicker">${escapeHtml(BEHAVIOR_LABELS[locale][behavior.behavioral_mode])}</span>
            <p class="nr-lead-headline">${escapeHtml(leadHeadline)}</p>${leadLines.length ? `
            <ul class="nr-lead-lines">
              ${leadLines.map(([k, v]) => `<li><span class="nr-lead-key">${escapeHtml(k)}</span>${escapeHtml(v)}</li>`).join('\n              ')}
            </ul>` : ''}
          </div>`;

  // ── What to Watch (Phase 80 intelligence-to-action product layer) ──────
  const checklist = (dailyBrief && dailyBrief.monitoring_checklist) || [];
  const watchItems = checklist.slice(0, 3);
  const sensitiveAssets = ((dailyBrief && dailyBrief.most_sensitive_assets) || [])
    .slice(0, 3)
    .map((item) => item.asset)
    .join(' · ') || '—';
  const briefCatalyst = ((dailyBrief && dailyBrief.next_catalysts) || [])[0] || topCatalyst;
  const briefCoherence = dailyBrief && dailyBrief.regime && dailyBrief.regime.coherence
    ? dailyBrief.regime.coherence
    : null;
  const coherenceLabel = briefCoherence && briefCoherence.score !== null
    ? `${briefCoherence.score}/100 · ${String(briefCoherence.band || '').replace(/_/g, ' ')}`
    : t('awaiting verified inputs', 'بانتظار مدخلات موثقة');
  const whatToWatchHtml = `
          <div class="nr-watch" data-intelligence-product="phase-80">
            <div class="nr-watch-head">
              <span class="nr-watch-title">${t('What to Watch', 'ما يستحق المتابعة')}</span>
              <span class="nr-watch-coherence">${t('Regime coherence', 'اتساق النظام')}: ${escapeHtml(coherenceLabel)}</span>
            </div>
            <ul class="nr-watch-list">
              ${watchItems.length
                ? watchItems.map((item) => `<li>${escapeHtml(ar ? item.ar : item.en)}</li>`).join('\n              ')
                : `<li>${t('Monitoring priorities resume with the next product brief cycle.', 'تُستأنف أولويات المتابعة مع دورة الموجز التالية.')}</li>`}
            </ul>
            <div class="nr-watch-meta">
              <span><strong>${t('Next catalyst', 'المحفز التالي')}</strong>${briefCatalyst ? escapeHtml(ar ? (briefCatalyst.name_ar || briefCatalyst.name) : briefCatalyst.name) : '—'}</span>
              <span><strong>${t('Most sensitive', 'الأكثر حساسية')}</strong>${escapeHtml(sensitiveAssets)}</span>
            </div>
          </div>`;

  // ── Asset intelligence strip ────────────────────────────────────────────
  const assetCells = STRIP_ASSETS.map(({ key, symbol }) => {
    const node = liveOk ? liveNode(live, key) : { value: null, change: null };
    const ctx = assetContext(symbol, node.change, dims, ar);
    return `<div class="nr-asset" data-symbol="${symbol}" data-dir="${ctx.state}"><span class="nr-asset-sym">${symbol}</span><span class="nr-asset-chg">${fmtChange(node.change)}</span><span class="nr-asset-ctx">${escapeHtml(ctx.label)}</span></div>`;
  }).join('\n            ');

  // ── Macro monitor chips (terminal dashboard, with regime phase markers) ─
  const chips = Object.entries(DIM_LABELS[locale]).map(([key, label]) => {
    const value = dims[key] || 'unverified';
    const marker = cogFresh && value !== 'unverified' ? phaseMarker(cogShifts[key], ar) : '';
    return `<span class="nr-chip" data-dim="${key}" data-state="${escapeHtml(value)}">${escapeHtml(label)}: <strong>${escapeHtml(stateLabel(value, ar))}</strong>${marker}</span>`;
  }).join('\n            ');

  // ── Modules (with desk identities) ──────────────────────────────────────
  const fedDay = catalysts.some((c) => /fomc|fed/i.test(String(c.name || '')));

  const wireItems = (wire.items || []).slice(0, 5);
  const wireHtml = wireItems.length
    ? wireItems.map((item) => {
      const tier = urgencyTier(item.urgency);
      const badge = (CLUSTER_BADGES[locale][item.cluster]) || CLUSTER_BADGES[locale].macro;
      const ts = String(item.timestamp || '').slice(11, 16);
      return `<li><span class="nr-wire-headline"><span class="nr-badge" data-urgency="${tier}">${escapeHtml(badge)}</span> ${escapeHtml(item.headline)}</span><span class="nr-meta">${ts ? ts + ' UTC' : ''}</span></li>`;
    }).join('\n              ')
    : `<li class="nr-empty">${t('Wire quiet — no high-impact sourced events in the last 48 hours.', 'الموجز هادئ — لا أحداث موثقة عالية التأثير خلال 48 ساعة الماضية.')}</li>`;

  const catalystItems = catalysts.length
    ? catalysts.map((c) => {
      const when = String(c.time || '').includes('T') ? String(c.time).slice(11, 16) + ' UTC' : escapeHtml(String(c.time || ''));
      return `<li><span class="nr-wire-headline">${escapeHtml(catalystName(c.name, ar))}</span><span class="nr-meta">${when}${c.assets && c.assets.length ? ' · ' + escapeHtml(c.assets.slice(0, 3).map((a) => assetName(a, ar)).join(ar ? '، ' : ', ')) : ''}</span></li>`;
    }).join('\n              ')
    : `<li class="nr-empty">${t('No high-impact catalysts on the calendar window.', 'لا محفزات عالية التأثير في نافذة المفكرة الحالية.')}</li>`;

  // Top movers with classification (sourced moves only).
  const movers = liveOk
    ? STRIP_ASSETS
      .map(({ key, symbol }) => ({ symbol, change: liveNode(live, key).change }))
      .filter((m) => Number.isFinite(m.change) && Math.abs(m.change) >= 0.8)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 4)
    : [];
  const moversHtml = movers.length
    ? movers.map((m) => `<li><span class="nr-wire-headline"><strong>${m.symbol}</strong> ${fmtChange(m.change)} — ${escapeHtml(classifyMove(m.symbol, m.change, dims, ar))}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('No outsized sourced moves this cycle.', 'لا تحركات كبيرة موثقة في هذه الدورة.')}</li>`;

  const rotation = verified
    ? [
      [t('Breadth', 'الاتساع'), dims.breadth_state],
      [t('Defensive rotation', 'التناوب الدفاعي'), dims.defensive_rotation],
      [t('Momentum concentration', 'تركز الزخم'), dims.momentum_concentration],
      [t('Speculative appetite', 'شهية المضاربة'), dims.speculative_appetite],
    ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><span class="nr-meta">${escapeHtml(stateLabel(value || 'unverified', ar))}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('Rotation structure remains under observation until participation inputs are verified.', 'تبقى بنية التناوب قيد الرصد إلى أن تتأكد بيانات المشاركة في السوق.')}</li>`;

  let riskDesk = verified
    ? [
      [t('Volatility regime', 'نظام التقلب'), dims.volatility_regime],
      [t('Market fragility', 'هشاشة السوق'), dims.market_fragility],
      [t('Liquidity state', 'حالة السيولة'), dims.liquidity_stress],
      [t('Duration stress', 'ضغط الحساسية للفائدة'), dims.duration_pressure],
    ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><span class="nr-meta">${escapeHtml(stateLabel(value || 'unverified', ar))}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('Risk conditions are being monitored; no verified stress state is asserted this cycle.', 'تخضع ظروف المخاطر للرصد؛ ولا تُعتمد حالة ضغط قبل اكتمال هذه الدورة الموثقة.')}</li>`;
  const riskMemory = memoryFocus.find((item) => ['market-fragility', 'liquidity-compression', 'defensive-rotation', 'volatility-compression'].includes(item.id));
  if (verified && riskMemory) {
    riskDesk += `\n              <li data-memory-thread="${escapeHtml(riskMemory.id)}"><span class="nr-wire-headline"><span class="nr-badge" data-urgency="low">${t('CONTINUITY', 'استمرارية')}</span> ${escapeHtml(ar ? riskMemory.ar : riskMemory.en)}</span></li>`;
  }
  const riskStrain = tension ? (tension.strain_map || []).find((item) => ['liquidity-strain', 'volatility-compression-strain', 'participation-strain'].includes(item.id)) : null;
  if (riskStrain) {
    riskDesk += `\n              <li data-tension-thread="${escapeHtml(riskStrain.id)}"><span class="nr-wire-headline"><span class="nr-badge" data-urgency="medium">${t('STRUCTURAL', 'هيكلي')}</span> ${escapeHtml(ar ? riskStrain.ar : riskStrain.en)}</span></li>`;
  }

  const commentary = verified
    ? (pulse.desk_commentary || []).map((line) => `<li><span class="nr-wire-headline">${escapeHtml(line)}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('Desk commentary resumes with the next verified data cycle.', 'يستأنف تعليق المكتب مع دورة البيانات الموثقة التالية.')}</li>`;

  // ── Cognition modules (Phase 74) ────────────────────────────────────────
  const alertsHtml = cogAlerts.length
    ? cogAlerts.map((a) => `<li data-severity="${escapeHtml(a.severity)}"><span class="nr-wire-headline"><span class="nr-badge" data-urgency="${SEVERITY_TIER[a.severity] || 'low'}">${escapeHtml(SEVERITY_LABELS[locale][a.severity] || a.severity)}</span> ${escapeHtml(ar ? a.headline_ar : a.headline_en)}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('No verified state transitions this cycle — desk in monitoring mode.', 'لا تحولات حالة موثقة في هذه الدورة — المكتب في وضع المراقبة.')}</li>`;

  const memoryObs = cogFresh ? (cognition.memory_observations || []) : [];
  const lifecycleLabels = {
    en: { emerging: 'EMERGING', strengthening: 'STRENGTHENING', dominant: 'DOMINANT', crowded: 'CROWDED', weakening: 'WEAKENING', fading: 'FADING', unresolved: 'UNRESOLVED', invalidated: 'INVALIDATED', failed: 'FAILED TEST', 'ignored-by-price': 'UNPRICED' },
    ar: { emerging: 'ناشئة', strengthening: 'تتعزز', dominant: 'مهيمنة', crowded: 'مزدحمة', weakening: 'تضعف', fading: 'تتلاشى', unresolved: 'غير محسومة', invalidated: 'انتفت', failed: 'اختبار لم يتحقق', 'ignored-by-price': 'دون تسعير' },
  };
  const memoryHtml = memoryFocus.length
    ? memoryFocus.slice(0, 4).map((item) => {
      const state = MEMORY_STATES.includes(item.state) || ['failed', 'ignored-by-price'].includes(item.state) ? item.state : 'emerging';
      const sessions = Number.isInteger(item.sessions) && item.sessions > 1
        ? `<span class="nr-meta">${ar ? `${item.sessions} جلسات` : `${item.sessions} sessions`}</span>`
        : '';
      return `<li data-memory-state="${escapeHtml(state)}"><span class="nr-wire-headline"><span class="nr-badge" data-urgency="low">${escapeHtml(lifecycleLabels[locale][state])}</span> ${escapeHtml(ar ? item.ar : item.en)}</span>${sessions}</li>`;
    }).join('\n              ')
    : memoryObs.length && memoryCurrent
      ? memoryObs.slice(0, 4).map((o) => `<li><span class="nr-wire-headline">${escapeHtml(ar ? o.ar : o.en)}</span></li>`).join('\n              ')
      : `<li class="nr-empty">${t('Editorial memory is held until the next verified session; prior claims are not extended.', 'تظل الذاكرة التحريرية معلقة حتى الجلسة الموثقة التالية، ولا يجري تمديد أي استنتاج سابق.')}</li>`;

  // ── Macro cognition modules (Phase 75) ──────────────────────────────────
  const convictionRows = [];
  if (macroVerified && macro.conviction && macro.conviction.state !== 'unverified') {
    convictionRows.push(`<li><span class="nr-wire-headline"><span class="nr-badge" data-urgency="medium">${escapeHtml(CONVICTION_LABELS[locale][macro.conviction.state] || macro.conviction.state)}</span> ${escapeHtml(ar ? macro.conviction.ar : macro.conviction.en)}</span></li>`);
    if (macro.structure && macro.structure.class && !['unverified'].includes(macro.structure.class)) {
      convictionRows.push(`<li><span class="nr-wire-headline">${escapeHtml(ar ? macro.structure.ar : macro.structure.en)}</span></li>`);
    }
    for (const c of (macro.contradictions || []).filter((x) => x.active_today).slice(0, 3)) {
      convictionRows.push(`<li data-contradiction="${escapeHtml(c.id)}"><span class="nr-wire-headline"><span class="nr-contra${c.escalated ? '" data-escalated="true' : ''}">×${c.sessions}</span> ${escapeHtml(ar ? c.ar : c.en)}</span></li>`);
    }
    const elevatedTracks = ((macro.pressure && macro.pressure.elevated) || []).slice(0, 3);
    for (const key of elevatedTracks) {
      const track = macro.pressure.tracks[key];
      convictionRows.push(`<li><span class="nr-wire-headline">${escapeHtml(ar ? track.ar : track.en)}</span><span class="nr-meta">${track.score}/5</span></li>`);
    }
  }
  const convictionHtml = convictionRows.length
    ? convictionRows.join('\n              ')
    : `<li class="nr-empty">${t('Conviction analysis resumes with the next verified data cycle.', 'يستأنف تحليل القناعة مع دورة البيانات الموثقة التالية.')}</li>`;

  // ── Convergence desks (Phase 79) ─────────────────────────────────────────
  const LINK_STATE_LABEL = {
    en: { confirming: 'CONFIRMING', diverging: 'DIVERGING', neutral: 'NEUTRAL' },
    ar: { confirming: 'مؤكِّد', diverging: 'منفصل', neutral: 'محايد' },
  };
  const LINK_STATE_TIER = { confirming: 'low', diverging: 'high', neutral: 'low' };
  const observedLinks = convVerified
    ? [...(convergence.diverges || []), ...(convergence.confirms || [])].slice(0, 6)
    : [];
  let crossAssetHtml = observedLinks.length
    ? observedLinks.map((l) => `<li><span class="nr-wire-headline"><span class="nr-badge" data-urgency="${LINK_STATE_TIER[l.state] || 'low'}">${escapeHtml(LINK_STATE_LABEL[locale][l.state] || l.state)}</span> <strong>${escapeHtml(l.legs.join('/').toUpperCase())}</strong> — ${escapeHtml(ar ? l.ar : l.en)}${l.chain_strength >= 2 ? ` <em class="nr-contra">×${l.chain_strength}</em>` : ''}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('Cross-asset links await two-leg sourced quotes this session.', 'روابط الأصول بانتظار تسعير موثق لطرفي العلاقة في هذه الجلسة.')}</li>`;
  const crossAssetMemory = memoryFocus.find((item) => ['cross-asset-conflict', 'gold-resilience', 'dollar-strength', 'yield-pressure'].includes(item.id));
  if (convVerified && crossAssetMemory) {
    crossAssetHtml += `\n              <li data-memory-thread="${escapeHtml(crossAssetMemory.id)}"><span class="nr-wire-headline"><span class="nr-badge" data-urgency="low">${t('CONTINUITY', 'استمرارية')}</span> ${escapeHtml(ar ? crossAssetMemory.ar : crossAssetMemory.en)}</span></li>`;
  }
  const crossStrain = tension ? (tension.strain_map || []).find((item) => ['cross-asset-strain', 'contradiction-strain', 'defensive-nonconfirmation'].includes(item.id)) : null;
  if (crossStrain) {
    crossAssetHtml += `\n              <li data-tension-thread="${escapeHtml(crossStrain.id)}"><span class="nr-wire-headline"><span class="nr-badge" data-urgency="medium">${t('STRAIN', 'ضغط بنيوي')}</span> ${escapeHtml(ar ? crossStrain.ar : crossStrain.en)}</span></li>`;
  }

  const pressureTracks = macroVerified
    ? Object.entries((macro.pressure && macro.pressure.tracks) || {})
      .filter(([, track]) => Number.isFinite(track.score) && track.score > 0)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 6)
    : [];
  const positioningRows = [];
  if (macroVerified && (macro.conviction.state === 'crowded-positioning' || (macro.structure && macro.structure.class === 'crowded-trade'))) {
    positioningRows.push(`<li><span class="nr-wire-headline">${escapeHtml(ar ? macro.conviction.ar : macro.conviction.en)}</span></li>`);
  }
  for (const [key, track] of pressureTracks) {
    positioningRows.push(`<li><span class="nr-wire-headline">${escapeHtml(ar ? track.ar : track.en)}</span><span class="nr-meta">${track.score}/5 · ${escapeHtml(stateLabel(track.state, ar))}</span></li>`);
  }
  const positioningMemory = memoryFocus.find((item) => ['narrow-leadership', 'speculative-momentum'].includes(item.id));
  if (macroVerified && positioningMemory) {
    positioningRows.push(`<li data-memory-thread="${escapeHtml(positioningMemory.id)}"><span class="nr-wire-headline"><span class="nr-badge" data-urgency="low">${t('CONTINUITY', 'استمرارية')}</span> ${escapeHtml(ar ? positioningMemory.ar : positioningMemory.en)}</span></li>`);
  }
  const positioningHtml = positioningRows.length
    ? positioningRows.join('\n              ')
    : `<li class="nr-empty">${t('Pressure accumulation builds with verified sessions.', 'يتكوّن تراكم الضغوط مع الجلسات الموثقة.')}</li>`;

  const scenarioItems = macro
    ? (macro.scenarios || []).filter((s) => s.status !== 'dormant').slice(0, 5)
    : [];
  const scenariosHtml = scenarioItems.length
    ? scenarioItems.map((s) => `<li data-scenario="${escapeHtml(s.id)}"><span class="nr-wire-headline"><span class="nr-badge" data-urgency="${SCENARIO_STATUS_TIER[s.status] || 'low'}">${escapeHtml(SCENARIO_STATUS_LABELS[locale][s.status] || s.status)}</span> ${escapeHtml(localizeCatalystsInText(ar ? s.ar : s.en, ar))}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('Scenario monitor initializes with the next verified data cycle.', 'تبدأ مراقبة السيناريوهات مع دورة البيانات الموثقة التالية.')}</li>`;

  const timelineEvents = (cognition.timeline_tail || []).slice(0, 4);
  const timelineHtml = timelineEvents.length
    ? timelineEvents.map((e) => {
      const dimLabel = DIM_LABELS[locale][e.dimension] || String(e.dimension || '').replace(/_/g, ' ');
      const text = ar
        ? `${dimLabel}: من ${stateLabel(e.from, true)} إلى ${stateLabel(e.to, true)}`
        : `${dimLabel}: ${stateLabel(e.from, false)} → ${stateLabel(e.to, false)}`;
      return `<li><span class="nr-wire-headline">${escapeHtml(text)}</span><span class="nr-meta">${escapeHtml(String(e.date || ''))}</span></li>`;
    }).join('\n              ')
    : `<li class="nr-empty">${t('No verified regime transitions recorded yet — the evolution timeline starts with the first sourced shift.', 'لا تحولات نظام موثقة بعد — يبدأ خط التطور مع أول تحول موثق.')}</li>`;

  // ── Session-aware module ordering ───────────────────────────────────────
  // weekend -> macro view first; fed/catalyst day -> catalysts first;
  // stressed vol -> risk desk first; default -> wire first.
  const modules = {
    wire: { title: t('Live Newswire', 'الموجز المباشر'), body: wireHtml },
    catalysts: { title: fedDay ? t('Fed Watch — Key Catalysts', 'مراقبة الفيدرالي — أبرز المحفزات') : t('Key Catalysts', 'أبرز المحفزات'), body: catalystItems },
    movers: { title: t('Top Movers — Flow Monitor', 'أبرز التحركات — مراقبة التدفقات'), body: moversHtml },
    rotation: { title: t('Rotation Signals — Flow Monitor', 'إشارات التناوب — مراقبة التدفقات'), body: rotation },
    risk: { title: t('Risk Desk', 'مكتب المخاطر'), body: riskDesk },
    macro: { title: t('Macro Desk View', 'رؤية مكتب الماكرو'), body: commentary },
    alerts: { title: t('Desk Alerts', 'تنبيهات المكتب'), body: alertsHtml },
    memory: { title: t('Editorial Market Memory', 'الذاكرة التحريرية للسوق'), body: memoryHtml },
    timeline: { title: t('Market State Evolution', 'تطور حالة السوق'), body: timelineHtml },
    conviction: { title: t('Desk Conviction', 'قناعة المكتب'), body: convictionHtml },
    scenarios: { title: t('Scenario Monitor', 'مراقبة السيناريوهات'), body: scenariosHtml },
    crossasset: { title: t('Cross-Asset Desk', 'مكتب العلاقات بين الأصول'), body: crossAssetHtml },
    positioning: { title: t('Positioning Desk', 'مكتب التمركزات'), body: positioningHtml },
  };
  const escalated = cogAlerts.some((a) => a.severity === 'high' || a.severity === 'elevated');
  let order;
  if (escalated) order = ['alerts', 'risk', 'conviction', 'crossasset', 'wire', 'positioning', 'memory', 'scenarios', 'movers', 'catalysts', 'timeline', 'rotation', 'macro'];
  else if (session === 'weekend') order = ['macro', 'scenarios', 'timeline', 'memory', 'crossasset', 'conviction', 'positioning', 'catalysts', 'rotation', 'risk', 'alerts', 'wire', 'movers'];
  else if (stressed) order = ['risk', 'alerts', 'conviction', 'crossasset', 'wire', 'movers', 'positioning', 'scenarios', 'memory', 'catalysts', 'rotation', 'timeline', 'macro'];
  else if (fedDay) order = ['catalysts', 'wire', 'scenarios', 'alerts', 'conviction', 'crossasset', 'risk', 'positioning', 'memory', 'movers', 'rotation', 'timeline', 'macro'];
  else order = ['wire', 'catalysts', 'conviction', 'alerts', 'crossasset', 'movers', 'memory', 'positioning', 'scenarios', 'rotation', 'risk', 'timeline', 'macro'];

  // Adaptive desk-focus elevation (Phase 75): the homepage reorders itself
  // around the derived focus — never overriding alert escalation or vol stress.
  const focus = (macroVerified && macro.desk_focus && macro.desk_focus.focus) || null;
  if (focus && !escalated && !stressed) {
    if (focus === 'contradictions' || focus === 'concentration') order = promote(order, ['conviction']);
    else if (focus === 'risk' || focus === 'pressure') order = promote(order, ['risk', 'conviction']);
    else if (focus === 'macro') order = promote(order, ['macro', 'scenarios']);
  }

  // Phase 81 layout intelligence: classify existing desk output for visual
  // density and hierarchy only. No intelligence state is changed here.
  const behaviorBias = new Set(behavior.desk_priority_bias);
  const prioritize = (id, fallback) => behavior.verified_inputs && fallback !== 'quiet' && behaviorBias.has(id)
    ? (fallback === 'critical' ? 'critical' : 'high')
    : fallback;
  const tensionPrioritize = (id, fallback) => tensionElevated && ['risk', 'crossasset', 'conviction'].includes(id) && fallback !== 'quiet'
    ? (fallback === 'critical' ? 'critical' : 'high')
    : fallback;
  const moduleMetrics = {
    wire: { count: wireItems.length, priority: wireItems.length ? 'high' : 'quiet' },
    catalysts: { count: catalysts.length, priority: prioritize('catalysts', catalysts.length ? 'high' : 'quiet') },
    movers: { count: movers.length, priority: prioritize('movers', movers.length ? 'high' : 'quiet') },
    rotation: { count: verified ? 4 : 0, priority: prioritize('rotation', verified ? 'normal' : 'quiet') },
    risk: { count: verified ? 4 + (riskStrain ? 1 : 0) : 0, priority: tensionPrioritize('risk', prioritize('risk', stressed ? 'critical' : (verified ? 'high' : 'quiet'))) },
    macro: { count: verified ? (pulse.desk_commentary || []).length : 0, priority: prioritize('macro', verified && focus === 'macro' ? 'high' : (verified ? 'normal' : 'quiet')) },
    alerts: { count: cogAlerts.length, priority: prioritize('alerts', cogAlerts.some((item) => item.severity === 'high') ? 'critical' : (cogAlerts.length ? 'high' : 'quiet')) },
    memory: {
      count: memoryFocus.length || (memoryCurrent ? memoryObs.length : 0),
      priority: prioritize('memory', memoryFocus.length || (memoryCurrent && memoryObs.length) ? 'normal' : 'quiet'),
    },
    timeline: { count: timelineEvents.length, priority: timelineEvents.length ? 'normal' : 'quiet' },
    conviction: { count: convictionRows.length, priority: tensionPrioritize('conviction', prioritize('conviction', convictionRows.length ? 'high' : 'quiet')) },
    scenarios: { count: scenarioItems.length, priority: prioritize('scenarios', scenarioItems.some((item) => item.status === 'active') ? 'high' : (scenarioItems.length ? 'normal' : 'quiet')) },
    crossasset: { count: observedLinks.length + (crossStrain ? 1 : 0), priority: tensionPrioritize('crossasset', prioritize('crossasset', observedLinks.some((item) => item.state === 'diverging') ? 'critical' : (observedLinks.length || crossStrain ? 'high' : 'quiet'))) },
    positioning: { count: positioningRows.length, priority: prioritize('positioning', pressureTracks.some(([, track]) => track.score >= 3) ? 'high' : (positioningRows.length ? 'normal' : 'quiet')) },
  };
  const densityFor = (metric) => {
    if (!metric || metric.count === 0) return 'quiet';
    if (metric.count === 1) return 'compact';
    if (metric.count <= 3) return 'standard';
    return 'expanded';
  };
  const continuityDesks = new Set(['memory', 'timeline', 'macro']);
  const baselinePriority = new Set(['catalysts', 'scenarios', 'risk']);
  const priorityIds = order.filter((id) => {
    const level = moduleMetrics[id].priority;
    return level === 'critical' || level === 'high' || baselinePriority.has(id);
  });
  const continuityIds = order.filter((id) => continuityDesks.has(id) && !priorityIds.includes(id));
  const secondaryIds = order.filter((id) => !priorityIds.includes(id) && !continuityIds.includes(id));

  // Phase 85 — surface compression. Only desks with verified content earn a
  // full card; quiet desks collapse into one compact strip per band (still
  // individually addressable via data-desk for integrity checks) and one
  // shared calm note replaces thirteen repeated empty-state boxes. Desks
  // re-expand automatically the moment their underlying artifact carries
  // content — the surface breathes with the market.
  function renderModule(id) {
    const metric = moduleMetrics[id];
    return `
              <div class="nr-module" data-desk="${id}" data-density="${densityFor(metric)}" data-priority="${metric.priority}" data-state="active">
                <h3>${modules[id].title}</h3>
                <ul>
                ${modules[id].body}
                </ul>
              </div>`;
  }

  function renderQuietStrip(ids) {
    if (!ids.length) return '';
    return `
              <div class="nr-quiet-strip">
                <span class="nr-quiet-label">${t('Quiet', 'هادئ')}</span>
                ${ids.map((id) => `<span class="nr-quiet-desk" data-desk="${id}" data-state="monitoring">${modules[id].title}</span>`).join('\n                ')}
              </div>`;
  }

  function renderBand(id, title, subtitle, ids) {
    if (!ids.length) return '';
    const activeIds = ids.filter((moduleId) => moduleMetrics[moduleId].count > 0);
    const quietIds = ids.filter((moduleId) => moduleMetrics[moduleId].count === 0);
    const grid = activeIds.length
      ? `
              <div class="nr-desk-grid">${activeIds.map(renderModule).join('')}
              </div>`
      : '';
    return `
            <section class="nr-desk-band" data-band="${id}" data-compressed="${activeIds.length ? 'false' : 'true'}">
              <div class="nr-band-head">
                <h3>${title}</h3>
                <span>${subtitle}</span>
              </div>${grid}${renderQuietStrip(quietIds)}
            </section>`;
  }

  const allBandIds = [...priorityIds, ...secondaryIds, ...continuityIds];
  const anyQuiet = allBandIds.some((id) => moduleMetrics[id].count === 0);
  const calmNote = anyQuiet
    ? `
            <p class="nr-calm-note">${t('Quiet desks hold their last verified state and re-expand automatically when sourced conditions change.', 'تحتفظ المكاتب الهادئة بآخر حالة موثقة وتتوسع تلقائياً عند تغير الظروف الموثقة.')}</p>`
    : '';

  const moduleHtml = [
    renderBand(
      'priority',
      t('Priority Desks', 'المكاتب ذات الأولوية'),
      t('Catalysts, active tensions and current market judgment', 'المحفزات والتوترات النشطة وقراءة السوق الراهنة'),
      priorityIds
    ),
    renderBand(
      'secondary',
      t('Market Structure', 'بنية السوق'),
      t('Flow, positioning and supporting confirmation', 'التدفقات والتمركزات وإشارات التأكيد المساندة'),
      secondaryIds
    ),
    renderBand(
      'continuity',
      t('Continuity & Memory', 'الاستمرارية والذاكرة'),
      t('Cross-session context and regime history', 'سياق الجلسات وتاريخ تحولات النظام'),
      continuityIds
    ),
  ].join('') + calmNote;

  const edition = EDITIONS[locale][session];

  return `
      <section class="section section-tight" id="newsroom-live">
        <div class="section-panel newsroom" data-session="${session}" data-behavior="${behavior.behavioral_mode}" data-intensity="${behavior.editorial_intensity}" data-pacing="${behavior.pacing_density}" data-catalyst-focus="${behavior.catalyst_focus}" data-divergence-focus="${behavior.divergence_focus}" data-stress="${behavior.stress_level}" data-behavior-verified="${behavior.verified_inputs}" data-memory-status="${memoryCurrent ? 'verified' : 'holding'}" data-memory-character="${memoryCharacter ? escapeHtml(memoryCharacter.id) : 'unavailable'}" data-tension-status="${tensionCurrent ? 'verified' : 'holding'}" data-regime-pressure="${tension ? escapeHtml(tension.regime_condition) : 'unverified'}" data-tension-level="${tension ? escapeHtml(tension.tension_level) : 'unverified'}" data-desk-bias="${behavior.desk_priority_bias.join(',')}" dir="${ar ? 'rtl' : 'ltr'}">
          <div class="newsroom-head">
            <h2 class="newsroom-title">${t('TradeAlphaAI Terminal', 'منصة TradeAlphaAI')} · <span class="nr-edition">${escapeHtml(edition)}</span></h2>
            <span class="newsroom-session" data-session="${session}"><span class="nr-dot"></span>${escapeHtml(SESSION_LABELS[locale][session])}${macroVerified && macro.desk_focus ? `<span class="nr-desk-focus" data-focus="${escapeHtml(macro.desk_focus.focus)}">${t('Desk focus', 'تركيز المكتب')}: ${escapeHtml(FOCUS_LABELS[locale][macro.desk_focus.focus] || macro.desk_focus.focus)}</span>` : ''}</span>
          </div>
${heroRibbon}
          <p class="newsroom-banner" data-tone="${bannerTone}">${banner}</p>
${leadHtml}
          <div class="nr-asset-strip" data-live-endpoint="/api/live-quotes">
            ${assetCells}
          </div>
${whatToWatchHtml}
          <div class="newsroom-pulse-strip">
            ${chips}
          </div>
          <div class="newsroom-flow">${moduleHtml}
          </div>
          <div class="newsroom-foot">
            <span>${updatedLabel ? `${t('Data as of', 'البيانات حتى')} ${updatedLabel}` : t('Awaiting first data cycle', 'بانتظار دورة البيانات الأولى')} <span class="nr-live-asof"></span></span>
            <span class="nr-continuity">${Number.isFinite(cognition.sessions_tracked) && cognition.sessions_tracked > 0 ? (ar ? `الاستمرارية: ${cognition.sessions_tracked} ${cognition.sessions_tracked === 1 ? 'جلسة متتبعة' : 'جلسات متتبعة'}` : `Continuity: ${cognition.sessions_tracked} ${cognition.sessions_tracked === 1 ? 'session' : 'sessions'} tracked`) : t('Continuity memory initializing', 'ذاكرة الاستمرارية قيد التهيئة')}</span>
            <span>${t('Sourced platform data only — educational market intelligence, not investment advice.', 'بيانات موثقة من المنصة فقط — استخبارات سوق تعليمية وليست نصيحة استثمارية.')}</span>
          </div>
        </div>
        <script src="/js/live-terminal.js" defer></script>
      </section>`;
}

function inject(relPath, html) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[newsroom-render] missing page: ${relPath}`);
    return false;
  }
  const source = fs.readFileSync(fullPath, 'utf8');
  const start = `<!-- ${MARKER_KEY}:start -->`;
  const end = `<!-- ${MARKER_KEY}:end -->`;
  const startIdx = source.indexOf(start);
  const endIdx = source.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    console.error(`[newsroom-render] markers missing in ${relPath} — skipping (page unchanged)`);
    return false;
  }
  const next = source.slice(0, startIdx + start.length) + '\n' + html + '\n' + source.slice(endIdx);
  fs.writeFileSync(fullPath, next, 'utf8');
  console.log(`[newsroom-render] injected terminal modules into ${relPath}`);
  return true;
}

function main() {
  inject('index.html', renderSection('en'));
  inject('ar/index.html', renderSection('ar'));
}

if (require.main === module) main();

module.exports = {
  renderSection,
  marketSession,
  deriveNewsroomBehavior,
  catalystHoursUntil,
  BEHAVIOR_MODES,
  EDITORIAL_INTENSITIES,
  PACING_DENSITIES,
  CATALYST_FOCUS_LEVELS,
  DIVERGENCE_FOCUS_LEVELS,
};
