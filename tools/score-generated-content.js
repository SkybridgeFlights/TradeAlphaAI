'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const slug = argValue('--slug');
const type = argValue('--type') || 'editorial';
const minScore = Number(argValue('--min-score') || 0);
const targetDir = type === 'market_outlook' ? 'drafts/market-outlook' : 'drafts/editorial';
const dirs = slug ? [path.join(ROOT, targetDir, slug)] : listDirs(path.join(ROOT, targetDir));
const results = dirs.filter(fs.existsSync).map(scoreDraft);

if (!results.length) {
  console.log('No generated content drafts found for scoring.');
  process.exit(0);
}

const report = { version: '2.0', scored_at: new Date().toISOString(), minimum_required_score: minScore || null, results };
console.log(JSON.stringify(report, null, 2));

if (minScore && results.some((result) => result.quality_score < minScore || result.publish_recommendation !== 'eligible_after_human_review')) {
  console.error(`Generated content quality score below required threshold ${minScore}, or a hard-gate check failed.`);
  process.exit(1);
}

function scoreDraft(dir) {
  const slugValue = path.basename(dir);
  const en = read(path.join(dir, 'en.html'));
  const ar = read(path.join(dir, 'ar.html'));
  const enBody = bodyText(en);
  const arBody = bodyText(ar);
  const combined = `${enBody} ${arBody}`;
  const checks = {
    originality: !hasExcessiveRepetition(combined),
    duplication_risk: !nearDuplicateTitle(slugValue, en),
    seo_completeness: has(en, '<title>') && has(en, 'meta name="description"') && has(en, 'rel="canonical"'),
    readability: wordCount(enBody) >= 250 || type === 'market_outlook',
    arabic_quality: /<html[^>]+lang="ar"[^>]+dir="rtl"/.test(ar) && /[\u0600-\u06ff]/.test(arBody) && !hasMojibake(ar),
    schema_completeness: has(en, 'application/ld+json') && has(ar, 'application/ld+json'),
    hallucination_risk: !/(according to unnamed sources|rumored data|fabricated|made-up|fake catalyst)/i.test(combined),
    educational_compliance: !/(buy now|sell now|guaranteed returns?|must buy|must sell|certain to|definitely will)/i.test(combined),
    disclaimer_presence: /(Educational Disclaimer|educational-disclaimer|إخلاء المسؤولية التعليمي|تعليق تعليمي حول الأسواق المالية)/.test(`${en} ${ar}`)
  };
  checks.disclaimer_presence = /(educational disclaimer|educational-disclaimer|for educational and informational purposes)/i.test(`${en} ${ar}`);

  if (type === 'market_outlook') {
    Object.assign(checks, marketOutlookChecks(en, ar, enBody, arBody, combined));
  }
  if (type === 'editorial') {
    Object.assign(checks, editorialLongFormChecks(en, ar, enBody, arBody, combined));
  }

  const passed = Object.values(checks).filter(Boolean).length;
  const quality_score = Math.round((passed / Object.keys(checks).length) * 100);
  const marketOutlookHardGatePass = type !== 'market_outlook' || (
    checks.language_purity &&
    checks.public_placeholder_risk &&
    checks.semantic_depth &&
    checks.layout_quality &&
    checks.has_directional_bias &&
    checks.has_scenarios &&
    checks.scenario_structure &&
    checks.institutional_density &&
    checks.continuity_depth &&
    checks.cross_asset_relationships &&
    checks.transmission_chains &&
    checks.supported_directional_claims &&
    checks.narrative_originality &&
    checks.specificity &&
    checks.no_generic_filler &&
    checks.economic_event_context &&
    checks.market_expectations_framing &&
    checks.expectation_reaction_logic &&
    checks.probabilistic_language &&
    checks.multi_asset_interaction &&
    checks.macro_causal_reasoning
  );
  const editorialHardGatePass = type !== 'editorial' || (
    checks.editorial_word_count &&
    checks.editorial_section_count &&
    checks.editorial_paragraph_count &&
    checks.editorial_average_paragraph_depth &&
    checks.editorial_analytical_sentence_count &&
    checks.editorial_paragraph_dominance &&
    checks.editorial_section_depth &&
    checks.editorial_no_skeleton_structure &&
    checks.editorial_semantic_depth &&
    checks.editorial_narrative_continuity &&
    checks.editorial_analytical_density &&
    checks.editorial_sentence_opening_diversity &&
    checks.editorial_lexical_richness &&
    checks.editorial_anti_generic_language &&
    checks.editorial_comparison_depth &&
    checks.editorial_causal_reasoning &&
    checks.editorial_evidence_linkage &&
    checks.editorial_scenario_framing &&
    checks.editorial_plan_consumption
  );
  const requiredScore = type === 'market_outlook' ? 90 : type === 'editorial' ? 90 : 85;
  return {
    slug: slugValue,
    type,
    checks,
    quality_score,
    publish_recommendation: marketOutlookHardGatePass && editorialHardGatePass && quality_score >= requiredScore
      ? 'eligible_after_human_review'
      : 'manual_revision_required'
  };
}

function editorialLongFormChecks(en, ar, enBody, arBody, combined) {
  const enParagraphs = extractParagraphs(en);
  const arParagraphs = extractParagraphs(ar);
  const enSections = extractMainSections(en);
  const arSections = extractMainSections(ar);
  const enArticleText = enSections.map((section) => section.text).join(' ') || enBody;
  const arArticleText = arSections.map((section) => section.text).join(' ') || arBody;
  const bulletCount = (en.match(/<li\b/gi) || []).length;
  const semantic = editorialSemanticDepth(enArticleText);
  return {
    editorial_word_count: wordCount(enArticleText) >= 1200 && wordCount(enArticleText) <= 1800 && wordCount(arArticleText) >= 900 && wordCount(arArticleText) <= 1400,
    editorial_section_count: enSections.length >= 7,
    editorial_paragraph_count: enParagraphs.length >= 24 && arParagraphs.length >= 20,
    editorial_average_paragraph_depth: averageWords(enParagraphs) >= 45 && averageWords(arParagraphs) >= 30,
    editorial_analytical_sentence_count: analyticalSentenceCount(enArticleText) >= 32,
    editorial_paragraph_dominance: bulletCount < enParagraphs.length,
    editorial_section_depth: enSections.length >= 7 && enSections.every((section) => wordCount(section.text) >= 120 && extractParagraphs(section.html).length >= 2),
    editorial_no_skeleton_structure: !looksLikeSkeleton(en, enArticleText, enParagraphs, bulletCount),
    editorial_semantic_depth: Object.values(semantic).every(Boolean),
    editorial_narrative_continuity: narrativeContinuity(en, enArticleText),
    editorial_analytical_density: analyticalSentenceCount(enArticleText) / Math.max(sentenceCount(enArticleText), 1) >= 0.42,
    editorial_sentence_opening_diversity: sentenceOpeningDiversity(enArticleText) >= 0.72,
    editorial_lexical_richness: lexicalRichness(enArticleText) >= 0.24,
    editorial_anti_generic_language: antiGenericLanguage(enArticleText),
    editorial_comparison_depth: comparisonDepth(en, enArticleText),
    editorial_causal_reasoning: causalReasoning(enArticleText),
    editorial_evidence_linkage: evidenceLinkage(enArticleText),
    editorial_scenario_framing: scenarioFraming(enArticleText),
    editorial_plan_consumption: /data-editorial-intelligence="v2"/.test(en) && /data-reasoning-module="[^"]+"/.test(en)
  };
}

function extractMainSections(html) {
  const excluded = new Set(['faq', 'related-research', 'continue-learning']);
  return [...String(html || '').matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi)]
    .map((match) => {
      const attrs = match[1] || '';
      const body = match[2] || '';
      const id = ((attrs.match(/\bid="([^"]+)"/i) || [])[1] || (body.match(/<h2[^>]*id="([^"]+)"/i) || [])[1] || '').trim();
      return { id, html: body, text: bodyText(body) };
    })
    .filter((section) => section.id && !excluded.has(section.id))
    .filter((section) => /<h2\b/i.test(section.html) || wordCount(section.text) >= 80);
}

function extractParagraphs(html) {
  return [...String(html || '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => bodyText(match[1]))
    .filter((text) => wordCount(text) >= 18);
}

function averageWords(items) {
  if (!items.length) return 0;
  return items.reduce((sum, text) => sum + wordCount(text), 0) / items.length;
}

function analyticalSentenceCount(text) {
  const analyticalTerms = /(because|while|therefore|however|depends|exposure|risk|volatility|concentration|liquidity|expense ratio|holdings|rates|interest rates|regulation|drug-pricing|earnings|innovation|diversification|defensive|lag|compare|XLV|VHT|IYH|ETF)/i;
  return String(text || '')
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.split(/\s+/).length >= 12 && analyticalTerms.test(sentence))
    .length;
}

function looksLikeSkeleton(html, text, paragraphs, bulletCount) {
  const lower = `${html} ${text}`.toLowerCase();
  const skeletonPhrases = [
    'editors should review',
    'draft educational research article',
    'placeholder',
    'todo',
    'tbd',
    'outline',
    'key takeaways',
    'this section will',
    'requires editorial content'
  ];
  if (skeletonPhrases.some((phrase) => lower.includes(phrase))) return true;
  if (bulletCount >= paragraphs.length) return true;
  const headingCount = (String(html || '').match(/<h[1-6]\b/gi) || []).length;
  const linkCount = (String(html || '').match(/<a\b/gi) || []).length;
  const bodyWords = Math.max(wordCount(text), 1);
  return (headingCount + linkCount) / bodyWords > 0.08;
}

function editorialSemanticDepth(text) {
  return {
    sector_mechanics: /(pharmaceutical|biotech|managed care|medical device|reimbursement|wafer|foundry|semiconductor|cloud|software|cybersecurity|endpoint|identity access|duration|yield curve|sector rotation|earnings breadth|industry|subsector)/i.test(text),
    diversification_mechanics: /(diversification|diversified|holdings breadth|broader universe|single-company risk|market-cap|weighting|overlap|position sizes)/i.test(text),
    macro_sensitivity: /(interest rates|rates|defensive rotation|risk appetite|macro|growth slows|volatility rises|duration|earnings stability)/i.test(text),
    valuation_risk_framing: /(valuation|risk premium|earnings expectations|cash flow|drawdown|financing conditions)/i.test(text),
    concentration_discussion: /(concentration|top-ten|largest holdings|mega-cap|position size|dominate)/i.test(text),
    volatility_discussion: /(volatility|standard deviation|drawdown|risk-on|risk-off)/i.test(text),
    liquidity_discussion: /(liquidity|bid-ask spread|trading volume|execution quality|assets under management)/i.test(text),
    investor_use_case: /(research question|research process|portfolio construction|benchmark|use-case|exposure analysis|educational framework)/i.test(text),
    non_advisory_framing: /(educational|framework|not financial advice|does not constitute financial|not a recommendation|research process)/i.test(text)
  };
}

function narrativeContinuity(html, text) {
  const transitionCount = (String(html || '').match(/class="editorial-transition"/g) || []).length;
  const connectors = ['because', 'however', 'therefore', 'once', 'while', 'yet', 'that distinction', 'taken together', 'by contrast', 'in turn'];
  const hits = connectors.filter((word) => text.toLowerCase().includes(word)).length;
  return transitionCount >= 6 && hits >= 5;
}

function sentenceCount(text) {
  return String(text || '').split(/[.!?]+/).map((item) => item.trim()).filter(Boolean).length;
}

function sentenceOpeningDiversity(text) {
  const openings = String(text || '').split(/[.!?]+/)
    .map((sentence) => sentence.trim().toLowerCase().split(/\s+/).slice(0, 3).join(' '))
    .filter((opening) => opening.split(/\s+/).length >= 2);
  return openings.length ? new Set(openings).size / openings.length : 0;
}

function lexicalRichness(text) {
  const words = String(text || '').toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [];
  return words.length ? new Set(words).size / words.length : 0;
}

function antiGenericLanguage(text) {
  const phrases = [
    'it is important to note',
    'investors should consider',
    'can help investors',
    'offers exposure to',
    'in today\'s market',
    'navigate the complex',
    'in conclusion'
  ];
  const lower = text.toLowerCase();
  const repeatedOpenings = String(text || '').split(/[.!?]+/)
    .map((sentence) => sentence.trim().toLowerCase().split(/\s+/).slice(0, 4).join(' '))
    .filter((opening) => opening.split(/\s+/).length >= 3)
    .reduce((counts, opening) => counts.set(opening, (counts.get(opening) || 0) + 1), new Map());
  const vagueClaims = (lower.match(/\b(markets remain uncertain|could go higher or lower|many factors to consider|depends on various factors|only time will tell)\b/g) || []).length;
  return phrases.every((phrase) => (lower.match(new RegExp(escapeRegExp(phrase), 'g')) || []).length <= 1) &&
    [...repeatedOpenings.values()].every((count) => count <= 2) &&
    vagueClaims === 0;
}

function comparisonDepth(html, text) {
  const tickers = new Set((text.match(/\b[A-Z]{2,5}\b/g) || []).filter((ticker) => !['ETF', 'SPY', 'FAQ'].includes(ticker)));
  if (!/\bETF(s)?\b/i.test(text) || tickers.size < 2) return true;
  const healthcareHeaders = ['Expense ratio', 'Approx. holdings', 'Concentration style', 'Top-holdings influence', 'Typical volatility profile', 'Liquidity profile'];
  const reasoningHeaders = ['Primary ETF', 'Comparison ETF', 'Construction difference', 'Research test'];
  return /class="editorial-comparison-table"/.test(html) &&
    (healthcareHeaders.every((header) => html.includes(header)) || reasoningHeaders.every((header) => html.includes(header)));
}

function causalReasoning(text) {
  const mechanisms = (String(text).match(/\b(because|therefore|depends on|transmission|first-order effect|as a result|in turn)\b/gi) || []).length;
  const causalObjects = (String(text).match(/\b(discount rate|cash flow|earnings revisions|risk premium|financing costs|margin|liquidity|valuation)\b/gi) || []).length;
  return mechanisms >= 8 && causalObjects >= 16;
}

function evidenceLinkage(text) {
  return (String(text).match(/\b(evidence|observable|verified|issuer materials|filings|earnings revisions|company guidance|market data)\b/gi) || []).length >= 5;
}

function scenarioFraming(text) {
  return /\bbase case\b/i.test(text) &&
    /\bconstructive case\b/i.test(text) &&
    /\badverse case\b/i.test(text) &&
    (String(text).match(/\b\d{2}% to \d{2}%/g) || []).length >= 3 &&
    /\binvalidat|would need revision|would challenge/i.test(text);
}

function marketOutlookChecks(en, ar, enBody, arBody, combined) {
  const banned = [
    'data is not currently sourced',
    'not currently sourced',
    'educational context:',
    'analysis uses structural context only',
    'editors should verify',
    'framework derived from',
    'placeholder',
    'todo',
    'tbd',
    'lorem ipsum'
  ];
  const lower = combined.toLowerCase();
  const uniqueWords = new Set(enBody.toLowerCase().split(/\s+/).filter((word) => word.length > 4));
  const requiredSections = ['market-narrative', 'volatility-context', 'key-drivers', 'scenario-outlook', 'risk-factors', 'watch-next', 'related-research'];
  return {
    semantic_depth: uniqueWords.size >= 55,
    language_purity: englishPurity(enBody) && arabicPurity(ar, arBody),
    human_readability: averageSentenceLength(enBody) >= 8 && averageSentenceLength(enBody) <= 34,
    template_repetition_risk: !hasRepeatedParagraphs(en),
    public_placeholder_risk: !banned.some((phrase) => lower.includes(phrase)),
    market_context_quality: /(policy|inflation|earnings|volatility|sector|ETF|risk|liquidity|rates|Federal Reserve)/i.test(enBody),
    layout_quality: requiredSections.every((id) => en.includes(`id="${id}"`) && ar.includes(`id="${id}"`)),
    has_scenarios: /(bullish scenario|bearish scenario|السيناريو الصاعد|السيناريو الهابط)/i.test(combined),
    has_directional_bias: checkDirectionalBias(combined),
    scenario_structure: checkScenarioStructure(enBody),
    institutional_density: checkInstitutionalDensity(enBody),
    continuity_depth: checkContinuityDepth(enBody),
    cross_asset_relationships: checkCrossAssetRelationships(enBody),
    transmission_chains: checkTransmissionChains(enBody),
    supported_directional_claims: checkSupportedDirectionalClaims(enBody),
    narrative_originality: checkNarrativeOriginality(enBody),
    specificity: checkSpecificity(enBody),
    no_generic_filler: checkNoGenericFiller(enBody),
    economic_event_context: /(CPI|PCE|NFP|FOMC|GDP|retail sales|ISM|jobless claims|economic calendar|data release|central bank decision)/i.test(enBody),
    market_expectations_framing: /(markets? (?:are|is) pricing|market expectations?|consensus|forecast|terminal rate|rate cuts?|soft landing|recession risk|disinflation)/i.test(enBody),
    expectation_reaction_logic: /(confirm|reject|validation|priced in|already pricing|surprise|actual|forecast|consensus)/i.test(enBody),
    probabilistic_language: checkProbabilisticLanguage(enBody),
    multi_asset_interaction: checkMultiAssetInteraction(enBody),
    macro_causal_reasoning: checkMacroCausalReasoning(enBody),
  };
}

function checkProbabilisticLanguage(text) {
  const conditional = (text.match(/\b(if|could|may|would|conditional|depending on|confirmation|unless|scenario)\b/gi) || []).length;
  const deterministic = (text.match(/\b(will certainly|must rise|must fall|guaranteed|inevitably|always causes|cannot fail)\b/gi) || []).length;
  return conditional >= 5 && deterministic === 0;
}

function checkMultiAssetInteraction(text) {
  const groups = [
    /\b(gold|GLD)\b/i, /\b(DXY|dollar)\b/i, /\b(Treasury|yield|TLT)\b/i,
    /\b(SPY|equities)\b/i, /\b(QQQ|growth)\b/i, /\b(IWM|small caps)\b/i,
    /\b(VIX|volatility)\b/i, /\b(oil|USO)\b/i, /\b(semiconductor|SMH|SOXX)\b/i
  ];
  return groups.filter((pattern) => pattern.test(text)).length >= 5;
}

function checkMacroCausalReasoning(text) {
  const mechanisms = (text.match(/->|â†’|because|therefore|which (?:raises|reduces|supports|pressures)|transmission|repric|real yields?|financial conditions|discount rate/gi) || []).length;
  return mechanisms >= 6;
}

function checkContinuityDepth(enBody) {
  return /(baseline|prior|previous|earlier|extends|persist|deteriorat|improv|unlike|transition|memory window|regime shift|stabilization phase|defensive rotation phase)/i.test(enBody);
}

function checkCrossAssetRelationships(enBody) {
  const relationships = [
    /\b(TLT|duration|10-year|2-year|yield curve)\b/i,
    /\b(QQQ|SPY|IWM|RSP|breadth|participation)\b/i,
    /\b(VIX|volatility regime|implied vol)\b/i,
    /\b(DXY|dollar|GLD|gold)\b/i,
    /\b(XLK|XLF|XLE|XLU|XLV|sector rotation)\b/i
  ];
  return relationships.filter((pattern) => pattern.test(enBody)).length >= 3;
}

function checkTransmissionChains(enBody) {
  const chainSignals = (enBody.match(/->|→|transmission mechanism|transmission chain|leads to|results in|repric|flows? into|pressures?|supports?/gi) || []).length;
  return chainSignals >= 4;
}

function checkSupportedDirectionalClaims(enBody) {
  const directional = /(bullish|bearish|constructive|defensive|risk-on|risk-off|upside|downside|supportive|pressure)/i.test(enBody);
  if (!directional) return false;
  return /(if|when|should|conditional|catalyst|transmission|mechanism|because|driven by|via|through)/i.test(enBody);
}

function checkNarrativeOriginality(enBody) {
  const banned = [
    'markets remain uncertain',
    'the outlook remains uncertain',
    'investors should remain cautious',
    'market conditions can change',
    'various macroeconomic factors'
  ];
  const lower = enBody.toLowerCase();
  if (banned.some((phrase) => lower.includes(phrase))) return false;
  const sentences = enBody.split(/[.!?]+/).map((item) => item.trim().toLowerCase()).filter((item) => item.length > 45);
  return new Set(sentences).size >= Math.ceil(sentences.length * 0.85);
}

function checkDirectionalBias(text) {
  return /(cautiously bullish|cautiously bearish|neutral-to-constructive|selective risk-on|defensive|risk-off stabilization|neutral|mixed\s*\/\s*range-bound|mixed|range-bound|elevated uncertainty|directional bias|صاعد بحذر|هابط بحذر|محايد|مختلط|عدم يقين مرتفع)/i.test(text);
}

function checkInstitutionalDensity(enBody) {
  const signals = [
    /\byield curve\b/i,
    /\bduration\b/i,
    /\bbreadth\b/i,
    /\bparticipation\b/i,
    /\bliquidity\b/i,
    /\bvolatility regime\b|\bvol regime\b|\bimplied vol\b/i,
    /\brisk appetite\b/i,
    /\bpositioning\b/i,
    /\bsector rotation\b/i,
    /\btransmission mechanism\b|\btransmission chain\b|\bmonetary transmission\b/i,
    /\bcredit spread\b|\byield spread\b|\bbasis points?\b/i,
    /\brepricing\b|\brisk premium\b|\breal yield\b/i,
  ];
  return signals.filter((pattern) => pattern.test(enBody)).length >= 4;
}

function checkScenarioStructure(enBody) {
  const bullish = extractScenario(enBody, 'bullish scenario', 'bearish scenario');
  const bearish = extractScenario(enBody, 'bearish scenario', 'key drivers');
  if (!bullish || !bearish) return false;
  return [bullish, bearish].every((text) => {
    const lower = text.toLowerCase();
    const hasCatalyst = /\bif\b|\bwhen\b|\bshould\b|catalyst|trigger|surprise|above|below|print|miss|exceed/.test(lower);
    const hasMechanism = /transmission|mechanism|yield|spread|rotation|liquidity|duration|breadth|participation|positioning|risk appetite|reprice|flow/.test(lower);
    const hasInstrument = checkSpecificity(text);
    const hasImplication = /implies|implication|would|could|pressure|support|reprice|tighten|widen|rotate|flows?|risk-on|risk-off|defensive|constructive/.test(lower);
    return hasCatalyst && hasMechanism && hasInstrument && hasImplication;
  });
}

function extractScenario(text, startLabel, endLabel) {
  const lower = text.toLowerCase();
  const start = lower.indexOf(startLabel);
  if (start === -1) return '';
  const end = lower.indexOf(endLabel, start + startLabel.length);
  return text.slice(start, end === -1 ? start + 1200 : end);
}

function checkSpecificity(enBody) {
  // Named instrument patterns (ETFs, tickers, specific rates)
  const INSTRUMENTS = [
    /\b(TLT|IEF|SHY|AGG|BND|LQD|HYG|TIP|TIPS|SCHP|ZROZ|EDV)\b/,
    /\b(QQQ|SPY|IWM|DIA|VOO|VTI|RSP|SPLG)\b/,
    /\b(SMH|SOXX|SOXL|XSD|NVDA|AMD|TSMC|TSM|ASML|INTC|QCOM)\b/,
    /\b(XLK|XLF|XLE|XLU|XLV|XLI|XLRE|XLP|XLB|XLY|XLC)\b/,
    /\b(MSFT|GOOGL|GOOG|META|AAPL|AMZN|TSLA|JPM|BAC|GS|MS)\b/,
    /\b(GLD|SLV|GDX|USO|DBA)\b/,
    /\b\d+[- ]?[Yy](ear)?\s*(Treasury|yield|note|bond)\b/i,
    /\b(Fed\s+funds|federal\s+funds|FOMC\s+rate)\b/i,
    /\b(yield\s+curve|2Y10Y|10Y2Y|inverted\s+curve|duration\s+risk|duration.sensitive)\b/i,
    /\b(VIX|CBOE\s+volatility)\b/i,
    /\b(DXY|dollar\s+index)\b/i,
  ];
  // Macro-analytical language patterns (institutional specificity without ticker names)
  const MACRO_ANALYSIS = [
    /\b(yield curve|yield spread|basis point|curve steepen|curve flatten|curve normaliz|curve inversion)\b/i,
    /\b(duration|duration risk|duration exposure|duration-sensitive)\b/i,
    /\b(breadth|participation|concentration risk|equal.weight|cap.weight|narrow leadership)\b/i,
    /\b(positioning|factor tilt|real yield|repricing|risk premium|net interest margin)\b/i,
    /\b(implied vol|vol regime|volatility regime|vol compression|vol expansion|hedging demand)\b/i,
    /\b(liquidity|risk appetite|credit spread|monetary transmission|rate.sensitive|terminal rate)\b/i,
    /\b(sector rotation|defensive rotation|growth.value|cross.asset|macro hedge|macro transmission|transmission mechanism)\b/i,
    /\b(transmission mechanism|transmission chain|policy path|rate path|monetary policy)\b/i,
  ];
  const instrHits = INSTRUMENTS.filter(p => p.test(enBody)).length;
  const macroHits = MACRO_ANALYSIS.filter(p => p.test(enBody)).length;
  // Pass if: ≥2 instrument patterns, OR ≥1 instrument + ≥2 macro patterns, OR ≥4 macro patterns (pure macro analysis)
  return instrHits >= 2 || (instrHits >= 1 && macroHits >= 2) || macroHits >= 4;
}

function checkNoGenericFiller(enBody) {
  const FILLER = [
    'various macroeconomic factors',
    'navigating a complex landscape',
    'market participants are closely monitoring',
    'it remains to be seen',
    'dynamic market landscape',
    'complex macro environment',
    'economic conditions can change',
    'broadly speaking',
    'at the end of the day',
  ];
  const lower = enBody.toLowerCase();
  return !FILLER.some(phrase => lower.includes(phrase));
}

function englishPurity(text) {
  const arabicCount = (text.match(/[\u0600-\u06ff]/g) || []).length;
  return arabicCount / Math.max(text.replace(/\s/g, '').length, 1) < 0.03;
}

function arabicPurity(html, text) {
  if (!/<html[^>]+lang="ar"[^>]+dir="rtl"/.test(html)) return false;
  if (hasMojibake(html)) return false;
  const cleaned = text
    .replace(/\b(TradeAlphaAI|VIX|NASDAQ|S&P|ETF|CPI|NFP|PCE|FOMC|GDP|DXY|AI|USD)\b/gi, ' ')
    .replace(/\b[A-Z]{1,6}\b/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\d.,:%-]+/g, ' ');
  return !/[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){4,}/.test(cleaned);
}

function hasMojibake(value) {
  return /[\uFFFD]|\?{3,}|[\u00d8\u00d9\u00c3]/.test(String(value || ''));
}

function hasRepeatedParagraphs(html) {
  // Exclude intentionally-repeated legal/disclaimer text
  const ALLOWED_REPEATS = [
    'this analysis is educational market commentary',
    'هذا التحليل عبارة عن تعليق'
  ];
  const paragraphs = [...String(html || '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => bodyText(match[1]).toLowerCase())
    .filter((text) => text.length > 40)
    .filter((text) => !ALLOWED_REPEATS.some(d => text.includes(d)));
  const seen = new Set();
  for (const paragraph of paragraphs) {
    if (seen.has(paragraph)) return true;
    seen.add(paragraph);
  }
  return false;
}

function nearDuplicateTitle(slugValue, html) {
  const title = bodyText((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || slugValue);
  return title.split(/\s+/).filter(Boolean).length < 4;
}

function hasExcessiveRepetition(text) {
  const allowedDomainTerms = new Set([
    'healthcare',
    'etfs',
    'funds',
    'sector',
    'research',
    'market',
    'companies',
    'exposure',
    'risk'
  ]);
  const counts = new Map();
  for (const word of String(text || '').toLowerCase().split(/\s+/).filter((item) => item.length > 4)) {
    if (allowedDomainTerms.has(word.replace(/[^a-z]/g, ''))) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  const total = Math.max(wordCount(text), 1);
  return [...counts.values()].some((count) => count > 35 && count / total > 0.012);
}

function averageSentenceLength(text) {
  const sentences = String(text || '').split(/[.!?؟]+/).map((item) => item.trim()).filter(Boolean);
  if (!sentences.length) return 0;
  return wordCount(text) / sentences.length;
}

function bodyText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(dir, entry.name));
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function has(value, part) {
  return String(value || '').includes(part);
}

function wordCount(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
