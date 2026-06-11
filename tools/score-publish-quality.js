'use strict';

// Pre-publish editorial quality scoring — [PUBLISH_QUALITY] gate.
// Scores the English draft on headline strength, narrative depth, macro and
// asset linkage, phrase repetition, and disclaimer density. The gate is
// intentionally conservative: it blocks only genuinely weak articles so valid
// publications are never over-blocked.
//
// Usage (CLI): node tools/score-publish-quality.js --content-type=market-outlook --slug=<slug>
// Usage (lib): const { scorePublishQuality } = require('./score-publish-quality');

const fs = require('fs');
const path = require('path');
const { GLOBAL_BANNED_PHRASES } = require('./editorial-personas');

const ROOT = path.resolve(__dirname, '..');

const MACRO_TERMS = [
  /\b(Fed|Federal Reserve|FOMC)\b/i,
  /\bCPI\b|\binflation\b/i,
  /\byield(s)?\b|\bTreasur(y|ies)\b/i,
  /\brate (path|cut|hike|expectations)\b|\bpolicy path\b/i,
  /\blabor market\b|\bjobless\b|\bpayrolls?\b|\bNFP\b/i,
  /\bGDP\b|\beconomic growth\b/i,
  /\bPCE\b|\bcore inflation\b/i,
  /\bliquidity\b|\bfinancial conditions\b/i,
  /\bdollar\b|\bDXY\b|\bUSD\b/i,
  /\bvolatility\b|\bVIX\b/i,
  /\bbreadth\b|\bparticipation\b/i,
  /\bsector rotation\b|\bpositioning\b/i,
];

const ASSET_TERMS = [
  /\bgold\b|\bGLD\b|\bGDX\b/i,
  /\bDXY\b|\bdollar index\b|\bUSD\b/i,
  /\bNasdaq\b|\bQQQ\b/i,
  /\bSPY\b|\bS&P\s*500\b|\bRSP\b/i,
  /\b10[- ]year\b|\b2[- ]year\b|\bTLT\b|\bIEF\b|\byield curve\b/i,
  /\bVIX\b/i,
  /\bIWM\b|\bsmall[- ]cap/i,
  /\bXL[KFEUVIPBYC]\b|\bSMH\b|\bSOXX\b/i,
];

const DISCLAIMER_PATTERNS = [
  /not (investment|financial) advice/gi,
  /not a (recommendation|forecast|prediction)/gi,
  /educational (market )?(commentary|analysis|overview|context|framework|purposes)/gi,
  /no (buy|sell) recommendations?/gi,
  /إخلاء المسؤولية/g,
];

const CONNECTIVES = [
  /\bhowever\b/i, /\bmeanwhile\b/i, /\bin contrast\b/i, /\bas a result\b/i,
  /\bthat said\b/i, /\bagainst this backdrop\b/i, /\bat the same time\b/i,
  /\bif\b[^.]{5,80}\b(then|would|could|may)\b/i, /\bwhile\b/i, /\byet\b/i,
  /\bstill\b/i, /\bbeyond that\b/i, /\bmore broadly\b/i,
];

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadline(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripHtml(h1[1]);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? stripHtml(title[1]).split('|')[0].trim() : '';
}

function extractParagraphs(html) {
  const matches = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  return matches.map((p) => stripHtml(p)).filter((t) => t.length > 0);
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function scoreHeadline(headline) {
  if (!headline) return 0;
  let score = 40;
  const len = headline.length;
  if (len >= 30 && len <= 110) score += 25;
  else if (len >= 20 && len <= 140) score += 12;
  if (MACRO_TERMS.some((p) => p.test(headline)) || ASSET_TERMS.some((p) => p.test(headline))) score += 25;
  if (/:|—/.test(headline)) score += 10;
  return clamp(score);
}

// Robotic transitions at paragraph or sentence starts (AI cadence signature).
const ROBOTIC_OPENERS = /^(overall|in conclusion|to summarize|in summary|additionally|furthermore|moreover|firstly|secondly|lastly|as we can see)[,\s]/i;

// AI cadence detection: repeated sentence openings, robotic paragraph openers,
// and uniform paragraph rhythm all read as machine writing. 100 = human-like.
function scoreAiCadence(paragraphs, body) {
  if (!paragraphs.length) return { score: 0, pacing_variation: 0 };
  let score = 100;

  // Repeated sentence openings (first two words) within the article.
  const sentences = body.match(/[^.!?]+[.!?]/g) || [];
  const openings = sentences
    .map((s) => s.trim().toLowerCase().split(/\s+/).slice(0, 2).join(' '))
    .filter((o) => o.length > 3);
  if (openings.length >= 8) {
    const counts = new Map();
    for (const o of openings) counts.set(o, (counts.get(o) || 0) + 1);
    const repeated = [...counts.values()].filter((n) => n >= 3).reduce((sum, n) => sum + n, 0);
    score -= Math.min(40, Math.round((repeated / openings.length) * 120));
  }

  // Robotic openers at paragraph starts.
  const roboticStarts = paragraphs.filter((p) => ROBOTIC_OPENERS.test(p.trim())).length;
  score -= roboticStarts * 12;

  // Pacing variation: coefficient of variation of paragraph lengths.
  const lengths = paragraphs.map((p) => countWords(p)).filter((n) => n > 0);
  let pacingVariation = 0;
  if (lengths.length >= 3) {
    const mean = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
    const variance = lengths.reduce((sum, n) => sum + (n - mean) ** 2, 0) / lengths.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    pacingVariation = clamp(Math.round(cv * 160));
    // Perfectly uniform paragraphs (cv < 0.15) read as template output.
    if (cv < 0.15) score -= 15;
  }

  return { score: clamp(score), pacing_variation: pacingVariation };
}

function countRoboticPhrases(body) {
  const lower = body.toLowerCase();
  let hits = 0;
  for (const phrase of GLOBAL_BANNED_PHRASES) {
    let index = lower.indexOf(phrase);
    while (index !== -1) {
      hits += 1;
      index = lower.indexOf(phrase, index + phrase.length);
    }
  }
  return hits;
}

function scoreNarrative(paragraphs, body) {
  if (!paragraphs.length) return 0;
  const substantive = paragraphs.filter((p) => countWords(p) >= 35).length;
  const connectiveHits = CONNECTIVES.filter((p) => p.test(body)).length;
  const sentences = body.match(/[^.!?]+[.!?]/g) || [];
  const avgSentence = sentences.length ? countWords(body) / sentences.length : 0;
  let score = 0;
  score += Math.min(40, substantive * 8);                 // depth of paragraphs
  score += Math.min(30, connectiveHits * 5);              // narrative flow
  if (avgSentence >= 12 && avgSentence <= 32) score += 20; // readable analyst cadence
  else if (avgSentence > 0) score += 8;
  if (sentences.length >= 18) score += 10;                 // enough total narrative
  score -= countRoboticPhrases(body) * 8;                  // AI-cliché penalty
  return clamp(score);
}

function scoreLinkage(body, patterns, perHit) {
  const hits = patterns.filter((p) => p.test(body)).length;
  return { hits, score: clamp(hits * perHit) };
}

function scoreRepetition(body) {
  const words = body.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length < 80) return { score: 50, repeated_ngrams: 0 };
  const seen = new Map();
  let repeated = 0;
  for (let i = 0; i + 5 <= words.length; i += 1) {
    const gram = words.slice(i, i + 5).join(' ');
    const count = (seen.get(gram) || 0) + 1;
    seen.set(gram, count);
    if (count === 2) repeated += 1;
  }
  const total = Math.max(1, words.length - 4);
  const ratio = repeated / total;
  return { score: clamp(100 - ratio * 1200), repeated_ngrams: repeated };
}

function measureDisclaimerDensity(body) {
  const wordCount = Math.max(1, countWords(body));
  let hits = 0;
  for (const pattern of DISCLAIMER_PATTERNS) {
    const found = body.match(pattern);
    hits += found ? found.length : 0;
  }
  return Math.round((hits / wordCount) * 1000 * 10) / 10; // hits per 1000 words
}

function draftEnPath(contentType, slug) {
  return path.join(ROOT, 'drafts', contentType, slug, 'en.html');
}

function scorePublishQuality({ contentType, slug }) {
  const filePath = draftEnPath(contentType, slug);
  const result = {
    content_type: contentType,
    slug,
    headline_score: 0,
    narrative_score: 0,
    macro_linkage: 0,
    asset_linkage: 0,
    repetition_score: 0,
    disclaimer_density: 0,
    publish_allowed: false,
    reasons: [],
  };

  if (!fs.existsSync(filePath)) {
    result.reasons.push(`draft not found: drafts/${contentType}/${slug}/en.html`);
    logQuality(result);
    return result;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const headline = extractHeadline(html);
  const paragraphs = extractParagraphs(html);
  const body = paragraphs.join(' ');

  result.headline_score = scoreHeadline(headline);
  result.narrative_score = scoreNarrative(paragraphs, body);
  const macro = scoreLinkage(body, MACRO_TERMS, 12);
  const asset = scoreLinkage(body, ASSET_TERMS, 16);
  result.macro_linkage = macro.score;
  result.asset_linkage = asset.score;
  const repetition = scoreRepetition(body);
  result.repetition_score = repetition.score;
  result.disclaimer_density = measureDisclaimerDensity(body);
  const cadence = scoreAiCadence(paragraphs, body);
  result.ai_cadence_score = cadence.score;
  result.pacing_variation = cadence.pacing_variation;

  // Conservative gate: block only genuinely weak articles.
  const roboticHits = countRoboticPhrases(body);
  if (roboticHits >= 5) result.reasons.push(`robotic phrasing: ${roboticHits} banned-phrase hits (block at 5)`);
  if (result.ai_cadence_score < 25) result.reasons.push(`ai_cadence_score ${result.ai_cadence_score} below 25 — machine-cadence writing`);
  if (!headline) result.reasons.push('missing headline');
  if (result.narrative_score < 30) result.reasons.push(`narrative_score ${result.narrative_score} below 30`);
  if (macro.hits === 0 && asset.hits === 0) result.reasons.push('no macro or asset linkage detected');
  if (result.repetition_score < 35) result.reasons.push(`repetition_score ${result.repetition_score} below 35`);
  if (result.disclaimer_density > 25) result.reasons.push(`disclaimer_density ${result.disclaimer_density}/1000w above 25`);

  result.publish_allowed = result.reasons.length === 0;
  logQuality(result);
  return result;
}

function logQuality(result) {
  console.log('[PUBLISH_QUALITY]');
  console.log(`headline_score=${result.headline_score}`);
  console.log(`narrative_score=${result.narrative_score}`);
  console.log(`macro_linkage=${result.macro_linkage}`);
  console.log(`asset_linkage=${result.asset_linkage}`);
  console.log(`repetition_score=${result.repetition_score}`);
  console.log(`disclaimer_density=${result.disclaimer_density}`);
  console.log(`ai_cadence_score=${result.ai_cadence_score ?? 'n/a'}`);
  console.log(`pacing_variation=${result.pacing_variation ?? 'n/a'}`);
  console.log(`publish_allowed=${result.publish_allowed ? 'yes' : 'no'}`);
  if (result.reasons.length) console.log(`quality_block_reasons=${result.reasons.join('; ')}`);
}

if (require.main === module) {
  const arg = (name) => {
    const found = process.argv.find((a) => a.startsWith(`${name}=`));
    return found ? found.slice(name.length + 1) : '';
  };
  const contentType = arg('--content-type');
  const slug = arg('--slug');
  if (!contentType || !slug) {
    console.error('Usage: node tools/score-publish-quality.js --content-type=<type> --slug=<slug>');
    process.exit(1);
  }
  const outcome = scorePublishQuality({ contentType, slug });
  process.exit(outcome.publish_allowed ? 0 : 1);
}

module.exports = { scorePublishQuality };
