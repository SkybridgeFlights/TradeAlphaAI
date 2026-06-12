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

function assetName(name, ar) {
  if (!ar) return String(name || '');
  return ASSET_NAME_AR[String(name || '').trim()] || String(name || '');
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
  // Emerging regime transition (verified) earns a hero ribbon slot.
  const emergingShift = cogFresh && cognition.verified === true
    ? (cognition.regime_shifts || []).find((s) => s.phase === 'emerging' && s.from)
    : null;
  const transitionItem = emergingShift
    ? `\n            <span class="nr-hero-item"><span class="nr-hero-key">${t('Transition', 'التحول')}</span>${escapeHtml(DIM_LABELS[locale][emergingShift.dimension] || emergingShift.dimension)}: ${ar ? `من ${escapeHtml(stateLabel(emergingShift.from.state, true))} إلى ${escapeHtml(stateLabel(emergingShift.state, true))}` : `${escapeHtml(stateLabel(emergingShift.from.state, false))} → ${escapeHtml(stateLabel(emergingShift.state, false))}`}</span>`
    : '';
  const heroRibbon = `
          <div class="nr-hero-ribbon">
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Top story', 'القصة الأبرز')}</span>${escapeHtml(topStory || t('Desk monitoring — no dominant wire story', 'وضع المراقبة — لا قصة مهيمنة في الموجز'))}</span>
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Next catalyst', 'المحفز التالي')}</span>${topCatalyst ? escapeHtml(topCatalyst.name) : t('none scheduled', 'لا شيء مجدول')}</span>
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Regime', 'النظام')}</span>${escapeHtml(stateLabel(dims.risk_state || 'unverified', ar))} · ${escapeHtml(stateLabel(dims.volatility_regime || 'unverified', ar))}</span>${macroVerified && macro.conviction && macro.conviction.state !== 'unverified' ? `
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Conviction', 'القناعة')}</span>${escapeHtml(CONVICTION_LABELS[locale][macro.conviction.state] || macro.conviction.state)}</span>` : ''}${transitionItem}
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
  const leadHeadline = topStory
    || (cogAlerts.length ? (ar ? cogAlerts[0].headline_ar : cogAlerts[0].headline_en) : null)
    || (verified ? pulse.pulse_banner : null)
    || t('Desk monitoring — the structural watch continues while regime inputs await the next sourced cycle.',
         'مراقبة المكتب مستمرة — المتابعة الهيكلية قائمة بانتظار دورة البيانات الموثقة التالية.');

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
    leadLines.push([t('What the desk awaits', 'ما ينتظره المكتب'), `${topCatalyst.name}${when ? ` — ${when}` : ''}`]);
  }
  const topObservation = cogFresh ? ((cognition.memory_observations || [])[0] || null) : null;
  if (topObservation) {
    leadLines.push([t('Continuity', 'الاستمرارية'), ar ? topObservation.ar : topObservation.en]);
  }
  if (convVerified && convergence.coherence && convergence.coherence.score !== null) {
    leadLines.push([t('Regime coherence', 'اتساق النظام'), ar ? convergence.coherence.ar : convergence.coherence.en]);
  }
  const topUnderpriced = convVerified ? ((convergence.underpriced || [])[0] || null) : null;
  if (topUnderpriced) {
    leadLines.push([t('Quietly building', 'يتراكم بهدوء'), ar ? topUnderpriced.ar : topUnderpriced.en]);
  }
  const leadHtml = `
          <div class="nr-lead">
            <span class="nr-lead-kicker">${t('Desk lead', 'محور المكتب')}</span>
            <p class="nr-lead-headline">${escapeHtml(leadHeadline)}</p>${leadLines.length ? `
            <ul class="nr-lead-lines">
              ${leadLines.map(([k, v]) => `<li><span class="nr-lead-key">${escapeHtml(k)}</span>${escapeHtml(v)}</li>`).join('\n              ')}
            </ul>` : ''}
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
      return `<li><span class="nr-wire-headline">${escapeHtml(c.name)}</span><span class="nr-meta">${when}${c.assets && c.assets.length ? ' · ' + escapeHtml(c.assets.slice(0, 3).map((a) => assetName(a, ar)).join(ar ? '، ' : ', ')) : ''}</span></li>`;
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

  const rotation = [
    [t('Breadth', 'الاتساع'), dims.breadth_state],
    [t('Defensive rotation', 'التناوب الدفاعي'), dims.defensive_rotation],
    [t('Momentum concentration', 'تركز الزخم'), dims.momentum_concentration],
    [t('Speculative appetite', 'شهية المضاربة'), dims.speculative_appetite],
  ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><span class="nr-meta">${escapeHtml(stateLabel(value || 'unverified', ar))}</span></li>`).join('\n              ');

  const riskDesk = [
    [t('Volatility regime', 'نظام التقلب'), dims.volatility_regime],
    [t('Market fragility', 'هشاشة السوق'), dims.market_fragility],
    [t('Liquidity state', 'حالة السيولة'), dims.liquidity_stress],
    [t('Duration stress', 'ضغط الحساسية للفائدة'), dims.duration_pressure],
  ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><span class="nr-meta">${escapeHtml(stateLabel(value || 'unverified', ar))}</span></li>`).join('\n              ');

  const commentary = verified
    ? (pulse.desk_commentary || []).map((line) => `<li><span class="nr-wire-headline">${escapeHtml(line)}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('Desk commentary resumes with the next verified data cycle.', 'يستأنف تعليق المكتب مع دورة البيانات الموثقة التالية.')}</li>`;

  // ── Cognition modules (Phase 74) ────────────────────────────────────────
  const alertsHtml = cogAlerts.length
    ? cogAlerts.map((a) => `<li data-severity="${escapeHtml(a.severity)}"><span class="nr-wire-headline"><span class="nr-badge" data-urgency="${SEVERITY_TIER[a.severity] || 'low'}">${escapeHtml(SEVERITY_LABELS[locale][a.severity] || a.severity)}</span> ${escapeHtml(ar ? a.headline_ar : a.headline_en)}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('No verified state transitions this cycle — desk in monitoring mode.', 'لا تحولات حالة موثقة في هذه الدورة — المكتب في وضع المراقبة.')}</li>`;

  const memoryObs = cogFresh ? (cognition.memory_observations || []) : [];
  const memoryHtml = memoryObs.length
    ? memoryObs.slice(0, 4).map((o) => `<li><span class="nr-wire-headline">${escapeHtml(ar ? o.ar : o.en)}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('Cross-session memory builds as verified sessions accumulate.', 'تتكوّن ذاكرة الجلسات مع تراكم الجلسات الموثقة.')}</li>`;

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
  const crossAssetHtml = observedLinks.length
    ? observedLinks.map((l) => `<li><span class="nr-wire-headline"><span class="nr-badge" data-urgency="${LINK_STATE_TIER[l.state] || 'low'}">${escapeHtml(LINK_STATE_LABEL[locale][l.state] || l.state)}</span> <strong>${escapeHtml(l.legs.join('/').toUpperCase())}</strong> — ${escapeHtml(ar ? l.ar : l.en)}${l.chain_strength >= 2 ? ` <em class="nr-contra">×${l.chain_strength}</em>` : ''}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('Cross-asset links await two-leg sourced quotes this session.', 'روابط الأصول بانتظار تسعير موثق لطرفي العلاقة في هذه الجلسة.')}</li>`;

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
  const positioningHtml = positioningRows.length
    ? positioningRows.join('\n              ')
    : `<li class="nr-empty">${t('Pressure accumulation builds with verified sessions.', 'يتكوّن تراكم الضغوط مع الجلسات الموثقة.')}</li>`;

  const scenarioItems = macro
    ? (macro.scenarios || []).filter((s) => s.status !== 'dormant').slice(0, 5)
    : [];
  const scenariosHtml = scenarioItems.length
    ? scenarioItems.map((s) => `<li data-scenario="${escapeHtml(s.id)}"><span class="nr-wire-headline"><span class="nr-badge" data-urgency="${SCENARIO_STATUS_TIER[s.status] || 'low'}">${escapeHtml(SCENARIO_STATUS_LABELS[locale][s.status] || s.status)}</span> ${escapeHtml(ar ? s.ar : s.en)}</span></li>`).join('\n              ')
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
    memory: { title: t('Market Memory', 'ذاكرة السوق'), body: memoryHtml },
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

  const moduleHtml = order.map((id) => `
            <div class="nr-module" data-desk="${id}">
              <h3>${modules[id].title}</h3>
              <ul>
              ${modules[id].body}
              </ul>
            </div>`).join('');

  const edition = EDITIONS[locale][session];

  return `
      <section class="section section-tight" id="newsroom-live">
        <div class="section-panel newsroom" data-session="${session}" dir="${ar ? 'rtl' : 'ltr'}">
          <div class="newsroom-head">
            <h2 class="newsroom-title">${t('TradeAlphaAI Terminal', 'منصة TradeAlphaAI')} · <span class="nr-edition">${escapeHtml(edition)}</span></h2>
            <span class="newsroom-session" data-session="${session}"><span class="nr-dot"></span>${escapeHtml(SESSION_LABELS[locale][session])}${macroVerified && macro.desk_focus ? `<span class="nr-desk-focus" data-focus="${escapeHtml(macro.desk_focus.focus)}">${t('Desk focus', 'تركيز المكتب')}: ${escapeHtml(FOCUS_LABELS[locale][macro.desk_focus.focus] || macro.desk_focus.focus)}</span>` : ''}</span>
          </div>
${heroRibbon}
          <div class="nr-asset-strip" data-live-endpoint="/api/live-quotes">
            ${assetCells}
          </div>
          <p class="newsroom-banner" data-tone="${bannerTone}">${banner}</p>
${leadHtml}
          <div class="newsroom-pulse-strip">
            ${chips}
          </div>
          <div class="newsroom-grid">${moduleHtml}
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

module.exports = { renderSection, marketSession };
