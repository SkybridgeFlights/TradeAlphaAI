'use strict';

/**
 * update-market-intelligence-status.js
 *
 * Reads market intelligence context and narrative memory, then:
 *   1. Writes data/system-status/market-intelligence-status.json
 *   2. Injects intelligence widget HTML into index.html and ar/index.html
 *      between <!-- generated:intelligence-widget:start/end --> markers.
 *
 * Run: node tools/update-market-intelligence-status.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const CONTEXT_PATH  = path.join(ROOT, 'data', 'intelligence', 'market-intelligence-context.json');
const MEMORY_PATH   = path.join(ROOT, 'data', 'narrative-memory.json');
const REGIME_PATH   = path.join(ROOT, 'data', 'market-regime-state.json');
const STATUS_DIR    = path.join(ROOT, 'data', 'system-status');
const STATUS_PATH   = path.join(STATUS_DIR, 'market-intelligence-status.json');

const MARKER_KEY    = 'generated:intelligence-widget';

main();

function main() {
  const context = readJson(CONTEXT_PATH, null);
  const memory  = readJson(MEMORY_PATH,  { snapshots: [], latest_snapshot: null });
  const regime  = readJson(REGIME_PATH,  {});

  const status  = buildStatus(context, memory, regime);

  fs.mkdirSync(STATUS_DIR, { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2) + '\n', 'utf8');
  console.log(`[update-market-intelligence-status] Wrote ${path.relative(ROOT, STATUS_PATH)}`);

  injectWidgets('index.html',    renderWidgetHtml(status, 'en'));
  injectWidgets('ar/index.html', renderWidgetHtml(status, 'ar'));
}

// ── Status builder ─────────────────────────────────────────────────────────────

function buildStatus(context, memory, regime) {
  const latest    = memory.latest_snapshot || (memory.snapshots || []).slice(-1)[0] || {};
  const breadth   = (context && context.breadth) || {};
  const macro     = (context && context.macro)   || {};
  const crossAsset= (context && context.cross_asset) || {};
  const saturation= (context && context.narrative_saturation) || {};

  const vixLevel  = crossAsset.vix ? crossAsset.vix.level : null;
  const vixRegime = crossAsset.vix ? crossAsset.vix.regime : 'unverified';

  const marketToneLabel   = resolveMarketTone(latest, regime);
  const sectorLeadership  = resolveSectorLeadership(latest, regime);
  const aiNarrative       = resolveAiNarrative(latest, context);

  return {
    generated_at: new Date().toISOString(),
    data_quality: (context && context.data_quality) || 'structural',
    market_tone: {
      label:    marketToneLabel,
      label_ar: toneAr(marketToneLabel),
      color:    toneColor(marketToneLabel),
    },
    volatility_regime: {
      label:       vixRegime,
      label_ar:    volatilityRegimeAr(vixRegime),
      vix_level:   vixLevel,
      description: volatilityDescription(vixRegime),
      description_ar: volatilityDescriptionAr(vixRegime),
    },
    breadth_condition: {
      label:          breadth.breadth_quality || 'unverified',
      label_ar:       breadthAr(breadth.breadth_quality || 'unverified'),
      participation:  breadth.sector_participation_score,
      concentration:  breadth.concentration_risk || 'unverified',
      rotation:       breadth.sector_rotation || 'unverified',
      rotation_ar:    rotationAr(breadth.sector_rotation || 'unverified'),
    },
    ai_infrastructure: {
      status:      aiNarrative.status,
      status_ar:   aiNarrative.status_ar,
      summary:     aiNarrative.summary,
      summary_ar:  aiNarrative.summary_ar,
    },
    yield_curve: {
      state:       macro.yield_curve_state || 'unverified',
      state_ar:    yieldCurveAr(macro.yield_curve_state || 'unverified'),
      spread_bps:  macro.yield_spread_bps,
      us10y:       macro.us10y_yield,
    },
    sector_leadership: {
      leaders:    sectorLeadership.leaders,
      leaders_ar: sectorLeadership.leaders_ar,
      rotation:   sectorLeadership.rotation,
    },
    narrative_saturation: {
      rotation_recommended: saturation.rotation_recommended || false,
      current_dominant:     saturation.current_dominant || null,
    },
  };
}

// ── Resolvers ─────────────────────────────────────────────────────────────────

function resolveMarketTone(snapshot, regime) {
  const label = snapshot.directional_bias
    || snapshot.dominant_risk_regime
    || (regime.state && regime.state.growth_value_bias)
    || 'unverified';
  // Normalize to known tones
  if (/bull|construct|growth|positive/i.test(label)) return 'constructive';
  if (/bear|risk.off|defensive|negative/i.test(label)) return 'defensive';
  if (/cautious|mixed|transition/i.test(label)) return 'cautious';
  if (/volat/i.test(label)) return 'volatile';
  if (/unverif/i.test(label)) return 'unverified';
  return label;
}

function resolveSectorLeadership(snapshot, regime) {
  const leaders = snapshot.sector_leadership || [];
  const internal = snapshot.advanced_internals || {};
  const derived  = [];

  if (internal.ai_semiconductor_participation === 'improving') derived.push('Technology', 'Semiconductors');
  if (internal.defensive_participation === 'improving')         derived.push('Utilities', 'Healthcare');
  if (internal.cyclical_participation   === 'improving')        derived.push('Industrials', 'Financials');

  const all = [...new Set([...leaders, ...derived])].slice(0, 4);

  const AR_SECTOR_MAP = {
    Technology:    'التكنولوجيا',
    Semiconductors:'أشباه الموصلات',
    Utilities:     'المرافق',
    Healthcare:    'الرعاية الصحية',
    Industrials:   'الصناعات',
    Financials:    'الخدمات المالية',
    Energy:        'الطاقة',
    'Real Estate': 'العقارات',
  };

  return {
    leaders:    all.length ? all : ['unverified'],
    leaders_ar: all.map((s) => AR_SECTOR_MAP[s] || s),
    rotation:   snapshot.advanced_internals ? deriveRotationType(internal) : 'unverified',
  };
}

function deriveRotationType(internals) {
  if (internals.defensive_participation === 'improving') return 'defensive-rotation';
  if (internals.ai_semiconductor_participation === 'improving' && internals.cyclical_participation === 'improving') return 'broad-growth';
  if (internals.ai_semiconductor_participation === 'improving') return 'growth-leadership';
  return 'mixed';
}

function resolveAiNarrative(snapshot, context) {
  const internals = (snapshot.advanced_internals) || {};
  const ai = internals.ai_semiconductor_participation || 'unverified';

  const statusMap = {
    improving:    { en: 'Active expansion', ar: 'توسع نشط' },
    stable:       { en: 'Holding leadership', ar: 'استمرار القيادة' },
    deteriorating:{ en: 'Narrowing', ar: 'تضيّق' },
    unverified:   { en: 'Unconfirmed', ar: 'غير مؤكد' },
  };

  const s = statusMap[ai] || statusMap.unverified;

  const guidance = context && context.generation_guidance;
  const seqNote  = guidance && guidance.emphasize_sequence
    ? `Active sequence: ${guidance.emphasize_sequence}.`
    : '';

  return {
    status:    s.en,
    status_ar: s.ar,
    summary:   seqNote || 'AI infrastructure themes remain tied to earnings visibility and supply-chain capacity.',
    summary_ar: seqNote
      ? `تسلسل نشط: ${guidance.emphasize_sequence}.`
      : 'تظل موضوعات البنية التحتية للذكاء الاصطناعي مرتبطة بوضوح الأرباح وطاقة سلاسل التوريد.',
  };
}

// ── Widget HTML renderer ───────────────────────────────────────────────────────

function renderWidgetHtml(status, locale) {
  const ar = locale === 'ar';

  const heading   = ar ? 'حالة الذكاء السوقي' : 'Market Intelligence Status';
  const eyebrow   = ar ? 'تحليل مباشر' : 'Live Analysis';
  const subtext   = ar
    ? 'مؤشرات السوق الكلي المستخرجة من نظام الذكاء التحليلي. للأغراض التعليمية فقط.'
    : 'Macro market indicators derived from the intelligence framework. Educational only.';

  const widgets = [
    widgetCard({
      ar,
      icon:    '&#x25CB;',
      label:   ar ? 'نبرة السوق' : 'Market Tone',
      value:   ar ? status.market_tone.label_ar : status.market_tone.label,
      color:   status.market_tone.color,
    }),
    widgetCard({
      ar,
      icon:    '&#x2248;',
      label:   ar ? 'نظام التقلب' : 'Volatility Regime',
      value:   ar ? status.volatility_regime.label_ar : status.volatility_regime.label,
      sub:     status.volatility_regime.vix_level ? `VIX ${status.volatility_regime.vix_level.toFixed(1)}` : '',
    }),
    widgetCard({
      ar,
      icon:    '&#x25A6;',
      label:   ar ? 'اتساع السوق' : 'Breadth Condition',
      value:   ar ? status.breadth_condition.label_ar : status.breadth_condition.label,
      sub:     ar ? status.breadth_condition.rotation_ar : status.breadth_condition.rotation,
    }),
    widgetCard({
      ar,
      icon:    '&#x2B1A;',
      label:   ar ? 'بنية تحتية للذكاء الاصطناعي' : 'AI Infrastructure',
      value:   ar ? status.ai_infrastructure.status_ar : status.ai_infrastructure.status,
    }),
    widgetCard({
      ar,
      icon:    '&#x25B3;',
      label:   ar ? 'منحنى العائد' : 'Yield Curve',
      value:   ar ? status.yield_curve.state_ar : status.yield_curve.state,
      sub:     status.yield_curve.spread_bps !== null ? `${status.yield_curve.spread_bps}bps` : '',
    }),
    widgetCard({
      ar,
      icon:    '&#x25CF;',
      label:   ar ? 'قيادة القطاعات' : 'Sector Leadership',
      value:   (ar ? status.sector_leadership.leaders_ar : status.sector_leadership.leaders).join(' · '),
    }),
  ];

  return `<!-- ${MARKER_KEY}:start -->
      <section class="section section-tight" id="market-intelligence-status">
        <div class="section-panel">
          <div class="section-head">
            <span class="eyebrow">${eyebrow}</span>
            <h2>${heading}</h2>
            <p class="market-copy">${subtext}</p>
          </div>
          <div class="intel-widget-grid">
            ${widgets.join('\n            ')}
          </div>
        </div>
      </section>
<!-- ${MARKER_KEY}:end -->`;
}

function widgetCard({ ar, icon, label, value, sub, color }) {
  const colorClass = color ? ` data-tone="${escHtml(color)}"` : '';
  const subHtml = sub ? `<span class="intel-widget-sub">${escHtml(sub)}</span>` : '';
  return `<div class="intel-widget-card"${colorClass}>
              <span class="intel-widget-icon" aria-hidden="true">${icon}</span>
              <span class="intel-widget-label">${escHtml(label)}</span>
              <strong class="intel-widget-value">${escHtml(value)}</strong>
              ${subHtml}
            </div>`;
}

// ── Listing page injection ─────────────────────────────────────────────────────

function injectWidgets(rel, html) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.warn(`[update-market-intelligence-status] Not found: ${rel}`);
    return;
  }

  let page = fs.readFileSync(file, 'utf8');
  const start = `<!-- ${MARKER_KEY}:start -->`;
  const end   = `<!-- ${MARKER_KEY}:end -->`;

  if (!page.includes(start)) {
    console.warn(`[update-market-intelligence-status] No ${MARKER_KEY} markers in ${rel} — skipping`);
    return;
  }

  const startIdx = page.indexOf(start);
  const endIdx   = page.indexOf(end) + end.length;
  page = page.slice(0, startIdx) + html + page.slice(endIdx);

  fs.writeFileSync(file, page, 'utf8');
  console.log(`[update-market-intelligence-status] Updated ${rel}`);
}

// ── Arabic translations ────────────────────────────────────────────────────────

function toneAr(label) {
  const map = {
    constructive: 'بناءة', cautious: 'حذرة', defensive: 'دفاعية',
    volatile: 'متقلبة', unverified: 'غير مؤكدة',
  };
  return map[label] || label;
}

function toneColor(label) {
  const map = {
    constructive: 'green', cautious: 'amber', defensive: 'red',
    volatile: 'orange', unverified: 'gray',
  };
  return map[label] || 'gray';
}

function volatilityRegimeAr(label) {
  const map = {
    complacency: 'انعدام الحذر', calm: 'هادئ', elevated: 'مرتفع',
    high: 'عالٍ', extreme: 'متطرف', unverified: 'غير مؤكد',
  };
  return map[label] || label;
}

function volatilityDescription(label) {
  const map = {
    complacency: 'Unusually low volatility; hidden risk may be underpriced.',
    calm:        'Below-average volatility; orderly market conditions.',
    elevated:    'Above-average volatility; event sensitivity elevated.',
    high:        'Significantly elevated; risk appetite compressed.',
    extreme:     'Extreme volatility; crisis conditions.',
    unverified:  'Volatility data unavailable.',
  };
  return map[label] || '';
}

function volatilityDescriptionAr(label) {
  const map = {
    complacency: 'تقلب منخفض بشكل غير اعتيادي؛ قد تكون المخاطر الكامنة مُقيَّمة بأقل من قيمتها.',
    calm:        'تقلب دون المتوسط؛ ظروف سوق منظمة.',
    elevated:    'تقلب فوق المتوسط؛ حساسية مرتفعة للأحداث.',
    high:        'تقلب مرتفع بشكل ملحوظ؛ شهية المخاطرة منخفضة.',
    extreme:     'تقلب متطرف؛ ظروف أزمة.',
    unverified:  'بيانات التقلب غير متاحة.',
  };
  return map[label] || '';
}

function breadthAr(label) {
  const map = {
    broad:       'اتساع واسع', moderate: 'اتساع معتدل',
    narrow:      'اتساع ضيق', 'very-narrow': 'اتساع ضيق جداً',
    unverified:  'غير مؤكد',
  };
  return map[label] || label;
}

function rotationAr(label) {
  const map = {
    'defensive-rotation': 'تناوب دفاعي', 'growth-leadership': 'قيادة نمو',
    'broad-growth': 'نمو واسع', mixed: 'مختلط', unverified: 'غير مؤكد',
  };
  return map[label] || label;
}

function yieldCurveAr(label) {
  const map = {
    steep: 'منحدر', normal: 'طبيعي', flat: 'مسطح',
    inverted: 'مقلوب', unverified: 'غير مؤكد',
  };
  return map[label] || label;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
