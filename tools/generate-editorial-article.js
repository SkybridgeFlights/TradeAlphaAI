'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const OUT_DIR = path.join(ROOT, 'drafts', 'editorial');
const slug = argValue('--slug');
const mode = argValue('--mode') || 'draft';

if (!slug) fail('Usage: node tools/generate-editorial-article.js --slug=<queue-slug> [--mode=draft]');
if (mode !== 'draft') fail('This tool only writes draft skeletons. Publishing is intentionally unsupported.');

const queue = readJson(QUEUE_PATH);
const topic = queue.topics.find((item) => item.slug === slug);
if (!topic) fail(`Editorial topic not found: ${slug}`);
if (topic.status === 'published') fail('Refusing to generate a draft for a topic already marked published.');
if (!Array.isArray(topic.language_support) || !topic.language_support.includes('en') || !topic.language_support.includes('ar')) {
  fail('Topic must support both English and Arabic before draft generation.');
}

const dir = path.join(OUT_DIR, topic.slug);
fs.mkdirSync(dir, { recursive: true });

writeIfMissing(path.join(dir, 'en.html'), renderArticle(topic, 'en'));
writeIfMissing(path.join(dir, 'ar.html'), renderArticle(topic, 'ar'));
writeIfMissing(path.join(dir, 'metadata.json'), JSON.stringify(renderMetadata(topic), null, 2) + '\n');

console.log(`Draft skeleton created: ${relative(dir)}`);
console.log('Review required before any sitemap, search index, or public route update.');

function renderArticle(topic, locale) {
  const isAr = locale === 'ar';
  const title = isAr ? topic.title_ar : topic.title_en;
  const lang = isAr ? 'ar' : 'en';
  const dir = isAr ? 'rtl' : 'ltr';
  const canonicalPath = isAr ? `/ar/insights/${topic.slug}.html` : `/insights/${topic.slug}.html`;
  const description = isAr
    ? `مسودة تعليمية للمراجعة حول ${topic.title_ar}. لا تمثل نصيحة مالية.`
    : `Editorial review draft for ${topic.title_en}. Educational content only; no financial advice.`;
  const relatedLinks = renderRelatedLinks(topic, isAr);
  const faq = isAr ? renderArabicFaq() : renderEnglishFaq();

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeHtml(title)} | Editorial Draft | TradeAlphaAI</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="https://www.tradealphaai.com${canonicalPath}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/insights/${topic.slug}.html" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/insights/${topic.slug}.html" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/insights/${topic.slug}.html" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://www.tradealphaai.com${canonicalPath}" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
${JSON.stringify(articleSchema(topic, locale), null, 2)}
  </script>
</head>
<body>
  <main>
    <article data-editorial-draft="true" data-status="${escapeHtml(topic.status)}">
      <header>
        <p>${escapeHtml(topic.category)} / ${escapeHtml(topic.evergreen_category)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </header>

      <section id="executive-summary">
        <h2>${isAr ? 'ملخص تنفيذي' : 'Executive summary'}</h2>
        <p>${isAr ? 'اكتب ملخصاً تعليمياً موجزاً يشرح سؤال البحث ونطاق المقال وما لا يغطيه. تجنب أي توصيات شراء أو بيع.' : 'Write a concise educational summary explaining the research question, article scope, and what the article does not cover. Avoid buy or sell recommendations.'}</p>
      </section>

      <section id="key-takeaways">
        <h2>${isAr ? 'أهم النقاط' : 'Key takeaways'}</h2>
        <ul>
          <li>${isAr ? 'نقطة تعليمية أولى تحتاج مراجعة تحريرية.' : 'First educational takeaway pending editorial review.'}</li>
          <li>${isAr ? 'نقطة تعليمية ثانية تربط الموضوع بالمخاطر أو التنويع.' : 'Second educational takeaway connecting the topic to risk or diversification.'}</li>
          <li>${isAr ? 'نقطة تعليمية ثالثة تربط القارئ بصفحات البحث ذات الصلة.' : 'Third educational takeaway linking readers to related research pages.'}</li>
        </ul>
      </section>

      <section id="research-framework">
        <h2>${isAr ? 'إطار البحث' : 'Research framework'}</h2>
        <p>${isAr ? 'اكتب محتوى دائم الصلاحية فقط. لا تضف أخباراً أو أرباحاً أو توقعات سعرية غير موثقة.' : 'Write evergreen content only. Do not add unsourced news, earnings claims, or price forecasts.'}</p>
      </section>

      <section id="related-research">
        <h2>${isAr ? 'أبحاث مرتبطة' : 'Related research'}</h2>
        <ul>
${relatedLinks}
        </ul>
      </section>

      <section id="faq">
        <h2>${isAr ? 'أسئلة شائعة' : 'FAQ'}</h2>
${faq}
      </section>

      <section id="discovery">
        <h2>${isAr ? 'تابع التعلم' : 'Continue learning'}</h2>
        <p>${isAr ? 'أضف روابط إلى التصنيفات والمحاور والمقارنات بعد المراجعة النهائية.' : 'Add links to rankings, hubs, and comparison pages after final review.'}</p>
      </section>

      <footer>
        <p>${isAr ? 'تنبيه تعليمي: هذا المحتوى لأغراض تعليمية ومعلوماتية فقط ولا يمثل نصيحة مالية أو استثمارية.' : 'Educational disclaimer: this content is for educational and informational purposes only and does not constitute financial or investment advice.'}</p>
      </footer>
    </article>
  </main>
</body>
</html>
`;
}

function renderMetadata(topic) {
  return {
    slug: topic.slug,
    status: topic.status,
    generated_at: new Date().toISOString(),
    publish_target: topic.target_publish_date,
    languages: topic.language_support,
    review_required: true,
    auto_publish: false,
    telegram_ready: false
  };
}

function articleSchema(topic, locale) {
  const isAr = locale === 'ar';
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: isAr ? topic.title_ar : topic.title_en,
    description: isAr ? `مسودة تعليمية للمراجعة حول ${topic.title_ar}.` : `Editorial review draft for ${topic.title_en}.`,
    inLanguage: locale,
    datePublished: topic.target_publish_date,
    dateModified: topic.target_publish_date,
    author: { '@type': 'Organization', name: 'TradeAlphaAI' },
    publisher: { '@type': 'Organization', name: 'TradeAlphaAI' },
    mainEntityOfPage: `https://www.tradealphaai.com${isAr ? '/ar' : ''}/insights/${topic.slug}.html`
  };
}

function renderRelatedLinks(topic, isAr) {
  const links = [];
  for (const symbol of topic.related_stocks || []) links.push([`${isAr ? '/ar' : ''}/stocks/${slugify(symbol)}.html`, symbol]);
  for (const symbol of topic.related_etfs || []) links.push([`${isAr ? '/ar' : ''}/etfs/${slugify(symbol)}.html`, symbol]);
  for (const item of topic.related_comparisons || []) links.push([`${isAr ? '/ar' : ''}/compare/${item}.html`, item.toUpperCase().replace(/-/g, ' ')]);
  for (const item of topic.related_hubs || []) links.push([`${isAr ? '/ar' : ''}/${item}.html`, item.replace(/-/g, ' ')]);
  return links.slice(0, 12).map(([href, label]) => `          <li><a href="${href}">${escapeHtml(label)}</a></li>`).join('\n');
}

function renderEnglishFaq() {
  return `        <details open><summary>Is this article financial advice?</summary><p>No. This draft is educational only and must not recommend buying or selling any security.</p></details>
        <details><summary>What sources can editors use?</summary><p>Editors should use existing TradeAlphaAI static research pages, fund methodology pages, official issuer documents, and clearly evergreen educational context.</p></details>
        <details><summary>What should be reviewed before publication?</summary><p>Review metadata, schema, related links, bilingual parity, disclaimers, and any claims that could become time-sensitive.</p></details>`;
}

function renderArabicFaq() {
  return `        <details open><summary>هل هذا المقال نصيحة مالية؟</summary><p>لا. هذه المسودة تعليمية فقط ولا يجوز أن توصي بشراء أو بيع أي ورقة مالية.</p></details>
        <details><summary>ما المصادر التي يمكن للمحرر استخدامها؟</summary><p>يجب استخدام صفحات TradeAlphaAI البحثية الثابتة، ووثائق الجهات المصدرة للصناديق، وسياق تعليمي دائم الصلاحية.</p></details>
        <details><summary>ما الذي يجب مراجعته قبل النشر؟</summary><p>تجب مراجعة البيانات الوصفية والمخطط والروابط ذات الصلة والتكافؤ اللغوي والتنبيهات وأي ادعاءات قد تصبح زمنية.</p></details>`;
}

function writeIfMissing(file, content) {
  if (fs.existsSync(file)) fail(`Refusing to overwrite existing draft: ${relative(file)}`);
  fs.writeFileSync(file, content, 'utf8');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`Unable to read ${relative(file)}: ${error.message}`);
  }
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
