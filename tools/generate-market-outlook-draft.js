'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');
const ECONOMIC_CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const REGIME_PATH = path.join(ROOT, 'data', 'market-regime-state.json');
const MEMORY_PATH = path.join(ROOT, 'data', 'topic-memory.json');
const LIVE_MARKET_PATH = path.join(ROOT, 'data', 'live-market-state.json');
const OUT_DIR = path.join(ROOT, 'drafts', 'market-outlook');
const SITE_URL = 'https://tradealphaai.com';
const ELIGIBLE = new Set(['planned', 'draft']);
const DISCLAIMER_EN = 'This analysis is educational market commentary only and is not investment advice.';
const DISCLAIMER_AR = 'هذا التحليل عبارة عن تعليق تعليمي على الأسواق فقط ولا يُعتبر نصيحة استثمارية.';

const queue = readJson(QUEUE_PATH, { topics: [] });
const calendar = readJson(ECONOMIC_CALENDAR_PATH, { events: [] });
const regime = readJson(REGIME_PATH, {});
const memory = readJson(MEMORY_PATH, { recent_topics: [] });
const liveMarket = readJson(LIVE_MARKET_PATH, { metadata: { status: 'fallback' } });
const liveDataAvailable = liveMarket.metadata && liveMarket.metadata.status === 'live';
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
const matchingEvents = upcomingEvents(normalized);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'en.html'), render(normalized, 'en', matchingEvents), 'utf8');
fs.writeFileSync(path.join(dir, 'ar.html'), render(normalized, 'ar', matchingEvents), 'utf8');
fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
  slug,
  content_type: 'market_outlook',
  status: 'in_review',
  review_status: 'pending',
  generated_at: new Date().toISOString(),
  market_regime_used: regime.state || {},
  live_market_status: liveMarket.metadata && liveMarket.metadata.status,
  event_context_used: matchingEvents.map((event) => ({ id: event.id, name: event.name, date: event.date, source_url: event.source_url })),
  quality_score_required: 85,
  auto_publish: false,
  telegram_ready: false,
  public_site_updated: false,
  languages: ['en', 'ar']
}, null, 2) + '\n', 'utf8');

topic.status = 'in_review';
topic.review_status = 'pending';
topic.revision_count = 0;
topic.last_reviewed = null;
topic.event_tags = unique([...(topic.event_tags || []), ...matchingEvents.map((event) => event.type)]);
topic.regime_tags = regimeTags();
queue.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

console.log(`Generated market outlook draft: drafts/market-outlook/${slug}`);

function normalizeTopic(topic) {
  return {
    ...topic,
    title_en: clean(topic.title_en) || titleCase(topic.slug),
    title_ar: safeArabic(topic.title_ar) ? clean(topic.title_ar) : 'تعليق تعليمي على اتجاهات السوق',
    category: clean(topic.category) || 'Market Outlook',
    topic_cluster: clean(topic.topic_cluster || topic.discovery_cluster || topic.category || 'market outlook'),
    summary_en: clean(topic.summary_en) || 'Educational market outlook draft focused on context, risks, and research links without investment recommendations.',
    summary_ar: safeArabic(topic.summary_ar) ? clean(topic.summary_ar) : 'مسودة تعليق تعليمي على السوق تركز على السياق والمخاطر وروابط البحث دون تقديم توصيات استثمارية.'
  };
}

function render(topic, locale, events) {
  const ar = locale === 'ar';
  const title = ar ? topic.title_ar : topic.title_en;
  const summary = ar ? topic.summary_ar : topic.summary_en;
  const disclaimer = ar ? DISCLAIMER_AR : DISCLAIMER_EN;
  const canonical = `${SITE_URL}${ar ? '/ar' : ''}/market-outlook/${topic.slug}.html`;
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
    <article data-content-type="market_outlook" data-topic-cluster="${escapeHtml(topic.topic_cluster)}">
      <header>
        <p>${escapeHtml(ar ? 'تعليق تعليمي على السوق' : 'Educational market outlook')}</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(summary)}</p>
      </header>
      <section id="market-context">
        <h2>${ar ? 'سياق السوق' : 'Market context'}</h2>
        <p>${escapeHtml(ar ? marketContextAr(topic, events) : marketContextEn(topic, events))}</p>
      </section>
      <section id="event-context">
        <h2>${ar ? 'أحداث يجب مراقبتها' : 'Events to watch'}</h2>
${renderEvents(events, ar)}
      </section>
      <section id="regime-context">
        <h2>${ar ? 'سياق نظام السوق' : 'Market regime context'}</h2>
        <p>${escapeHtml(ar ? regimeContextAr() : regimeContextEn())}</p>
      </section>
${liveDataAvailable ? renderLiveSnapshot(ar) : ''}
      <section id="risk-context">
        <h2>${ar ? 'سياق المخاطر' : 'Risk context'}</h2>
        <p>${escapeHtml(ar ? 'يربط هذا التحليل الموضوع بالمخاطر والتقلب والتنويع والسيولة بلغة احتمالية وغير جازمة.' : 'This analysis connects the topic to risk, volatility, diversification, and liquidity using non-certain language.')}</p>
      </section>
      <section id="related-research">
        <h2>${ar ? 'أبحاث مرتبطة' : 'Related research'}</h2>
        <ul>
          <li><a href="${ar ? '/ar/rankings.html' : '/rankings.html'}">${ar ? 'تصنيفات السوق' : 'Market rankings'}</a></li>
          <li><a href="${ar ? '/ar/insights/index.html' : '/insights/index.html'}">${ar ? 'الرؤى التعليمية' : 'Educational insights'}</a></li>
        </ul>
      </section>
      <footer>
        <p class="educational-disclaimer">${escapeHtml(disclaimer)}</p>
      </footer>
    </article>
  </main>
</body>
</html>
`;
}

function marketContextEn(topic, events) {
  const eventText = events.length ? ` It references ${events.map((event) => event.name).join(', ')} because those events are present in the sourced economic calendar.` : ' No specific event is added unless it exists in the sourced calendar.';
  return `TradeAlphaAI frames this outlook around ${topic.topic_cluster} using educational scenario analysis, not trading calls.${eventText}`;
}

function marketContextAr(topic, events) {
  const eventText = events.length ? ` ويشير إلى ${events.map((event) => event.name).join('، ')} لأن هذه الأحداث موجودة في التقويم الاقتصادي الموثق.` : ' ولا تتم إضافة أي حدث محدد ما لم يكن موجودا في التقويم الموثق.';
  return `يعرض TradeAlphaAI هذا التعليق حول ${topic.topic_cluster} باستخدام تحليل سيناريوهات تعليمي وليس دعوات تداول.${eventText}`;
}

function regimeContextEn() {
  const state = regime.state || {};
  return `Current regime tags: ${regimeTags().join(', ') || 'not enough sourced regime context'}. Editors should verify all regime labels before approval.`;
}

function regimeContextAr() {
  return `وسوم نظام السوق الحالية: ${regimeTags().join('، ') || 'لا توجد بيانات سياقية موثقة كافية'}. يجب على المحرر مراجعة جميع الوسوم قبل الاعتماد.`;
}

function renderLiveSnapshot(ar) {
  const lines = [];
  const numFields = [
    ['sp500',       ar ? 'S&P 500'              : 'S&P 500'],
    ['nasdaq',      ar ? 'ناسداك'               : 'NASDAQ'],
    ['vix',         ar ? 'مؤشر التقلب (VIX)'   : 'VIX volatility index'],
    ['us10y_yield', ar ? 'عائد سندات 10 سنوات' : 'US 10-year yield'],
    ['gold',        ar ? 'الذهب'                : 'Gold'],
    ['bitcoin',     ar ? 'بيتكوين'              : 'Bitcoin']
  ];
  const strFields = [
    ['ai_sector_momentum',     ar ? 'زخم قطاع الذكاء الاصطناعي' : 'AI sector momentum'],
    ['semiconductor_momentum', ar ? 'زخم أشباه الموصلات'         : 'Semiconductor momentum'],
    ['market_regime',          ar ? 'نظام السوق'                  : 'Market regime'],
    ['volatility_state',       ar ? 'حالة التقلب'                 : 'Volatility state']
  ];
  for (const [field, label] of numFields) {
    const entry = liveMarket[field];
    if (entry && entry.value !== null) {
      lines.push(`    <li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(entry.value))} <small>(<a href="${escapeHtml(entry.source_url)}">${escapeHtml(entry.source_name)}</a>)</small></li>`);
    }
  }
  for (const [field, label] of strFields) {
    const entry = liveMarket[field];
    if (entry && entry.value && entry.value !== 'unverified') {
      lines.push(`    <li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(entry.value)}</li>`);
    }
  }
  if (!lines.length) return '';
  const disclaimer = ar
    ? 'بيانات السوق للسياق التعليمي فقط. قد لا تعكس الأسعار اللحظية الحالية. لا تُعتبر توصية استثمارية.'
    : 'Market data shown for educational context only. Values may not reflect real-time prices. Not investment advice.';
  return `      <section id="live-market-snapshot">
        <h2>${ar ? 'لقطة السوق الحالية' : 'Live market snapshot'}</h2>
        <p class="snapshot-disclaimer">${escapeHtml(disclaimer)}</p>
        <ul class="market-snapshot-list">
${lines.join('\n')}
        </ul>
      </section>`;
}

function renderEvents(events, ar) {
  if (!events.length) return `        <p>${ar ? 'لا توجد أحداث موثقة مرتبطة بهذه المسودة في التقويم الحالي.' : 'No sourced calendar events are attached to this draft.'}</p>`;
  const items = events.map((event) => `          <li>${escapeHtml(event.date)} - <a href="${escapeHtml(event.source_url)}">${escapeHtml(event.name)}</a></li>`).join('\n');
  return `        <ul>\n${items}\n        </ul>`;
}

function upcomingEvents(topic) {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const terms = normalize(`${topic.title_en} ${topic.category} ${topic.topic_cluster} ${(topic.tags || []).join(' ')}`).split(' ');
  return (calendar.events || [])
    .filter((event) => event.source_url && event.date && event.status === 'confirmed')
    .filter((event) => {
      const date = new Date(`${event.date}T00:00:00Z`);
      const days = (date - today) / 86400000;
      return days >= 0 && days <= 7;
    })
    .filter((event) => {
      const eventText = normalize(`${event.name} ${event.type} ${(event.tags || []).join(' ')}`);
      return terms.some((term) => term.length > 2 && eventText.includes(term));
    })
    .slice(0, 3);
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
    state.volatility_regime,
    state.risk_regime,
    state.ai_sector_momentum,
    state.semiconductor_strength,
    state.rates_trend,
    state.defensive_rotation,
    state.growth_value_bias
  ].filter(Boolean));
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeArabic(value) {
  const text = String(value || '');
  return /[\u0600-\u06FF]/.test(text) && !/[\uFFFD]/.test(text) && !/\?{3,}/.test(text);
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

function fail(message) {
  console.error(message);
  process.exit(1);
}
