'use strict';

// Phase 72 — Newsroom module renderer.
// Injects the live newsroom section into index.html and ar/index.html between
// <!-- generated:newsroom-modules:start/end --> markers, following the same
// idempotent pattern as update-market-intelligence-status.js.
//
// Honesty rules: only verified pulse commentary is shown with urgency styling;
// timestamps come from real artifact update times; a quiet wire says so
// plainly. No fabricated realtime claims — the session badge is clock-derived
// and the freshness line states the actual data timestamp.
//
// Run: node tools/render-newsroom-modules.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKER_KEY = 'generated:newsroom-modules';

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Market session awareness (UTC, clock-derived — never a data claim) ──────

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
    'weekend': 'Weekend desk — outlooks & macro features',
    'us-cash': 'US cash session',
    'us-premarket': 'US premarket',
    'europe': 'European session',
    'after-hours': 'US after-hours',
    'asia': 'Asia session',
  },
  ar: {
    'weekend': 'وضع نهاية الأسبوع — توقعات وتقارير ماكرو',
    'us-cash': 'الجلسة الأمريكية الرئيسية',
    'us-premarket': 'ما قبل الافتتاح الأمريكي',
    'europe': 'الجلسة الأوروبية',
    'after-hours': 'ما بعد الإغلاق الأمريكي',
    'asia': 'الجلسة الآسيوية',
  },
};

const DIM_LABELS = {
  en: {
    risk_state: 'Risk', volatility_regime: 'Volatility', dollar_pressure: 'Dollar',
    duration_pressure: 'Duration', momentum_concentration: 'Momentum',
    ai_concentration_risk: 'AI Concentration', breadth_state: 'Breadth',
    defensive_rotation: 'Defensive Rotation',
  },
  ar: {
    risk_state: 'المخاطر', volatility_regime: 'التقلب', dollar_pressure: 'الدولار',
    duration_pressure: 'حساسية الفائدة', momentum_concentration: 'الزخم',
    ai_concentration_risk: 'تركز الذكاء الاصطناعي', breadth_state: 'الاتساع',
    defensive_rotation: 'التناوب الدفاعي',
  },
};

const STATE_AR = {
  'risk_on': 'إقبال على المخاطر', 'risk_off': 'تجنب المخاطر', 'neutral': 'محايد',
  'compressed': 'منضغط', 'normal': 'طبيعي', 'elevated': 'مرتفع', 'stressed': 'مضغوط بشدة',
  'firming': 'يتقوى', 'easing': 'يتراجع', 'stable': 'مستقر',
  'building': 'يتصاعد', 'relaxing': 'ينحسر',
  'narrow-megacap': 'ضيق حول الكبرى', 'broadening': 'يتسع', 'balanced': 'متوازن',
  'contained': 'محتوى', 'deteriorating': 'يتدهور', 'confirming': 'مؤكِّد', 'mixed': 'متباين',
  'active': 'نشط', 'dormant': 'خامل', 'supportive': 'داعمة', 'tightening': 'متشددة',
  'rising': 'صاعد', 'falling': 'هابط', 'sideways': 'عرضي',
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

function renderSection(locale) {
  const ar = locale === 'ar';
  const pulse = readJson('data/intelligence/market-pulse.json', null);
  const wire = readJson('data/newswire/wire-events.json', { items: [], status: 'quiet' });
  const feed = readJson('data/feeds/newsroom-pulse.json', { modules: {} });
  const session = marketSession();
  const t = (en, arText) => (ar ? arText : en);

  const updatedAt = (pulse && pulse.updated_at) || (feed && feed.updated_at) || null;
  const updatedLabel = updatedAt ? new Date(updatedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : null;

  // Regime banner: verified pulse commentary only; quiet tone otherwise.
  const verified = Boolean(pulse && pulse.verified === true);
  const stressed = Boolean(pulse && pulse.dimensions && pulse.dimensions.volatility_regime === 'stressed');
  const banner = verified
    ? escapeHtml(pulse.pulse_banner)
    : t('Desk monitoring mode — regime inputs await the next sourced data cycle.',
        'وضع المراقبة — مؤشرات النظام بانتظار دورة البيانات الموثقة التالية.');
  const bannerTone = !verified ? 'quiet' : stressed ? 'alert' : 'info';

  // Pulse strip chips (always render labels; unverified values show as —).
  const dims = (pulse && pulse.dimensions) || {};
  const chips = Object.entries(DIM_LABELS[locale]).map(([key, label]) => {
    const value = dims[key] || 'unverified';
    return `<span class="nr-chip" data-state="${escapeHtml(value)}">${escapeHtml(label)}: <strong>${escapeHtml(stateLabel(value, ar))}</strong></span>`;
  }).join('\n            ');

  // Catalysts module.
  const catalysts = (pulse && pulse.catalysts_today) || [];
  const catalystItems = catalysts.length
    ? catalysts.map((c) => {
      const when = String(c.time || '').includes('T') ? String(c.time).slice(11, 16) + ' UTC' : escapeHtml(String(c.time || ''));
      return `<li><span class="nr-wire-headline">${escapeHtml(c.name)}</span><span class="nr-meta">${when}${c.assets && c.assets.length ? ' · ' + escapeHtml(c.assets.slice(0, 3).join(', ')) : ''}</span></li>`;
    }).join('\n              ')
    : `<li class="nr-empty">${t('No high-impact catalysts on the calendar window.', 'لا محفزات عالية التأثير في نافذة المفكرة الحالية.')}</li>`;

  // Wire module.
  const wireItems = (wire.items || []).slice(0, 5);
  const wireHtml = wireItems.length
    ? wireItems.map((item) => {
      const tier = urgencyTier(item.urgency);
      const badge = (CLUSTER_BADGES[locale][item.cluster]) || CLUSTER_BADGES[locale].macro;
      const ts = String(item.timestamp || '').slice(11, 16);
      return `<li><span class="nr-wire-headline"><span class="nr-badge" data-urgency="${tier}">${escapeHtml(badge)}</span> ${escapeHtml(item.headline)}</span><span class="nr-meta">${ts ? ts + ' UTC' : ''}</span></li>`;
    }).join('\n              ')
    : `<li class="nr-empty">${t('Wire quiet — no high-impact sourced events in the last 48 hours.', 'الموجز هادئ — لا أحداث موثقة عالية التأثير خلال 48 ساعة الماضية.')}</li>`;

  // Rotation module.
  const rotation = [
    [t('Breadth', 'الاتساع'), dims.breadth_state],
    [t('Defensive rotation', 'التناوب الدفاعي'), dims.defensive_rotation],
    [t('Momentum concentration', 'تركز الزخم'), dims.momentum_concentration],
    [t('Speculative appetite', 'شهية المضاربة'), dims.speculative_appetite],
  ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><span class="nr-meta">${escapeHtml(stateLabel(value || 'unverified', ar))}</span></li>`).join('\n              ');

  // Desk commentary lines (verified only).
  const commentary = verified
    ? (pulse.desk_commentary || []).map((line) => `<li><span class="nr-wire-headline">${escapeHtml(line)}</span></li>`).join('\n              ')
    : `<li class="nr-empty">${t('Desk commentary resumes with the next verified data cycle.', 'يستأنف تعليق المكتب مع دورة البيانات الموثقة التالية.')}</li>`;

  return `
      <section class="section section-tight" id="newsroom-live">
        <div class="section-panel newsroom" dir="${ar ? 'rtl' : 'ltr'}">
          <div class="newsroom-head">
            <h2 class="newsroom-title">${t('TradeAlphaAI Newsroom', 'غرفة أخبار TradeAlphaAI')}</h2>
            <span class="newsroom-session" data-session="${session}"><span class="nr-dot"></span>${escapeHtml(SESSION_LABELS[locale][session])}</span>
          </div>
          <p class="newsroom-banner" data-tone="${bannerTone}">${banner}</p>
          <div class="newsroom-pulse-strip">
            ${chips}
          </div>
          <div class="newsroom-grid">
            <div class="nr-module">
              <h3>${t('Live Newswire', 'الموجز المباشر')}</h3>
              <ul>
              ${wireHtml}
              </ul>
            </div>
            <div class="nr-module">
              <h3>${t('Key Catalysts', 'أبرز المحفزات')}</h3>
              <ul>
              ${catalystItems}
              </ul>
            </div>
            <div class="nr-module">
              <h3>${t('Rotation Signals', 'إشارات التناوب')}</h3>
              <ul>
              ${rotation}
              </ul>
            </div>
            <div class="nr-module">
              <h3>${t('Macro Desk Update', 'تحديث مكتب الماكرو')}</h3>
              <ul>
              ${commentary}
              </ul>
            </div>
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
  console.log(`[newsroom-render] injected newsroom modules into ${relPath}`);
  return true;
}

function main() {
  inject('index.html', renderSection('en'));
  inject('ar/index.html', renderSection('ar'));
}

if (require.main === module) main();

module.exports = { renderSection, marketSession };
