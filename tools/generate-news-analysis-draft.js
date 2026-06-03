'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'news-analysis-queue.json');
const OUT_DIR = path.join(ROOT, 'drafts', 'news-analysis');
const ALLOWED_SOURCE_TYPES = new Set([
  'sec_filing',
  'official_earnings_report',
  'federal_reserve_release',
  'cpi_release',
  'nfp_release',
  'etf_provider_update',
  'platform_market_data'
]);

const queue = readJson(QUEUE_PATH);
const topic = (queue.topics || []).find((item) => item.status === 'planned' || item.status === 'draft');

if (!topic) {
  console.log('No sourced news-analysis topic available');
  process.exit(0);
}

if (!Array.isArray(topic.sources) || topic.sources.length === 0) {
  console.log('No sourced news-analysis topic available');
  process.exit(0);
}

const invalidSource = topic.sources.find((source) => !source.url || !ALLOWED_SOURCE_TYPES.has(source.type));
if (invalidSource) fail(`${topic.slug}: news analysis source is missing url or has unsupported type`);

const dir = path.join(OUT_DIR, topic.slug);
if (fs.existsSync(path.join(dir, 'en.html')) || fs.existsSync(path.join(dir, 'ar.html'))) fail(`${topic.slug}: draft already exists`);
fs.mkdirSync(dir, { recursive: true });

const sourceList = topic.sources.map((source) => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title || source.type)}</a></li>`).join('\n');
const titleEn = topic.title_en || 'Sourced Market News Analysis';
const titleAr = topic.title_ar || 'تحليل تعليمي لخبر موثق في السوق';
const disclaimerEn = 'This content is educational market commentary only and does not constitute financial advice or investment recommendations.';
const disclaimerAr = 'هذا المحتوى عبارة عن تحليل وتعليق تعليمي للأسواق فقط ولا يُعتبر نصيحة مالية أو توصية شراء أو بيع.';

fs.writeFileSync(path.join(dir, 'en.html'), render('en', titleEn, topic.summary_en || 'Educational sourced news analysis draft.', sourceList, disclaimerEn), 'utf8');
fs.writeFileSync(path.join(dir, 'ar.html'), render('ar', titleAr, topic.summary_ar || 'مسودة تحليل تعليمي لخبر موثق.', sourceList, disclaimerAr), 'utf8');
fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({ slug: topic.slug, content_type: 'news_analysis', sources: topic.sources, auto_publish: false }, null, 2) + '\n', 'utf8');

topic.status = 'in_review';
topic.review_status = 'pending';
queue.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
console.log(`Generated sourced news-analysis draft: drafts/news-analysis/${topic.slug}`);

function render(locale, title, summary, sources, disclaimer) {
  const ar = locale === 'ar';
  return `<!doctype html>
<html lang="${locale}" dir="${ar ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8" /><title>${escapeHtml(title)} | TradeAlphaAI</title><meta name="robots" content="noindex,nofollow" /></head>
<body><main><article data-content-type="news_analysis"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(summary)}</p><section id="sources"><h2>${ar ? 'المصادر' : 'Sources'}</h2><ul>${sources}</ul></section><section id="context"><h2>${ar ? 'السياق التعليمي' : 'Educational context'}</h2><p>${ar ? 'اشرح الحدث وتداعياته التعليمية دون لغة جازمة أو توصيات.' : 'Explain the event and educational implications without certainty language or recommendations.'}</p></section><footer><p class="educational-disclaimer">${escapeHtml(disclaimer)}</p></footer></article></main></body></html>
`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
