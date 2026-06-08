'use strict';

/**
 * Phase 70 Part C — Continuous Intelligence Article Generator
 * Generates bilingual EN/AR articles from intelligence signal candidates.
 *
 * Usage:
 *   node tools/generate-continuous-intelligence-article.js --slug=<slug>
 *   node tools/generate-continuous-intelligence-article.js  (auto-selects first planned topic)
 */

const fs   = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderStyles, globalHeaderScripts } = require('./render-global-header');

const ROOT = path.resolve(__dirname, '..');
const TODAY = new Date().toISOString().slice(0, 10);

const QUEUE_PATH      = path.join(ROOT, 'data', 'continuous-intelligence-queue.json');
const REGIME_V2_PATH  = path.join(ROOT, 'data', 'intelligence', 'regime-engine-v2.json');
const INTEL_CTX_PATH  = path.join(ROOT, 'data', 'intelligence', 'market-intelligence-context.json');
const CONTINUITY_PATH = path.join(ROOT, 'data', 'intelligence', 'narrative-continuity.json');
const HISTORY_PATH    = path.join(ROOT, 'data', 'intelligence', 'historical-memory.json');
const NARRATIVE_PATH  = path.join(ROOT, 'data', 'narrative-memory.json');
const TRANSMISSION_PATH = path.join(ROOT, 'data', 'intelligence', 'cross-asset-transmission.json');
const ETF_FLOW_PATH   = path.join(ROOT, 'data', 'intelligence', 'etf-flow-intelligence.json');
const RATE_PATH       = path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json');

function argValue(name) {
  const prefix = `${name}=`;
  const found  = process.argv.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pill(label) {
  const clean = String(label || 'unknown').replace(/_/g, ' ');
  const cls   = /risk.on|bullish|rising|steep/i.test(clean) ? 'intel-pill--bull' :
                /risk.off|bearish|falling|invert/i.test(clean) ? 'intel-pill--bear' : '';
  return `<span class="intel-pill ${cls}">${esc(clean)}</span>`;
}

function confBar(pct) {
  const p   = Math.max(0, Math.min(100, Number(pct) || 0));
  const cls = p >= 70 ? 'high' : p >= 45 ? 'medium' : 'low';
  return `<div class="intel-conf-bar" aria-label="Confidence ${p}%"><div class="intel-conf-fill intel-conf-fill--${cls}" style="width:${p}%"></div></div><span class="intel-conf-value">${p}%</span>`;
}

// ── Article section builders ──────────────────────────────────────────────────

function buildExecutiveSummary(topic, regimeV2, ar) {
  const cls      = regimeV2?.classifications || {};
  const tone     = cls.risk_appetite?.label   || 'neutral';
  const vol      = cls.volatility_regime?.label || 'uncertain';
  const rateLabel = cls.rate_path?.label       || 'uncertain';
  const avgConf  = topic.confidence || 0;

  const summaryEn = `This intelligence brief is generated from TradeAlphaAI's automated regime classification engine. The trigger signal is <strong>${esc(topic.trigger.replace(/_/g, ' '))}</strong>, classified under the <strong>${esc(topic.family.replace(/_/g, ' '))}</strong> intelligence family. Evidence confidence is <strong>${avgConf}%</strong>. Current market tone is ${esc(tone)}, volatility is ${esc(vol)}, and the rate path signal is ${esc(rateLabel)}.`;

  const summaryAr = `هذا الملخص الاستخباراتي مُولَّد من محرك تصنيف النظام الآلي في TradeAlphaAI. إشارة التشغيل هي <strong>${esc(topic.trigger.replace(/_/g, ' '))}</strong>، مصنَّفة ضمن عائلة الاستخبارات <strong>${esc(topic.family.replace(/_/g, ' '))}</strong>. ثقة الأدلة <strong>${avgConf}%</strong>. نبرة السوق الحالية ${esc(tone)}، التذبذب ${esc(vol)}، وإشارة مسار الفائدة ${esc(rateLabel)}.`;

  return `<section class="intel-section" id="executive-summary">
  <div class="intel-section-head">
    <span class="eyebrow">${ar ? 'الملخص التنفيذي' : 'Executive Intelligence Summary'}</span>
    <h2>${ar ? 'نظرة عامة على الإشارة' : 'Signal Overview'}</h2>
  </div>
  <div class="intel-panel">
    <div class="intel-meta-row">
      <span class="intel-label">${ar ? 'النظام' : 'Regime'}</span>${pill(tone)}
      <span class="intel-label">${ar ? 'التذبذب' : 'Volatility'}</span>${pill(vol)}
      <span class="intel-label">${ar ? 'الفائدة' : 'Rate Path'}</span>${pill(rateLabel)}
    </div>
    <div class="intel-conf-row">
      <span class="intel-label">${ar ? 'الثقة' : 'Evidence Confidence'}</span>
      ${confBar(avgConf)}
    </div>
    <p class="intel-body">${ar ? summaryAr : summaryEn}</p>
  </div>
</section>`;
}

function buildWhatChanged(topic, ar) {
  const evidence = (topic.evidence || []).slice(0, 4);
  const items = evidence.map(e => `<li class="intel-evidence-item"><span class="intel-evidence-icon" aria-hidden="true">▸</span>${esc(e)}</li>`).join('\n    ');

  const introEn = `The following evidence points motivated this intelligence signal. Each data point is derived from TradeAlphaAI's structural regime classification engine, not from fabricated or estimated figures.`;
  const introAr = `نقاط الأدلة التالية هي ما حرّك إشارة الاستخبارات هذه. كل نقطة بيانات مشتقة من محرك تصنيف النظام الهيكلي في TradeAlphaAI، وليست من أرقام مختلقة أو مُقدَّرة.`;

  return `<section class="intel-section" id="what-changed">
  <div class="intel-section-head">
    <span class="eyebrow">${ar ? 'ما الذي تغيّر' : 'What Changed'}</span>
    <h2>${ar ? 'أدلة الإشارة' : 'Signal Evidence'}</h2>
  </div>
  <div class="intel-panel">
    <p class="intel-body">${ar ? introAr : introEn}</p>
    <ul class="intel-evidence-list">
    ${items || `<li class="intel-evidence-item">${esc(ar ? 'إشارة نظام رُصدت بناءً على البيانات المتاحة' : 'Regime signal detected from available data')}</li>`}
    </ul>
  </div>
</section>`;
}

function buildEvidenceMap(topic, regimeV2, ar) {
  const cls = regimeV2?.classifications || {};
  const dims = [
    ['risk_appetite',    ar ? 'شهية المخاطرة'  : 'Risk Appetite'],
    ['volatility_regime',ar ? 'التذبذب'         : 'Volatility'],
    ['yield_curve',      ar ? 'منحنى العائد'    : 'Yield Curve'],
    ['rate_path',        ar ? 'مسار الفائدة'    : 'Rate Path'],
    ['inflation_regime', ar ? 'نظام التضخم'     : 'Inflation Regime'],
    ['growth_regime',    ar ? 'نظام النمو'       : 'Growth Regime'],
  ];

  const rows = dims.map(([key, label]) => {
    const d = cls[key];
    if (!d) return '';
    const conf = d.confidence || 0;
    return `<tr class="intel-map-row">
      <td class="intel-map-dim">${esc(label)}</td>
      <td class="intel-map-val">${pill(d.label)}</td>
      <td class="intel-map-conf">${confBar(conf)}</td>
      <td class="intel-map-note">${esc(ar ? (d.reason_ar || '') : (d.reason_en || '')).slice(0, 80)}</td>
    </tr>`;
  }).filter(Boolean).join('\n');

  return `<section class="intel-section" id="evidence-map">
  <div class="intel-section-head">
    <span class="eyebrow">${ar ? 'خريطة الأدلة' : 'Evidence Map'}</span>
    <h2>${ar ? 'التصنيفات عبر الأبعاد' : 'Cross-Dimension Classifications'}</h2>
  </div>
  <div class="intel-panel">
    <div class="intel-table-wrap">
      <table class="intel-map-table">
        <thead><tr>
          <th>${ar ? 'البُعد' : 'Dimension'}</th>
          <th>${ar ? 'التصنيف' : 'Classification'}</th>
          <th>${ar ? 'الثقة' : 'Confidence'}</th>
          <th>${ar ? 'السياق' : 'Context'}</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="4">${esc(ar ? 'البيانات غير كافية' : 'Insufficient data')}</td></tr>`}</tbody>
      </table>
    </div>
  </div>
</section>`;
}

function buildCrossAssetInterpretation(topic, transmission, etfFlow, ar) {
  const txSignals = (transmission?.transmission_signals || []).slice(0, 3);
  const etfNote   = etfFlow?.rotation_analysis;

  const txRows = txSignals.map(s =>
    `<li class="intel-tx-item"><strong>${esc(String(s.trigger).replace(/_/g, ' '))}</strong> → ${esc(s.channel)} <span class="intel-tx-chain">(${s.chain_length} ${ar ? 'خطوات' : 'steps'})</span></li>`
  ).join('\n    ');

  const introEn = 'The following transmission channels are active under current regime conditions. Each chain shows how an initial catalyst propagates across asset classes.';
  const introAr = 'قنوات الانتقال التالية نشطة في ظروف النظام الحالية. كل سلسلة تُظهر كيف ينتشر المحفز الأولي عبر فئات الأصول.';

  return `<section class="intel-section" id="cross-asset">
  <div class="intel-section-head">
    <span class="eyebrow">${ar ? 'تفسير الأصول المتقاطعة' : 'Cross-Asset Interpretation'}</span>
    <h2>${ar ? 'قنوات الانتقال النشطة' : 'Active Transmission Channels'}</h2>
  </div>
  <div class="intel-panel">
    <p class="intel-body">${ar ? introAr : introEn}</p>
    ${txRows ? `<ul class="intel-tx-list">${txRows}</ul>` : `<p class="intel-body intel-muted">${esc(ar ? 'لا توجد قنوات انتقال كافية متاحة حالياً' : 'No transmission channel data currently available')}</p>`}
    ${etfNote ? `<p class="intel-body intel-note"><strong>${ar ? 'ملاحظة دوران صناديق المؤشرات:' : 'ETF Rotation Note:'}</strong> ${esc(String(etfNote).slice(0, 120))}</p>` : ''}
  </div>
</section>`;
}

function buildRegimeImplication(topic, regimeV2, ar) {
  const cls     = regimeV2?.classifications || {};
  const summary = regimeV2?.summary || {};

  const headlineEn = summary.headline_en || 'Regime classification available from structural data only.';
  const headlineAr = summary.headline_ar || 'تصنيف النظام متاح من البيانات الهيكلية فقط.';

  const family = topic.family.replace(/_/g, ' ');

  const implicationEn = `Under a <strong>${esc(family)}</strong> regime signal, portfolio construction considerations typically include reviewing concentration exposure, monitoring cross-asset correlations, and assessing liquidity conditions. This analysis is educational and does not constitute investment advice.`;
  const implicationAr = `في ظل إشارة نظام <strong>${esc(family)}</strong>، تتضمن اعتبارات بناء المحفظة عادةً مراجعة تعرضات التركيز، ورصد الارتباطات بين الأصول، وتقييم ظروف السيولة. هذا التحليل تعليمي ولا يمثل نصيحة استثمارية.`;

  return `<section class="intel-section" id="regime-implication">
  <div class="intel-section-head">
    <span class="eyebrow">${ar ? 'انعكاس النظام' : 'Regime Implication'}</span>
    <h2>${ar ? 'السياق الهيكلي' : 'Structural Context'}</h2>
  </div>
  <div class="intel-panel">
    <p class="intel-body intel-headline-quote">${esc(ar ? headlineAr : headlineEn)}</p>
    <p class="intel-body">${ar ? implicationAr : implicationEn}</p>
  </div>
</section>`;
}

function buildHistoricalComparison(history, ar) {
  const snapshots = history?.snapshots || [];
  if (snapshots.length < 2) {
    const msg = ar ? 'بيانات تاريخية غير كافية حالياً. يُبنى السياق التاريخي تلقائياً مع اكتمال اللقطات.' :
                     'Insufficient historical data currently. Historical context builds automatically as snapshots accumulate.';
    return `<section class="intel-section" id="historical-comparison">
  <div class="intel-section-head">
    <span class="eyebrow">${ar ? 'المقارنة التاريخية' : 'Historical Comparison'}</span>
    <h2>${ar ? 'السياق التاريخي' : 'Historical Context'}</h2>
  </div>
  <div class="intel-panel"><p class="intel-body intel-muted">${esc(msg)}</p></div>
</section>`;
  }

  const latest   = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];

  const toneChanged = latest.market_tone !== previous.market_tone;
  const volChanged  = latest.volatility_state !== previous.volatility_state;
  const confDelta   = (latest.confidence || 0) - (previous.confidence || 0);

  const changeRows = [
    toneChanged ? `<tr><td>${ar ? 'نبرة السوق' : 'Market Tone'}</td><td>${pill(previous.market_tone)}</td><td>→</td><td>${pill(latest.market_tone)}</td></tr>` : '',
    volChanged  ? `<tr><td>${ar ? 'التذبذب' : 'Volatility'}</td><td>${pill(previous.volatility_state)}</td><td>→</td><td>${pill(latest.volatility_state)}</td></tr>` : '',
    `<tr><td>${ar ? 'الثقة' : 'Confidence'}</td><td>${previous.confidence || 0}%</td><td>${confDelta >= 0 ? '↑' : '↓'}</td><td>${latest.confidence || 0}%</td></tr>`,
  ].filter(Boolean).join('');

  return `<section class="intel-section" id="historical-comparison">
  <div class="intel-section-head">
    <span class="eyebrow">${ar ? 'المقارنة التاريخية' : 'Historical Comparison'}</span>
    <h2>${ar ? 'التغيير منذ اللقطة السابقة' : 'Change Since Last Snapshot'}</h2>
  </div>
  <div class="intel-panel">
    <p class="intel-body intel-muted">${ar ? `اللقطة السابقة: ${esc(previous.date)} · الأحدث: ${esc(latest.date)}` : `Previous snapshot: ${esc(previous.date)} · Latest: ${esc(latest.date)}`}</p>
    <div class="intel-table-wrap">
      <table class="intel-hist-table">
        <thead><tr><th>${ar ? 'البُعد' : 'Dimension'}</th><th>${ar ? 'السابق' : 'Previous'}</th><th></th><th>${ar ? 'الأحدث' : 'Latest'}</th></tr></thead>
        <tbody>${changeRows || `<tr><td colspan="4">${esc(ar ? 'لا تغييرات رُصدت' : 'No material changes detected')}</td></tr>`}</tbody>
      </table>
    </div>
    <p class="intel-replay-link">${ar ? 'عرض السجل الكامل:' : 'Full history:'} <a href="${ar ? '/ar/market-replay/' : '/market-replay/'}">${ar ? 'إعادة تشغيل السوق' : 'Market Replay'}</a></p>
  </div>
</section>`;
}

function buildScenarioFramework(topic, regimeV2, ar) {
  const cls    = regimeV2?.classifications || {};
  const family = topic.family;

  const scenarios = {
    en: [
      { label: 'Base Case', text: 'Current regime conditions persist. Intelligence signal resolves without material cross-asset disruption.' },
      { label: 'Upside Case', text: 'Signal resolves favorably — breadth improves, volatility compresses, or regime clarity increases.' },
      { label: 'Downside Case', text: 'Signal escalates — liquidity deteriorates, regime transitions accelerate, or cross-asset correlations break down.' },
    ],
    ar: [
      { label: 'السيناريو الأساسي', text: 'تستمر ظروف النظام الحالية. تتحل إشارة الاستخبارات دون اضطراب مادي عبر الأصول.' },
      { label: 'السيناريو الإيجابي', text: 'تتحل الإشارة بشكل إيجابي — يتحسن الاتساع، أو ينضغط التذبذب، أو يزداد وضوح النظام.' },
      { label: 'السيناريو السلبي', text: 'تتصاعد الإشارة — تتدهور السيولة، أو تتسارع انتقالات النظام، أو تنهار الارتباطات بين الأصول.' },
    ],
  };

  const items = (ar ? scenarios.ar : scenarios.en).map((s, i) => {
    const cls_suffix = i === 0 ? 'base' : i === 1 ? 'bull' : 'bear';
    return `<div class="intel-scenario intel-scenario--${cls_suffix}">
      <strong class="intel-scenario-label">${esc(s.label)}</strong>
      <p class="intel-scenario-text">${esc(s.text)}</p>
    </div>`;
  }).join('\n');

  return `<section class="intel-section" id="scenario-framework">
  <div class="intel-section-head">
    <span class="eyebrow">${ar ? 'إطار السيناريوهات' : 'Scenario Framework'}</span>
    <h2>${ar ? 'مسارات الدقة المحتملة' : 'Potential Resolution Paths'}</h2>
  </div>
  <div class="intel-panel">
    <div class="intel-scenarios-grid">${items}</div>
  </div>
</section>`;
}

function buildWhatToMonitor(topic, regimeV2, ar) {
  const monitors = {
    en: [
      'Breadth readings (advance/decline ratio, new 52-week highs/lows)',
      'Volatility term structure (VIX spot vs. futures curve)',
      'Credit spread widening (IG and HY spreads)',
      'Fed communications and rate expectations repricing',
      'Sector rotation patterns and leadership shifts',
      'Yield curve shape changes at key maturities',
    ],
    ar: [
      'قراءات الاتساع (نسبة التقدم/التراجع، مستويات 52 أسبوعاً الجديدة)',
      'هيكل مدة التذبذب (VIX الفوري مقابل منحنى العقود الآجلة)',
      'توسع فروق الائتمان (فروق درجة الاستثمار والعائد المرتفع)',
      'اتصالات الاحتياطي الفيدرالي وإعادة تسعير توقعات الفائدة)',
      'أنماط الدوران القطاعي وتحولات القيادة',
      'تغييرات شكل منحنى العائد عند الاستحقاقات الرئيسية',
    ],
  };

  const items = (ar ? monitors.ar : monitors.en)
    .map(m => `<li class="intel-monitor-item">${esc(m)}</li>`).join('\n    ');

  return `<section class="intel-section" id="what-to-monitor">
  <div class="intel-section-head">
    <span class="eyebrow">${ar ? 'ما يجب رصده' : 'What to Monitor'}</span>
    <h2>${ar ? 'المؤشرات الرئيسية للمتابعة' : 'Key Indicators to Track'}</h2>
  </div>
  <div class="intel-panel">
    <ul class="intel-monitor-list">${items}</ul>
    <p class="intel-replay-link">${ar ? 'تتبع تطور النظام في:' : 'Track regime evolution at:'} <a href="${ar ? '/ar/market-replay/' : '/market-replay/'}">${ar ? 'إعادة تشغيل السوق' : 'Market Replay'}</a> · <a href="${ar ? '/ar/market-dashboard/' : '/market-dashboard/'}">${ar ? 'لوحة السوق' : 'Market Dashboard'}</a></p>
  </div>
</section>`;
}

function buildDisclaimer(ar) {
  const textEn = 'This Market Intelligence article is educational commentary only. It is generated from TradeAlphaAI\'s automated regime classification engine using structural and macro data. No live pricing, earnings estimates, or analyst recommendations are incorporated. This content does not constitute financial, investment, or trading advice. Past regime conditions are not predictive of future outcomes. Always consult a qualified financial professional before making investment decisions.';
  const textAr = 'هذه المقالة الاستخباراتية للسوق هي تعليق تعليمي فقط. مُولَّدة من محرك التصنيف الآلي لـ TradeAlphaAI باستخدام بيانات هيكلية وكلية. لا تُدرج أسعار مباشرة أو تقديرات أرباح أو توصيات محللين. لا يمثل هذا المحتوى نصيحة مالية أو استثمارية أو تداولية. ظروف النظام السابقة ليست تنبؤية للنتائج المستقبلية. استشر دائماً متخصصاً مالياً مؤهلاً قبل اتخاذ قرارات الاستثمار.';
  return `<section class="intel-section intel-disclaimer-section" id="disclaimer">
  <div class="intel-panel">
    <span class="eyebrow">${ar ? 'إخلاء المسؤولية' : 'Educational Disclaimer'}</span>
    <p class="intel-disclaimer-text">${ar ? textAr : textEn}</p>
  </div>
</section>`;
}

// ── Full article HTML builder ─────────────────────────────────────────────────

function buildArticleHtml(topic, ar, regimeV2, intelCtx, continuity, history, transmission, etfFlow) {
  const locale     = ar ? 'ar' : 'en';
  const dir        = ar ? 'rtl' : 'ltr';
  const baseUrl    = 'https://www.tradealphaai.com';
  const enPath     = `/intelligence/${topic.slug}.html`;
  const arPath     = `/ar/intelligence/${topic.slug}.html`;
  const enUrl      = baseUrl + enPath;
  const arUrl      = baseUrl + arPath;
  const canonical  = ar ? arUrl : enUrl;
  const hreflangSelf  = ar ? arUrl : enUrl;
  const hreflangOther = ar ? enUrl : arUrl;

  const title      = ar ? topic.title_ar : topic.title_en;
  const descEn     = `TradeAlphaAI market intelligence analysis: ${topic.title_en}. Evidence-based regime classification and structural market analysis.`;
  const descAr     = `تحليل استخباراتي سوقي من TradeAlphaAI: ${topic.title_ar}. تصنيف النظام القائم على الأدلة والتحليل السوقي الهيكلي.`;
  const description = ar ? descAr : descEn;

  const headerHtml  = renderGlobalHeader({ locale, activePage: '', arabicHref: arPath, englishHref: enPath });
  const stylesHtml  = globalHeaderStyles();
  const scriptsHtml = globalHeaderScripts();

  const publishedDate = topic.target_publish_date || TODAY;

  // Sidebar sections
  const sidebarLinks = [
    ['executive-summary', ar ? 'الملخص التنفيذي' : 'Executive Summary'],
    ['what-changed',      ar ? 'ما الذي تغيّر'   : 'What Changed'],
    ['evidence-map',      ar ? 'خريطة الأدلة'     : 'Evidence Map'],
    ['cross-asset',       ar ? 'الأصول المتقاطعة'  : 'Cross-Asset'],
    ['regime-implication',ar ? 'انعكاس النظام'     : 'Regime Implication'],
    ['historical-comparison', ar ? 'المقارنة التاريخية' : 'Historical Comparison'],
    ['scenario-framework',ar ? 'إطار السيناريوهات' : 'Scenario Framework'],
    ['what-to-monitor',   ar ? 'ما يجب رصده'       : 'What to Monitor'],
  ];
  const sidebarHtml = sidebarLinks
    .map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`)
    .join('\n          ');

  const breadcrumbItems = ar
    ? [['الرئيسية', '/ar/'], ['ذكاء السوق', '/ar/intelligence/'], [title, '']]
    : [['Home', '/'], ['Market Intelligence', '/intelligence/'], [title, '']];
  const breadcrumbHtml = breadcrumbItems
    .map(([label, href]) => href ? `<a href="${href}">${label}</a>` : `<span>${label}</span>`)
    .join('<span>/</span>');

  const sections = [
    buildExecutiveSummary(topic, regimeV2, ar),
    buildWhatChanged(topic, ar),
    buildEvidenceMap(topic, regimeV2, ar),
    buildCrossAssetInterpretation(topic, transmission, etfFlow, ar),
    buildRegimeImplication(topic, regimeV2, ar),
    buildHistoricalComparison(history, ar),
    buildScenarioFramework(topic, regimeV2, ar),
    buildWhatToMonitor(topic, regimeV2, ar),
    buildDisclaimer(ar),
  ].join('\n\n');

  const familyLabel = String(topic.family || '').replace(/_/g, ' ');

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="index,follow" />
  <title>${esc(title)} | TradeAlphaAI</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="${locale}" href="${hreflangSelf}" />
  <link rel="alternate" hreflang="${ar ? 'en' : 'ar'}" href="${hreflangOther}" />
  ${stylesHtml}
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/visual-intelligence.css" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <meta name="article:published_time" content="${publishedDate}" />
  <meta name="article:section" content="Market Intelligence" />
</head>
<body class="market-page">
  ${headerHtml}

  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb">${breadcrumbHtml}</nav>

      <div class="market-article-layout">
        <article class="market-article-body">
          <header class="intel-article-header">
            <span class="intel-family-badge">${esc(ar ? 'استخبارات السوق' : 'Market Intelligence')} · ${esc(familyLabel)}</span>
            <h1 class="intel-article-title">${esc(title)}</h1>
            <div class="intel-article-meta">
              <time datetime="${publishedDate}">${publishedDate}</time>
              <span class="intel-conf-badge">${ar ? 'ثقة' : 'Confidence'}: ${topic.confidence || 0}%</span>
              <span class="intel-dq-badge">${ar ? 'جودة البيانات' : 'Data Quality'}: ${esc(topic.data_quality || 'structural')}</span>
            </div>
            <p class="intel-article-lead">${esc(ar ? topic.title_ar : topic.title_en)}</p>
          </header>

          ${sections}
        </article>

        <aside class="market-article-sidebar">
          <div class="intel-toc">
            <strong class="intel-toc-title">${ar ? 'الأقسام' : 'Sections'}</strong>
            <ul class="intel-toc-list">
          ${sidebarHtml}
            </ul>
          </div>
          <div class="intel-sidebar-links">
            <a class="intel-sidebar-link" href="${ar ? '/ar/market-replay/' : '/market-replay/'}">${ar ? '↗ إعادة تشغيل السوق' : '↗ Market Replay'}</a>
            <a class="intel-sidebar-link" href="${ar ? '/ar/market-dashboard/' : '/market-dashboard/'}">${ar ? '↗ لوحة السوق' : '↗ Market Dashboard'}</a>
            <a class="intel-sidebar-link" href="${ar ? '/ar/market-outlook/' : '/market-outlook/'}">${ar ? '↗ توقعات السوق' : '↗ Market Outlook'}</a>
          </div>
        </aside>
      </div>
    </div>
  </main>

  <footer class="site-footer"><div class="wrap site-footer-inner"><div><strong>TradeAlphaAI</strong><p>${ar ? 'أبحاث مالية تعليمية غير استشارية.' : 'Educational, non-advisory financial research.'}</p></div><nav aria-label="${ar ? 'روابط التذييل' : 'Footer navigation'}"><a href="${ar ? '/ar/insights/' : '/insights/'}">${ar ? 'مقالات' : 'Insights'}</a><a href="${ar ? '/ar/market-outlook/' : '/market-outlook/'}">${ar ? 'توقعات السوق' : 'Market Outlook'}</a><a href="${ar ? '/ar/intelligence/' : '/intelligence/'}">${ar ? 'ذكاء السوق' : 'Market Intelligence'}</a><a href="${ar ? '/ar/market-replay/' : '/market-replay/'}">${ar ? 'إعادة تشغيل السوق' : 'Market Replay'}</a><a href="${ar ? '/ar/methodology.html' : '/methodology.html'}">${ar ? 'المنهجية' : 'Methodology'}</a></nav><small>&copy; 2026 TradeAlphaAI</small></div></footer>

  <script src="/js/language-router.js" defer></script>
  ${scriptsHtml}
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const slugArg    = argValue('--slug');
  const regimeV2   = readJson(REGIME_V2_PATH, null);
  const intelCtx   = readJson(INTEL_CTX_PATH, null);
  const continuity = readJson(CONTINUITY_PATH, null);
  const history    = readJson(HISTORY_PATH, null);
  const transmission = readJson(TRANSMISSION_PATH, null);
  const etfFlow    = readJson(ETF_FLOW_PATH, null);
  const ratePath   = readJson(RATE_PATH, null);

  const queue      = readJson(QUEUE_PATH, { topics: [] });
  const topics     = queue.topics || [];

  let topic;
  if (slugArg) {
    topic = topics.find(t => t.slug === slugArg);
    if (!topic) {
      console.error(`[continuous-intelligence-article] Topic not found in queue: ${slugArg}`);
      process.exit(1);
    }
  } else {
    // Auto-select first planned/queued topic
    topic = topics.find(t => ['planned', 'queued', 'draft'].includes(t.status));
    if (!topic) {
      console.log('[continuous-intelligence-article] No planned topics in queue — nothing to generate.');
      process.exit(0);
    }
  }

  console.log(`[continuous-intelligence-article] Generating: ${topic.slug}`);

  const draftDir = path.join(ROOT, 'drafts', 'continuous-intelligence', topic.slug);
  fs.mkdirSync(draftDir, { recursive: true });

  // Generate EN + AR
  const enHtml = buildArticleHtml(topic, false, regimeV2, intelCtx, continuity, history, transmission, etfFlow);
  const arHtml = buildArticleHtml(topic, true,  regimeV2, intelCtx, continuity, history, transmission, etfFlow);

  fs.writeFileSync(path.join(draftDir, 'en.html'), enHtml, 'utf8');
  fs.writeFileSync(path.join(draftDir, 'ar.html'), arHtml, 'utf8');

  // Write metadata
  const meta = {
    slug:               topic.slug,
    content_type:       'continuous-intelligence',
    title_en:           topic.title_en,
    title_ar:           topic.title_ar,
    family:             topic.family,
    trigger:            topic.trigger,
    confidence:         topic.confidence,
    data_quality:       topic.data_quality,
    generated_at:       new Date().toISOString(),
    target_publish_date: topic.target_publish_date,
    overflow_generated: topic.overflow_generated,
  };
  fs.writeFileSync(path.join(draftDir, 'metadata.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  // Update queue status to 'in_review'
  const queueRaw = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  const t = (queueRaw.topics || []).find(t => t.slug === topic.slug);
  if (t) {
    t.status    = 'in_review';
    t.draft_generated_at = new Date().toISOString();
    queueRaw.updated = new Date().toISOString();
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queueRaw, null, 2) + '\n', 'utf8');
  }

  console.log(`[continuous-intelligence-article] Written drafts/continuous-intelligence/${topic.slug}/en.html`);
  console.log(`[continuous-intelligence-article] Written drafts/continuous-intelligence/${topic.slug}/ar.html`);
  console.log(`[continuous-intelligence-article] Written drafts/continuous-intelligence/${topic.slug}/metadata.json`);
}

main();
