?'use strict';
/* Static insight generator for curated topics and controlled queue topics.
   Existing curated path:
     node tools/generate-insights.js --force
   Queue path:
     node tools/generate-insights.js --queue --slug=<slug> --mode=review|draft|publish-if-safe
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'templates/insight-template.html'), 'utf8');
const TOPICS = readJson(path.join(ROOT, 'data', 'insight-topics.json'), { articles: [] });
const QUEUE_PATH = path.join(ROOT, 'data', 'insight-topic-queue.json');
const SYMBOLS = readJson(path.join(ROOT, 'data', 'market-symbols.json'), { symbols: [], hubs: [] });

const BASE_URL = 'https://www.tradealphaai.com';
const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');
const USE_QUEUE = process.argv.includes('--queue');
const MODE = argValue('--mode') || (USE_QUEUE ? 'review' : 'publish-if-safe');
const SELECTED_SLUG = argValue('--slug');
const VALID_MODES = new Set(['draft', 'review', 'publish-if-safe']);

if (!VALID_MODES.has(MODE)) {
  console.error(`Invalid mode: ${MODE}. Use draft, review, or publish-if-safe.`);
  process.exit(1);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function plainText(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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
  for (const symbol of SYMBOLS.symbols.map((item) => item.symbol)) {
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

function buildJsonLd(a) {
  const faqEntities = (a.faqs || []).map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer }
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: BASE_URL + '/' },
          { '@type': 'ListItem', position: 2, name: 'Articles', item: BASE_URL + '/insights/' },
          { '@type': 'ListItem', position: 3, name: a.breadcrumbLabel || a.h1, item: BASE_URL + '/insights/' + a.slug + '.html' }
        ]
      },
      {
        '@type': 'Article',
        headline: a.h1,
        description: a.metaDescription,
        datePublished: a.datePublished,
        dateModified: a.dateModified || a.datePublished,
        author: { '@type': 'Organization', name: 'TradeAlphaAI Articles Team', url: BASE_URL },
        publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: BASE_URL },
        url: BASE_URL + '/insights/' + a.slug + '.html',
        about: [{ '@type': 'Thing', name: a.category }],
        mainEntityOfPage: { '@type': 'WebPage', '@id': BASE_URL + '/insights/' + a.slug + '.html' }
      },
      ...(faqEntities.length ? [{ '@type': 'FAQPage', mainEntity: faqEntities }] : [])
    ]
  };

  return JSON.stringify(schema, null, 2);
}

function buildArticleBody(a) {
  let html = '';

  for (const section of (a.sections || [])) {
    html += `\n            <h2 id="${section.id}">${esc(section.heading)}</h2>\n`;
    for (const p of (section.paragraphs || [])) html += `            <p class="market-copy">${p}</p>\n`;

    if (section.bullets && section.bullets.length) {
      html += '            <ul>\n';
      for (const b of section.bullets) html += `              <li>${b}</li>\n`;
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

    if (section.pullQuote) html += `            <div class="pull-quote"><p>${esc(section.pullQuote)}</p></div>\n`;
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

function buildTocItems(a) {
  let html = '';
  for (const t of (a.tocItems || [])) html += `                <li><a href="#${t.id}">${esc(t.label)}</a></li>\n`;
  html += '                <li><a href="#s-faq">FAQ</a></li>\n';
  return html;
}

function buildSidebarLinks(a) {
  let html = '';
  for (const link of (a.sidebarLinks || [])) {
    html += `                <a href="${link.href}" class="related-link"><strong>${esc(link.strong)}</strong><span>${esc(link.text)}</span></a>\n`;
  }
  return html;
}

function generateArticle(a, mode) {
  const dateDisplay = displayDate(a.datePublished);
  const updatedIso = a.dateModified || a.datePublished;
  const updatedDisplay = displayDate(updatedIso);
  const pageTitle = a.pageTitle || `${a.h1} | TradeAlphaAI`;
  const ogTitle = a.ogTitle || a.h1;
  const ogDesc = a.ogDescription || a.metaDescription;
  const breadcrumb = a.breadcrumbLabel || (a.h1.length > 40 ? a.category : a.h1);
  const robots = mode === 'publish-if-safe' ? 'index,follow,max-image-preview:large' : 'noindex,nofollow,max-image-preview:large';

  return TEMPLATE
    .replace(/\{\{PAGE_TITLE\}\}/g, esc(pageTitle))
    .replace(/\{\{META_DESC\}\}/g, esc(a.metaDescription))
    .replace(/\{\{ROBOTS_META\}\}/g, robots)
    .replace(/\{\{SLUG\}\}/g, a.slug)
    .replace(/\{\{OG_TITLE\}\}/g, esc(ogTitle))
    .replace(/\{\{OG_DESC\}\}/g, esc(ogDesc))
    .replace(/\{\{H1\}\}/g, esc(a.h1))
    .replace(/\{\{BREADCRUMB_LABEL\}\}/g, esc(breadcrumb))
    .replace(/\{\{CATEGORY\}\}/g, esc(a.category))
    .replace(/\{\{READING_TIME\}\}/g, esc(a.readingTime || '7 min'))
    .replace(/\{\{DATE_ISO\}\}/g, a.datePublished)
    .replace(/\{\{DATE_DISPLAY\}\}/g, dateDisplay)
    .replace(/\{\{UPDATED_ISO\}\}/g, updatedIso)
    .replace(/\{\{UPDATED_DISPLAY\}\}/g, updatedDisplay)
    .replace(/\{\{LEAD\}\}/g, a.lead)
    .replace(/\{\{INTRO_SUMMARY\}\}/g, esc(introSummary(a)))
    .replace(/\{\{RELATED_SYMBOLS\}\}/g, buildChips(relatedSymbols(a)))
    .replace(/\{\{TOPIC_TAGS\}\}/g, buildChips(topicTags(a)))
    .replace('{{JSON_LD}}', buildJsonLd(a))
    .replace('{{ARTICLE_BODY}}', buildArticleBody(a))
    .replace('{{TOC_ITEMS}}', buildTocItems(a))
    .replace('{{SIDEBAR_LINKS}}', buildSidebarLinks(a))
    .replace(/\{\{RC_KEY\}\}/g, a.rcKey || 'ins-ai-infra');
}

function topicToArticle(topic) {
  const today = new Date().toISOString().slice(0, 10);
  const stocks = ensureMinimum(topic.relatedStocks || [], 2, ['NVDA', 'MSFT']);
  const etfs = ensureMinimum(topic.relatedETFs || [], 1, ['SPY']);
  const hubs = ensureMinimum(topic.relatedHubs || [], 1, ['ai-stocks']);
  const relatedInsights = chooseRelatedInsights(topic).slice(0, 3);
  const primaryStock = stocks[0];
  const secondStock = stocks[1];
  const primaryEtf = etfs[0];
  const primaryHub = hubs[0];

  const linkStock = (symbol) => link(`../${pageForSymbol(symbol)}`, symbol);
  const linkEtf = (symbol) => link(`../${pageForSymbol(symbol)}`, symbol);
  const linkHub = (hub) => link(`../${hub}.html`, titleFromSlug(hub));
  const relatedInsightLinks = relatedInsights.map((item) => link(item.href, item.label)).join(', ');
  const methodology = link('../methodology.html', 'TradeAlphaAI methodology');
  const dataStatus = link('../market-data-status.html', 'market data status');

  const h1 = topic.title;
  const metaDescription = `${topic.category} educational research on ${topic.angle}, related stocks ${stocks.slice(0, 3).join(', ')}, ETF context ${etfs.slice(0, 2).join(', ')}, key risks, and internal research links.`;

  return {
    slug: topic.slug,
    h1,
    breadcrumbLabel: h1.length > 46 ? topic.category : h1,
    pageTitle: `${h1} | TradeAlphaAI Insights`,
    metaDescription,
    ogDescription: `${topic.category} research brief: ${topic.angle}. Educational market context only, with related stock, ETF, hub, and risk links.`,
    category: topic.category,
    readingTime: '7 min',
    datePublished: topic.datePublished || today,
    dateModified: today,
    rcKey: rcKeyForTopic(topic),
    relatedSymbols: unique([...stocks, ...etfs]),
    tags: unique([topic.category, ...(topic.targetKeywords || []).slice(0, 4)]),
    introSummary: `${topic.audienceIntent} This research brief frames the topic through market context, why it matters, risk variables, and links into related TradeAlphaAI stock, ETF, and hub pages.`,
    lead: `${topic.title} examines ${topic.angle} through a professional educational lens. The goal is to help readers understand market structure, related assets, ETF exposure, and risk variables without making forecasts, recommendations, or personalized investment claims.`,
    sections: [
      {
        id: 's-market-context',
        heading: 'Executive Summary and Market Context',
        paragraphs: [
          `${topic.category} research sits inside a broader market environment where fundamentals, liquidity, sentiment, and index concentration all interact. For this topic, the core research angle is ${topic.angle}. Readers often arrive with a practical question: how does this theme connect to observable companies, ETFs, and macro variables without turning the analysis into a trade recommendation?`,
          `A useful starting point is to separate business exposure from market exposure. ${linkStock(primaryStock)} and ${linkStock(secondStock)} may connect to the theme through revenue drivers, product cycles, customer concentration, or valuation sensitivity. ${linkEtf(primaryEtf)} provides an ETF-level view that can reveal whether the theme is isolated to a few names or reflected across a broader basket. That distinction matters because single-stock narratives and diversified ETF exposures can behave very differently during volatility spikes.`,
          `The TradeAlphaAI platform treats this article as research context rather than a signal. Readers can continue from this page into ${linkHub(primaryHub)}, individual stock analyzers, ETF pages, the ${methodology}, and the ${dataStatus} page to understand how static educational content, mock/live data modes, and scoring context fit together.`
        ]
      },
      {
        id: 's-why-it-matters',
        heading: 'Key Market Takeaway and Why It Matters',
        paragraphs: [
          `This topic matters because finance research is rarely about one isolated metric. A theme such as ${topic.category.toLowerCase()} can affect revenue expectations, valuation multiples, ETF concentration, sector leadership, and risk appetite at the same time. When readers understand those moving pieces, they are better equipped to compare claims, read company filings, and evaluate market commentary critically.`,
          `For stock research, the important question is not whether a company is popular. It is whether the company has measurable exposure to the theme, whether that exposure is already reflected in expectations, and whether risks could change the interpretation. For ETF research, the question shifts toward holdings, index methodology, concentration, cost, liquidity, and drawdown behavior. Those dimensions can be explored through ${etfs.map(linkEtf).join(', ')} and related hub pages.`,
          `A second reason this matters is internal discoverability. High-quality research pages should connect readers to adjacent concepts. This article links to related insight work including ${relatedInsightLinks}, which helps a reader build context across AI infrastructure, ETF education, market cycles, and risk research without relying on repetitive or thin articles.`
        ]
      },
      {
        id: 's-related-assets',
        heading: 'ETF Exposure, Related Sectors, and Research Hubs',
        paragraphs: [
          `The most relevant stock research pages for this theme are ${stocks.map(linkStock).join(', ')}. These pages provide educational screening context such as company profile, sector exposure, risk overview, and TradeAlpha Score components. None of those pages should be read as a recommendation; they are designed to make research paths easier to navigate.`,
          `ETF context is equally important. ${etfs.map(linkEtf).join(', ')} can help readers compare single-company exposure with diversified index or sector exposure. ETF pages also make it easier to study expense ratios, top holdings, volatility, and sector concentration, which are often more useful for educational comparison than isolated headlines.`,
          `Theme hubs such as ${hubs.map(linkHub).join(', ')} organize the same research universe around broader questions. A hub can be useful when the reader wants to compare companies and funds inside a theme before opening deeper stock or ETF pages.`
        ]
      },
      {
        id: 's-key-risks',
        heading: 'Risk Factors and Macro Context',
        paragraphs: [
          `Every market theme has research limits. The first risk is narrative compression: a complicated topic can become reduced to one headline, one company, or one quarterly datapoint. That can hide second-order variables such as valuation, margins, capital intensity, liquidity, customer concentration, and macro sensitivity.`,
          `The second risk is extrapolation. A real business trend can exist while market expectations are already high. This is especially relevant in growth-oriented themes where investors may price in years of future improvement. Educational research should distinguish between identifying a theme and assuming how prices will respond to that theme.`,
          `The third risk is data quality. Static pages, mock data, live provider data, and company disclosures can update at different cadences. Readers should verify current figures with primary filings, fund documents, and independent data sources before drawing conclusions.`
        ],
        pullQuote: `A strong research page should clarify the variables that matter, not imply certainty about future returns.`
      },
      {
        id: 's-research-process',
        heading: 'Portfolio Context and Research Process',
        paragraphs: [
          `A practical workflow starts with the theme, then moves into assets, funds, and risk checks. First, define the claim being researched: in this case, ${topic.angle}. Second, identify linked stocks and ETFs. Third, compare whether the theme appears broad-based or concentrated. Fourth, check methodology and data-status notes so the limitations of the analysis are clear.`,
          `This workflow intentionally avoids one-click conclusions. It gives readers a structured path: read the market context, open the related stock pages, compare ETF exposure, review related insight articles, and then verify current data independently. That process protects content quality because each new article must add a distinct educational angle and a clear internal-linking path.`,
          `For broader research, continue to ${relatedInsightLinks}. These adjacent articles help prevent topic isolation and support a deeper session path through the platform.`
        ]
      },
      {
        id: 's-conclusion',
        heading: 'Conclusion',
        paragraphs: [
          `${topic.title} is best understood as a research framework, not a prediction. The topic connects company fundamentals, ETF exposure, valuation context, and risk variables that can change over time. The most useful takeaway is the structure of the analysis: identify the theme, map related assets, compare diversified exposure, review risks, and verify current data from reliable sources.`,
          `TradeAlphaAI publishes this type of article to improve educational discoverability across related stocks, ETFs, hubs, and market concepts. It does not recommend securities, provide price targets, or promise outcomes.`
        ]
      }
    ],
    faqs: [
      {
        question: `What is the main research angle in ${topic.title}?`,
        answer: `The main angle is ${topic.angle}. The article explains the theme through market context, related stocks, related ETFs, risks, and internal research links for educational use.`
      },
      {
        question: `Which stocks are related to this ${topic.category} topic?`,
        answer: `Related educational stock pages include ${stocks.join(', ')}. These links are for research navigation only and are not recommendations.`
      },
      {
        question: `Which ETFs help compare this theme?`,
        answer: `Related ETF pages include ${etfs.join(', ')}. ETF research can help compare concentration, holdings, sector exposure, expense ratios, and broad-market context.`
      },
      {
        question: 'How should readers use this article?',
        answer: 'Use it as an educational starting point. Compare the linked stock pages, ETF pages, hub pages, methodology notes, and external primary sources before forming any independent view.'
      },
      {
        question: 'Is this article investment advice?',
        answer: 'No. This article is for educational and informational purposes only and does not constitute investment or financial advice.'
      }
    ],
    tocItems: [
      { id: 's-market-context', label: 'Market Context' },
      { id: 's-why-it-matters', label: 'Key Takeaway' },
      { id: 's-related-assets', label: 'ETF Exposure' },
      { id: 's-key-risks', label: 'Risk Factors' },
      { id: 's-research-process', label: 'Portfolio Context' },
      { id: 's-conclusion', label: 'Conclusion' }
    ],
    sidebarLinks: [
      ...stocks.slice(0, 3).map((symbol) => ({ href: `../${pageForSymbol(symbol)}`, strong: symbol, text: labelForSymbol(symbol) })),
      ...etfs.slice(0, 2).map((symbol) => ({ href: `../${pageForSymbol(symbol)}`, strong: symbol, text: labelForSymbol(symbol) })),
      ...hubs.slice(0, 2).map((hub) => ({ href: `../${hub}.html`, strong: titleFromSlug(hub), text: 'Theme hub research path' })),
      { href: '../methodology.html', strong: 'Methodology', text: 'Scoring and research process' },
      ...relatedInsights.slice(0, 2).map((item) => ({ href: item.href, strong: item.label, text: 'Related insight article' }))
    ]
  };
}

function updateSitemap(sitemapPath, slug) {
  if (!fs.existsSync(sitemapPath)) return false;
  let content = fs.readFileSync(sitemapPath, 'utf8');
  const url = `${BASE_URL}/insights/${slug}.html`;
  if (content.includes(`<loc>${url}</loc>`)) return false;
  const entry = ['  <url>', `    <loc>${url}</loc>`, '    <changefreq>monthly</changefreq>', '    <priority>0.75</priority>', '  </url>'].join('\n');
  content = content.replace('</urlset>', entry + '\n</urlset>');
  fs.writeFileSync(sitemapPath, content, 'utf8');
  return true;
}

function run() {
  const insightsDir = path.join(ROOT, 'insights');
  const sitemapMarket = path.join(ROOT, 'sitemap-market.xml');
  const sitemapMain = path.join(ROOT, 'sitemap.xml');
  fs.mkdirSync(insightsDir, { recursive: true });

  const queue = readJson(QUEUE_PATH, { topics: [] });
  const sourceArticles = USE_QUEUE ? queueTopicsToArticles(queue) : TOPICS.articles;
  let generated = 0;
  let skipped = 0;
  let sitemapAdds = 0;

  console.log(`\nTradeAlphaAI Insight Generator - ${sourceArticles.length} topic(s), mode=${MODE}\n`);

  for (const article of sourceArticles) {
    const outPath = path.join(insightsDir, article.slug + '.html');
    const exists = fs.existsSync(outPath);

    if (exists && !FORCE) {
      console.log(`  skip  : ${article.slug}.html`);
      skipped += 1;
      continue;
    }

    const html = generateArticle(article, MODE);
    if (DRY_RUN) {
      console.log(`  dry   : ${article.slug}.html (${html.length} chars)`);
      generated += 1;
      continue;
    }

    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`  write : ${article.slug}.html  [${article.category}]`);
    writeArabicInsightContent(article);

    if (MODE === 'publish-if-safe') {
      const a1 = updateSitemap(sitemapMarket, article.slug);
      const a2 = updateSitemap(sitemapMain, article.slug);
      if (a1 || a2) sitemapAdds += 1;
      updateResearchLayer(article);
      updateInsightsIndex(article);
    }

    if (USE_QUEUE) updateQueueStatus(queue, article.slug, MODE);
    generated += 1;
  }

  if (USE_QUEUE && !DRY_RUN) writeJson(QUEUE_PATH, queue);
  if (!DRY_RUN && generated > 0 && MODE === 'publish-if-safe') {
    const localized = spawnSync(process.execPath, ['tools/generate-localized-pages.js'], { cwd: ROOT, stdio: 'inherit' });
    if (localized.status !== 0) {
      console.error('Arabic localization generation failed after insight publishing.');
      process.exit(localized.status || 1);
    }
  }

  console.log(`\n  Generated: ${generated}  Skipped: ${skipped}  Sitemap entries added: ${sitemapAdds}\n`);
  if (!DRY_RUN && generated > 0) console.log('Run `npm run insights:quality -- --slug=<slug>` and `npm run check:production` before publishing.\n');
}

function writeArabicInsightContent(article) {
  const dir = path.join(ROOT, 'data', 'localization', 'ar-insight-content');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, article.slug + '.json');
  const content = {
    slug: article.slug,
    title: arTitle(article.h1),
    category: arCategory(article.category),
    readingTime: '7 دقائق قراءة',
    lead: arLead(article),
    summary: arSummary(article),
    sections: (article.sections || []).map((section) => ({
      id: section.id,
      title: arHeading(section.heading),
      body: arSectionBody(article, section)
    })),
    faq: arFaq(article)
  };
  validateArabicInsightContent(content);
  writeJson(file, content);
}

function validateArabicInsightContent(content) {
  const text = JSON.stringify(content);
  if (!content.slug || !content.title || !content.sections?.length || !content.faq?.length) {
    throw new Error(`Arabic insight content is incomplete for ${content.slug}`);
  }
  const visibleText = [
    content.title,
    content.category,
    content.lead,
    content.summary,
    ...(content.sections || []).flatMap((section) => [section.title, ...(section.body || [])]),
    ...(content.faq || []).flatMap((item) => [item.q, item.a])
  ].join(' ');
  const leftover = visibleText.match(/\b(This article|investment advice|security recommendations|price targets|Executive Summary|Market Context|FAQ)\b/i);
  if (leftover) {
    throw new Error(`Arabic insight content contains untranslated boilerplate for ${content.slug}: ${leftover[0]}`);
  }
}

function arTitle(value) {
  return arClean(value)
    .replace(/^(.+?):\s*/, '$1: ')
    .replace(/Research/gi, 'بحث')
    .replace(/Education/gi, 'تعليم')
    .replace(/Explained/gi, 'شرح')
    .replace(/Structure/gi, 'البنية')
    .replace(/Methodology/gi, 'المنهجية');
}

function arCategory(value) {
  return arClean(value || 'Market Research');
}

function arLead(article) {
  return `يتناول هذا البحث التعليمي موضوع ${arClean(article.h1)} من زاوية ${arClean(topicAngle(article))}. يركز المقال على بنية السوق، الأصول المرتبطة، تعرض صناديق المؤشرات، وعوامل المخاطر دون تقديم توقعات أو توصيات أو نصائح مالية شخصية.`;
}

function arSummary(article) {
  return `موجز بحثي عربي يربط ${arClean(article.category)} بالأسهم وصناديق المؤشرات ذات الصلة، مع توضيح السياق، المخاطر، الروابط الداخلية، وحدود الاستخدام التعليمي.`;
}

function arHeading(value) {
  const map = {
    'Executive Summary and Market Context': 'ملخص تنفيذي وسياق السوق',
    'Key Market Takeaway and Why It Matters': 'الخلاصة البحثية وأهميتها',
    'ETF Exposure, Related Sectors, and Research Hubs': 'تعرض صناديق المؤشرات والقطاعات ومحاور البحث',
    'Risk Factors and Macro Context': 'عوامل المخاطر والسياق الكلي',
    'Portfolio Context and Research Process': 'سياق المحفظة ومنهجية البحث',
    'Conclusion': 'الخلاصة'
  };
  return map[value] || arClean(value);
}

function arSectionBody(article, section) {
  const angle = arClean(topicAngle(article));
  const stocks = relatedSymbols(article).filter((symbol) => !isEtfSymbol(symbol)).slice(0, 3).join(' و ') || 'الأسهم المرتبطة';
  const etfs = relatedSymbols(article).filter(isEtfSymbol).slice(0, 3).join(' و ') || 'صناديق المؤشرات المرتبطة';
  const category = arClean(article.category);
  const byId = {
    's-market-context': [
      `يقع موضوع ${category} داخل بيئة سوق تتداخل فيها الأساسيات والسيولة والمعنويات وتركيز المؤشرات. زاوية البحث الأساسية هنا هي ${angle}، ولذلك يجب قراءة الموضوع كإطار لفهم العلاقات بين الشركات والصناديق والعوامل الكلية.`,
      `نقطة البداية هي الفصل بين تعرض الشركة وتعرض السوق. قد ترتبط ${stocks} بالموضوع من خلال الإيرادات أو دورات المنتجات أو تركيز العملاء أو حساسية التقييم، بينما توفر ${etfs} قراءة أوسع من منظور صناديق المؤشرات.`,
      `تتعامل TradeAlphaAI مع هذا المقال كسياق بحثي لا كإشارة تداول. يمكن للقارئ استخدام الروابط الداخلية والمنهجية وحالة بيانات السوق لفهم حدود المحتوى التعليمي قبل الرجوع إلى المصادر الأولية.`
    ],
    's-why-it-matters': [
      `تنبع أهمية هذا الموضوع من أن البحث المالي لا يعتمد على رقم منفصل. قد تؤثر زاوية مثل ${category} في توقعات الإيرادات، مضاعفات التقييم، قيادة القطاعات، شهية المخاطرة، وتركيز صناديق المؤشرات في الوقت نفسه.`,
      `بالنسبة للأسهم، السؤال المهم ليس شهرة الشركة بل مدى تعرضها القابل للقياس للموضوع وما إذا كانت التوقعات الحالية تعكس ذلك بالفعل. وبالنسبة لصناديق المؤشرات، ينتقل التركيز إلى المكونات والمنهجية والتكلفة والسيولة وسلوك التراجع.`,
      `يساعد الربط بين هذا المقال والمقالات القريبة منه على بناء مسار بحث أعمق بدلا من مقالات منفصلة ورفيعة. الهدف هو تحسين قابلية الاكتشاف وفهم العلاقات بين الذكاء الاصطناعي، صناديق المؤشرات، الدورات السوقية، والمخاطر.`
    ],
    's-related-assets': [
      `أهم صفحات الأسهم المرتبطة بهذا الموضوع تشمل ${stocks}. تعرض هذه الصفحات سياقا تعليميا حول نشاط الشركة، التعرض القطاعي، طبقة المخاطر، ومكونات درجة TradeAlpha دون تحويلها إلى توصية.`,
      `سياق صناديق المؤشرات مهم بالقدر نفسه. يمكن أن تساعد ${etfs} في مقارنة التعرض الفردي بتعرض أكثر تنوعا عبر مؤشر أو قطاع، مع قراءة نسب المصاريف والمكونات والتركيز والتذبذب.`,
      `تجمع المحاور البحثية الموضوعات المتشابهة في مسار واحد، ما يساعد القارئ على مقارنة الشركات والصناديق داخل الفكرة نفسها قبل الانتقال إلى صفحات تحليل أعمق.`
    ],
    's-key-risks': [
      `لكل محور سوقي حدود بحثية. الخطر الأول هو ضغط السرد في عنوان واحد أو شركة واحدة، مما قد يخفي متغيرات مثل الهوامش، كثافة رأس المال، السيولة، تركيز العملاء، وحساسية الاقتصاد الكلي.`,
      `الخطر الثاني هو المبالغة في الاستقراء. قد يكون الاتجاه التجاري حقيقيا بينما تكون توقعات السوق مرتفعة بالفعل. لذلك يجب التفريق بين تحديد المحور البحثي وافتراض استجابة الأسعار له.`,
      `الخطر الثالث هو جودة البيانات وتوقيت تحديثها. قد تختلف وتيرة تحديث الصفحات الثابتة وبيانات المزودين وإفصاحات الشركات، لذلك ينبغي التحقق من الأرقام الحالية عبر المصادر الأولية.`
    ],
    's-research-process': [
      `يبدأ مسار البحث العملي بتحديد الفكرة، ثم ربطها بالأصول والصناديق وفحوص المخاطر. في هذا المقال تتمثل الفكرة في ${angle}، ثم تُقرأ من خلال الأسهم والصناديق والمحاور ذات الصلة.`,
      `يتجنب هذا الأسلوب الاستنتاجات السريعة. المسار الأفضل هو قراءة سياق السوق، فتح صفحات الأسهم المرتبطة، مقارنة تعرض صناديق المؤشرات، مراجعة المقالات القريبة، ثم التحقق من البيانات الحالية بشكل مستقل.`,
      `يساعد هذا الانضباط على رفع جودة المحتوى لأن كل مقال جديد يجب أن يضيف زاوية تعليمية واضحة وروابط داخلية مفيدة بدلا من تكرار موضوعات قائمة.`
    ],
    's-conclusion': [
      `يجب فهم ${arClean(article.h1)} كإطار بحثي لا كتوقع. يربط الموضوع بين أساسيات الشركات، تعرض صناديق المؤشرات، سياق التقييم، وعوامل المخاطر التي قد تتغير بمرور الوقت.`,
      `تنشر TradeAlphaAI هذا النوع من المقالات لتحسين الاكتشاف التعليمي بين الأسهم والصناديق والمحاور ومفاهيم السوق. المحتوى لا يوصي بأوراق مالية ولا يقدم أسعارا مستهدفة ولا يعد بنتائج مستقبلية.`
    ]
  };
  return byId[section.id] || (section.paragraphs || []).map((p) => arClean(stripLinks(p)));
}

function arFaq(article) {
  const stocks = relatedSymbols(article).filter((symbol) => !isEtfSymbol(symbol)).slice(0, 3).join('، ') || 'الأصول المرتبطة';
  const etfs = relatedSymbols(article).filter(isEtfSymbol).slice(0, 3).join('، ') || 'صناديق المؤشرات المرتبطة';
  return [
    { q: `ما زاوية البحث الرئيسية في ${arClean(article.h1)}؟`, a: `الزاوية الرئيسية هي ${arClean(topicAngle(article))}. يشرح المقال الموضوع من خلال سياق السوق، الأسهم المرتبطة، صناديق المؤشرات، عوامل المخاطر، والروابط الداخلية للاستخدام التعليمي.` },
    { q: `ما الأسهم المرتبطة بهذا الموضوع؟`, a: `تشمل صفحات الأسهم التعليمية المرتبطة: ${stocks}. هذه الروابط مخصصة للتنقل البحثي ولا تمثل توصيات.` },
    { q: `ما صناديق المؤشرات المفيدة للمقارنة؟`, a: `تشمل صناديق المؤشرات المرتبطة: ${etfs}. تساعد صفحات الصناديق في مقارنة التركز، المكونات، التعرض القطاعي، نسب المصاريف، والسياق الواسع للسوق.` },
    { q: 'كيف ينبغي استخدام هذا المقال؟', a: 'استخدمه كنقطة بداية تعليمية. قارن الصفحات المرتبطة، راجع المنهجية، وافحص المصادر الأولية قبل تكوين أي رأي مستقل.' },
    { q: 'هل هذا المقال نصيحة استثمارية؟', a: 'لا. هذا المقال لأغراض تعليمية ومعلوماتية فقط ولا يمثل نصيحة استثمارية أو مالية.' }
  ];
}

function topicAngle(article) {
  const first = (article.lead || '').match(/examines ([^.]+?) through/i);
  return first ? first[1] : (article.category || article.h1);
}

function arClean(value) {
  return String(value || '')
    .replace(/AI Infrastructure/gi, 'البنية التحتية للذكاء الاصطناعي')
    .replace(/Artificial Intelligence/gi, 'الذكاء الاصطناعي')
    .replace(/Semiconductor(s)?/gi, 'أشباه الموصلات')
    .replace(/GPU(s)?/gi, 'وحدات GPU')
    .replace(/ETF(s)?/gi, 'صناديق المؤشرات')
    .replace(/Index Methodology/gi, 'منهجية المؤشر')
    .replace(/Index Funds/gi, 'صناديق المؤشرات')
    .replace(/Market Research/gi, 'أبحاث السوق')
    .replace(/GPU Market/gi, 'سوق وحدات GPU')
    .replace(/Market Share/gi, 'الحصة السوقية')
    .replace(/ETF Education/gi, 'تعليم صناديق المؤشرات')
    .replace(/Market Cycles/gi, 'دورات السوق')
    .replace(/Macro Risk/gi, 'المخاطر الكلية')
    .replace(/Portfolio Risk/gi, 'مخاطر المحفظة')
    .replace(/Cloud Computing/gi, 'الحوسبة السحابية')
    .replace(/Growth Stocks/gi, 'أسهم النمو')
    .replace(/Value Stocks/gi, 'أسهم القيمة')
    .replace(/Interest Rates/gi, 'أسعار الفائدة')
    .replace(/Technology Stocks/gi, 'أسهم التكنولوجيا')
    .replace(/Dividend/gi, 'التوزيعات')
    .replace(/Expense Ratios/gi, 'نسب المصاريف')
    .replace(/Structure/gi, 'البنية')
    .replace(/Methodology/gi, 'المنهجية')
    .replace(/Market Context/gi, 'سياق السوق')
    .replace(/Product Cycle(s)?/gi, 'دورات المنتجات')
    .replace(/Product/gi, 'المنتج')
    .replace(/Share/gi, 'الحصة')
    .replace(/Research/gi, 'بحث')
    .replace(/Education/gi, 'تعليم')
    .replace(/Risk/gi, 'المخاطر')
    .replace(/Exposure/gi, 'التعرض')
    .replace(/Demand/gi, 'الطلب')
    .replace(/Supply/gi, 'العرض')
    .replace(/Cycle(s)?/gi, 'الدورات')
    .replace(/Explained/gi, 'شرح')
    .replace(/\band\b/gi, 'و')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLinks(value) {
  return String(value || '').replace(/<a [^>]+>([\s\S]*?)<\/a>/gi, '$1');
}

function isEtfSymbol(symbol) {
  const item = SYMBOLS.symbols.find((entry) => entry.symbol === symbol);
  return item?.type === 'etf';
}

function queueTopicsToArticles(queue) {
  let topics = queue.topics || [];
  if (SELECTED_SLUG) topics = topics.filter((topic) => topic.slug === SELECTED_SLUG);
  else topics = topics.filter((topic) => ['candidate', 'approved', 'draft'].includes(topic.status)).slice(0, 1);
  if (SELECTED_SLUG && !topics.length) {
    console.error(`Queue topic not found: ${SELECTED_SLUG}`);
    process.exit(1);
  }
  return topics.map(topicToArticle);
}

function updateQueueStatus(queue, slug, mode) {
  const topic = (queue.topics || []).find((item) => item.slug === slug);
  if (!topic) return;
  topic.status = mode === 'publish-if-safe' ? 'published' : 'draft';
  topic.reviewStatus = mode === 'review' ? 'needs-review' : mode;
  topic.generatedAt = new Date().toISOString();
  if (mode === 'publish-if-safe') topic.publishedAt = new Date().toISOString();
  queue.updatedAt = new Date().toISOString().slice(0, 10);
}

function updateResearchLayer(article) {
  const file = path.join(ROOT, 'data', 'research-layer.json');
  const data = readJson(file, { updatedAt: '', insights: [], themes: [], linkLabels: {} });
  const href = `insights/${article.slug}.html`;
  const symbols = relatedSymbols(article);
  const entry = {
    title: article.h1,
    href,
    category: article.category,
    readingTime: article.readingTime || '7 min',
    updated: article.dateModified || article.datePublished,
    symbols: symbols.slice(0, 5),
    signal: 'Updated this week',
    summary: introSummary(article)
  };
  data.insights = [entry, ...(data.insights || []).filter((item) => item.href !== href)].slice(0, 30);
  data.linkLabels = data.linkLabels || {};
  data.linkLabels[href] = article.breadcrumbLabel || article.category || article.h1;
  data.updatedAt = new Date().toISOString().slice(0, 10);
  writeJson(file, data);
}

function updateInsightsIndex(article) {
  const file = path.join(ROOT, 'insights', 'index.html');
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  const href = `${article.slug}.html`;
  if (html.includes(`href="${href}"`)) return;

  const card = [
    `            <a class="insight-card" href="${href}" data-published-insight data-featured-link>`,
    `              <div class="insight-card-meta"><span class="insight-category-badge" style="margin:0">${esc(article.category)}</span><time datetime="${article.dateModified || article.datePublished}">${displayDate(article.dateModified || article.datePublished)}</time></div>`,
    `              <h3>${esc(article.h1)}</h3>`,
    `              <p>${esc(introSummary(article))}</p>`,
    `              <span class="insight-card-cta">Read article &rarr;</span>`,
    `            </a>`
  ].join('\n');

  const marker = '<div class="insight-grid" style="margin-top:20px">';
  const idx = html.indexOf(marker);
  if (idx === -1) return;
  const insertAt = idx + marker.length;
  html = html.slice(0, insertAt) + '\n' + card + html.slice(insertAt);
  fs.writeFileSync(file, html, 'utf8');
}

function chooseRelatedInsights(topic) {
  const preferred = (TOPICS.articles || [])
    .filter((article) => article.slug !== topic.slug)
    .map((article) => ({
      href: `${article.slug}.html`,
      label: article.breadcrumbLabel || article.category || article.h1,
      score: overlap(topic.targetKeywords || [], topicWords(article)) + (article.category === topic.category ? 0.3 : 0)
    }))
    .sort((a, b) => b.score - a.score);
  return preferred.slice(0, 3).length >= 2 ? preferred.slice(0, 3) : [
    { href: 'ai-infrastructure-demand.html', label: 'AI Infrastructure Demand' },
    { href: 'spy-vs-qqq-explained.html', label: 'SPY vs QQQ Explained' },
    { href: 'semiconductor-cycle-risks.html', label: 'Semiconductor Cycle Risks' }
  ];
}

function topicWords(article) {
  return `${article.h1 || ''} ${article.metaDescription || ''} ${article.lead || ''}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function overlap(a, b) {
  const as = new Set(a.map((item) => String(item).toLowerCase()));
  const bs = new Set(b.map((item) => String(item).toLowerCase()));
  let score = 0;
  as.forEach((item) => { if (bs.has(item)) score += 1; });
  return score;
}

function pageForSymbol(symbol) {
  const item = SYMBOLS.symbols.find((entry) => entry.symbol === symbol);
  return item ? item.pagePath : `stocks/${String(symbol).toLowerCase()}.html`;
}

function labelForSymbol(symbol) {
  const item = SYMBOLS.symbols.find((entry) => entry.symbol === symbol);
  return item ? item.name : `${symbol} research page`;
}

function rcKeyForTopic(topic) {
  const key = String(topic.sourceCluster || '').toLowerCase();
  if (key.includes('semi') || key.includes('gpu')) return 'ins-semi-cycle';
  if (key.includes('etf') || key.includes('dividend') || key.includes('diversification')) return 'ins-spy-qqq';
  return 'ins-ai-infra';
}

function ensureMinimum(values, min, fallback) {
  return unique([...(values || []), ...fallback]).slice(0, Math.max(min, values.length || 0));
}

function link(href, text) {
  return `<a href="${href}">${esc(text)}</a>`;
}

function titleFromSlug(slug) {
  return String(slug).split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : fallback;
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

run();

