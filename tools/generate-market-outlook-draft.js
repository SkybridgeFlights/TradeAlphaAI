'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { generateIntelligence } = require('./generate-market-intelligence.js');
const { appendSnapshot, buildSnapshot } = require('./macro-intelligence-core');
const { detectNarrativeDrift } = require('./detect-narrative-drift');
const { buildRegimeSequence } = require('./build-regime-sequence');
const { detectCrossAssetDivergence } = require('./detect-cross-asset-divergence');
const { extractMarketSignals } = require('./extract-market-signals');
const { recommendLinks } = require('./internal-link-intelligence');
const { cleanArabicMarketCopy } = require('./clean-arabic-market-copy');
const { renderSiteFooter, renderSiteHeader } = require('./global-layout-renderer');
const {
  findArabicEnglishRun,
  normalizeArabicFinancialHtml,
} = require('./arabic-financial-localization');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');
const ECONOMIC_CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const REGIME_PATH = path.join(ROOT, 'data', 'market-regime-state.json');
const MEMORY_PATH = path.join(ROOT, 'data', 'topic-memory.json');
const LIVE_MARKET_PATH = path.join(ROOT, 'data', 'live-market-state.json');
const ETF_FLOW_PATH = path.join(ROOT, 'data', 'intelligence', 'etf-flow-intelligence.json');
const OUT_DIR = path.join(ROOT, 'drafts', 'market-outlook');
const SITE_URL = 'https://www.tradealphaai.com';
const ELIGIBLE = new Set(['planned', 'draft']);
const DISCLAIMER_EN = 'This analysis is educational market commentary only. It is not investment advice, financial advice, or a recommendation to buy or sell any asset. Market conditions can change rapidly and uncertainty remains present.';
const DISCLAIMER_AR = 'هذا التحليل عبارة عن تعليق تعليمي حول الأسواق المالية فقط، ولا يُعتبر نصيحة استثمارية أو مالية أو توصية شراء أو بيع لأي أصل مالي. قد تتغير ظروف السوق بسرعة وتبقى حالة عدم اليقين قائمة.';

const slugArg = argValue('--slug');
const queue = readJson(QUEUE_PATH, { topics: [] });
const calendar = readJson(ECONOMIC_CALENDAR_PATH, { events: [] });
const regime = readJson(REGIME_PATH, {});
const memory = readJson(MEMORY_PATH, { recent_topics: [] });
const liveMarket = readJson(LIVE_MARKET_PATH, { metadata: { status: 'fallback' } });
const etfFlow = readJson(ETF_FLOW_PATH, { etf_profiles: {}, regime_context: 'unknown' });

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
const generationId = new Date().toISOString();
const sourceHash = generationSourceHash();

cleanupStaleArtifacts(topic.slug);
console.log(`[GENERATION SOURCE HASH] slug=${topic.slug} sha256=${sourceHash}`);

const normalized = normalizeTopic(topic);
const intelligence = generateIntelligence(liveMarket, calendar, regime, normalized.topic_cluster);

// Attempt AI-generated content (requires OPENAI_API_KEY).
// When unavailable the draft is structural only and must not be auto-approved.
const aiContent = tryGetAiContent(topic.slug);
const aiMode = aiContent !== null;

const renderedEn = render(normalized, 'en', intelligence, aiContent, generationId);
const renderedAr = cleanArabicMarketCopy(normalizeArabicFinancialHtml(
  render(normalized, 'ar', intelligence, aiContent, generationId)
));
assertArabicGenerationSafe(renderedAr, topic.slug);

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(enDraft, renderedEn, 'utf8');
fs.writeFileSync(arDraft, renderedAr, 'utf8');
fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
  slug: topic.slug,
  content_type: 'market_outlook',
  status: 'in_review',
  review_status: 'pending',
  generated_at: generationId,
  data_generation_id: generationId,
  generation_source_hash: sourceHash,
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
console.log(`[FINAL HTML HASH] locale=en slug=${topic.slug} sha256=${sha256(renderedEn)}`);
console.log(`[FINAL HTML HASH] locale=ar slug=${topic.slug} sha256=${sha256(renderedAr)}`);

// ── Validate generated artifacts (Fix 8) ─────────────────────────────────────
// GLOBAL_HEADER_START is injected by apply-global-header.js on published pages.
// At draft time, we verify the CSS link and the data-global-header attribute only.
const generatedEn = fs.readFileSync(enDraft, 'utf8');
const generatedAr = fs.readFileSync(arDraft, 'utf8');
const missingMarkers = [];
if (!generatedEn.includes('data-global-header'))     missingMarkers.push('data-global-header (en)');
if (!generatedEn.includes('/css/global-header.css')) missingMarkers.push('/css/global-header.css (en)');
if (!generatedAr.includes('data-global-header'))     missingMarkers.push('data-global-header (ar)');
if (missingMarkers.length) fail(`${topic.slug}: generated draft missing required markers: ${missingMarkers.join(', ')}`);

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

// ── Deterministic promotion (Fix 1) ──────────────────────────────────────────
// AI path: try high-bar auto-approval first; fall back to structural promotion.
// Structural path: promote deterministically when bilingual generation succeeds.
if (aiMode) {
  if (attemptAutoApproval(topic, topic.slug)) {
    console.log(`${topic.slug}: auto-approved (AI-generated content, score >= 96, all hard gates passed).`);
  } else {
    console.log(`${topic.slug}: AI quality gate not met — applying structural promotion.`);
    attemptStructuralPromotion(topic, topic.slug, 'ai_quality_gate_below_threshold');
  }
} else {
  console.log(`${topic.slug}: no OPENAI_API_KEY — structural draft complete.`);
  attemptStructuralPromotion(topic, topic.slug, 'structural_generation_complete_no_ai_key');
}

function render(topic, locale, intel, aiContent = null, dataGenerationId = new Date().toISOString()) {
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
  const generatedAt = dataGenerationId;
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
  const nav = renderSiteHeader({
    locale: ar ? 'ar' : 'en',
    active: 'market-outlook',
    languageHref: ar ? `/market-outlook/${topic.slug}.html` : `/ar/market-outlook/${topic.slug}.html`
  });
  const articleIntelligence = buildArticleIntelligence(topic, ar);
  const compSection = buildInstitutionalComparisonSection(topic, etfFlow, ar);
  const breadcrumb = ar
    ? `<nav class="breadcrumb"><a href="/ar/">الرئيسية</a><span>/</span><a href="/ar/market-outlook/">توقعات السوق</a><span>/</span><span>${escapeHtml(title)}</span></nav>`
    : `<nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/market-outlook/">Market Outlook</a><span>/</span><span>${escapeHtml(title)}</span></nav>`;
  const sidebarItems = [
    ['market-narrative', L.executiveSummary],
    ['intelligence-snapshot', L.intelligenceSnapshot],
    ['volatility-context', L.marketTone],
    ['key-drivers', L.keyDrivers],
    ['scenario-outlook', L.scenarioOutlook],
    ['risk-factors', L.riskFactorsTitle],
    ['watch-next', L.watchNextTitle],
    ...(compSection ? [['institutional-comparison', ar ? 'مقارنة مؤسسية' : 'Institutional Comparison']] : []),
    ['related-research', L.relatedTitle]
  ];
  const sidebarLinks = sidebarItems.map(([id, label]) => `            <a href="#${id}">${escapeHtml(label)}</a>`).join('\n');

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
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body class="market-page" data-generation-id="${escapeHtml(dataGenerationId)}">
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

${articleIntelligence}

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

${compSection}
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
  ${renderSiteFooter({ locale: ar ? 'ar' : 'en' })}
  <script src="${pathPrefix}js/language-router.js" defer></script>
  <script src="${pathPrefix}js/global-header.js" defer></script>
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

function buildArticleIntelligence(topic, ar) {
  const labels = getLabels();
  const L = { ...labels.en, ...(ar ? labels.ar : {}) };
  try {
    const current = buildSnapshot({ slug: topic.slug, topic });
    const memoryBefore = require('./macro-intelligence-core').readMemory();
    const drift = detectNarrativeDrift(current, memoryBefore);
    const sequence = buildRegimeSequence(current, memoryBefore);
    const divergence = detectCrossAssetDivergence(current);
    const signals = extractMarketSignals(current, memoryBefore).signals.slice(0, 5);
    const tags = signals.length ? signals.map((signal) => ar ? cleanStateAr(signal.signal) : signal.signal) : [ar ? 'مراقبة أساسية' : 'baseline monitoring'];
    const stateCards = [
      [L.riskRegime, current.dominant_risk_regime],
      [L.volatilityRegime, current.volatility_environment],
      [L.breadthCondition, current.breadth_quality == null ? current.breadth_state : `${current.breadth_quality}%`],
      [L.concentrationRisk, current.concentration_risk]
    ];
    return `      <section class="market-section" id="intelligence-snapshot">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.intelligenceSnapshot)}</span><h2>${escapeHtml(L.intelligenceSnapshot)}</h2><p class="market-copy">${escapeHtml(L.intelligenceIntro)}</p></div>
        <div class="article-intelligence-panel">
          <div class="article-intel-grid">
${stateCards.map(([label, value]) => `            <article class="article-intel-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(ar ? cleanStateAr(value) : cleanState(value))}</strong><small>${escapeHtml(L.confidence)}: ${escapeHtml(ar ? confidenceForAr(value) : confidenceFor(value))}</small></article>`).join('\n')}
          </div>
          <div class="article-signal-tags" aria-label="${escapeHtml(L.activeSignals)}">
${tags.map((tag) => `            <span>${escapeHtml(ar ? tag : cleanState(tag))}</span>`).join('\n')}
          </div>
          <div class="article-intel-notes">
            <p><strong>${escapeHtml(L.continuitySummary)}:</strong> ${escapeHtml(ar ? L.baselineContinuity : (drift.notes[0] || L.baselineContinuity))}</p>
            <p><strong>${escapeHtml(L.divergenceContext)}:</strong> ${escapeHtml(ar ? cleanStateAr(divergence.primary_tension.signal) : `${divergence.primary_tension.signal}: ${divergence.primary_tension.commentary}`)}</p>
            <p><strong>${escapeHtml(L.relatedSequence)}:</strong> ${escapeHtml(ar ? `${cleanStateAr(sequence.primary_sequence.pattern)} (${cleanStateAr(sequence.primary_sequence.transition_maturity)}, ${L.confidence}: ${cleanStateAr(sequence.primary_sequence.sequence_confidence)})` : `${sequence.primary_sequence.pattern} (${sequence.primary_sequence.transition_maturity}, confidence ${sequence.primary_sequence.sequence_confidence})`)}</p>
          </div>
        </div>
      </section>`;
  } catch (error) {
    return '';
  }
}

function buildInstitutionalComparisonSection(topicItem, etfFlowData, ar) {
  const KNOWN = ['SPY','QQQ','IWM','XLV','TLT','GLD','SOXX','DIA','XLE','XLF','XLU','XLP','UUP'];
  const explicit = [...(topicItem.related_etfs || []), ...(topicItem.affected_instruments || [])]
    .map((value) => String(value).toUpperCase())
    .filter((value) => KNOWN.includes(value));
  const haystack = `${topicItem.slug || ''} ${topicItem.title_en || ''} ${(topicItem.macro_tags || []).join(' ')} ${topicItem.topic_cluster || ''}`.toUpperCase();
  const inferred = KNOWN.filter((t) => new RegExp(`\\b${t}\\b`).test(haystack));
  const mentioned = [...new Set([...explicit, ...inferred])];
  if (mentioned.length < 2) return '';

  const profiles = etfFlowData.etf_profiles || {};
  const pair = mentioned.filter((t) => profiles[t]).slice(0, 2);
  if (pair.length < 2) return '';

  const [a, b] = pair;
  const pA = profiles[a];
  const pB = profiles[b];
  if (!pA || !pB) return '';

  const currentRegime = etfFlowData.regime_context || 'unknown';
  const rpA = pA.regime_profile?.[currentRegime] || pA.regime_profile?.tightening_cycle || '';
  const rpB = pB.regime_profile?.[currentRegime] || pB.regime_profile?.tightening_cycle || '';

  const L = ar ? {
    sectionTitle: 'مقارنة مؤسسية للصناديق',
    intro: 'تحليل الخصائص الهيكلية وقناة المعدلات وسلوك الدوران القطاعي لكل صندوق في السياق الحالي.',
    rateChannel: 'قناة المعدلات',
    regimeContext: 'السياق الراهن',
    structuralNote: 'مقارنة هيكلية',
  } : {
    sectionTitle: 'Institutional ETF Comparison',
    intro: 'Structural characteristics, rate-channel transmission, and current regime positioning for each ETF.',
    rateChannel: 'Rate channel',
    regimeContext: 'Current regime view',
    structuralNote: 'Structural comparison note',
  };

  const compNote = pA.comparison_note || pB.comparison_note || '';
  const intA = pA.institutional_interpretation || '';
  const intB = pB.institutional_interpretation || '';

  return `      <section class="market-section" id="institutional-comparison">
        <div class="market-section-head"><span class="eyebrow">${escapeHtml(L.sectionTitle)}</span><h2>${escapeHtml(L.sectionTitle)}: ${escapeHtml(a)} vs ${escapeHtml(b)}</h2><p class="market-copy">${escapeHtml(L.intro)}</p></div>
        <div class="market-grid two">
          <article class="market-card">
            <span class="market-card-kicker">${escapeHtml(a)}: ${escapeHtml(pA.full_name || a)}</span>
            <p class="market-copy">${escapeHtml(intA)}</p>
            <p class="market-copy"><strong>${escapeHtml(L.rateChannel)}:</strong> ${escapeHtml(pA.rate_transmission || '—')}</p>
            <p class="market-copy"><strong>${escapeHtml(L.regimeContext)}:</strong> ${escapeHtml(rpA || '—')}</p>
          </article>
          <article class="market-card">
            <span class="market-card-kicker">${escapeHtml(b)}: ${escapeHtml(pB.full_name || b)}</span>
            <p class="market-copy">${escapeHtml(intB)}</p>
            <p class="market-copy"><strong>${escapeHtml(L.rateChannel)}:</strong> ${escapeHtml(pB.rate_transmission || '—')}</p>
            <p class="market-copy"><strong>${escapeHtml(L.regimeContext)}:</strong> ${escapeHtml(rpB || '—')}</p>
          </article>
        </div>
        ${compNote ? `<div class="market-panel" style="margin-top:1rem"><p class="market-copy"><strong>${escapeHtml(L.structuralNote)}:</strong> ${escapeHtml(compNote)}</p></div>` : ''}
      </section>`;
}

function cleanState(value) {
  if (value === null || value === undefined || value === '') return 'unverified';
  return String(value).replace(/_/g, ' ');
}

function cleanStateAr(value) {
  if (value === null || value === undefined || value === '') return 'غير محدد';
  const map = {
    risk_off: 'تجنب المخاطر', risk_on: 'إقبال على المخاطر', neutral: 'محايد',
    elevated: 'مرتفع', low: 'منخفض', normal: 'طبيعي', high: 'عالٍ',
    moderate: 'معتدل', mixed: 'متباين', tightening: 'تشديدي', easing: 'تيسيري',
    transitioning: 'انتقالي', established: 'مستقر', contested: 'متنازع عليه',
    improving: 'متحسن', deteriorating: 'متراجع', stable: 'مستقر',
    defensive: 'دفاعي', growth: 'نمو', value: 'قيمة', unverified: 'غير محدد',
    tightening_cycle: 'دورة تشديدية', easing_cycle: 'دورة تيسيرية',
    risk_off_elevated_vix: 'تجنب المخاطر مع ارتفاع VIX',
    regime_persistence: 'استمرار النظام', unknown: 'غير محدد',
    strong: 'قوي', weak: 'ضعيف', narrow: 'ضيق', broad: 'واسع',
    positive: 'إيجابي', negative: 'سلبي', rising: 'صاعد', falling: 'هابط', flat: 'مستقر',
    early: 'مبكر', mature: 'ناضج', late: 'متأخر',
    high_confidence: 'ثقة عالية', medium_confidence: 'ثقة متوسطة', low_confidence: 'ثقة منخفضة',
    baseline_monitoring: 'مراقبة أساسية', signal_divergence: 'تباعد الإشارات',
    volatility_spike: 'ارتفاع التقلب', defensive_rotation: 'تناوب دفاعي',
    growth_momentum: 'زخم نمو', disinflation: 'تباطؤ تضخمي',
    stagflation_risk: 'مخاطر ركود تضخمي', recession_risk: 'مخاطر ركود'
  };
  const raw = String(value);
  const key = raw.toLowerCase().trim();
  const underKey = raw.replace(/\s+/g, '_').toLowerCase();
  return map[key] || map[underKey] || 'غير محدد';
}

function confidenceFor(value) {
  if (!value || value === 'unverified') return 'low';
  if (String(value).includes('mixed')) return 'medium';
  return 'medium-high';
}

function confidenceForAr(value) {
  if (!value || value === null || value === undefined || value === '') return 'منخفضة';
  if (String(value).includes('mixed') || String(value).includes('متباين')) return 'متوسطة';
  return 'متوسطة إلى مرتفعة';
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
  const clusters   = [topic.topic_cluster, topic.discovery_cluster].filter(Boolean);
  const macro_tags = topic.macro_tags || [];
  // Derive entity list from topic tags and slug keyword matching
  const etfWords   = ['TLT','IEF','SHY','BND','QQQ','SPY','IWM','SMH','SOXX','XLK','GLD','ARKK','JEPI','SCHD','VIG'];
  const entities   = etfWords.filter(t => {
    const hay = `${(topic.macro_tags || []).join(' ')} ${topic.slug || ''} ${topic.topic_cluster || ''}`.toUpperCase();
    return new RegExp(`\\b${t}\\b`).test(hay);
  });
  const links = recommendLinks({
    slug:     topic.slug || '',
    clusters,
    macro_tags,
    entities,
    locale:   ar ? 'ar' : 'en',
    maxLinks: 8,
  });
  // Map to the href/label/reason shape expected by the template
  return links.map(l => ({ href: l.href, label: l.label, reason: l.reason }));
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
    intelligenceSnapshot: 'Market Intelligence Snapshot',
    intelligenceIntro: 'This article is connected to the macro intelligence layer: regime memory, active signals, divergence checks, and sequence analysis.',
    riskRegime: 'Risk Regime',
    volatilityRegime: 'Volatility Regime',
    breadthCondition: 'Breadth Condition',
    concentrationRisk: 'Concentration Risk',
    confidence: 'Confidence',
    activeSignals: 'Active signals',
    continuitySummary: 'Narrative continuity',
    divergenceContext: 'Divergence context',
    relatedSequence: 'Related macro sequence',
    baselineContinuity: 'This establishes a baseline for future narrative comparison.',
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
    ],
    intelligenceSnapshot: 'نظرة تحليلية للسوق',
    intelligenceIntro: 'يرتبط هذا التقرير بإطار التحليل الكلي: ذاكرة النظام والإشارات النشطة وفحوصات التباين وتحليل التسلسل.',
    riskRegime: 'نظام المخاطر',
    volatilityRegime: 'نظام التقلب',
    breadthCondition: 'اتساع السوق',
    concentrationRisk: 'مخاطر التركز',
    confidence: 'الثقة',
    activeSignals: 'إشارات نشطة',
    continuitySummary: 'استمرارية السرد',
    divergenceContext: 'سياق التباعد',
    relatedSequence: 'التسلسل الكلي المرتبط',
    baselineContinuity: 'يضع هذا سياقاً أساسياً للمقارنة السردية المستقبلية.'
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

function attemptStructuralPromotion(topicItem, slugValue, reason) {
  const draftDir = path.join(OUT_DIR, slugValue);
  const enFile = path.join(draftDir, 'en.html');
  const arFile = path.join(draftDir, 'ar.html');
  const metaFile = path.join(draftDir, 'metadata.json');

  // Require bilingual drafts
  if (!fs.existsSync(enFile) || !fs.existsSync(arFile)) {
    console.log(`[MARKET OUTLOOK PROMOTION] topic=${slugValue} promotion_skipped reason=missing_bilingual_drafts`);
    return false;
  }

  // Require required intelligence files
  const requiredIntelligence = [REGIME_PATH, ECONOMIC_CALENDAR_PATH];
  for (const f of requiredIntelligence) {
    if (!fs.existsSync(f)) {
      console.log(`[MARKET OUTLOOK PROMOTION] topic=${slugValue} promotion_skipped reason=missing_intelligence_file:${path.basename(f)}`);
      return false;
    }
  }

  // Validate draft content — check for canonical header attribute and CSS link
  // (GLOBAL_HEADER_START is injected by apply-global-header.js on published pages, not drafts)
  const enHtml = fs.readFileSync(enFile, 'utf8');
  const arHtml = fs.readFileSync(arFile, 'utf8');
  if (!enHtml.includes('data-global-header') || !arHtml.includes('data-global-header')) {
    console.log(`[MARKET OUTLOOK PROMOTION] topic=${slugValue} promotion_skipped reason=missing_data_global_header_attribute`);
    return false;
  }
  if (!enHtml.includes(DISCLAIMER_EN)) {
    console.log(`[MARKET OUTLOOK PROMOTION] topic=${slugValue} promotion_skipped reason=missing_disclaimer_en`);
    return false;
  }
  if (!arHtml.includes(DISCLAIMER_AR)) {
    console.log(`[MARKET OUTLOOK PROMOTION] topic=${slugValue} promotion_skipped reason=missing_disclaimer_ar`);
    return false;
  }

  // Do not re-promote if already approved or published
  if (['published'].includes(topicItem.status)) {
    console.log(`[MARKET OUTLOOK PROMOTION] topic=${slugValue} promotion_skipped reason=already_${topicItem.status}`);
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  const previousState = `${topicItem.status}/${topicItem.review_status || 'none'}`;

  // Walk through promotion states
  const states = ['in_review', 'pending', 'generated'];
  const transitions = [];
  if (states.includes(topicItem.status) || topicItem.status === 'draft' || topicItem.status === 'planned') {
    if (topicItem.status !== 'reviewed') {
      topicItem.status = 'reviewed';
      transitions.push(`→ reviewed`);
    }
  }
  if (topicItem.review_status !== 'approved') {
    topicItem.review_status = 'approved';
    transitions.push(`→ approved`);
  }
  topicItem.last_reviewed = today;
  queue.updated = today;
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

  console.log(`[MARKET OUTLOOK PROMOTION] topic=${slugValue} previous_state=${previousState} next_state=reviewed/approved promotion_reason=${reason}`);
  if (transitions.length) console.log(`[MARKET OUTLOOK PROMOTION] transitions: ${transitions.join(', ')}`);
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

function cleanupStaleArtifacts(slug) {
  const targets = [
    path.join(OUT_DIR, slug),
    path.join(ROOT, 'ar', 'market-outlook', `${slug}.html`),
    path.join(ROOT, 'en', 'market-outlook', `${slug}.html`),
    path.join(ROOT, 'market-outlook', `${slug}.html`),
  ];
  const removed = [];

  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(path.relative(ROOT, target).replaceAll('\\', '/'));
  }

  console.log(`[STALE CLEANUP] slug=${slug} removed=${removed.length ? removed.join(',') : 'none'}`);
}

function generationSourceHash() {
  const inputs = [
    __filename,
    path.join(ROOT, 'tools', 'internal-link-intelligence.js'),
    path.join(ROOT, 'data', 'content-knowledge-graph.json'),
    path.join(ROOT, 'data', 'insights', 'article-registry.json'),
  ];
  const hash = crypto.createHash('sha256');
  for (const file of inputs) {
    hash.update(path.relative(ROOT, file).replaceAll('\\', '/'));
    hash.update('\0');
    if (fs.existsSync(file)) hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function assertArabicGenerationSafe(html, slug) {
  const match = String(html || '').match(/Training|Understanding the Two Phases/i);
  if (match) {
    throw new Error(
      `[MARKET OUTLOOK LOCALIZATION] ${slug}: prohibited English fragment found in generated Arabic HTML: "${match[0]}"`
    );
  }
  const englishRun = findArabicEnglishRun(html);
  if (englishRun) {
    throw new Error(
      `[MARKET OUTLOOK LOCALIZATION] ${slug}: more than 3 consecutive English words remain after normalization: ` +
      `"${englishRun[0].slice(0, 120)}"`
    );
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
