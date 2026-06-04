'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { generateIntelligence } = require('./generate-market-intelligence.js');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');
const ECONOMIC_CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const REGIME_PATH = path.join(ROOT, 'data', 'market-regime-state.json');
const MEMORY_PATH = path.join(ROOT, 'data', 'topic-memory.json');
const LIVE_MARKET_PATH = path.join(ROOT, 'data', 'live-market-state.json');
const OUT_DIR = path.join(ROOT, 'drafts', 'market-outlook');
const SITE_URL = 'https://www.tradealphaai.com';
const ELIGIBLE = new Set(['planned', 'draft']);
const DISCLAIMER_EN = 'This analysis is educational market commentary only. It is not investment advice, financial advice, or a recommendation to buy or sell any asset. Market conditions can change rapidly and uncertainty remains present.';
const DISCLAIMER_AR = 'هذا التحليل عبارة عن تعليق تعليمي حول الأسواق المالية فقط، ولا يُعتبر نصيحة استثمارية أو مالية أو توصية شراء أو بيع لأي أصل مالي. قد تتغير ظروف السوق بسرعة وتبقى حالة عدم اليقين قائمة.';

const slugArg = argValue('--slug');
const overwrite = process.argv.includes('--overwrite');
const queue = readJson(QUEUE_PATH, { topics: [] });
const calendar = readJson(ECONOMIC_CALENDAR_PATH, { events: [] });
const regime = readJson(REGIME_PATH, {});
const memory = readJson(MEMORY_PATH, { recent_topics: [] });
const liveMarket = readJson(LIVE_MARKET_PATH, { metadata: { status: 'fallback' } });

const topic = slugArg
  ? (queue.topics || []).find((item) => item.slug === slugArg)
  : (queue.topics || []).find((item) => ELIGIBLE.has(item.status) && !isCoolingDown(item));

if (!topic) {
  console.log('No market outlook draft topic available');
  process.exit(0);
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug || '')) fail('Market outlook topic has malformed slug');

const dir = path.join(OUT_DIR, topic.slug);
const enDraft = path.join(dir, 'en.html');
const arDraft = path.join(dir, 'ar.html');
if (!overwrite && (fs.existsSync(enDraft) || fs.existsSync(arDraft))) fail(`${topic.slug}: draft already exists`);

const normalized = normalizeTopic(topic);
const intelligence = generateIntelligence(liveMarket, calendar, regime, normalized.topic_cluster);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(enDraft, render(normalized, 'en', intelligence), 'utf8');
fs.writeFileSync(arDraft, render(normalized, 'ar', intelligence), 'utf8');
fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
  slug: topic.slug,
  content_type: 'market_outlook',
  status: 'in_review',
  review_status: 'pending',
  generated_at: new Date().toISOString(),
  quality_score_required: 90,
  live_market_status: intelligence.data_completeness,
  confidence: intelligence.confidence,
  event_context_used: intelligence.upcoming_events.slice(0, 3).map((event) => ({ name: event.name, date: event.date, source_url: event.source_url })),
  auto_publish: false,
  telegram_ready: false,
  public_site_updated: false,
  languages: ['en', 'ar']
}, null, 2) + '\n', 'utf8');

if (!['published', 'reviewed'].includes(topic.status)) {
  topic.status = 'in_review';
  topic.review_status = 'pending';
}
topic.revision_count = Number.isInteger(topic.revision_count) ? topic.revision_count : 0;
topic.last_reviewed = topic.last_reviewed || null;
topic.event_tags = unique([...(topic.event_tags || []), ...intelligence.upcoming_events.map((event) => event.type)]);
topic.regime_tags = regimeTags();
topic.confidence_label = intelligence.confidence.label;
queue.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

console.log(`Generated market outlook draft: drafts/market-outlook/${topic.slug}`);
console.log(`Confidence: ${intelligence.confidence.label}`);
console.log(`Data completeness: ${intelligence.data_completeness}`);

if (attemptAutoApproval(topic, topic.slug)) {
  console.log(`${topic.slug}: auto-approved after score >= 90 and all required checks passed.`);
} else {
  console.log(`${topic.slug}: requires manual review.`);
}

function render(topic, locale, intel) {
  const labelSets = getLabels();
  const ar = locale === 'ar';
  const title = ar ? topic.title_ar : topic.title_en;
  const summary = ar ? topic.summary_ar : topic.summary_en;
  const disclaimer = ar ? DISCLAIMER_AR : DISCLAIMER_EN;
  const enUrl = `${SITE_URL}/market-outlook/${topic.slug}.html`;
  const arUrl = `${SITE_URL}/ar/market-outlook/${topic.slug}.html`;
  const canonical = ar ? arUrl : enUrl;
  const pathPrefix = ar ? '../../' : '../';
  const n = intel.narratives;
  const scenarioCards = intel.scenarios.slice(0, 3).map((scenario) => marketCard(ar ? scenario.ar : scenario.en)).join('\n');
  const riskCards = (ar ? labelSets.ar.risks : labelSets.en.risks).map(marketCard).join('\n');
  const driverCards = [
    [ar ? labelSets.ar.macroBackdrop : labelSets.en.macroBackdrop, ar ? n.macro_pressure.ar : n.macro_pressure.en],
    [ar ? labelSets.ar.sectorContext : labelSets.en.sectorContext, ar ? n.sector_narrative.ar : n.sector_narrative.en],
    [ar ? labelSets.ar.etfContext : labelSets.en.etfContext, ar ? n.etf_rotation.ar : n.etf_rotation.en]
  ].map(([heading, text]) => marketCard(text, heading)).join('\n');
  const watchItems = (ar ? labelSets.ar.watch : labelSets.en.watch).map((item) => `              <li>${escapeHtml(item)}</li>`).join('\n');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: summary,
    inLanguage: locale,
    author: { '@type': 'Organization', name: 'TradeAlphaAI' },
    publisher: { '@type': 'Organization', name: 'TradeAlphaAI' },
    mainEntityOfPage: canonical,
    about: unique([topic.topic_cluster, ...(topic.event_tags || []), ...regimeTags()]).filter(Boolean)
  };
  const L = ar ? labelSets.ar : labelSets.en;
  const nav = ar ? renderArNav(topic.slug) : renderEnNav(topic.slug);
  const breadcrumb = ar
    ? `<nav class="breadcrumb"><a href="/ar/">الرئيسية</a><span>/</span><a href="/ar/market-outlook/">توقعات السوق</a><span>/</span><span>${escapeHtml(title)}</span></nav>`
    : `<nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/market-outlook/">Market Outlook</a><span>/</span><span>${escapeHtml(title)}</span></nav>`;

  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="index,follow" />
  <title>${escapeHtml(title)} | TradeAlphaAI Market Outlook</title>
  <meta name="description" content="${escapeHtml(summary)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${enUrl}" />
  <link rel="alternate" hreflang="ar" href="${arUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(summary)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${SITE_URL}/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(summary)}" />
  <link rel="stylesheet" href="${pathPrefix}styles.css" />
  <link rel="stylesheet" href="${pathPrefix}landing.css" />
  <link rel="stylesheet" href="${pathPrefix}css/market/market-portal.css" />
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body class="market-page">
  ${nav}
  <main class="market-shell">
    <div class="wrap">
      ${breadcrumb}
      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${escapeHtml(L.label)}</span>
          <h1>${escapeHtml(title)}</h1>
          <p class="market-lead">${escapeHtml(summary)}</p>
          <div class="market-actions">
            <span class="market-btn">${escapeHtml(L.tone)}: ${escapeHtml(ar ? confidenceAr(intel.confidence.label) : intel.confidence.label)}</span>
            <span class="market-btn">${escapeHtml(L.uncertainty)}: ${escapeHtml(ar ? uncertaintyAr(intel.confidence.uncertainty_label) : intel.confidence.uncertainty_label)}</span>
          </div>
        </div>
      </section>

      <section class="market-section" id="disclaimer-block">
        <div class="market-panel">
          <span class="eyebrow">${escapeHtml(L.disclaimerTitle)}</span>
          <p class="market-copy educational-disclaimer">${escapeHtml(disclaimer)}</p>
        </div>
      </section>

      <section class="market-section" id="market-narrative">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.executiveSummary)}</span><h2>${escapeHtml(L.executiveSummary)}</h2></div>
        <div class="market-panel"><p class="market-copy">${escapeHtml(ar ? n.market_narrative.ar : n.market_narrative.en)}</p></div>
      </section>

      <section class="market-section" id="volatility-context">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.marketTone)}</span><h2>${escapeHtml(L.marketTone)}</h2></div>
        <div class="market-panel">
          <p class="market-copy"><strong>${escapeHtml(L.tone)}:</strong> ${escapeHtml(ar ? confidenceAr(intel.confidence.label) : intel.confidence.label)}</p>
          <p class="market-copy">${escapeHtml(ar ? n.volatility_interpretation.ar : n.volatility_interpretation.en)}</p>
        </div>
      </section>

      <section class="market-section" id="key-drivers">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.keyDrivers)}</span><h2>${escapeHtml(L.keyDrivers)}</h2></div>
        <div class="market-grid three">
${driverCards}
        </div>
      </section>

      <section class="market-section" id="scenario-outlook">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.scenarioOutlook)}</span><h2>${escapeHtml(L.scenarioOutlook)}</h2><p class="market-copy">${escapeHtml(L.scenarioNote)}</p></div>
        <div class="market-grid three">
${scenarioCards}
        </div>
      </section>

      <section class="market-section" id="risk-factors">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.riskFactorsTitle)}</span><h2>${escapeHtml(L.riskFactorsTitle)}</h2></div>
        <div class="market-grid three">
${riskCards}
        </div>
      </section>

      <section class="market-section" id="watch-next">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.watchNextTitle)}</span><h2>${escapeHtml(L.watchNextTitle)}</h2></div>
        <div class="market-panel"><ul class="market-copy">
${watchItems}
        </ul></div>
      </section>

      <section class="market-section" id="related-research">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.relatedTitle)}</span><h2>${escapeHtml(L.relatedTitle)}</h2></div>
        <div class="market-grid three">
${relatedCards(ar)}
        </div>
      </section>

      <section class="market-section" id="footer-disclaimer">
        <div class="market-panel">
          <span class="eyebrow">${escapeHtml(L.educationalDisclaimer)}</span>
          <p class="market-copy educational-disclaimer">${escapeHtml(disclaimer)}</p>
          <p class="market-copy">${escapeHtml(L.footerNote)}</p>
        </div>
      </section>
    </div>
  </main>
  <script src="${pathPrefix}js/language-router.js" defer></script>
  <script src="${pathPrefix}js/mobile-nav.js" defer></script>
</body>
</html>
`;

  function marketCard(text, heading = '') {
    return `          <article class="market-card">${heading ? `<span class="market-card-kicker">${escapeHtml(heading)}</span>` : ''}<p class="market-copy">${escapeHtml(text)}</p></article>`;
  }
}

function getLabels() {
  return {
  en: {
    label: 'Educational market commentary',
    tone: 'Market tone',
    uncertainty: 'Uncertainty',
    disclaimerTitle: 'Educational Disclaimer',
    executiveSummary: 'Executive Summary',
    marketTone: 'Market Tone',
    keyDrivers: 'Key Drivers',
    macroBackdrop: 'Macro Backdrop',
    sectorContext: 'Sector Context',
    etfContext: 'ETF Rotation Context',
    scenarioOutlook: 'Scenario Outlook',
    scenarioNote: 'The scenarios below are conditional educational frameworks. They are not predictions or investment recommendations.',
    riskFactorsTitle: 'Risk Factors',
    watchNextTitle: 'What to Watch Next',
    relatedTitle: 'Related Research',
    educationalDisclaimer: 'Educational Disclaimer',
    footerNote: 'TradeAlphaAI publishes market outlook research for education and context. Readers should evaluate risk, uncertainty, and source quality before making independent decisions.',
    risks: [
      'Macro data may shift rate expectations and change market tone quickly.',
      'Earnings guidance can affect sector leadership and valuation sensitivity.',
      'Liquidity and positioning can amplify volatility around major events.'
    ],
    watch: [
      'Inflation and labor-market data releases.',
      'Federal Reserve communication and rate expectations.',
      'Sector breadth across technology, defensive, and cyclical groups.',
      'ETF rotation between broad-market, growth, income, and defensive exposures.'
    ]
  },
  ar: {
    label: 'تعليق تعليمي على السوق',
    tone: 'نبرة السوق',
    uncertainty: 'عدم اليقين',
    disclaimerTitle: 'إخلاء المسؤولية التعليمي',
    executiveSummary: 'الملخص التنفيذي',
    marketTone: 'نبرة السوق',
    keyDrivers: 'العوامل الرئيسية',
    macroBackdrop: 'الخلفية الكلية',
    sectorContext: 'سياق القطاعات',
    etfContext: 'سياق صناديق المؤشرات',
    scenarioOutlook: 'سيناريوهات محتملة',
    scenarioNote: 'السيناريوهات التالية أطر تعليمية مشروطة. لا تمثل توقعات أو توصيات استثمارية.',
    riskFactorsTitle: 'عوامل المخاطر',
    watchNextTitle: 'ما الذي يجب مراقبته لاحقا',
    relatedTitle: 'أبحاث مرتبطة',
    educationalDisclaimer: 'إخلاء المسؤولية التعليمي',
    footerNote: 'تنشر TradeAlphaAI أبحاث توقعات السوق لأغراض التعليم والسياق. ينبغي للقارئ تقييم المخاطر وعدم اليقين وجودة المصادر قبل اتخاذ قرارات مستقلة.',
    risks: [
      'قد تغير البيانات الكلية توقعات الفائدة ونبرة السوق بسرعة.',
      'قد تؤثر توجيهات الأرباح في قيادة القطاعات وحساسية التقييم.',
      'قد تؤدي السيولة والتمركز إلى تضخيم التقلب حول الأحداث الكبرى.'
    ],
    watch: [
      'إصدارات بيانات التضخم وسوق العمل.',
      'تواصل الاحتياطي الفيدرالي وتوقعات أسعار الفائدة.',
      'اتساع المشاركة عبر قطاعات التكنولوجيا والقطاعات الدفاعية والدورية.',
      'التناوب بين صناديق السوق الواسع والنمو والدخل والتعرضات الدفاعية.'
    ]
  }
  };
}

function relatedCards(ar) {
  const cards = ar
    ? [
        ['تصنيفات السوق', 'راجع تصنيفات الأسهم وصناديق المؤشرات ضمن سياق تعليمي أوسع.', '/ar/rankings.html', 'عرض التصنيفات'],
        ['أبحاث صناديق المؤشرات', 'استكشف التعرضات القطاعية والتنويع ومقارنات الصناديق.', '/ar/etfs.html', 'استكشاف الصناديق'],
        ['مكتبة الرؤى', 'اقرأ مقالات تعليمية حول القطاعات والمقارنات وإدارة المخاطر.', '/ar/insights/', 'تصفح المقالات']
      ]
    : [
        ['Market Rankings', 'Review stock and ETF rankings inside a broader educational context.', '/rankings.html', 'View rankings'],
        ['ETF Research', 'Explore sector exposure, diversification, and ETF comparisons.', '/etfs.html', 'Explore ETFs'],
        ['Insights Library', 'Read educational articles on sectors, comparisons, and risk management.', '/insights/', 'Browse articles']
      ];
  return cards.map(([title, body, href, link]) => `          <article class="market-card"><span class="market-card-kicker">${escapeHtml(title)}</span><p class="market-copy">${escapeHtml(body)}</p><a class="market-card-link" href="${href}">${escapeHtml(link)}</a></article>`).join('\n');
}

function renderEnNav(slug) {
  return `<div class="topbar"><div class="wrap topbar-inner"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlphaAI</strong><span>Research Platform</span></span></a><div class="top-actions"><nav class="nav-group" aria-label="Primary"><a href="/" class="nav-link">Home</a><a href="/stocks.html" class="nav-link">Global Stock Research</a><a href="/etfs.html" class="nav-link">ETF Analyzer</a><a href="/rankings.html" class="nav-link">Rankings</a><a href="/insights/" class="nav-link">Articles</a><a href="/market-outlook/" class="nav-link">Market Outlook</a></nav><div class="locale-links" aria-label="Language"><a class="lang-switch" data-locale-route="ar" href="/ar/market-outlook/${slug}.html">Arabic</a><a class="lang-switch" data-locale-route="en" href="/market-outlook/${slug}.html">English</a></div></div></div></div>`;
}

function renderArNav(slug) {
  return `<div class="topbar"><div class="wrap topbar-inner"><a class="brand" href="/ar/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlphaAI</strong><span>منصة الأبحاث</span></span></a><div class="top-actions"><nav class="nav-group" aria-label="التنقل الرئيسي"><a href="/ar/" class="nav-link">الرئيسية</a><a href="/ar/stocks.html" class="nav-link">أبحاث الأسهم</a><a href="/ar/etfs.html" class="nav-link">صناديق المؤشرات</a><a href="/ar/rankings.html" class="nav-link">التصنيفات</a><a href="/ar/insights/" class="nav-link">المقالات</a><a href="/ar/market-outlook/" class="nav-link">توقعات السوق</a></nav><div class="locale-links" aria-label="اختيار اللغة"><a class="lang-switch" data-locale-route="en" href="/market-outlook/${slug}.html">English</a><a class="lang-switch" data-locale-route="ar" href="/ar/market-outlook/${slug}.html">العربية</a></div></div></div></div>`;
}

function normalizeTopic(topic) {
  return {
    ...topic,
    title_en: clean(topic.title_en) || titleCase(topic.slug),
    title_ar: safeArabic(topic.title_ar) ? clean(topic.title_ar) : arabicTitle(topic.slug),
    category: clean(topic.category) || 'Market Outlook',
    topic_cluster: clean(topic.topic_cluster || topic.discovery_cluster || topic.category || 'market outlook'),
    summary_en: clean(topic.summary_en) || 'Educational market outlook focused on context, risks, and conditional scenarios without investment recommendations.',
    summary_ar: safeArabic(topic.summary_ar) ? clean(topic.summary_ar) : arabicSummary(topic.slug)
  };
}

function attemptAutoApproval(topicItem, slugValue) {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'score-generated-content.js'), `--slug=${slugValue}`, '--type=market_outlook', '--min-score=90'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) {
    if (result.stderr) console.log(result.stderr.trim());
    return false;
  }
  const report = JSON.parse(result.stdout);
  const entry = (report.results || []).find((item) => item.slug === slugValue);
  if (!entry || entry.quality_score < 90) return false;
  const required = ['language_purity', 'public_placeholder_risk', 'semantic_depth', 'layout_quality'];
  if (required.some((name) => entry.checks[name] !== true)) return false;
  const today = new Date().toISOString().slice(0, 10);
  topicItem.status = 'reviewed';
  topicItem.review_status = 'approved';
  topicItem.last_reviewed = today;
  queue.updated = today;
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
  return true;
}

function isCoolingDown(item) {
  const cluster = item.topic_cluster || item.discovery_cluster || item.category;
  if (!cluster) return false;
  return (memory.recent_topics || []).some((entry) => entry.cluster === cluster && daysSince(entry.published_at || entry.created_at) < 14);
}

function daysSince(day) {
  if (!day) return Infinity;
  return Math.floor((Date.now() - new Date(`${day}T00:00:00Z`).getTime()) / 86400000);
}

function regimeTags() {
  const state = regime.state || {};
  return unique([state.volatility_regime, state.risk_regime, state.ai_sector_momentum, state.semiconductor_strength, state.rates_trend, state.defensive_rotation, state.growth_value_bias].filter(Boolean));
}

function confidenceAr(label) {
  const map = { constructive: 'بناءة', cautious: 'حذرة', defensive: 'دفاعية', volatile: 'متقلبة', 'elevated uncertainty': 'عدم يقين مرتفع', 'improving breadth': 'اتساع متحسن' };
  return map[label] || 'مشروطة';
}

function uncertaintyAr(label) {
  const map = { 'low uncertainty': 'منخفض', 'moderate uncertainty': 'معتدل', 'elevated uncertainty': 'مرتفع', 'high uncertainty': 'عال' };
  return map[label] || 'معتدل';
}

function arabicTitle(slug) {
  if (slug.includes('ai-sector')) return 'سياق قطاع الذكاء الاصطناعي وأشباه الموصلات: مراجعة تعليمية للزخم والسيناريوهات';
  if (slug.includes('etf-rotation')) return 'سياق التناوب في صناديق المؤشرات: إشارات التدفق والسيناريوهات القطاعية التعليمية';
  if (slug.includes('yield')) return 'عوائد الخزانة وسياق أسعار الفائدة: إطار تعليمي لسيناريوهات السوق';
  if (slug.includes('regime')) return 'سياق نظام السوق: إشارات المخاطر والسيناريوهات التعليمية';
  return 'تعليق تعليمي على اتجاهات السوق';
}

function arabicSummary(slug) {
  if (slug.includes('ai-sector')) return 'نظرة تعليمية على زخم قطاع الذكاء الاصطناعي وأشباه الموصلات وسياق صناديق المؤشرات والسيناريوهات المشروطة، وليست نصيحة استثمارية.';
  if (slug.includes('etf-rotation')) return 'تحليل تعليمي لموضوعات تدفق صناديق المؤشرات والتناوب القطاعي والسيناريوهات السوقية المشروطة، وليس توقعا أو توصية استثمارية.';
  if (slug.includes('yield')) return 'نظرة تعليمية على تحركات عوائد الخزانة وسياق أسعار الفائدة والسيناريوهات السوقية المشروطة، وليست توقعا أو توصية استثمارية.';
  if (slug.includes('regime')) return 'سياق تعليمي لإشارات نظام السوق وديناميكيات المخاطر والسيناريوهات المشروطة، وليس توقعا أو توصية استثمارية.';
  return 'تعليق تعليمي على السوق يركز على السياق والمخاطر والسيناريوهات دون تقديم توصيات استثمارية.';
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeArabic(value) {
  const text = String(value || '');
  return /[\u0600-\u06ff]/.test(text) && !/[\uFFFD]/.test(text) && !/\?{3,}/.test(text) && !/[\u00d8\u00d9\u00c3]/.test(text);
}

function titleCase(value) {
  return String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readJson(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch (error) {
    fail(`${path.relative(ROOT, file)}: ${error.message}`);
  }
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
