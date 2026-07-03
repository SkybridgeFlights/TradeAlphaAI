'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ensureProductionEditorialLayout, hasProductionEditorialLayout } = require('./editorial-layout-renderer');
const { assessPublicationConfidence } = require('./intelligence/publication-confidence-engine');
const { injectArticleVisual, selectChartForArticle } = require('./render-editorial-visuals');
const { injectEditorialGraphic } = require('./render-editorial-graphics');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'published-history.json');
const slug = argValue('--slug');
const execute = process.argv.includes('--execute');
const telegram = process.argv.includes('--telegram-dry-run') || process.argv.includes('--telegram-send');
const telegramSend = process.argv.includes('--telegram-send');
const refreshExisting = process.argv.includes('--refresh-existing');
let telegramDelivered = false;

if (!slug) fail('Usage: node tools/publish-reviewed-article.js --slug=<slug> [--execute] [--telegram-dry-run|--telegram-send]');

const queue = readJson(QUEUE_PATH);
const topic = (queue.topics || []).find((item) => item.slug === slug);
if (!topic) fail(`Topic not found: ${slug}`);
if (topic.status !== 'reviewed') fail(`Refusing publish: ${slug} status must be reviewed, found ${topic.status}`);
if (topic.review_status !== 'approved') fail(`Refusing publish: ${slug} review_status must be approved`);

const draftDir = path.join(ROOT, 'drafts', 'editorial', slug);
const publicEn = path.join(ROOT, 'insights', `${slug}.html`);
const publicAr = path.join(ROOT, 'ar', 'insights', `${slug}.html`);
const enLocalePath = path.join(ROOT, 'en', 'insights', `${slug}.html`);
const arContentPath = path.join(ROOT, 'data', 'localization', 'ar-insight-content', `${slug}.json`);
const draftEn = path.join(draftDir, 'en.html');
const draftAr = path.join(draftDir, 'ar.html');

if (!fs.existsSync(draftEn)) fail(`Missing reviewed EN draft: ${relative(draftEn)}`);
if (!fs.existsSync(draftAr)) fail(`Missing reviewed AR draft: ${relative(draftAr)}`);
diagnoseArticleParts(fs.readFileSync(draftEn, 'utf8'), false, relative(draftEn));
diagnoseArticleParts(fs.readFileSync(draftAr, 'utf8'), true, relative(draftAr));
if (!hasRequiredArticleParts(fs.readFileSync(draftEn, 'utf8'), false)) fail(`${relative(draftEn)} is missing required article metadata/schema/discovery/layout`);
if (!hasRequiredArticleParts(fs.readFileSync(draftAr, 'utf8'), true)) fail(`${relative(draftAr)} is missing required Arabic article metadata/schema/discovery/layout`);

// Chart selection runs against the EN body ONCE — the term-matching
// heuristic is English-only, so running it separately against the AR
// translation gave asymmetric results and broke the section-count
// contract. Both locales now inject the same chart (or neither).
const enLayoutHtml = ensureProductionEditorialLayout(fs.readFileSync(draftEn, 'utf8'), topic, 'en');
const arLayoutHtml = ensureProductionEditorialLayout(fs.readFileSync(draftAr, 'utf8'), topic, 'ar');
const sharedChart = selectChartForArticle(enLayoutHtml);
const enHtml = injectEditorialGraphic(injectArticleVisual(enLayoutHtml, 'en', sharedChart), 'en');
const arHtml = injectEditorialGraphic(injectArticleVisual(arLayoutHtml, 'ar', sharedChart), 'ar');
assertProductionLayout(enHtml, false, relative(draftEn));
assertProductionLayout(arHtml, true, relative(draftAr));

console.log(execute ? 'EXECUTE mode requested.' : 'DRY_RUN active. No files will be published.');
console.log(`Publish repository root: ${ROOT}`);
console.log(`Publish process cwd: ${process.cwd()}`);
console.log(`Would publish ${relative(draftEn)} -> ${relative(publicEn)}`);
console.log(`Would publish ${relative(draftAr)} -> ${relative(publicAr)}`);
console.log(`Would create ${relative(enLocalePath)}`);
console.log(`Would create ${relative(arContentPath)}`);
console.log('Would update: insights/index.html, ar/insights/index.html');
console.log('Would refresh: article registry, search index, SEO sitemaps, and insight indexes.');

if (!execute) process.exit(0);

const existingPublicFiles = [publicEn, publicAr].filter(fs.existsSync);
if (existingPublicFiles.length) {
  const enMatches = fs.existsSync(publicEn) && fs.readFileSync(publicEn, 'utf8') === enHtml;
  const arMatches = fs.existsSync(publicAr) && fs.readFileSync(publicAr, 'utf8') === arHtml;
  if ((!enMatches || !arMatches) && !refreshExisting) fail('Refusing to overwrite existing public article files.');
  if (!enMatches || !arMatches) {
    console.log('Existing public article files differ from reviewed drafts; refresh-existing mode will republish them.');
  } else {
    console.log('Existing public article files match reviewed drafts; resuming publish finalization.');
  }
}

// ── 1. Copy handcrafted drafts to public locations ────────────────────────────
if (refreshExisting || !fs.existsSync(publicEn)) {
  fs.writeFileSync(publicEn, enHtml, 'utf8');
  console.log(`${refreshExisting ? 'Refreshed' : 'Copied'}: ${relative(publicEn)}`);
} else {
  console.log(`Already present: ${relative(publicEn)}`);
}
if (refreshExisting || !fs.existsSync(publicAr)) {
  fs.writeFileSync(publicAr, arHtml, 'utf8');
  console.log(`${refreshExisting ? 'Refreshed' : 'Copied'}: ${relative(publicAr)}`);
} else {
  console.log(`Already present: ${relative(publicAr)}`);
}

// ── 2. Generate en/insights/<slug>.html ───────────────────────────────────────
// Identical to insights/<slug>.html but with absolute asset paths so that
// the en/insights/ depth resolves CSS/JS correctly.
generateEnLocalizedPage(slug, enHtml);
console.log(`Created: ${relative(enLocalePath)}`);

for (const output of [publicEn, publicAr, enLocalePath]) {
  if (!fs.existsSync(output)) fail(`Publish output missing after write: ${relative(output)}`);
  console.log(`Verified publish output in repo: ${relative(output)}`);
}

// ── 3. Generate ar-insight-content/<slug>.json ────────────────────────────────
// Required by checkArabicInsightBodies and generate-localized-pages.js.
generateArContentJson(slug, topic, arHtml);
console.log(`Created: ${relative(arContentPath)}`);

// ── 4. Add article cards to both insights indexes ─────────────────────────────
updateInsightsIndexes(slug, topic, enHtml, arHtml);
console.log('Updated: insights/index.html and ar/insights/index.html');

// ── 5. Regenerate derived artifacts and validate ──────────────────────────────
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
run(NPM, ['run', 'article-registry:generate']);
run(NPM, ['run', 'search:generate']);
run(NPM, ['run', 'generate:seo-sitemaps']);
run(NPM, ['run', 'check:editorial']);
run(NPM, ['run', 'check:utf8']);
run(NPM, ['run', 'check:production']);
run(NPM, ['run', 'check:seo']);
run(NPM, ['run', 'check:indexing']);
run(NPM, ['run', 'check:social-meta']);

if (telegram) {
  const confidence = assessPublicationConfidence({ slug, draftDir, write: true });
  const providerHealth = readJson(path.join(ROOT, 'data', 'provider-health.json'));
  const criticallyDegraded = providerHealth.degraded === true &&
    (!Number(providerHealth.event_count) || providerHealth.reason === 'all_providers_unavailable');
  if (confidence.confidence < confidence.confidence_threshold || !confidence.institutional_depth_passed) {
    console.warn(`Telegram skipped: publication confidence gate failed (${confidence.confidence}/${confidence.confidence_threshold}).`);
  } else if (criticallyDegraded) {
    console.warn(`Telegram skipped: macro mode critically degraded (${providerHealth.reason || 'provider unavailable'}).`);
  } else {
    const args = ['tools/telegram-publish-article.js', `--slug=${slug}`, '--locale=both'];
    if (telegramSend) args.push('--send');
    telegramDelivered = runTelegram(process.execPath, args);
  }
}

// Finalize publication only after every public artifact and derived validation
// has succeeded. This keeps the queue and publication history transactional.
const publishedAt = new Date().toISOString();
const publishDate = publishedAt.slice(0, 10);
topic.status = 'published';
topic.review_status = 'approved';
topic.autonomous_review_status = 'published';
topic.published_at = publishedAt;
topic.publish_date = publishDate;
topic.telegram_status = telegramDelivered ? 'posted' : 'skipped';
queue.updated = publishDate;
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

const history = readJson(HISTORY_PATH, { version: '1.0', publications: [] });
history.publications = Array.isArray(history.publications) ? history.publications : [];
history.publications = history.publications.filter((entry) => entry.slug !== slug);
history.publications.push({
  slug,
  publish_date: publishDate,
  published_at: publishedAt,
  workflow_run_id: process.env.GITHUB_RUN_ID || null,
  languages: ['en', 'ar'],
  content_type: 'editorial'
});
history.updated = publishDate;
fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf8');
console.log(`Publication finalized: ${slug} status=published; history updated.`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateEnLocalizedPage(slug, draftEnHtml) {
  // The draft uses ../  relative paths (correct for insights/ depth).
  // en/insights/ is one level deeper, so ../  would miss — use absolute /  instead.
  const html = draftEnHtml.replace(/(\s(?:href|src))="\.\.\/([^"]*?)"/g, '$1="/$2"');
  fs.mkdirSync(path.join(ROOT, 'en', 'insights'), { recursive: true });
  fs.writeFileSync(enLocalePath, html, 'utf8');
}

function generateArContentJson(slug, topic, arHtml) {
  const title = extractText(arHtml, /<h1>([^<]+)<\/h1>/);
  const category = extractText(arHtml, /class="insight-category-badge"[^>]*>([^<]+)<\/span>/);
  const readingTime = `${topic.estimated_read_time || 7} دقائق قراءة`;
  const lead = extractText(arHtml, /class="market-lead">([^<]+)<\/p>/);
  const summary = extractText(arHtml, /class="insight-summary-box">[\s\S]*?<p>([\s\S]*?)<\/p>\s*<\/div>/);
  const sections = extractArSections(arHtml);
  const faq = extractArFaq(arHtml);

  const content = { slug, title, category, readingTime, lead, summary, sections, faq };
  fs.writeFileSync(arContentPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
}

function extractArSections(html) {
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (!articleMatch) return [];
  const body = articleMatch[1];
  const sections = [];
  const h2Blocks = body.split(/<h2[^>]*id="([^"]+)"[^>]*>/);
  for (let i = 1; i < h2Blocks.length; i += 2) {
    const id = h2Blocks[i];
    const block = h2Blocks[i + 1] || '';
    const title = extractText(`<h2>${block.split('</h2>')[0]}</h2>`, /<h2>([^<]+)<\/h2>/);
    const afterHeading = block.split('</h2>')[1] || '';
    const paragraphs = [...afterHeading.matchAll(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/p>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(Boolean);
    if (id && (title || paragraphs.length)) {
      sections.push({ id, title: title || '', body: paragraphs });
    }
  }
  return sections;
}

function extractArFaq(html) {
  return [...html.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/details>/g)]
    .map((m) => ({
      q: m[1].replace(/<[^>]+>/g, '').trim(),
      a: m[2].replace(/<[^>]+>/g, '').trim()
    }))
    .filter((item) => item.q && item.a);
}

function updateInsightsIndexes(slug, topic, enHtml, arHtml) {
  const dataCategory = categorySlug(topic.category || '');
  const enTitle = extractText(enHtml, /<h1>([^<]+)<\/h1>/);
  const arTitle = extractText(arHtml, /<h1>([^<]+)<\/h1>/);
  const enKicker = extractText(enHtml, /class="insight-category-badge"[^>]*>([^<]+)<\/span>/);
  const arKicker = extractText(arHtml, /class="insight-category-badge"[^>]*>([^<]+)<\/span>/);
  const enDesc = extractText(enHtml, /<meta name="description" content="([^"]+)"/);
  const arDesc = extractText(arHtml, /<meta name="description" content="([^"]+)"/);

  const enCard = `<article class="market-card" data-category="${escape(dataCategory)}"><span class="market-card-kicker">${escape(enKicker)}</span><h3>${escape(enTitle)}</h3><p>${escape(enDesc)}</p><a class="market-card-link" href="/insights/${slug}.html">Read article</a></article>`;
  const arCard = `<article class="market-card" data-category="${escape(dataCategory)}"><span class="market-card-kicker">${escape(arKicker)}</span><h3>${escape(arTitle)}</h3><p>${escape(arDesc)}</p><a class="market-card-link" href="/ar/insights/${slug}.html">اقرأ المقال</a></article>`;

  const GRID_MARKER = '<div id="insight-grid" class="market-grid three">';
  injectCard(path.join(ROOT, 'insights', 'index.html'), GRID_MARKER, enCard, slug);
  injectCard(path.join(ROOT, 'ar', 'insights', 'index.html'), GRID_MARKER, arCard, slug);
}

function injectCard(indexPath, marker, card, slug) {
  const html = fs.readFileSync(indexPath, 'utf8');
  if (html.includes(`/${slug}.html`)) {
    console.log(`  Index ${relative(indexPath)}: already contains ${slug}, skipping injection.`);
    return;
  }
  const pos = html.indexOf(marker);
  if (pos === -1) fail(`Cannot find article grid marker in ${relative(indexPath)}`);
  const insertAt = pos + marker.length;
  const updated = html.slice(0, insertAt) + card + html.slice(insertAt);
  fs.writeFileSync(indexPath, updated, 'utf8');
}

function categorySlug(category) {
  const c = category.toLowerCase();
  if (c.includes('etf')) return 'etf-research';
  if (c.includes('comparison') || c.includes('vs')) return 'comparisons';
  if (c.includes('ai') || c.includes('semi') || c.includes('cloud') || c.includes('cyber') || c.includes('gpu') || c.includes('tech')) return 'ai-tech';
  return 'market-research';
}

function extractText(html, pattern) {
  const m = String(html || '').match(pattern);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function escape(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hasRequiredArticleParts(html, ar) {
  if (!/<meta name="robots" content="index,follow/.test(html)) return false;
  if (!/<link rel="canonical"/.test(html)) return false;
  if (!/<link rel="alternate" hreflang="en"/.test(html) || !/<link rel="alternate" hreflang="ar"/.test(html)) return false;
  if (!/<meta property="og:title"/.test(html) || !/<meta name="twitter:card"/.test(html)) return false;
  if (!/<script type="application\/ld\+json">[\s\S]*"Article"[\s\S]*<\/script>/.test(html)) return false;
  if (!/<script type="application\/ld\+json">[\s\S]*"FAQPage"[\s\S]*<\/script>/.test(html)) return false;
  if (!/id="related-research"/.test(html) || !/id="continue-learning"/.test(html)) return false;
  if (ar && !/<html[^>]+lang="ar"[^>]+dir="rtl"/.test(html)) return false;
  return true;
}

function diagnoseArticleParts(html, ar, label) {
  const p = (name, ok) => console.log(`[ARTICLE PUBLISH VALIDATION] ${ok ? 'PASS' : 'FAIL'} ${name}`);
  console.log(`\n[ARTICLE PUBLISH VALIDATION] --- ${label} ---`);
  p('robots index,follow',          /<meta name="robots" content="index,follow/.test(html));
  p('canonical link',               /<link rel="canonical"/.test(html));
  p('hreflang en',                  /<link rel="alternate" hreflang="en"/.test(html));
  p('hreflang ar',                  /<link rel="alternate" hreflang="ar"/.test(html));
  p('og:title',                     /<meta property="og:title"/.test(html));
  p('twitter:card',                 /<meta name="twitter:card"/.test(html));
  p('Article JSON-LD',              /<script type="application\/ld\+json">[\s\S]*"Article"[\s\S]*<\/script>/.test(html));
  p('FAQPage JSON-LD',              /<script type="application\/ld\+json">[\s\S]*"FAQPage"[\s\S]*<\/script>/.test(html));
  p('id=related-research',          /id="related-research"/.test(html));
  p('id=continue-learning',         /id="continue-learning"/.test(html));
  p('layout: body.market-page',     /<body[^>]+class="[^"]*\bmarket-page\b/i.test(html));
  p('layout: .topbar',              /class="[^"]*\btopbar\b[^"]*"/.test(html));
  p('layout: data-global-header',   /data-global-header="homepage"/.test(html));
  p('layout: .market-shell',        /class="[^"]*\bmarket-shell\b[^"]*"/.test(html));
  p('layout: .wrap',                /class="[^"]*\bwrap\b[^"]*"/.test(html));
  p('layout: .insight-hero-card',   /class="[^"]*\binsight-hero-card\b[^"]*"/.test(html));
  p('layout: .insight-layout',      /class="[^"]*\binsight-layout\b[^"]*"/.test(html));
  p('layout: .insight-article-body',/class="[^"]*\binsight-article-body\b[^"]*"/.test(html));
  p('layout: .insight-sidebar',     /class="[^"]*\binsight-sidebar\b[^"]*"/.test(html));
  p('layout: market-portal.css',    /css\/market\/market-portal\.css/.test(html));
  p('layout: global-layout.css',    /css\/global-layout\.css/.test(html));
  p('layout: language-router.js',   /js\/language-router\.js/.test(html));
  p('layout: mobile-nav.js',        /js\/mobile-nav\.js/.test(html));
  p('layout: data-locale-route',    /data-locale-route="ar"|data-locale-route="en"/.test(html));
  if (ar) p('html lang=ar dir=rtl', /<html[^>]+lang="ar"[^>]+dir="rtl"/i.test(html));
}

function assertProductionLayout(html, ar, label) {
  const conditions = [
    ['body.market-page',      /<body[^>]+class="[^"]*\bmarket-page\b/i],
    ['.topbar',               /class="[^"]*\btopbar\b[^"]*"/],
    ['data-global-header',    /data-global-header/],
    ['.market-shell',         /class="[^"]*\bmarket-shell\b[^"]*"/],
    ['.wrap',                 /class="[^"]*\bwrap\b[^"]*"/],
    ['.insight-hero-card',    /class="[^"]*\binsight-hero-card\b[^"]*"/],
    ['.insight-layout',       /class="[^"]*\binsight-layout\b[^"]*"/],
    ['.insight-article-body', /class="[^"]*\binsight-article-body\b[^"]*"/],
    ['.insight-sidebar',      /class="[^"]*\binsight-sidebar\b[^"]*"/],
    ['market-portal.css',     /css\/market\/market-portal\.css/],
    ['global-layout.css',     /css\/global-layout\.css/],
    ['language-router.js',    /js\/language-router\.js/],
    ['mobile-nav.js',         /js\/mobile-nav\.js/],
    ['data-locale-route',     /data-locale-route="ar"|data-locale-route="en"/],
  ];
  for (const [name, pattern] of conditions) {
    if (!pattern.test(html)) fail(`${label}: production layout wrapping failed — missing ${name}`);
  }
  if (ar && !/<html[^>]+lang="ar"[^>]+dir="rtl"/i.test(html)) {
    fail(`${label}: production layout wrapping failed — missing html lang=ar dir=rtl`);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status || 1);
}

function runTelegram(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.warn(`[publish] Telegram delivery failed (exit ${result.status || 1}) — publish is complete, Telegram is non-fatal`);
    return false;
  }
  return true;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${relative(file)}: ${error.message}`);
  }
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
