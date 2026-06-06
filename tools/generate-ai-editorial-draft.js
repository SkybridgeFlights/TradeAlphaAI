'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ensureProductionEditorialLayout } = require('./editorial-layout-renderer');
const { renderLongFormEditorial } = require('./editorial-longform-renderer');
const { buildEditorialContext, updateEditorialMemory } = require('./editorial-context-engine');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const DRAFT_ROOT = path.join(ROOT, 'drafts', 'editorial');
const ELIGIBLE_STATUSES = new Set(['draft', 'planned', 'queued']);
const SITE_URL = 'https://www.tradealphaai.com';

// Parse optional --slug=<value> so the brain can target a specific topic
const slugArg = process.argv.find(a => a.startsWith('--slug='));
const targetSlug = slugArg ? slugArg.slice('--slug='.length).trim() : null;

// --repair-regeneration=true allows regenerating a topic that the review engine
// temporarily set to manual_revision_required during a failed pipeline run.
// ONLY valid when combined with --slug. Must not broaden normal generation behavior.
const isRepairRegen = targetSlug && process.argv.includes('--repair-regeneration=true');

const queue = readJson(QUEUE_PATH);
const topics = Array.isArray(queue.topics) ? queue.topics : [];

// Normal slug-targeted statuses: topic may be in_review/approved/reviewed from a prior pass.
const SLUG_TARGETED_STATUSES = new Set(['draft', 'planned', 'queued', 'in_review', 'approved', 'reviewed']);
// Repair-regeneration also accepts manual_revision_required — a transient state set by the
// review engine during THIS pipeline run. After successful generation the status is
// restored to in_review by the normal generator lifecycle code below.
const REPAIR_REGEN_STATUSES = new Set([...SLUG_TARGETED_STATUSES, 'manual_revision_required']);

let topic;
if (targetSlug) {
  topic = topics.find(t => t.slug === targetSlug);
  if (!topic) fail(`--slug=${targetSlug}: topic not found in editorial queue`);
  const eligibleStatuses = isRepairRegen ? REPAIR_REGEN_STATUSES : SLUG_TARGETED_STATUSES;
  if (!eligibleStatuses.has(topic.status)) {
    fail(`--slug=${targetSlug}: topic status '${topic.status}' is not eligible for generation`);
  }
} else {
  topic = topics.find((item) => ELIGIBLE_STATUSES.has(item.status));
  if (!topic) {
    console.log('No draft topic available');
    process.exit(0);
  }
}

if (!Array.isArray(topic.language_support) || !topic.language_support.includes('en') || !topic.language_support.includes('ar')) {
  fail(`${topic.slug}: AI draft generation requires EN and AR language support`);
}

const draftDir = path.join(DRAFT_ROOT, topic.slug);
if (fs.existsSync(path.join(draftDir, 'en.html')) || fs.existsSync(path.join(draftDir, 'ar.html'))) {
  fail(`${topic.slug}: draft files already exist; refusing to overwrite review workspace`);
}

fs.mkdirSync(draftDir, { recursive: true });

const normalized = normalizeTopic(topic);
const editorialContext = buildEditorialContext(normalized);
const enHtml = ensureProductionEditorialLayout(renderLongFormEditorial(normalized, 'en', editorialContext), normalized, 'en');
const arHtml = ensureProductionEditorialLayout(renderLongFormEditorial(normalized, 'ar', editorialContext), normalized, 'ar');
fs.writeFileSync(path.join(draftDir, 'en.html'), enHtml, 'utf8');
fs.writeFileSync(path.join(draftDir, 'ar.html'), arHtml, 'utf8');
fs.writeFileSync(path.join(draftDir, 'metadata.json'), JSON.stringify(renderMetadata(normalized), null, 2) + '\n', 'utf8');
updateEditorialMemory(normalized, editorialContext, enHtml);

const prevStatus = topic.status;
topic.status = 'in_review';
topic.review_status = 'pending';
topic.revision_count = 0;
topic.last_reviewed = null;
queue.updated = new Date().toISOString().slice(0, 10);
if (isRepairRegen && prevStatus === 'manual_revision_required') {
  console.log(`${topic.slug}: repair regeneration restored status: manual_revision_required -> in_review`);
}
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

console.log(`Generated AI-assisted editorial draft: ${relative(draftDir)}`);
console.log(`Editorial angle: ${editorialContext.selected_angle}; market context: ${editorialContext.evidence_status}`);
console.log(`${topic.slug}: status set to in_review; review_status set to pending`);
console.log('Draft only. No public pages, sitemaps, search index, registry, or Telegram actions were updated.');

if (attemptAutoApproval(topic)) {
  console.log(`${topic.slug}: AUTO-APPROVED - long-form editorial checks passed (score >= 90). status=reviewed, review_status=approved.`);
  console.log('The article is eligible for autonomous publishing on its target_publish_date.');
} else {
  console.log(`${topic.slug}: requires manual editorial review. Queue status remains in_review/pending.`);
}

function attemptAutoApproval(topic) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'score-generated-content.js'), `--slug=${topic.slug}`, '--type=editorial', '--min-score=90'],
    { cwd: ROOT, encoding: 'utf8' }
  );

  if (result.status !== 0 || !result.stdout) {
    console.log('Auto-approval skipped: scorer did not complete successfully.');
    if (result.stderr) console.log(result.stderr.trim());
    return false;
  }

  let scoreReport;
  try {
    scoreReport = JSON.parse(result.stdout);
  } catch {
    console.log('Auto-approval skipped: could not parse scorer output.');
    return false;
  }

  const entry = (scoreReport.results || []).find((r) => r.slug === topic.slug);
  if (!entry) {
    console.log(`Auto-approval skipped: no score entry found for ${topic.slug}.`);
    return false;
  }

  console.log(`Quality score: ${entry.quality_score}/100`);

  if (entry.quality_score < 90) {
    console.log(`Auto-approval denied: score ${entry.quality_score} < 90. Manual review required.`);
    logFailedChecks(entry.checks);
    return false;
  }

  const failedChecks = Object.entries(entry.checks).filter(([, passed]) => !passed);
  if (failedChecks.length > 0) {
    console.log('Auto-approval denied: one or more safety checks failed. Manual review required.');
    logFailedChecks(entry.checks);
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  topic.status = 'reviewed';
  topic.review_status = 'approved';
  topic.last_reviewed = today;
  queue.updated = today;
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
  return true;
}

function logFailedChecks(checks) {
  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) console.log(`  FAILED check: ${name}`);
  }
}

function normalizeTopic(topic) {
  const titleEn = cleanText(topic.title_en) || titleFromSlug(topic.slug);
  const titleAr = safeArabic(topic.title_ar) ? cleanText(topic.title_ar) : arabicTitleFallback(topic);
  const categoryAr = arabicCategory(topic.category);
  const descriptionEn = topic.slug === 'healthcare-etf-research-guide'
    ? 'A research-led comparison of XLV, VHT, and IYH across index design, concentration, healthcare subindustries, liquidity, volatility, and macro sensitivity.'
    : `Institutional educational research on ${titleEn.toLowerCase()}, including exposure mechanics, concentration, liquidity, macro sensitivity, and risk transmission.`;
  const descriptionAr = topic.slug === 'healthcare-etf-research-guide'
    ? 'مقارنة بحثية بين XLV وVHT وIYH تشمل بناء المؤشر والتركيز والصناعات الصحية والسيولة والتقلب والحساسية للاقتصاد الكلي.'
    : `${titleAr} ضمن بحث تعليمي مؤسسي يشرح آليات التعرض والتركيز والسيولة والحساسية الكلية وانتقال المخاطر دون تقديم نصيحة مالية.`;

  return {
    ...topic,
    title_en: titleEn,
    title_ar: titleAr,
    category_ar: categoryAr,
    description_en: descriptionEn,
    description_ar: descriptionAr,
    related_stocks: Array.isArray(topic.related_stocks) ? topic.related_stocks : [],
    related_etfs: Array.isArray(topic.related_etfs) ? topic.related_etfs : [],
    related_comparisons: Array.isArray(topic.related_comparisons) ? topic.related_comparisons : [],
    related_hubs: Array.isArray(topic.related_hubs) ? topic.related_hubs : []
  };
}

function renderArticle(topic, locale) {
  const ar = locale === 'ar';
  const lang = ar ? 'ar' : 'en';
  const dir = ar ? 'rtl' : 'ltr';
  const title = ar ? topic.title_ar : topic.title_en;
  const description = ar ? topic.description_ar : topic.description_en;
  const canonical = ar ? `${SITE_URL}/ar/insights/${topic.slug}.html` : `${SITE_URL}/insights/${topic.slug}.html`;
  const article = articleSchema(topic, locale);
  const faq = faqSchema(topic, locale);
  const breadcrumb = breadcrumbSchema(topic, locale);

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="index,follow" />
  <title>${escapeHtml(title)} | TradeAlphaAI</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${SITE_URL}/insights/${topic.slug}.html" />
  <link rel="alternate" hreflang="ar" href="${SITE_URL}/ar/insights/${topic.slug}.html" />
  <link rel="alternate" hreflang="x-default" href="${SITE_URL}/insights/${topic.slug}.html" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE_URL}/Image/og-image.svg" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <script type="application/ld+json">
${JSON.stringify(article, null, 2)}
  </script>
  <script type="application/ld+json">
${JSON.stringify(faq, null, 2)}
  </script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumb, null, 2)}
  </script>
</head>
<body>
  <main>
    <article class="market-article editorial-draft" data-editorial-draft="true" data-status="in_review">
      <header>
        <span class="insight-category-badge">${escapeHtml(ar ? topic.category_ar : topic.category)}</span>
        <p class="reading-time">${escapeHtml(ar ? `${topic.estimated_read_time} دقائق قراءة` : `${topic.estimated_read_time} min read`)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="market-lead">${escapeHtml(description)}</p>
      </header>

      <section id="executive-summary">
        <h2>${ar ? 'ملخص تنفيذي' : 'Executive summary'}</h2>
        <p>${escapeHtml(ar ? arabicSummary(topic) : englishSummary(topic))}</p>
      </section>

      <section id="key-takeaways">
        <h2>${ar ? 'أهم النقاط' : 'Key takeaways'}</h2>
        <ul>
${renderTakeaways(topic, ar)}
        </ul>
      </section>

      <section id="research-framework">
        <h2>${ar ? 'إطار البحث' : 'Research framework'}</h2>
        <p>${escapeHtml(ar ? arabicFramework(topic) : englishFramework(topic))}</p>
        <p>${escapeHtml(ar ? 'يركز هذا المسار على عوامل ثابتة مثل نوع التعرض، التركز، التنويع، تكلفة الصندوق، وسلوك المخاطر. يجب على المحرر مراجعة أي مثال قبل النشر النهائي.' : 'This path focuses on durable factors such as exposure type, concentration, diversification, fund cost, and risk behavior. Editors should review any example before final publication.')}</p>
      </section>

      <section id="related-research">
        <h2>${ar ? 'أبحاث مرتبطة' : 'Related research'}</h2>
        <ul>
${renderRelatedLinks(topic, ar)}
        </ul>
      </section>

      <section id="continue-learning">
        <h2>${ar ? 'تابع التعلم' : 'Continue learning'}</h2>
        <ul>
${renderContinueLearning(ar)}
        </ul>
      </section>

      <section id="faq">
        <h2>${ar ? 'أسئلة شائعة' : 'FAQ'}</h2>
${renderFaqBlocks(ar)}
      </section>

      <footer>
        <p class="educational-disclaimer">${ar ? 'تنبيه تعليمي: هذا المحتوى لأغراض تعليمية ومعلوماتية فقط ولا يمثل نصيحة مالية أو استثمارية أو توصية بشراء أو بيع أي ورقة مالية.' : 'Educational disclaimer: this content is for educational and informational purposes only and does not constitute financial or investment advice, or a recommendation to buy or sell any security.'}</p>
      </footer>
    </article>
  </main>
  <nav class="locale-links" aria-label="Language">
    <a class="lang-switch" data-locale-route="ar" href="/ar/insights/${topic.slug}.html">${ar ? 'العربية' : 'Arabic'}</a>
    <a class="lang-switch" data-locale-route="en" href="/insights/${topic.slug}.html">${ar ? 'الإنجليزية' : 'English'}</a>
  </nav>
</body>
</html>
`;
}

function renderMetadata(topic) {
  return {
    slug: topic.slug,
    source: 'deterministic-template',
    status: 'in_review',
    review_status: 'pending',
    generated_at: new Date().toISOString(),
    publish_target: topic.target_publish_date,
    languages: ['en', 'ar'],
    canonical_placeholder: {
      en: `${SITE_URL}/insights/${topic.slug}.html`,
      ar: `${SITE_URL}/ar/insights/${topic.slug}.html`
    },
    review_required: true,
    auto_publish: false,
    telegram_ready: false,
    public_site_updated: false
  };
}

function articleSchema(topic, locale) {
  const ar = locale === 'ar';
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: ar ? topic.title_ar : topic.title_en,
    description: ar ? topic.description_ar : topic.description_en,
    inLanguage: locale,
    datePublished: topic.target_publish_date,
    dateModified: new Date().toISOString().slice(0, 10),
    author: { '@type': 'Organization', name: 'TradeAlphaAI' },
    publisher: { '@type': 'Organization', name: 'TradeAlphaAI' },
    mainEntityOfPage: `${SITE_URL}${ar ? '/ar' : ''}/insights/${topic.slug}.html`
  };
}

function breadcrumbSchema(topic, locale) {
  const ar = locale === 'ar';
  const prefix = ar ? '/ar' : '';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: ar ? 'رؤى السوق' : 'Market Insights', item: `${SITE_URL}${prefix}/insights/` },
      { '@type': 'ListItem', position: 3, name: ar ? topic.title_ar : topic.title_en, item: `${SITE_URL}${prefix}/insights/${topic.slug}.html` }
    ]
  };
}

function faqSchema(topic, locale) {
  const ar = locale === 'ar';
  const items = ar
    ? [
        ['هل هذا المحتوى نصيحة مالية؟', 'لا. هذا المحتوى تعليمي فقط ولا يقدم توصية بشراء أو بيع أي ورقة مالية.'],
        ['ما الذي يجب مراجعته قبل النشر؟', 'يجب مراجعة الدقة اللغوية، الروابط، المخطط المنظم، التكافؤ بين الإنجليزية والعربية، وأي عبارة قد تبدو زمنية أو توصية مباشرة.'],
        ['كيف يستخدم القارئ هذا البحث؟', 'يمكن استخدامه كإطار تعليمي لفهم الموضوع وربطه بصفحات المقارنات والصناديق والقطاعات ذات الصلة.']
      ]
    : [
        ['Is this content financial advice?', 'No. This content is educational only and does not recommend buying or selling any security.'],
        ['What should be reviewed before publication?', 'Editors should review language quality, links, schema, bilingual parity, and any phrase that may sound time-sensitive or advisory.'],
        ['How can readers use this research?', 'Readers can use it as an educational framework connected to related comparison, ETF, stock, and sector research pages.']
      ];

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([name, answer]) => ({
      '@type': 'Question',
      name,
      acceptedAnswer: { '@type': 'Answer', text: answer }
    }))
  };
}

function renderTakeaways(topic, ar) {
  const items = ar
    ? [
        `يربط هذا الدليل موضوع ${topic.title_ar} بعوامل تعليمية مثل التنويع والمخاطر والتركز.`,
        'تساعد الروابط المرتبطة القارئ على الانتقال بين الأصول والمقارنات ومحاور القطاعات دون تغيير سياق البحث.',
        'يجب أن تبقى النسخة النهائية دائمة الصلاحية وخالية من الأخبار غير الموثقة أو توقعات الأداء.'
      ]
    : [
        `This guide connects ${topic.title_en} to evergreen factors such as diversification, risk, and concentration.`,
        'Related links help readers move between assets, comparisons, and sector hubs without losing research context.',
        'The final version should remain evergreen and avoid unsourced news, predictions, or performance claims.'
      ];
  return items.map((item) => `          <li>${escapeHtml(item)}</li>`).join('\n');
}

function renderRelatedLinks(topic, ar) {
  const prefix = ar ? '/ar' : '';
  const candidates = [];
  for (const symbol of topic.related_stocks) candidates.push([`${prefix}/stocks/${slugify(symbol)}.html`, symbol]);
  for (const symbol of topic.related_etfs) candidates.push([`${prefix}/etfs/${slugify(symbol)}.html`, symbol]);
  for (const item of topic.related_comparisons) candidates.push([`${prefix}/compare/${item}.html`, item.toUpperCase().replace(/-/g, ' ')]);
  for (const item of topic.related_hubs) candidates.push([`${prefix}/${item}.html`, titleCase(item)]);
  // Only include links that exist on disk to satisfy internal_link_resolution
  const links = candidates.filter(([href]) => {
    const normalized = href.replace(/^\//, '');
    return fs.existsSync(path.join(ROOT, normalized)) || fs.existsSync(path.join(ROOT, normalized, 'index.html'));
  });
  return links.slice(0, 12).map(([href, label]) => `          <li><a href="${href}">${escapeHtml(label)}</a></li>`).join('\n');
}

function renderContinueLearning(ar) {
  const links = ar
    ? [
        ['/ar/insights/index.html', 'مكتبة الرؤى التعليمية'],
        ['/ar/rankings.html', 'تصنيفات السوق'],
        ['/ar/etfs.html', 'أبحاث صناديق المؤشرات'],
        ['/ar/stocks.html', 'أبحاث الأسهم']
      ]
    : [
        ['/insights/index.html', 'Educational insights library'],
        ['/rankings.html', 'Market rankings'],
        ['/etfs.html', 'ETF research'],
        ['/stocks.html', 'Stock research']
      ];
  return links.map(([href, label]) => `          <li><a href="${href}">${escapeHtml(label)}</a></li>`).join('\n');
}

function renderFaqBlocks(ar) {
  const items = ar
    ? [
        ['هل هذا المحتوى نصيحة مالية؟', 'لا. هذا المحتوى تعليمي فقط ولا يقدم توصية بشراء أو بيع أي ورقة مالية.'],
        ['ما الذي يجب مراجعته قبل النشر؟', 'يجب مراجعة الدقة اللغوية، الروابط، المخطط المنظم، التكافؤ بين الإنجليزية والعربية، وأي عبارة قد تبدو زمنية أو توصية مباشرة.'],
        ['كيف يستخدم القارئ هذا البحث؟', 'يمكن استخدامه كإطار تعليمي لفهم الموضوع وربطه بصفحات المقارنات والصناديق والقطاعات ذات الصلة.']
      ]
    : [
        ['Is this content financial advice?', 'No. This content is educational only and does not recommend buying or selling any security.'],
        ['What should be reviewed before publication?', 'Editors should review language quality, links, schema, bilingual parity, and any phrase that may sound time-sensitive or advisory.'],
        ['How can readers use this research?', 'Readers can use it as an educational framework connected to related comparison, ETF, stock, and sector research pages.']
      ];
  return items.map(([q, a], index) => `        <details${index === 0 ? ' open' : ''}><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join('\n');
}

function englishSummary(topic) {
  return `${topic.title_en} is a draft educational research article for the ${topic.discovery_cluster || topic.category} cluster. It should explain the research framework, link to relevant assets, and avoid claims that depend on unsourced news or short-term forecasts.`;
}

function arabicSummary(topic) {
  return `${topic.title_ar} مسودة بحثية تعليمية ضمن مجموعة ${arabicDiscovery(topic.discovery_cluster || topic.category)}. يجب أن تشرح إطار البحث، وتربط القارئ بالصفحات ذات الصلة، وتتجنب الأخبار غير الموثقة أو التوقعات قصيرة الأجل.`;
}

function englishFramework(topic) {
  return `Use this draft to compare the topic through exposure, concentration, liquidity, fees, and risk context. Related symbols include ${(topic.related_etfs.concat(topic.related_stocks)).slice(0, 6).join(', ') || 'market assets'}.`;
}

function arabicFramework(topic) {
  const symbols = topic.related_etfs.concat(topic.related_stocks).slice(0, 6).join('، ') || 'أصول السوق';
  return `استخدم هذه المسودة لمقارنة الموضوع من خلال التعرض، التركز، السيولة، الرسوم، وسياق المخاطر. تشمل الرموز المرتبطة: ${symbols}.`;
}

function arabicTitleFallback(topic) {
  const map = {
    'etf-diversification-basics': 'أساسيات تنويع صناديق المؤشرات: المكونات والقطاعات والتداخل',
    'growth-vs-value-etf-research-framework': 'إطار بحث صناديق النمو مقابل صناديق القيمة',
    'healthcare-etf-research-guide': 'دليل بحث صناديق الرعاية الصحية: السمات الدفاعية ومخاطر القطاع',
    'semiconductor-etf-risk-research': 'بحث مخاطر صناديق أشباه الموصلات: الدورات والتركيز والتقلب',
    'defensive-investing-etf-checklist': 'قائمة فحص صناديق الاستثمار الدفاعي: بيتا والتراجع والدخل',
    'how-to-compare-two-etfs': 'كيفية مقارنة صندوقي مؤشرات: المؤشر والتكلفة والمكونات والمخاطر'
  };
  return map[topic.slug] || `دليل تعليمي حول ${arabicCategory(topic.category)}`;
}

function arabicCategory(category) {
  const value = String(category || '').toLowerCase();
  if (value.includes('beginner')) return 'استثمار للمبتدئين';
  if (value.includes('comparison')) return 'مقارنات تعليمية';
  if (value.includes('sector')) return 'أبحاث القطاعات';
  if (value.includes('etf')) return 'تعليم صناديق المؤشرات';
  return 'أبحاث تعليمية';
}

function arabicDiscovery(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('beginner')) return 'استثمار المبتدئين';
  if (text.includes('dividend')) return 'استثمار التوزيعات';
  if (text.includes('defensive')) return 'الاستثمار الدفاعي';
  if (text.includes('semiconductor')) return 'أشباه الموصلات';
  if (text.includes('market sectors')) return 'قطاعات السوق';
  return 'الأبحاث التعليمية';
}

function safeArabic(value) {
  const text = String(value || '');
  return /[\u0600-\u06FF]/.test(text) && !/[\uFFFD]/.test(text) && !/\?{3,}/.test(text);
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function titleFromSlug(slug) {
  return titleCase(slug || 'editorial draft');
}

function titleCase(value) {
  return String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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
  } catch (error) {
    fail(`${relative(file)}: ${error.message}`);
  }
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
