'use strict';

const fs = require('fs');
const path = require('path');
const { generateIntelligence } = require('./generate-market-intelligence.js');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH          = path.join(ROOT, 'data', 'market-outlook-queue.json');
const ECONOMIC_CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const REGIME_PATH         = path.join(ROOT, 'data', 'market-regime-state.json');
const MEMORY_PATH         = path.join(ROOT, 'data', 'topic-memory.json');
const LIVE_MARKET_PATH    = path.join(ROOT, 'data', 'live-market-state.json');
const OUT_DIR             = path.join(ROOT, 'drafts', 'market-outlook');
const SITE_URL            = 'https://tradealphaai.com';
const ELIGIBLE            = new Set(['planned', 'draft']);

// ── Phase 39 extended disclaimers (legally required in every article) ─────────
const DISCLAIMER_EN = 'This analysis is educational market commentary only. It is not investment advice, financial advice, or a recommendation to buy or sell any asset. Market conditions can change rapidly and uncertainty remains present.';
const DISCLAIMER_AR = 'هذا التحليل عبارة عن تعليق وتعليم حول الأسواق المالية فقط، ولا يُعتبر نصيحة استثمارية أو مالية أو توصية شراء أو بيع لأي أصل مالي. قد تتغير ظروف السوق بسرعة وتبقى حالة عدم اليقين قائمة.';

const queue    = readJson(QUEUE_PATH, { topics: [] });
const calendar = readJson(ECONOMIC_CALENDAR_PATH, { events: [] });
const regime   = readJson(REGIME_PATH, {});
const memory   = readJson(MEMORY_PATH, { recent_topics: [] });
const liveMarket = readJson(LIVE_MARKET_PATH, { metadata: { status: 'fallback' } });

const topic = (queue.topics || []).find((item) => ELIGIBLE.has(item.status) && !isCoolingDown(item));

if (!topic) {
  console.log('No market outlook draft topic available');
  process.exit(0);
}

const slug = topic.slug;
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) fail('Market outlook topic has malformed slug');
const dir = path.join(OUT_DIR, slug);
if (fs.existsSync(path.join(dir, 'en.html')) || fs.existsSync(path.join(dir, 'ar.html'))) fail(`${slug}: draft already exists`);

const normalized = normalizeTopic(topic);
const intelligence = generateIntelligence(liveMarket, calendar, regime);

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'en.html'), render(normalized, 'en', intelligence), 'utf8');
fs.writeFileSync(path.join(dir, 'ar.html'), render(normalized, 'ar', intelligence), 'utf8');
fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
  slug,
  content_type: 'market_outlook',
  status: 'in_review',
  review_status: 'pending',
  generated_at: new Date().toISOString(),
  market_regime_used: regime.state || {},
  live_market_status: intelligence.data_completeness,
  confidence: intelligence.confidence,
  event_context_used: intelligence.upcoming_events.slice(0, 3).map((e) => ({ name: e.name, date: e.date, source_url: e.source_url })),
  quality_score_required: 85,
  auto_publish: false,
  telegram_ready: false,
  public_site_updated: false,
  languages: ['en', 'ar']
}, null, 2) + '\n', 'utf8');

topic.status        = 'in_review';
topic.review_status = 'pending';
topic.revision_count = 0;
topic.last_reviewed = null;
topic.event_tags = unique([...(topic.event_tags || []), ...intelligence.upcoming_events.map((e) => e.type)]);
topic.regime_tags = regimeTags();
topic.confidence_label = intelligence.confidence.label;
queue.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

console.log(`Generated market outlook draft: drafts/market-outlook/${slug}`);
console.log(`Confidence: ${intelligence.confidence.label} (score: ${intelligence.confidence.confidence_score})`);
console.log(`Data completeness: ${intelligence.data_completeness} (${intelligence.sourced_fields.length} sourced fields)`);

// ── Render ────────────────────────────────────────────────────────────────────

function render(topic, locale, intel) {
  const ar = locale === 'ar';
  const title = ar ? topic.title_ar : topic.title_en;
  const summary = ar ? topic.summary_ar : topic.summary_en;
  const disclaimer = ar ? DISCLAIMER_AR : DISCLAIMER_EN;
  const canonical = `${SITE_URL}${ar ? '/ar' : ''}/market-outlook/${topic.slug}.html`;
  const n = intel.narratives;
  const conf = intel.confidence;

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

  const riskFactors = ar
    ? ['تغيرات غير متوقعة في سياسة الاحتياطي الفيدرالي', 'صدمات الأرباح التي تتجاوز التوقعات السوقية', 'تصاعد التوترات الجيوسياسية', 'تحولات مفاجئة في مشاعر المستثمرين', 'تطورات غير متوقعة في بيانات التضخم أو التوظيف']
    : ['Unexpected shifts in Federal Reserve policy', 'Earnings surprises that exceed market expectations', 'Escalation of geopolitical tensions', 'Sudden changes in investor sentiment', 'Unexpected inflation or employment data releases'];

  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="index,follow" />
  <title>${escapeHtml(title)} | TradeAlphaAI Market Outlook</title>
  <meta name="description" content="${escapeHtml(summary)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${SITE_URL}/market-outlook/${topic.slug}.html" />
  <link rel="alternate" hreflang="ar" href="${SITE_URL}/ar/market-outlook/${topic.slug}.html" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(summary)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <main>
    <article data-content-type="market_outlook" data-topic-cluster="${escapeHtml(topic.topic_cluster)}" data-confidence="${escapeHtml(conf.label)}">
      <header>
        <p class="content-label">${escapeHtml(ar ? 'تعليق تعليمي على السوق' : 'Educational market commentary')}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="market-lead">${escapeHtml(summary)}</p>
        <p class="confidence-badge">${escapeHtml(ar ? `مستوى الثقة: ${confidenceLabelAr(conf.label)}` : `Market tone: ${conf.label}`)}</p>
      </header>

      <section id="disclaimer-block" class="disclaimer-block">
        <p class="educational-disclaimer">${escapeHtml(disclaimer)}</p>
      </section>

      <section id="market-narrative">
        <h2>${ar ? 'السرد التعليمي للسوق' : 'Market narrative'}</h2>
        <p>${escapeHtml(ar ? translateNarrative(n.market_narrative) : n.market_narrative)}</p>
      </section>

      <section id="volatility-context">
        <h2>${ar ? 'سياق التقلب' : 'Volatility context'}</h2>
        <p>${escapeHtml(ar ? translateNarrative(n.volatility_interpretation) : n.volatility_interpretation)}</p>
        <p>${escapeHtml(ar ? `مؤشر عدم اليقين الحالي: ${uncertaintyLabelAr(conf.uncertainty_label)}` : `Current uncertainty level: ${conf.uncertainty_label}`)}</p>
      </section>

      <section id="macro-watch">
        <h2>${ar ? 'متابعة الأحداث الكلية' : 'Macro watch'}</h2>
        <p>${escapeHtml(ar ? translateNarrative(n.macro_pressure) : n.macro_pressure)}</p>
${renderMacroEvents(intel.upcoming_events, ar)}
      </section>

      <section id="ai-semiconductor-context">
        <h2>${ar ? 'سياق الذكاء الاصطناعي وأشباه الموصلات' : 'AI & semiconductor context'}</h2>
        <p>${escapeHtml(ar ? translateNarrative(n.ai_semiconductor_context) : n.ai_semiconductor_context)}</p>
        <p>${escapeHtml(ar ? translateNarrative(n.etf_rotation) : n.etf_rotation)}</p>
      </section>

      <section id="scenario-outlook">
        <h2>${ar ? 'سيناريوهات تعليمية' : 'Educational scenario outlook'}</h2>
        <p class="scenario-notice">${escapeHtml(ar ? 'السيناريوهات التالية تعليمية وشرطية فقط. لا تمثل توقعات أو توصيات استثمارية.' : 'The following scenarios are educational and conditional only. They do not represent predictions or investment recommendations.')}</p>
        <ul class="scenario-list">
${intel.scenarios.map((s) => `          <li>${escapeHtml(ar ? translateNarrative(s) : s)}</li>`).join('\n')}
        </ul>
      </section>

      <section id="risk-factors">
        <h2>${ar ? 'عوامل المخاطرة التعليمية' : 'Risk factors'}</h2>
        <p>${escapeHtml(ar ? 'العوامل التالية قد تؤثر على السياق التعليمي. لا تُعدّ أيًا منها توقعًا أو توصية.' : 'The following factors may influence the educational context. None are predictions or recommendations.')}</p>
        <ul>
${riskFactors.map((f) => `          <li>${escapeHtml(f)}</li>`).join('\n')}
        </ul>
      </section>

      <section id="related-research">
        <h2>${ar ? 'أبحاث مرتبطة' : 'Related research'}</h2>
        <ul>
          <li><a href="${ar ? '/ar/rankings.html' : '/rankings.html'}">${ar ? 'تصنيفات السوق' : 'Market rankings'}</a></li>
          <li><a href="${ar ? '/ar/insights/index.html' : '/insights/index.html'}">${ar ? 'الرؤى التعليمية' : 'Educational insights'}</a></li>
          <li><a href="${ar ? '/ar/etfs.html' : '/etfs.html'}">${ar ? 'أبحاث صناديق المؤشرات' : 'ETF research'}</a></li>
        </ul>
      </section>

      <footer class="article-footer">
        <div class="educational-disclaimer-block">
          <p class="educational-disclaimer">${escapeHtml(disclaimer)}</p>
          <p class="disclaimer-note">${escapeHtml(ar ? 'بيانات السوق المستخدمة في هذه المسودة تعليمية فقط ولا تعكس أسعارًا لحظية ولا تشكّل توصية.' : 'Market data referenced in this draft is for educational purposes only, does not reflect real-time prices, and does not constitute a recommendation.')}</p>
        </div>
      </footer>
    </article>
  </main>
</body>
</html>
`;
}

function renderMacroEvents(events, ar) {
  if (!events.length) {
    return `        <p>${ar ? 'لا توجد أحداث كلية موثقة في التقويم الحالي.' : 'No sourced macro events are currently in the calendar.'}</p>`;
  }
  const today = new Date().toISOString().slice(0, 10);
  const items = events.slice(0, 5).map((event) => {
    const days = Math.floor((new Date(event.date + 'T00:00:00Z') - Date.now()) / 86400000);
    const proximity = days <= 2 ? (ar ? 'وشيك' : 'imminent') : days <= 7 ? (ar ? 'قريب' : 'near-term') : (ar ? 'قادم' : 'upcoming');
    return `          <li>${escapeHtml(event.date)} — <a href="${escapeHtml(event.source_url)}">${escapeHtml(event.name)}</a> <span class="event-proximity">[${proximity}]</span></li>`;
  }).join('\n');
  return `        <ul class="macro-event-list">\n${items}\n        </ul>`;
}

// ── Arabic translation layer ──────────────────────────────────────────────────
// Light keyword-based translation for dynamically generated narrative strings.
// Editors must verify Arabic quality before approval.

function translateNarrative(text) {
  if (!text) return '';
  return text
    .replace(/No live market state is currently available/g, 'لا تتوفر بيانات سوق حية في الوقت الحالي')
    .replace(/No sourced market data is currently available/g, 'لا تتوفر بيانات سوق موثقة حاليًا')
    .replace(/No sourced macro events/g, 'لا توجد أحداث كلية موثقة')
    .replace(/educational commentary/g, 'تعليق تعليمي')
    .replace(/AI sector momentum/g, 'زخم قطاع الذكاء الاصطناعي')
    .replace(/semiconductor momentum/g, 'زخم قطاع أشباه الموصلات')
    .replace(/market conditions/g, 'ظروف السوق')
    .replace(/constructive/g, 'بنّاء')
    .replace(/cautious/g, 'حذر')
    .replace(/defensive/g, 'دفاعي')
    .replace(/volatile/g, 'متقلب')
    .replace(/elevated uncertainty/g, 'عدم يقين مرتفع')
    .replace(/risk-off/g, 'تجنب المخاطرة')
    .replace(/risk-on/g, 'إقبال على المخاطرة')
    .replace(/bullish/g, 'إيجابي')
    .replace(/bearish/g, 'سلبي')
    .replace(/neutral/g, 'محايد')
    .replace(/This is not predictive/g, 'هذا ليس توقعًا')
    .replace(/not investment advice/g, 'ليس نصيحة استثمارية')
    .replace(/ETF/g, 'صندوق المؤشر');
}

function confidenceLabelAr(label) {
  const map = { 'constructive': 'بنّاء', 'improving breadth': 'اتساع متحسن', 'cautious': 'حذر', 'defensive': 'دفاعي', 'volatile': 'متقلب', 'elevated uncertainty': 'عدم يقين مرتفع' };
  return map[label] || label;
}

function uncertaintyLabelAr(label) {
  const map = { 'low uncertainty': 'عدم يقين منخفض', 'moderate uncertainty': 'عدم يقين معتدل', 'elevated uncertainty': 'عدم يقين مرتفع', 'high uncertainty': 'عدم يقين عالٍ' };
  return map[label] || label;
}

// ── Existing helpers (preserved) ──────────────────────────────────────────────

function normalizeTopic(topic) {
  return {
    ...topic,
    title_en: clean(topic.title_en) || titleCase(topic.slug),
    title_ar: safeArabic(topic.title_ar) ? clean(topic.title_ar) : 'تعليق تعليمي على اتجاهات السوق',
    category: clean(topic.category) || 'Market Outlook',
    topic_cluster: clean(topic.topic_cluster || topic.discovery_cluster || topic.category || 'market outlook'),
    summary_en: clean(topic.summary_en) || 'Educational market outlook focused on context, risks, and scenarios without investment recommendations.',
    summary_ar: safeArabic(topic.summary_ar) ? clean(topic.summary_ar) : 'تعليق تعليمي على السوق يركز على السياق والمخاطر والسيناريوهات دون تقديم توصيات استثمارية.'
  };
}

function isCoolingDown(item) {
  const cluster = item.topic_cluster || item.discovery_cluster || item.category;
  if (!cluster) return false;
  const recent = memory.recent_topics || [];
  return recent.some((entry) => entry.cluster === cluster && daysSince(entry.published_at || entry.created_at) < 14);
}

function daysSince(day) {
  if (!day) return Infinity;
  return Math.floor((Date.now() - new Date(`${day}T00:00:00Z`).getTime()) / 86400000);
}

function regimeTags() {
  const state = regime.state || {};
  return unique([
    state.volatility_regime, state.risk_regime, state.ai_sector_momentum,
    state.semiconductor_strength, state.rates_trend, state.defensive_rotation, state.growth_value_bias
  ].filter(Boolean));
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

function safeArabic(value) {
  const text = String(value || '');
  return /[؀-ۿ]/.test(text) && !/[\uFFFD]/.test(text) && !/\?{3,}/.test(text);
}

function titleCase(value) {
  return String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readJson(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
  catch (error) { fail(`${path.relative(ROOT, file)}: ${error.message}`); }
}

function fail(message) { console.error(message); process.exit(1); }
