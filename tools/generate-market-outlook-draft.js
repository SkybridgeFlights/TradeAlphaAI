'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');
const OUT_DIR = path.join(ROOT, 'drafts', 'market-outlook');
const SITE_URL = 'https://tradealphaai.com';
const ELIGIBLE = new Set(['planned', 'draft']);
const DISCLAIMER_EN = 'This content is educational market commentary only and does not constitute financial advice or investment recommendations.';
const DISCLAIMER_AR = 'هذا المحتوى عبارة عن تحليل وتعليق تعليمي للأسواق فقط ولا يُعتبر نصيحة مالية أو توصية شراء أو بيع.';

const queue = readJson(QUEUE_PATH);
const topic = (queue.topics || []).find((item) => ELIGIBLE.has(item.status));

if (!topic) {
  console.log('No market outlook draft topic available');
  process.exit(0);
}

const slug = topic.slug;
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) fail('Market outlook topic has malformed slug');
const dir = path.join(OUT_DIR, slug);
if (fs.existsSync(path.join(dir, 'en.html')) || fs.existsSync(path.join(dir, 'ar.html'))) fail(`${slug}: draft already exists`);

fs.mkdirSync(dir, { recursive: true });
const normalized = normalizeTopic(topic);
fs.writeFileSync(path.join(dir, 'en.html'), render(normalized, 'en'), 'utf8');
fs.writeFileSync(path.join(dir, 'ar.html'), render(normalized, 'ar'), 'utf8');
fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
  slug,
  content_type: 'market_outlook',
  status: 'in_review',
  review_status: 'pending',
  generated_at: new Date().toISOString(),
  auto_publish: false,
  telegram_ready: false,
  public_site_updated: false,
  languages: ['en', 'ar']
}, null, 2) + '\n', 'utf8');

topic.status = 'in_review';
topic.review_status = 'pending';
topic.revision_count = 0;
topic.last_reviewed = null;
queue.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

console.log(`Generated market outlook draft: drafts/market-outlook/${slug}`);

function normalizeTopic(topic) {
  return {
    ...topic,
    title_en: clean(topic.title_en) || titleCase(topic.slug),
    title_ar: safeArabic(topic.title_ar) ? clean(topic.title_ar) : 'تعليق تعليمي على اتجاهات السوق',
    category: clean(topic.category) || 'Market Outlook',
    summary_en: clean(topic.summary_en) || 'Educational market outlook draft focused on context, risks, and research links without investment recommendations.',
    summary_ar: safeArabic(topic.summary_ar) ? clean(topic.summary_ar) : 'مسودة تعليق تعليمي على السوق تركز على السياق والمخاطر وروابط البحث دون تقديم توصيات استثمارية.'
  };
}

function render(topic, locale) {
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
    mainEntityOfPage: canonical
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
    <article data-content-type="market_outlook">
      <header>
        <p>${escapeHtml(ar ? 'تعليق تعليمي على السوق' : 'Educational market outlook')}</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(summary)}</p>
      </header>
      <section id="market-context">
        <h2>${ar ? 'سياق السوق' : 'Market context'}</h2>
        <p>${ar ? 'اشرح السياق التعليمي العام باستخدام بيانات حقيقية متاحة أو مفاهيم دائمة الصلاحية فقط. لا تضف أخبارا أو محفزات غير موثقة.' : 'Explain the educational context using available real data or evergreen concepts only. Do not add unsourced news or catalysts.'}</p>
      </section>
      <section id="risk-context">
        <h2>${ar ? 'سياق المخاطر' : 'Risk context'}</h2>
        <p>${ar ? 'اربط الموضوع بالمخاطر، التقلب، التنويع، والسيولة بلغة احتمالية وغير جازمة.' : 'Connect the topic to risk, volatility, diversification, and liquidity using non-certain language.'}</p>
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

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${path.relative(ROOT, file)}: ${error.message}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
