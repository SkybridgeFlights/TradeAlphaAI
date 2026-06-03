'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'news-analysis-queue.json');
const OUT_DIR = path.join(ROOT, 'drafts', 'news-analysis');
const SITE_URL = 'https://tradealphaai.com';

const ALLOWED_SOURCE_TYPES = new Set([
  'sec_filing',
  'official_earnings_report',
  'federal_reserve_release',
  'cpi_release',
  'nfp_release',
  'gdp_release',
  'pce_release',
  'etf_provider_update',
  'platform_market_data'
]);

const queue = readJson(QUEUE_PATH);
const topic = (queue.topics || []).find((item) => item.status === 'planned' || item.status === 'draft');

if (!topic) {
  console.log('No sourced news-analysis topic available');
  process.exit(0);
}

if (!Array.isArray(topic.sources) || !topic.sources.length) {
  console.log(`${topic.slug}: no sources attached — skipping`);
  process.exit(0);
}

for (const source of topic.sources) {
  if (!source.url || !/^https?:\/\//.test(source.url)) fail(`${topic.slug}: source missing valid URL`);
  if (!source.type || !ALLOWED_SOURCE_TYPES.has(source.type)) fail(`${topic.slug}: source has unsupported type: ${source.type || '<missing>'}`);
}

const dir = path.join(OUT_DIR, topic.slug);
if (fs.existsSync(path.join(dir, 'en.html')) || fs.existsSync(path.join(dir, 'ar.html'))) {
  fail(`${topic.slug}: draft already exists — refusing to overwrite`);
}
fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'en.html'), render(topic, 'en'), 'utf8');
fs.writeFileSync(path.join(dir, 'ar.html'), render(topic, 'ar'), 'utf8');
fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(buildMetadata(topic), null, 2) + '\n', 'utf8');

topic.status = 'in_review';
topic.review_status = 'pending';
queue.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

console.log(`Generated sourced news-analysis draft: drafts/news-analysis/${topic.slug}`);
console.log(`${topic.slug}: status set to in_review; review_status set to pending`);
console.log('Draft only — no public pages, sitemaps, search index, registry, or Telegram actions updated.');
console.log('Manual editorial review required before any publishing decision.');

// ── Render ────────────────────────────────────────────────────────────────────

function render(topic, locale) {
  const ar = locale === 'ar';
  const lang = ar ? 'ar' : 'en';
  const dir = ar ? 'rtl' : 'ltr';
  const title = ar
    ? (topic.title_ar || 'تحليل تعليمي لخبر موثق في السوق')
    : (topic.title_en || 'Sourced Market News Analysis');
  const summary = ar
    ? `تحليل تعليمي مبني على مصدر رسمي موثق. يعكس هذا المحتوى معلومات تعليمية عامة فقط ولا يمثل نصيحة مالية أو توصية استثمارية.`
    : `Educational analysis based on a verified official source. This content reflects general educational information only and does not constitute financial advice or investment recommendations.`;
  const disclaimer = ar
    ? 'هذا المحتوى عبارة عن تعليق تعليمي على الأسواق فقط ولا يُعتبر نصيحة مالية أو توصية شراء أو بيع. المصادر مذكورة بشكل صريح.'
    : 'This content is educational market commentary only and does not constitute financial advice or investment recommendations. Sources are explicitly cited.';
  const sourceItems = topic.sources
    .map((s) => `<li><span class="source-type">[${escapeHtml(sourceTypeLabel(s.type, ar))}]</span> <a href="${escapeHtml(s.url)}" rel="noopener noreferrer">${escapeHtml(s.title || s.type)}</a>${s.fetched_at ? ` <span class="source-date">(${escapeHtml(s.fetched_at.slice(0, 10))})</span>` : ''}</li>`)
    .join('\n        ');

  const faqItems = ar
    ? [
        ['هل هذا المحتوى نصيحة مالية؟', 'لا. هذا محتوى تعليمي فقط ولا يقدم توصية بشراء أو بيع أي ورقة مالية.'],
        ['ما مصدر هذه المعلومات؟', 'جميع المعلومات مأخوذة من مصادر رسمية موثقة مذكورة صراحةً في قسم المصادر أعلاه.'],
        ['كيف يستخدم القارئ هذا التحليل؟', 'يمكن استخدامه كإطار تعليمي لفهم حدث السوق المذكور بدون اتخاذ قرار استثماري بناءً عليه منفرداً.']
      ]
    : [
        ['Is this content financial advice?', 'No. This is educational content only and does not recommend buying or selling any security.'],
        ['Where does this information come from?', 'All information is drawn from official verified sources cited explicitly in the sources section above.'],
        ['How should readers use this analysis?', 'Readers can use it as an educational framework for understanding the cited market event — not as a standalone basis for any investment decision.']
      ];

  const faqBlocks = faqItems
    .map(([q, a], i) => `        <details${i === 0 ? ' open' : ''}><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`)
    .join('\n');

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeHtml(title)} | TradeAlphaAI Draft</title>
  <meta name="description" content="${escapeHtml(summary)}" />
</head>
<body>
  <main>
    <article data-content-type="news_analysis" data-status="in_review" data-locale="${lang}">
      <header>
        <p class="draft-notice">${ar ? 'مسودة للمراجعة التحريرية — لم تُنشر بعد' : 'DRAFT — Editorial review required — not published'}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="market-lead">${escapeHtml(summary)}</p>
      </header>

      <section id="sources">
        <h2>${ar ? 'المصادر الرسمية' : 'Official sources'}</h2>
        <p>${ar ? 'المصادر التالية هي الأساس الوثائقي لهذا التحليل. يجب على المحرر التحقق من صلاحية الروابط قبل النشر.' : 'The following sources are the documentary basis for this analysis. Editors must verify link validity before any publishing decision.'}</p>
        <ul class="source-list">
        ${sourceItems}
        </ul>
      </section>

      <section id="educational-context">
        <h2>${ar ? 'السياق التعليمي' : 'Educational context'}</h2>
        <p>${ar ? '[يُكمل المحرر هنا: اشرح الحدث وتداعياته التعليمية دون لغة جازمة أو توصيات. لا تستخدم مصطلحات مثل سيرتفع أو سينخفض أو يجب الشراء.]' : '[Editor completes here: explain the event and its educational implications without certainty language or recommendations. Do not use terms like will rise, will fall, or must buy.]'}</p>
        <p>${ar ? 'يجب أن يظل هذا القسم موضوعياً وتعليمياً وخالياً من التوقعات غير الموثقة.' : 'This section must remain objective, educational, and free of unsourced predictions.'}</p>
      </section>

      <section id="related-tickers">
        <h2>${ar ? 'الرموز المرتبطة' : 'Related tickers'}</h2>
        <ul>
          ${(topic.related_tickers || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('\n          ')}
        </ul>
        <p>${ar ? 'الرموز المذكورة للسياق التعليمي فقط وليست توصية باستثمار.' : 'Tickers listed for educational context only — not an investment recommendation.'}</p>
      </section>

      <section id="faq">
        <h2>${ar ? 'أسئلة شائعة' : 'FAQ'}</h2>
${faqBlocks}
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

function buildMetadata(topic) {
  return {
    slug: topic.slug,
    content_type: 'news_analysis',
    status: 'in_review',
    review_status: 'pending',
    generated_at: new Date().toISOString(),
    event_type: topic.event_type || null,
    related_tickers: topic.related_tickers || [],
    sources: topic.sources,
    auto_publish: false,
    public_site_updated: false,
    review_required: true
  };
}

function sourceTypeLabel(type, ar) {
  const labels = {
    sec_filing: ar ? 'إيداع SEC' : 'SEC Filing',
    official_earnings_report: ar ? 'تقرير أرباح رسمي' : 'Official Earnings Report',
    federal_reserve_release: ar ? 'بيان الاحتياطي الفيدرالي' : 'Federal Reserve Release',
    cpi_release: ar ? 'بيان مؤشر أسعار المستهلك' : 'CPI Release',
    nfp_release: ar ? 'بيان الوظائف خارج قطاع الزراعة' : 'NFP Release',
    gdp_release: ar ? 'بيان الناتج المحلي الإجمالي' : 'GDP Release',
    pce_release: ar ? 'بيان الإنفاق الشخصي' : 'PCE Release',
    etf_provider_update: ar ? 'تحديث مزود صندوق المؤشر' : 'ETF Provider Update',
    platform_market_data: ar ? 'بيانات السوق الموثقة' : 'Verified Platform Market Data'
  };
  return labels[type] || type;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`Cannot read ${path.relative(ROOT, file)}: ${err.message}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
