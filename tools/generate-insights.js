'use strict';
/* tools/generate-insights.js
   Programmatic insight-article generator for TradeAlphaAI.
   Usage: node tools/generate-insights.js
   Reads:  data/insight-topics.json  +  templates/insight-template.html
   Writes: insights/[slug].html  (skips existing by default)
           sitemap.xml and sitemap-market.xml updated automatically
   Options:
     --force   Overwrite existing files
     --dry-run Print what would be generated without writing
*/

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const TEMPLATE  = fs.readFileSync(path.join(ROOT, 'templates/insight-template.html'), 'utf8');
const TOPICS    = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/insight-topics.json'), 'utf8'));

const BASE_URL   = 'https://www.tradealphaai.com';
const FORCE      = process.argv.includes('--force');
const DRY_RUN    = process.argv.includes('--dry-run');

/* ---- HTML escape ---- */
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---- Format date ---- */
function displayDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function plainText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function introSummary(a) {
  if (a.introSummary) return a.introSummary;
  const first = plainText((a.sections && a.sections[0] && a.sections[0].paragraphs && a.sections[0].paragraphs[0]) || a.lead);
  return first.length > 230 ? first.slice(0, 227).replace(/\s+\S*$/, '') + '...' : first;
}

function relatedSymbols(a) {
  if (a.relatedSymbols && a.relatedSymbols.length) return a.relatedSymbols;
  const found = new Set();
  const corpus = JSON.stringify([a.h1, a.lead, a.sidebarLinks, a.sections]);
  for (const symbol of ['NVDA', 'AMD', 'AVGO', 'SMCI', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AAPL', 'TSLA', 'SPY', 'QQQ', 'SOXX', 'XLK', 'VTI', 'VOO', 'SCHD', 'TLT', 'GLD', 'IWM']) {
    if (corpus.includes(symbol)) found.add(symbol);
  }
  return [...found].slice(0, 6);
}

function topicTags(a) {
  if (a.tags && a.tags.length) return a.tags;
  const tags = new Set([a.category]);
  const text = `${a.h1} ${a.lead}`.toLowerCase();
  if (text.includes('ai')) tags.add('AI Infrastructure');
  if (text.includes('gpu') || text.includes('semiconductor') || text.includes('chip')) tags.add('Semiconductors');
  if (text.includes('etf') || text.includes('index')) tags.add('ETF Education');
  if (text.includes('rate') || text.includes('fed') || text.includes('macro')) tags.add('Macro Risk');
  if (text.includes('portfolio') || text.includes('diversification') || text.includes('beta')) tags.add('Portfolio Risk');
  return [...tags].slice(0, 5);
}

function buildChips(items, className) {
  const values = (items || []).filter(Boolean);
  if (!values.length) return '<span class="insight-chip muted">Research Context</span>';
  return values.map((item) => `<span class="${className || 'insight-chip'}">${esc(item)}</span>`).join('');
}

/* ---- Build JSON-LD ---- */
function buildJsonLd(a) {
  const faqEntities = (a.faqs || []).map(f => ({
    '@type': 'Question',
    'name': f.question,
    'acceptedAnswer': { '@type': 'Answer', 'text': f.answer }
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'TradeAlphaAI', 'item': BASE_URL + '/' },
          { '@type': 'ListItem', 'position': 2, 'name': 'Market Insights', 'item': BASE_URL + '/insights/' },
          { '@type': 'ListItem', 'position': 3, 'name': a.breadcrumbLabel || a.h1, 'item': BASE_URL + '/insights/' + a.slug + '.html' }
        ]
      },
      {
        '@type': 'Article',
        'headline': a.h1,
        'description': a.metaDescription,
        'datePublished': a.datePublished,
        'dateModified': a.dateModified || a.datePublished,
        'author': { '@type': 'Organization', 'name': 'TradeAlphaAI', 'url': BASE_URL },
        'publisher': { '@type': 'Organization', 'name': 'TradeAlphaAI', 'url': BASE_URL },
        'url': BASE_URL + '/insights/' + a.slug + '.html',
        'about': [{ '@type': 'Thing', 'name': a.category }],
        'mainEntityOfPage': { '@type': 'WebPage', '@id': BASE_URL + '/insights/' + a.slug + '.html' }
      },
      ...(faqEntities.length ? [{ '@type': 'FAQPage', 'mainEntity': faqEntities }] : [])
    ]
  };

  return JSON.stringify(schema, null, 2);
}

/* ---- Build article body HTML ---- */
function buildArticleBody(a) {
  let html = '';

  for (const section of (a.sections || [])) {
    html += `\n            <h2 id="${section.id}">${esc(section.heading)}</h2>\n`;

    for (const p of (section.paragraphs || [])) {
      html += `            <p class="market-copy">${p}</p>\n`;
    }

    if (section.bullets && section.bullets.length) {
      html += '            <ul>\n';
      for (const b of section.bullets) {
        html += `              <li>${b}</li>\n`;
      }
      html += '            </ul>\n';
    }

    if (section.stats && section.stats.length) {
      html += '            <div class="insight-stat-grid" style="margin:20px 0">\n';
      for (const s of section.stats) {
        html += '              <div class="insight-stat-card">\n';
        html += `                <span>${esc(s.label)}</span>\n`;
        html += `                <strong>${esc(s.value)}</strong>\n`;
        html += `                <p>${esc(s.context)}</p>\n`;
        html += '              </div>\n';
      }
      html += '            </div>\n';
    }

    if (section.pullQuote) {
      html += `            <div class="pull-quote"><p>${esc(section.pullQuote)}</p></div>\n`;
    }
  }

  if (a.faqs && a.faqs.length) {
    html += `\n            <h2 id="s-faq">Frequently Asked Questions</h2>\n`;
    html += '            <div class="stock-faq" style="margin-top:0">\n';
    for (const f of a.faqs) {
      html += '              <details>\n';
      html += `                <summary>${esc(f.question)}</summary>\n`;
      html += `                <p>${esc(f.answer)}</p>\n`;
      html += '              </details>\n';
    }
    html += '            </div>\n';
  }

  return html;
}

/* ---- Build TOC items HTML ---- */
function buildTocItems(a) {
  let html = '';
  for (const t of (a.tocItems || [])) {
    html += `                <li><a href="#${t.id}">${esc(t.label)}</a></li>\n`;
  }
  html += '                <li><a href="#s-faq">FAQ</a></li>\n';
  return html;
}

/* ---- Build sidebar links HTML ---- */
function buildSidebarLinks(a) {
  let html = '';
  for (const link of (a.sidebarLinks || [])) {
    html += `                <a href="${link.href}" class="related-link"><strong>${esc(link.strong)}</strong><span>${esc(link.text)}</span></a>\n`;
  }
  return html;
}

/* ---- Update sitemap ---- */
function updateSitemap(sitemapPath, slug) {
  if (!fs.existsSync(sitemapPath)) return false;
  let content = fs.readFileSync(sitemapPath, 'utf8');
  const url = `${BASE_URL}/insights/${slug}.html`;
  if (content.includes(`<loc>${url}</loc>`)) return false;

  const entry = [
    '  <url>',
    `    <loc>${url}</loc>`,
    '    <changefreq>monthly</changefreq>',
    '    <priority>0.75</priority>',
    '  </url>',
  ].join('\n');

  content = content.replace('</urlset>', entry + '\n</urlset>');
  fs.writeFileSync(sitemapPath, content, 'utf8');
  return true;
}

/* ---- Generate single article ---- */
function generateArticle(a) {
  const dateDisplay = displayDate(a.datePublished);
  const updatedIso   = a.dateModified || a.datePublished;
  const updatedDisplay = displayDate(updatedIso);
  const jsonLd      = buildJsonLd(a);
  const articleBody = buildArticleBody(a);
  const tocItems    = buildTocItems(a);
  const sidebarLinks= buildSidebarLinks(a);
  const pageTitle   = a.pageTitle || `${a.h1} | TradeAlphaAI`;
  const ogTitle     = a.ogTitle || a.h1;
  const ogDesc      = a.ogDescription || a.metaDescription;
  const breadcrumb  = a.breadcrumbLabel || (a.h1.length > 40 ? a.category : a.h1);

  return TEMPLATE
    .replace(/\{\{PAGE_TITLE\}\}/g,       esc(pageTitle))
    .replace(/\{\{META_DESC\}\}/g,        esc(a.metaDescription))
    .replace(/\{\{SLUG\}\}/g,             a.slug)
    .replace(/\{\{OG_TITLE\}\}/g,         esc(ogTitle))
    .replace(/\{\{OG_DESC\}\}/g,          esc(ogDesc))
    .replace(/\{\{H1\}\}/g,               esc(a.h1))
    .replace(/\{\{BREADCRUMB_LABEL\}\}/g, esc(breadcrumb))
    .replace(/\{\{CATEGORY\}\}/g,         esc(a.category))
    .replace(/\{\{READING_TIME\}\}/g,     esc(a.readingTime || '6 min'))
    .replace(/\{\{DATE_ISO\}\}/g,         a.datePublished)
    .replace(/\{\{DATE_DISPLAY\}\}/g,     dateDisplay)
    .replace(/\{\{UPDATED_ISO\}\}/g,      updatedIso)
    .replace(/\{\{UPDATED_DISPLAY\}\}/g,  updatedDisplay)
    .replace(/\{\{LEAD\}\}/g,             a.lead)
    .replace(/\{\{INTRO_SUMMARY\}\}/g,    esc(introSummary(a)))
    .replace(/\{\{RELATED_SYMBOLS\}\}/g,  buildChips(relatedSymbols(a)))
    .replace(/\{\{TOPIC_TAGS\}\}/g,       buildChips(topicTags(a)))
    .replace('{{JSON_LD}}',               jsonLd)
    .replace('{{ARTICLE_BODY}}',          articleBody)
    .replace('{{TOC_ITEMS}}',             tocItems)
    .replace('{{SIDEBAR_LINKS}}',         sidebarLinks)
    .replace(/\{\{RC_KEY\}\}/g,           a.rcKey || 'ins-ai-infra');
}

/* ---- Main ---- */
const insightsDir   = path.join(ROOT, 'insights');
const sitemapMarket = path.join(ROOT, 'sitemap-market.xml');
const sitemapMain   = path.join(ROOT, 'sitemap.xml');

let generated = 0, skipped = 0, sitemapAdds = 0;

console.log(`\nTradeAlphaAI Insight Generator — ${TOPICS.articles.length} topics loaded\n`);

for (const article of TOPICS.articles) {
  const outPath = path.join(insightsDir, article.slug + '.html');
  const exists  = fs.existsSync(outPath);

  if (exists && !FORCE) {
    console.log(`  skip  : ${article.slug}.html`);
    skipped++;
    continue;
  }

  const html = generateArticle(article);

  if (DRY_RUN) {
    console.log(`  dry   : ${article.slug}.html (${html.length} chars)`);
    generated++;
    continue;
  }

  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`  write : ${article.slug}.html  [${article.category}]`);

  const a1 = updateSitemap(sitemapMarket, article.slug);
  const a2 = updateSitemap(sitemapMain, article.slug);
  if (a1 || a2) sitemapAdds++;

  generated++;
}

console.log(`\n  Generated: ${generated}  Skipped: ${skipped}  Sitemap entries added: ${sitemapAdds}\n`);

if (!DRY_RUN && generated > 0) {
  console.log('Run `npm run check:production` to validate all generated pages.\n');
}
