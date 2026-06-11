'use strict';

// Phase 72/73 — Newsroom & terminal module renderer.
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
    breadth_state: 'Breadth', ai_concentration_risk: 'AI Concentration',
    speculative_appetite: 'Speculative Appetite', defensive_rotation: 'Defensive Rotation',
    dollar_pressure: 'Dollar', duration_pressure: 'Duration', market_fragility: 'Fragility',
  },
  ar: {
    risk_state: 'المخاطر', liquidity_stress: 'السيولة', volatility_regime: 'التقلب',
    breadth_state: 'الاتساع', ai_concentration_risk: 'تركز الذكاء الاصطناعي',
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
  'unverified': '—',
};

function stateLabel(value, ar) {
  if (!value || value === 'unverified') return '—';
  return ar ? (STATE_AR[value] || value) : value.replace(/_/g, '-');
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
  const heroRibbon = `
          <div class="nr-hero-ribbon">
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Top story', 'القصة الأبرز')}</span>${escapeHtml(topStory || t('Desk monitoring — no dominant wire story', 'وضع المراقبة — لا قصة مهيمنة في الموجز'))}</span>
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Next catalyst', 'المحفز التالي')}</span>${topCatalyst ? escapeHtml(topCatalyst.name) : t('none scheduled', 'لا شيء مجدول')}</span>
            <span class="nr-hero-item"><span class="nr-hero-key">${t('Regime', 'النظام')}</span>${escapeHtml(stateLabel(dims.risk_state || 'unverified', ar))} · ${escapeHtml(stateLabel(dims.volatility_regime || 'unverified', ar))}</span>
          </div>`;

  // ── Banner ──────────────────────────────────────────────────────────────
  const banner = verified
    ? escapeHtml(pulse.pulse_banner)
    : t('Desk monitoring mode — regime inputs await the next sourced data cycle.',
        'وضع المراقبة — مؤشرات النظام بانتظار دورة البيانات الموثقة التالية.');
  const bannerTone = !verified ? 'quiet' : stressed ? 'alert' : 'info';

  // ── Asset intelligence strip ────────────────────────────────────────────
  const assetCells = STRIP_ASSETS.map(({ key, symbol }) => {
    const node = liveOk ? liveNode(live, key) : { value: null, change: null };
    const ctx = assetContext(symbol, node.change, dims, ar);
    return `<div class="nr-asset" data-dir="${ctx.state}"><span class="nr-asset-sym">${symbol}</span><span class="nr-asset-chg">${fmtChange(node.change)}</span><span class="nr-asset-ctx">${escapeHtml(ctx.label)}</span></div>`;
  }).join('\n            ');

  // ── Macro monitor chips (terminal dashboard) ────────────────────────────
  const chips = Object.entries(DIM_LABELS[locale]).map(([key, label]) => {
    const value = dims[key] || 'unverified';
    return `<span class="nr-chip" data-state="${escapeHtml(value)}">${escapeHtml(label)}: <strong>${escapeHtml(stateLabel(value, ar))}</strong></span>`;
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
      return `<li><span class="nr-wire-headline">${escapeHtml(c.name)}</span><span class="nr-meta">${when}${c.assets && c.assets.length ? ' · ' + escapeHtml(c.assets.slice(0, 3).join(', ')) : ''}</span></li>`;
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
  };
  let order;
  if (session === 'weekend') order = ['macro', 'catalysts', 'rotation', 'risk', 'wire', 'movers'];
  else if (stressed) order = ['risk', 'wire', 'movers', 'catalysts', 'rotation', 'macro'];
  else if (fedDay) order = ['catalysts', 'wire', 'risk', 'movers', 'rotation', 'macro'];
  else order = ['wire', 'catalysts', 'movers', 'rotation', 'risk', 'macro'];

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
        <div class="section-panel newsroom" dir="${ar ? 'rtl' : 'ltr'}">
          <div class="newsroom-head">
            <h2 class="newsroom-title">${t('TradeAlphaAI Terminal', 'منصة TradeAlphaAI')} · <span class="nr-edition">${escapeHtml(edition)}</span></h2>
            <span class="newsroom-session" data-session="${session}"><span class="nr-dot"></span>${escapeHtml(SESSION_LABELS[locale][session])}</span>
          </div>
${heroRibbon}
          <div class="nr-asset-strip">
            ${assetCells}
          </div>
          <p class="newsroom-banner" data-tone="${bannerTone}">${banner}</p>
          <div class="newsroom-pulse-strip">
            ${chips}
          </div>
          <div class="newsroom-grid">${moduleHtml}
          </div>
          <div class="newsroom-foot">
            <span>${updatedLabel ? `${t('Data as of', 'البيانات حتى')} ${updatedLabel}` : t('Awaiting first data cycle', 'بانتظار دورة البيانات الأولى')}</span>
            <span>${t('Sourced platform data only — educational market intelligence, not investment advice.', 'بيانات موثقة من المنصة فقط — استخبارات سوق تعليمية وليست نصيحة استثمارية.')}</span>
          </div>
        </div>
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
