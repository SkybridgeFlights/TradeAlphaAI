'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { generateIntelligence } = require('./generate-market-intelligence.js');
const { appendSnapshot, buildSnapshot } = require('./macro-intelligence-core');
const { detectNarrativeDrift } = require('./detect-narrative-drift');
const { buildRegimeSequence } = require('./build-regime-sequence');
const { detectCrossAssetDivergence } = require('./detect-cross-asset-divergence');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');
const ECONOMIC_CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const REGIME_PATH = path.join(ROOT, 'data', 'market-regime-state.json');
const MEMORY_PATH = path.join(ROOT, 'data', 'topic-memory.json');
const LIVE_MARKET_PATH = path.join(ROOT, 'data', 'live-market-state.json');
const OUT_DIR = path.join(ROOT, 'drafts', 'market-outlook');
const SITE_URL = 'https://www.tradealphaai.com';
const ELIGIBLE = new Set(['planned', 'draft']);
const DISCLAIMER_EN = 'This analysis is educational market commentary only. It is not investment advice, financial advice, or a recommendation to buy or sell any asset. Market conditions can change rapidly and uncertainty remains present.';
const DISCLAIMER_AR = 'هذا التحليل عبارة عن تعليق تعليمي حول الأسواق المالية فقط، ولا يُعتبر نصيحة استثمارية أو مالية أو توصية شراء أو بيع لأي أصل مالي. قد تتغير ظروف السوق بسرعة وتبقى حالة عدم اليقين قائمة.';

const slugArg = argValue('--slug');
const overwrite = process.argv.includes('--overwrite');
const queue = readJson(QUEUE_PATH, { topics: [] });
const calendar = readJson(ECONOMIC_CALENDAR_PATH, { events: [] });
const regime = readJson(REGIME_PATH, {});
const memory = readJson(MEMORY_PATH, { recent_topics: [] });
const liveMarket = readJson(LIVE_MARKET_PATH, { metadata: { status: 'fallback' } });

const topic = slugArg
  ? (queue.topics || []).find((item) => item.slug === slugArg)
  : (queue.topics || []).find((item) => ELIGIBLE.has(item.status) && !isCoolingDown(item));

if (!topic) {
  console.log('No market outlook draft topic available');
  process.exit(0);
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug || '')) fail('Market outlook topic has malformed slug');

const dir = path.join(OUT_DIR, topic.slug);
const enDraft = path.join(dir, 'en.html');
const arDraft = path.join(dir, 'ar.html');
if (!overwrite && (fs.existsSync(enDraft) || fs.existsSync(arDraft))) fail(`${topic.slug}: draft already exists`);

const normalized = normalizeTopic(topic);
const intelligence = generateIntelligence(liveMarket, calendar, regime, normalized.topic_cluster);

// Attempt AI-generated content (requires OPENAI_API_KEY).
// When unavailable the draft is structural only and must not be auto-approved.
const aiContent = tryGetAiContent(topic.slug);
const aiMode = aiContent !== null;

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(enDraft, render(normalized, 'en', intelligence, aiContent), 'utf8');
fs.writeFileSync(arDraft, render(normalized, 'ar', intelligence, aiContent), 'utf8');
fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
  slug: topic.slug,
  content_type: 'market_outlook',
  status: 'in_review',
  review_status: 'pending',
  generated_at: new Date().toISOString(),
  quality_score_required: 90,
  ai_generated: aiMode,
  directional_bias: aiMode ? aiContent.en.directional_bias : null,
  live_market_status: intelligence.data_completeness,
  confidence: intelligence.confidence,
  event_context_used: intelligence.upcoming_events.slice(0, 3).map((event) => ({ name: event.name, date: event.date, source_url: event.source_url })),
  auto_publish: false,
  telegram_ready: false,
  public_site_updated: false,
  languages: ['en', 'ar']
}, null, 2) + '\n', 'utf8');

if (!['published', 'reviewed'].includes(topic.status)) {
  topic.status = 'in_review';
  topic.review_status = 'pending';
}
topic.revision_count = Number.isInteger(topic.revision_count) ? topic.revision_count : 0;
topic.last_reviewed = topic.last_reviewed || null;
topic.event_tags = unique([...(topic.event_tags || []), ...intelligence.upcoming_events.map((event) => event.type)]);
topic.regime_tags = regimeTags();
topic.confidence_label = intelligence.confidence.label;
if (aiMode && aiContent.en.directional_bias) topic.directional_bias = aiContent.en.directional_bias;
queue.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

console.log(`Generated market outlook draft: drafts/market-outlook/${topic.slug}`);
console.log(`AI-generated: ${aiMode}`);
console.log(`Confidence: ${intelligence.confidence.label}`);
console.log(`Data completeness: ${intelligence.data_completeness}`);
if (aiMode) console.log(`Directional bias: ${aiContent.en.directional_bias}`);
updateNarrativeMemory(topic, aiContent);

if (aiMode) {
  if (attemptAutoApproval(topic, topic.slug)) {
    console.log(`${topic.slug}: auto-approved (AI-generated content, score >= 96, all hard gates passed including specificity and no-filler).`);
  } else {
    console.log(`${topic.slug}: AI content generated but quality gate failed. Requires manual review.`);
  }
} else {
  console.log(`${topic.slug}: no OPENAI_API_KEY — structural draft saved, review_status=pending (no auto-approve).`);
}

function render(topic, locale, intel, aiContent = null) {
  const labelSets = getLabels();
  const ar = locale === 'ar';
  const title = ar ? topic.title_ar : topic.title_en;
  const summary = ar ? topic.summary_ar : topic.summary_en;
  const disclaimer = ar ? DISCLAIMER_AR : DISCLAIMER_EN;
  const enUrl = `${SITE_URL}/market-outlook/${topic.slug}.html`;
  const arUrl = `${SITE_URL}/ar/market-outlook/${topic.slug}.html`;
  const canonical = ar ? arUrl : enUrl;
  const pathPrefix = ar ? '../../' : '../';
  const n = intel.narratives;
  const ai = aiContent ? (ar ? aiContent.ar : aiContent.en) : null;

  // Scenario cards — AI: explicit bullish/bearish pair; structural: 3 generic cards
  const scenarioCards = ai
    ? [
        marketCard(ai.bullish_scenario, ar ? labelSets.ar.bullishScenario : labelSets.en.bullishScenario),
        marketCard(ai.bearish_scenario, ar ? labelSets.ar.bearishScenario : labelSets.en.bearishScenario)
      ].join('\n')
    : intel.scenarios.slice(0, 3).map((s) => marketCard(ar ? s.ar : s.en)).join('\n');

  // Risk factor cards — AI: specific; structural: generic label set
  const riskCards = ai
    ? ai.risk_factors.map(marketCard).join('\n')
    : (ar ? labelSets.ar.risks : labelSets.en.risks).map(marketCard).join('\n');

  // Key driver cards — AI: specific 3-item drivers; structural: macro/sector/ETF
  const driverCards = ai
    ? ai.key_drivers.map((d, i) => marketCard(d, String(i + 1))).join('\n')
    : [
        [ar ? labelSets.ar.macroBackdrop : labelSets.en.macroBackdrop, ar ? n.macro_pressure.ar : n.macro_pressure.en],
        [ar ? labelSets.ar.sectorContext : labelSets.en.sectorContext, ar ? n.sector_narrative.ar : n.sector_narrative.en],
        [ar ? labelSets.ar.etfContext : labelSets.en.etfContext, ar ? n.etf_rotation.ar : n.etf_rotation.en]
      ].map(([heading, text]) => marketCard(text, heading)).join('\n');

  // Watch-next items — AI: specific; structural: generic list
  const watchItems = ai
    ? ai.what_to_watch.map((item) => `              <li>${escapeHtml(item)}</li>`).join('\n')
    : (ar ? labelSets.ar.watch : labelSets.en.watch).map((item) => `              <li>${escapeHtml(item)}</li>`).join('\n');

  // Executive summary — AI: ai.executive_summary; structural: market_narrative
  const execSummaryText = ai
    ? ai.executive_summary
    : (ar ? n.market_narrative.ar : n.market_narrative.en);

  // Market tone section — AI: market_context + directional bias; structural: volatility text
  const marketToneContent = ai
    ? `<p class="market-copy">${escapeHtml(ai.market_context)}</p>
          <p class="market-copy"><strong>${escapeHtml(ar ? labelSets.ar.bias : labelSets.en.bias)}:</strong> ${escapeHtml(ai.directional_bias)}</p>`
    : `<p class="market-copy"><strong>${escapeHtml(ar ? labelSets.ar.tone : labelSets.en.tone)}:</strong> ${escapeHtml(ar ? confidenceAr(intel.confidence.label) : intel.confidence.label)}</p>
          <p class="market-copy">${escapeHtml(ar ? n.volatility_interpretation.ar : n.volatility_interpretation.en)}</p>`;
  const L = ar ? labelSets.ar : labelSets.en;
  const generatedAt = new Date().toISOString();
  const updatedDate = generatedAt.slice(0, 10);
  const readingMinutes = estimateReadingMinutes([
    title,
    summary,
    ar ? n.market_narrative.ar : n.market_narrative.en,
    ar ? n.volatility_interpretation.ar : n.volatility_interpretation.en,
    ar ? n.macro_pressure.ar : n.macro_pressure.en,
    ar ? n.sector_narrative.ar : n.sector_narrative.en,
    ar ? n.etf_rotation.ar : n.etf_rotation.en
  ].join(' '), ar);
  const contextual = contextualLinks(topic, ar).slice(0, 8);
  const contextualCards = contextual.map((link) => `          <a class="market-context-link" href="${link.href}"><span>${escapeHtml(link.label)}</span><small>${escapeHtml(link.reason)}</small></a>`).join('\n');
  const takeawayCards = L.takeaways.map((item) => `          <article class="market-takeaway-card"><span>${escapeHtml(item.kicker)}</span><p>${escapeHtml(item.text)}</p></article>`).join('\n');
  const schema = buildSchemas({ title, summary, locale, canonical, enUrl, arUrl, updatedDate, topic, ar, L });
  const nav = ar ? renderArNav(topic.slug) : renderEnNav(topic.slug);
  const breadcrumb = ar
    ? `<nav class="breadcrumb"><a href="/ar/">الرئيسية</a><span>/</span><a href="/ar/market-outlook/">توقعات السوق</a><span>/</span><span>${escapeHtml(title)}</span></nav>`
    : `<nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/market-outlook/">Market Outlook</a><span>/</span><span>${escapeHtml(title)}</span></nav>`;
  const sidebarLinks = [
    ['market-narrative', L.executiveSummary],
    ['volatility-context', L.marketTone],
    ['key-drivers', L.keyDrivers],
    ['scenario-outlook', L.scenarioOutlook],
    ['risk-factors', L.riskFactorsTitle],
    ['watch-next', L.watchNextTitle],
    ['related-research', L.relatedTitle]
  ].map(([id, label]) => `            <a href="#${id}">${escapeHtml(label)}</a>`).join('\n');

  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="index,follow" />
  <title>${escapeHtml(title)} | TradeAlphaAI Market Outlook</title>
  <meta name="description" content="${escapeHtml(summary)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${enUrl}" />
  <link rel="alternate" hreflang="ar" href="${arUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(summary)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${SITE_URL}/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(summary)}" />
  <link rel="stylesheet" href="${pathPrefix}styles.css" />
  <link rel="stylesheet" href="${pathPrefix}landing.css" />
  <link rel="stylesheet" href="${pathPrefix}css/market/market-portal.css" />
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body class="market-page">
  <div class="reading-progress" aria-hidden="true"><span></span></div>
  ${nav}
  <main class="market-shell">
    <div class="wrap">
      ${breadcrumb}
      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${escapeHtml(L.label)}</span>
          <h1>${escapeHtml(title)}</h1>
          <p class="market-lead">${escapeHtml(summary)}</p>
          <div class="market-article-meta">
            <span>${escapeHtml(L.researchDesk)}</span>
            <span>${escapeHtml(L.updatedAt)}: <time datetime="${updatedDate}">${updatedDate}</time></span>
            <span>${escapeHtml(L.readTime)}: ${readingMinutes} ${escapeHtml(L.minutes)}</span>
          </div>
          <div class="market-actions">
            <span class="market-btn">${escapeHtml(L.tone)}: ${escapeHtml(ar ? confidenceAr(intel.confidence.label) : intel.confidence.label)}</span>
            <span class="market-btn">${escapeHtml(L.uncertainty)}: ${escapeHtml(ar ? uncertaintyAr(intel.confidence.uncertainty_label) : intel.confidence.uncertainty_label)}</span>
          </div>
          <div class="market-takeaway-grid">
${takeawayCards}
          </div>
        </div>
      </section>

      <div class="market-outlook-layout">
        <aside class="market-outlook-sidebar" aria-label="${escapeHtml(L.sectionNavigation)}">
          <div class="market-sidebar-card">
            <span class="eyebrow">${escapeHtml(L.sectionNavigation)}</span>
            <nav class="market-anchor-nav">
${sidebarLinks}
            </nav>
          </div>
          <div class="market-sidebar-card">
            <span class="eyebrow">${escapeHtml(L.researchFramework)}</span>
            <p>${escapeHtml(L.frameworkCopy)}</p>
            <a href="${ar ? '/ar/methodology.html' : '/methodology.html'}">${escapeHtml(L.methodologyLink)}</a>
          </div>
        </aside>

        <article class="market-outlook-article">
      <section class="market-section" id="disclaimer-block">
        <div class="market-panel">
          <span class="eyebrow">${escapeHtml(L.disclaimerTitle)}</span>
          <p class="market-copy educational-disclaimer">${escapeHtml(disclaimer)}</p>
        </div>
      </section>

      <section class="market-section" id="market-narrative">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.executiveSummary)}</span><h2>${escapeHtml(L.executiveSummary)}</h2></div>
        <div class="market-panel"><p class="market-copy">${escapeHtml(execSummaryText)}</p></div>
      </section>

      <section class="market-section" id="volatility-context">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.marketTone)}</span><h2>${escapeHtml(L.marketTone)}</h2></div>
        <div class="market-panel">
          ${marketToneContent}
        </div>
      </section>

      <section class="market-section" id="key-drivers">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.keyDrivers)}</span><h2>${escapeHtml(L.keyDrivers)}</h2></div>
        <div class="market-grid three">
${driverCards}
        </div>
      </section>

      <section class="market-section" id="scenario-outlook">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.scenarioOutlook)}</span><h2>${escapeHtml(L.scenarioOutlook)}</h2><p class="market-copy">${escapeHtml(L.scenarioNote)}</p></div>
        <div class="market-grid three">
${scenarioCards}
        </div>
      </section>

      <section class="market-section" id="risk-factors">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.riskFactorsTitle)}</span><h2>${escapeHtml(L.riskFactorsTitle)}</h2></div>
        <div class="market-grid three">
${riskCards}
        </div>
      </section>

      <section class="market-section" id="watch-next">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.watchNextTitle)}</span><h2>${escapeHtml(L.watchNextTitle)}</h2></div>
        <div class="market-panel"><ul class="market-copy">
${watchItems}
        </ul></div>
      </section>

      <section class="market-section" id="related-research">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.relatedTitle)}</span><h2>${escapeHtml(L.relatedTitle)}</h2></div>
        <div class="market-grid three">
${relatedCards(ar)}
        </div>
        <div class="market-context-grid" aria-label="${escapeHtml(L.contextualLinks)}">
${contextualCards}
        </div>
      </section>

      <section class="market-section" id="footer-disclaimer">
        <div class="market-panel">
          <span class="eyebrow">${escapeHtml(L.educationalDisclaimer)}</span>
          <p class="market-copy educational-disclaimer">${escapeHtml(disclaimer)}</p>
          <p class="market-copy">${escapeHtml(L.footerNote)}</p>
        </div>
      </section>
        </article>
      </div>
    </div>
  </main>
  <script src="${pathPrefix}js/language-router.js" defer></script>
  <script src="${pathPrefix}js/mobile-nav.js" defer></script>
  <script>
(function(){
  var bar = document.querySelector('.reading-progress span');
  if (!bar) return;
  function updateProgress(){
    var doc = document.documentElement;
    var max = Math.max(1, doc.scrollHeight - doc.clientHeight);
    bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, doc.scrollTop / max)) + ')';
  }
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });
})();
  </script>
</body>
</html>
`;

  function marketCard(text, heading = '') {
    return `          <article class="market-card">${heading ? `<span class="market-card-kicker">${escapeHtml(heading)}</span>` : ''}<p class="market-copy">${escapeHtml(text)}</p></article>`;
  }
}

function updateNarrativeMemory(topicItem, aiContentValue) {
  try {
    const snapshot = buildSnapshot({ slug: topicItem.slug, topic: topicItem, generatedContent: aiContentValue });
    const memoryBefore = require('./macro-intelligence-core').readMemory();
    const drift = detectNarrativeDrift(snapshot, memoryBefore);
    const sequence = buildRegimeSequence(snapshot, memoryBefore);
    const divergence = detectCrossAssetDivergence(snapshot);
    snapshot.drift_notes = drift.notes;
    snapshot.regime_sequence = sequence.primary_sequence;
    snapshot.cross_asset_divergence = divergence.primary_tension;
    appendSnapshot(snapshot);
    console.log(`[NARRATIVE MEMORY] Appended snapshot: ${snapshot.id}`);
    console.log(`[NARRATIVE MEMORY] Drift: ${drift.notes[0]}`);
    console.log(`[NARRATIVE MEMORY] Sequence: ${sequence.primary_sequence.pattern}`);
    console.log(`[NARRATIVE MEMORY] Divergence: ${divergence.primary_tension.signal}`);
  } catch (error) {
    console.log(`[NARRATIVE MEMORY] Update skipped: ${error.message}`);
  }
}

function estimateReadingMinutes(text, ar) {
  const units = ar
    ? (String(text || '').match(/[\u0600-\u06ff]+/g) || []).length
    : String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.ceil(units / (ar ? 180 : 220)));
}

function buildSchemas({ title, summary, locale, canonical, enUrl, arUrl, updatedDate, topic, ar, L }) {
  const home = ar ? `${SITE_URL}/ar/` : `${SITE_URL}/`;
  const collection = ar ? `${SITE_URL}/ar/market-outlook/` : `${SITE_URL}/market-outlook/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: title,
        description: summary,
        inLanguage: locale,
        datePublished: updatedDate,
        dateModified: updatedDate,
        author: { '@type': 'Organization', name: 'TradeAlphaAI Research Desk', url: SITE_URL },
        publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: SITE_URL },
        mainEntityOfPage: canonical,
        isAccessibleForFree: true,
        about: unique([topic.topic_cluster, ...(topic.event_tags || []), ...regimeTags()]).filter(Boolean),
        educationalLevel: 'General market research'
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: ar ? 'الرئيسية' : 'Home', item: home },
          { '@type': 'ListItem', position: 2, name: ar ? 'توقعات السوق' : 'Market Outlook', item: collection },
          { '@type': 'ListItem', position: 3, name: title, item: canonical }
        ]
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: ar ? 'هل هذا التقرير توصية استثمارية؟' : 'Is this outlook investment advice?',
            acceptedAnswer: { '@type': 'Answer', text: ar ? DISCLAIMER_AR : DISCLAIMER_EN }
          },
          {
            '@type': 'Question',
            name: ar ? 'كيف ينبغي قراءة السيناريوهات؟' : 'How should the scenarios be read?',
            acceptedAnswer: { '@type': 'Answer', text: L.scenarioNote }
          }
        ]
      }
    ],
    alternateName: [enUrl, arUrl]
  };
}

function contextualLinks(topic, ar) {
  const cluster = normalize(`${topic.topic_cluster || ''} ${topic.discovery_cluster || ''} ${topic.slug || ''} ${(topic.macro_tags || []).join(' ')}`);
  const prefix = ar ? '/ar' : '';
  const common = ar
    ? [
        { href: `${prefix}/rankings.html`, label: 'تصنيفات السوق', reason: 'مقارنة تعليمية بين الأسهم وصناديق المؤشرات' },
        { href: `${prefix}/etfs.html`, label: 'مركز أبحاث صناديق المؤشرات', reason: 'سياق أوسع للتعرضات والقطاعات' },
        { href: `${prefix}/insights/etf-risk-comparison-guide.html`, label: 'دليل مخاطر صناديق المؤشرات', reason: 'إطار تعليمي لتقييم المخاطر' },
        { href: `${prefix}/methodology.html`, label: 'منهجية البحث', reason: 'شفافية حول طريقة بناء الأبحاث' }
      ]
    : [
        { href: '/rankings.html', label: 'Market rankings', reason: 'Educational comparison across stocks and ETFs' },
        { href: '/etfs.html', label: 'ETF research hub', reason: 'Broader context for exposures and sectors' },
        { href: '/insights/etf-risk-comparison-guide.html', label: 'ETF risk comparison guide', reason: 'Educational framework for risk review' },
        { href: '/methodology.html', label: 'Research methodology', reason: 'Transparent explanation of research process' }
      ];
  const thematic = [];
  if (cluster.includes('ai') || cluster.includes('semiconductor')) {
    thematic.push(
      ar
        ? { href: '/ar/semiconductor-stocks.html', label: 'محور أشباه الموصلات', reason: 'سياق قطاعي للتكنولوجيا والدورات الإنتاجية' }
        : { href: '/semiconductor-stocks.html', label: 'Semiconductor stocks hub', reason: 'Sector context for technology and chip cycles' },
      ar
        ? { href: '/ar/etfs/smh.html', label: 'SMH', reason: 'صندوق مؤشر مرتبط بمحور أشباه الموصلات' }
        : { href: '/etfs/smh.html', label: 'SMH ETF', reason: 'ETF exposure tied to semiconductor themes' },
      ar
        ? { href: '/ar/stocks/nvda.html', label: 'NVDA', reason: 'شركة رئيسية ضمن بنية الذكاء الاصطناعي' }
        : { href: '/stocks/nvda.html', label: 'NVDA research', reason: 'Large-cap AI infrastructure context' }
    );
  }
  if (cluster.includes('etf') || cluster.includes('rotation')) {
    thematic.push(
      ar
        ? { href: '/ar/compare/spy-vs-qqq.html', label: 'SPY مقابل QQQ', reason: 'مقارنة تعليمية بين تعرضين واسعَين' }
        : { href: '/compare/spy-vs-qqq.html', label: 'SPY vs QQQ', reason: 'Broad-market and growth exposure comparison' },
      ar
        ? { href: '/ar/dividend-etfs.html', label: 'محور صناديق التوزيعات', reason: 'سياق دفاعي ودخلي لصناديق المؤشرات' }
        : { href: '/dividend-etfs.html', label: 'Dividend ETFs hub', reason: 'Income and defensive ETF context' },
      ar
        ? { href: '/ar/etfs/qqq.html', label: 'QQQ', reason: 'تعرض للنمو والتكنولوجيا ضمن صناديق المؤشرات' }
        : { href: '/etfs/qqq.html', label: 'QQQ ETF', reason: 'Growth and technology ETF exposure' }
    );
  }
  if (cluster.includes('yield') || cluster.includes('rates') || cluster.includes('macro')) {
    thematic.push(
      ar
        ? { href: '/ar/etfs/bnd.html', label: 'BND', reason: 'سياق السندات عند تحليل الفائدة' }
        : { href: '/etfs/bnd.html', label: 'BND ETF', reason: 'Bond context for rate-sensitive research' },
      ar
        ? { href: '/ar/bond-etfs.html', label: 'محور صناديق السندات', reason: 'تعليم حول الفائدة والدخل الثابت' }
        : { href: '/bond-etfs.html', label: 'Bond ETFs hub', reason: 'Rate and fixed-income education' }
    );
  }
  return uniqueLinks([...thematic, ...common]);
}

function uniqueLinks(links) {
  const seen = new Set();
  return links.filter((link) => {
    if (!link || !link.href || seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}

function getLabels() {
  return {
  en: {
    label: 'Educational market commentary',
    tone: 'Market tone',
    bias: 'Directional bias',
    bullishScenario: 'Bullish Scenario',
    bearishScenario: 'Bearish Scenario',
    uncertainty: 'Uncertainty',
    disclaimerTitle: 'Educational Disclaimer',
    executiveSummary: 'Executive Summary',
    marketTone: 'Market Tone',
    keyDrivers: 'Key Drivers',
    macroBackdrop: 'Macro Backdrop',
    sectorContext: 'Sector Context',
    etfContext: 'ETF Rotation Context',
    scenarioOutlook: 'Scenario Outlook',
    scenarioNote: 'The scenarios below are conditional educational frameworks. They are not predictions or investment recommendations.',
    riskFactorsTitle: 'Risk Factors',
    watchNextTitle: 'What to Watch Next',
    relatedTitle: 'Related Research',
    contextualLinks: 'Contextual research links',
    educationalDisclaimer: 'Educational Disclaimer',
    sectionNavigation: 'Section navigation',
    researchFramework: 'Research framework',
    methodologyLink: 'Read methodology',
    researchDesk: 'TradeAlphaAI Research Desk',
    updatedAt: 'Updated',
    readTime: 'Reading time',
    minutes: 'min',
    frameworkCopy: 'This outlook uses scenario-based analysis, educational market commentary, and transparent uncertainty language. It avoids directional calls and separates context from recommendations.',
    footerNote: 'TradeAlphaAI publishes market outlook research for education and context. Readers should evaluate risk, uncertainty, and source quality before making independent decisions.',
    takeaways: [
      { kicker: 'Research posture', text: 'Scenario-based analysis keeps the discussion conditional and avoids certainty claims.' },
      { kicker: 'Market context', text: 'Macro, sector, and ETF rotation themes are reviewed as educational inputs, not trade signals.' },
      { kicker: 'Reader use', text: 'Use this outlook as a structured research guide alongside methodology and related pages.' }
    ],
    risks: [
      'Macro data may shift rate expectations and change market tone quickly.',
      'Earnings guidance can affect sector leadership and valuation sensitivity.',
      'Liquidity and positioning can amplify volatility around major events.'
    ],
    watch: [
      'Inflation and labor-market data releases.',
      'Federal Reserve communication and rate expectations.',
      'Sector breadth across technology, defensive, and cyclical groups.',
      'ETF rotation between broad-market, growth, income, and defensive exposures.'
    ]
  },
  ar: {
    label: 'تعليق تعليمي على السوق',
    tone: 'نبرة السوق',
    bias: 'الميل الاتجاهي',
    bullishScenario: 'السيناريو الصاعد',
    bearishScenario: 'السيناريو الهابط',
    uncertainty: 'عدم اليقين',
    disclaimerTitle: 'إخلاء المسؤولية التعليمي',
    executiveSummary: 'الملخص التنفيذي',
    marketTone: 'نبرة السوق',
    keyDrivers: 'العوامل الرئيسية',
    macroBackdrop: 'الخلفية الكلية',
    sectorContext: 'سياق القطاعات',
    etfContext: 'سياق صناديق المؤشرات',
    scenarioOutlook: 'سيناريوهات محتملة',
    scenarioNote: 'السيناريوهات التالية أطر تعليمية مشروطة. لا تمثل توقعات أو توصيات استثمارية.',
    riskFactorsTitle: 'عوامل المخاطر',
    watchNextTitle: 'ما الذي يجب مراقبته لاحقا',
    relatedTitle: 'أبحاث مرتبطة',
    contextualLinks: 'روابط بحثية سياقية',
    educationalDisclaimer: 'إخلاء المسؤولية التعليمي',
    sectionNavigation: 'تنقل الأقسام',
    researchFramework: 'إطار البحث',
    methodologyLink: 'قراءة المنهجية',
    researchDesk: 'فريق أبحاث TradeAlphaAI',
    updatedAt: 'آخر تحديث',
    readTime: 'مدة القراءة',
    minutes: 'دقائق',
    frameworkCopy: 'يعتمد هذا التقرير على تحليل قائم على السيناريوهات وتعليق تعليمي للأسواق ولغة واضحة حول عدم اليقين، مع تجنب الدعوات الاتجاهية وفصل السياق عن التوصيات.',
    footerNote: 'تنشر TradeAlphaAI أبحاث توقعات السوق لأغراض التعليم والسياق. ينبغي للقارئ تقييم المخاطر وعدم اليقين وجودة المصادر قبل اتخاذ قرارات مستقلة.',
    takeaways: [
      { kicker: 'منهجية البحث', text: 'يعتمد التحليل على سيناريوهات مشروطة ويتجنب لغة اليقين أو التوقعات الحاسمة.' },
      { kicker: 'سياق السوق', text: 'تُعرض المحاور الكلية والقطاعية وصناديق المؤشرات كمدخلات تعليمية وليست إشارات تداول.' },
      { kicker: 'استخدام القارئ', text: 'يمكن قراءة هذا التقرير كدليل بحث منظم إلى جانب صفحة المنهجية والروابط المرتبطة.' }
    ],
    risks: [
      'قد تغير البيانات الكلية توقعات الفائدة ونبرة السوق بسرعة.',
      'قد تؤثر توجيهات الأرباح في قيادة القطاعات وحساسية التقييم.',
      'قد تؤدي السيولة والتمركز إلى تضخيم التقلب حول الأحداث الكبرى.'
    ],
    watch: [
      'إصدارات بيانات التضخم وسوق العمل.',
      'تواصل الاحتياطي الفيدرالي وتوقعات أسعار الفائدة.',
      'اتساع المشاركة عبر قطاعات التكنولوجيا والقطاعات الدفاعية والدورية.',
      'التناوب بين صناديق السوق الواسع والنمو والدخل والتعرضات الدفاعية.'
    ]
  }
  };
}

function relatedCards(ar) {
  const cards = ar
    ? [
        ['تصنيفات السوق', 'راجع تصنيفات الأسهم وصناديق المؤشرات ضمن سياق تعليمي أوسع.', '/ar/rankings.html', 'عرض التصنيفات'],
        ['أبحاث صناديق المؤشرات', 'استكشف التعرضات القطاعية والتنويع ومقارنات الصناديق.', '/ar/etfs.html', 'استكشاف الصناديق'],
        ['مكتبة الرؤى', 'اقرأ مقالات تعليمية حول القطاعات والمقارنات وإدارة المخاطر.', '/ar/insights/', 'تصفح المقالات']
      ]
    : [
        ['Market Rankings', 'Review stock and ETF rankings inside a broader educational context.', '/rankings.html', 'View rankings'],
        ['ETF Research', 'Explore sector exposure, diversification, and ETF comparisons.', '/etfs.html', 'Explore ETFs'],
        ['Insights Library', 'Read educational articles on sectors, comparisons, and risk management.', '/insights/', 'Browse articles']
      ];
  return cards.map(([title, body, href, link]) => `          <article class="market-card"><span class="market-card-kicker">${escapeHtml(title)}</span><p class="market-copy">${escapeHtml(body)}</p><a class="market-card-link" href="${href}">${escapeHtml(link)}</a></article>`).join('\n');
}

function renderEnNav(slug) {
  return `<div class="topbar"><div class="wrap topbar-inner"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlphaAI</strong><span>Research Platform</span></span></a><div class="top-actions"><nav class="nav-group" aria-label="Primary"><a href="/" class="nav-link">Home</a><a href="/stocks.html" class="nav-link">Global Stock Research</a><a href="/etfs.html" class="nav-link">ETF Analyzer</a><a href="/rankings.html" class="nav-link">Rankings</a><a href="/insights/" class="nav-link">Articles</a><a href="/market-outlook/" class="nav-link">Market Outlook</a></nav><div class="locale-links" aria-label="Language"><a class="lang-switch" data-locale-route="ar" href="/ar/market-outlook/${slug}.html">Arabic</a><a class="lang-switch" data-locale-route="en" href="/market-outlook/${slug}.html">English</a></div></div></div></div>`;
}

function renderArNav(slug) {
  return `<div class="topbar"><div class="wrap topbar-inner"><a class="brand" href="/ar/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlphaAI</strong><span>منصة الأبحاث</span></span></a><div class="top-actions"><nav class="nav-group" aria-label="التنقل الرئيسي"><a href="/ar/" class="nav-link">الرئيسية</a><a href="/ar/stocks.html" class="nav-link">أبحاث الأسهم</a><a href="/ar/etfs.html" class="nav-link">صناديق المؤشرات</a><a href="/ar/rankings.html" class="nav-link">التصنيفات</a><a href="/ar/insights/" class="nav-link">المقالات</a><a href="/ar/market-outlook/" class="nav-link">توقعات السوق</a></nav><div class="locale-links" aria-label="اختيار اللغة"><a class="lang-switch" data-locale-route="en" href="/market-outlook/${slug}.html">English</a><a class="lang-switch" data-locale-route="ar" href="/ar/market-outlook/${slug}.html">العربية</a></div></div></div></div>`;
}

function normalizeTopic(topic) {
  return {
    ...topic,
    title_en: clean(topic.title_en) || titleCase(topic.slug),
    title_ar: safeArabic(topic.title_ar) ? clean(topic.title_ar) : arabicTitle(topic.slug),
    category: clean(topic.category) || 'Market Outlook',
    topic_cluster: clean(topic.topic_cluster || topic.discovery_cluster || topic.category || 'market outlook'),
    summary_en: clean(topic.summary_en) || 'Educational market outlook focused on context, risks, and conditional scenarios without investment recommendations.',
    summary_ar: safeArabic(topic.summary_ar) ? clean(topic.summary_ar) : arabicSummary(topic.slug)
  };
}

function tryGetAiContent(slug) {
  if (!process.env.OPENAI_API_KEY) {
    console.log('[AI] OPENAI_API_KEY not set — using structural content (no auto-approve).');
    return null;
  }
  console.log(`[AI] Generating AI content for: ${slug}`);
  const result = spawnSync(process.execPath, [
    path.join(__dirname, 'generate-ai-market-outlook-content.js'),
    `--slug=${slug}`
  ], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
    env: { ...process.env }
  });
  // Use buffer.toString('utf8') explicitly to handle multi-byte Arabic characters on Windows
  if (result.stderr) process.stderr.write(Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr);
  const stdout = result.stdout ? (Buffer.isBuffer(result.stdout) ? result.stdout.toString('utf8') : result.stdout) : '';
  if (result.status !== 0 || !stdout.trim()) {
    console.log(`[AI] AI content generation failed or returned empty — falling back to structural.`);
    return null;
  }
  try {
    const content = JSON.parse(stdout);
    if (!content.en || !content.ar) {
      console.log('[AI] AI content missing en or ar — falling back to structural.');
      return null;
    }
    console.log(`[AI] AI content ready. Bias: ${content.en.directional_bias}`);
    return content;
  } catch (e) {
    console.log(`[AI] Could not parse AI content JSON: ${e.message}`);
    return null;
  }
}

function attemptAutoApproval(topicItem, slugValue) {
  const metadata = readJson(path.join(OUT_DIR, slugValue, 'metadata.json'), {});
  if (metadata.ai_generated !== true) {
    console.log(`${slugValue}: auto-approval blocked because draft is structural fallback or metadata is missing ai_generated=true.`);
    return false;
  }
  const result = spawnSync(process.execPath, [path.join(__dirname, 'score-generated-content.js'), `--slug=${slugValue}`, '--type=market_outlook', '--min-score=96'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) {
    if (result.stderr) console.log(result.stderr.trim());
    return false;
  }
  const report = JSON.parse(result.stdout);
  const entry = (report.results || []).find((item) => item.slug === slugValue);
  if (!entry || entry.quality_score < 96) return false;
  const required = ['language_purity', 'public_placeholder_risk', 'semantic_depth', 'layout_quality', 'has_directional_bias', 'has_scenarios', 'scenario_structure', 'institutional_density', 'continuity_depth', 'cross_asset_relationships', 'transmission_chains', 'supported_directional_claims', 'narrative_originality', 'specificity', 'no_generic_filler'];
  if (required.some((name) => entry.checks[name] !== true)) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (topicItem.status !== 'published') topicItem.status = 'reviewed';
  if (topicItem.review_status !== 'approved') topicItem.review_status = 'approved';
  topicItem.last_reviewed = today;
  queue.updated = today;
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
  return true;
}

function isCoolingDown(item) {
  const cluster = item.topic_cluster || item.discovery_cluster || item.category;
  if (!cluster) return false;
  return (memory.recent_topics || []).some((entry) => entry.cluster === cluster && daysSince(entry.published_at || entry.created_at) < 14);
}

function daysSince(day) {
  if (!day) return Infinity;
  return Math.floor((Date.now() - new Date(`${day}T00:00:00Z`).getTime()) / 86400000);
}

function regimeTags() {
  const state = regime.state || {};
  return unique([state.volatility_regime, state.risk_regime, state.ai_sector_momentum, state.semiconductor_strength, state.rates_trend, state.defensive_rotation, state.growth_value_bias].filter(Boolean));
}

function confidenceAr(label) {
  const map = { constructive: 'بناءة', cautious: 'حذرة', defensive: 'دفاعية', volatile: 'متقلبة', 'elevated uncertainty': 'عدم يقين مرتفع', 'improving breadth': 'اتساع متحسن' };
  return map[label] || 'مشروطة';
}

function uncertaintyAr(label) {
  const map = { 'low uncertainty': 'منخفض', 'moderate uncertainty': 'معتدل', 'elevated uncertainty': 'مرتفع', 'high uncertainty': 'عال' };
  return map[label] || 'معتدل';
}

function arabicTitle(slug) {
  if (slug.includes('ai-sector')) return 'سياق قطاع الذكاء الاصطناعي وأشباه الموصلات: مراجعة تعليمية للزخم والسيناريوهات';
  if (slug.includes('etf-rotation')) return 'سياق التناوب في صناديق المؤشرات: إشارات التدفق والسيناريوهات القطاعية التعليمية';
  if (slug.includes('yield')) return 'عوائد الخزانة وسياق أسعار الفائدة: إطار تعليمي لسيناريوهات السوق';
  if (slug.includes('regime')) return 'سياق نظام السوق: إشارات المخاطر والسيناريوهات التعليمية';
  return 'تعليق تعليمي على اتجاهات السوق';
}

function arabicSummary(slug) {
  if (slug.includes('ai-sector')) return 'نظرة تعليمية على زخم قطاع الذكاء الاصطناعي وأشباه الموصلات وسياق صناديق المؤشرات والسيناريوهات المشروطة، وليست نصيحة استثمارية.';
  if (slug.includes('etf-rotation')) return 'تحليل تعليمي لموضوعات تدفق صناديق المؤشرات والتناوب القطاعي والسيناريوهات السوقية المشروطة، وليس توقعا أو توصية استثمارية.';
  if (slug.includes('yield')) return 'نظرة تعليمية على تحركات عوائد الخزانة وسياق أسعار الفائدة والسيناريوهات السوقية المشروطة، وليست توقعا أو توصية استثمارية.';
  if (slug.includes('regime')) return 'سياق تعليمي لإشارات نظام السوق وديناميكيات المخاطر والسيناريوهات المشروطة، وليس توقعا أو توصية استثمارية.';
  return 'تعليق تعليمي على السوق يركز على السياق والمخاطر والسيناريوهات دون تقديم توصيات استثمارية.';
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeArabic(value) {
  const text = String(value || '');
  return /[\u0600-\u06ff]/.test(text) && !/[\uFFFD]/.test(text) && !/\?{3,}/.test(text) && !/[\u00d8\u00d9\u00c3]/.test(text);
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

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
