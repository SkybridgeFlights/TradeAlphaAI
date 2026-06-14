'use strict';

// Phase 109 — deterministic editorial-quality scorer.
//
// Measures the institutional quality of a piece of editorial prose WITHOUT an
// LLM: filler/cliché density, repetition density, transition quality, evidence
// linkage, cross-asset integration, and hard safety (no retail TA, no
// predictions, no banned filler). Returns a 0–100 score plus hard `flags` that
// must be empty for a piece to publish. Pure and deterministic.

const { GLOBAL_BANNED_PHRASES } = require('./editorial-personas');

const TA = [/\bbuy now\b/i, /\bsell now\b/i, /\bstrong buy\b/i, /\bprice target\b/i, /\bbreakout\b/i, /\bgo long\b/i, /\bgo short\b/i, /\bRSI\b/, /\bMACD\b/, /\bto the moon\b/i, /\bguaranteed\b/i, /\boversold\b/i, /\boverbought\b/i];
const PREDICTION = [/\bwill (?:rise|fall|rally|drop|surge|plunge|reach)\b/i, /\bwe (?:forecast|predict|expect prices)\b/i, /\bshould (?:reach|hit|test)\b/i, /\bis (?:going|set) to (?:rise|fall|rally|drop)\b/i, /\bprices? will\b/i];
const WEAK_HEDGE = [/\bvarious\b/i, /\ba number of\b/i, /\bto some extent\b/i, /\bsomewhat\b/i, /\barguably\b/i, /\bperhaps\b/i];
const TRANSITIONS_EN = /\b(however|but|yet|while|whereas|because|since|after|before|although|though|as|leaving|without|rather than|even as|once|until|despite|instead)\b/gi;
// Arabic discourse connectors (institutional newsroom rhythm).
const TRANSITIONS_AR = /(لكن|غير أن|بينما|في حين|رغم|بالرغم|بسبب|إذ|حيث|منذ|بدلاً|بعد أن|قبل أن|بعدما|دون أن|إلا أن|ومع ذلك|من ثم|وبذلك|بحيث)/g;
const ASSETS_EN = /\b(DXY|US10Y|US02Y|10-?year|2-?year|yields?|GOLD|gold|SPY|QQQ|IWM|VIX|volatility|OIL|EURUSD|USDJPY|dollar|equities|rates)\b/g;
const ASSETS_AR = /(الدولار|العوائد|العائد|الذهب|الأسهم|التذبذب|التقلب|النفط|الفائدة|السندات|المؤشر)/g;
const NUMBERS = /(?<![\w])(?:\d+(?:[.,]\d+)?%?|\d{2,})(?![\w])/g;

function sentences(text) { return String(text || '').split(/(?<=[.!?؟])\s+/).map((s) => s.trim()).filter(Boolean); }
function words(text) { return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean); }

// Repeated 4-word shingle ratio (institutional prose should not self-repeat).
function repetitionDensity(text) {
  const w = words(text);
  if (w.length < 8) return 0;
  const shingles = [];
  for (let i = 0; i + 4 <= w.length; i += 1) shingles.push(w.slice(i, i + 4).join(' '));
  const seen = new Set(); let dup = 0;
  for (const s of shingles) { if (seen.has(s)) dup += 1; else seen.add(s); }
  return shingles.length ? Number((dup / shingles.length).toFixed(3)) : 0;
}

// score a single-language body. expectedAssets optional (for cross-asset linkage).
function scoreText(text, { lang = 'en' } = {}) {
  const body = String(text || '');
  const lower = body.toLowerCase();
  const flags = [];

  // Hard safety flags.
  for (const ph of GLOBAL_BANNED_PHRASES) if (lower.includes(ph.toLowerCase())) flags.push(`banned_phrase:${ph}`);
  for (const re of TA) if (re.test(body)) flags.push(`retail_ta:${re.source}`);
  for (const re of PREDICTION) if (re.test(body)) flags.push(`prediction:${re.source}`);
  if (/\b(undefined|NaN)\b/.test(body) || /\bnull\b/.test(body)) flags.push('null_leak');

  const sents = sentences(body);
  const w = words(body);
  const rep = repetitionDensity(body);
  if (rep > 0.18) flags.push(`repetition_density:${rep}`);

  // Metrics (language-aware).
  const transitions = (body.match(TRANSITIONS_EN) || []).length + (body.match(TRANSITIONS_AR) || []).length;
  const assetHits = (body.match(ASSETS_EN) || []).length + (body.match(ASSETS_AR) || []).length;
  const numberHits = (body.match(NUMBERS) || []).length;
  const weakHedge = WEAK_HEDGE.reduce((n, re) => n + ((body.match(re) || []).length), 0);
  const transitionRatio = sents.length ? transitions / sents.length : 0;

  // Score 0–100 (deterministic, weighted). Arabic gets a lighter asset/number
  // expectation since the same content is more compact.
  let score = 60;
  score += Math.min(18, transitionRatio * 24);            // flowing, connected prose
  score += Math.min(12, assetHits * 1.5);                 // cross-asset integration
  score += Math.min(8, numberHits * 1.2);                 // evidence/specificity
  score -= Math.min(20, rep * 80);                        // repetition penalty
  score -= Math.min(15, weakHedge * 4);                   // weak-hedge penalty
  score -= flags.length * 25;                             // hard issues dominate
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score, flags,
    metrics: {
      sentences: sents.length, words: w.length, repetition_density: rep,
      transitions, transition_ratio: Number(transitionRatio.toFixed(2)),
      cross_asset_mentions: assetHits, evidence_numbers: numberHits, weak_hedges: weakHedge,
    },
  };
}

// Score a bilingual article (EN + AR). Returns combined pass/fail + per-locale.
function scoreArticle({ en, ar }) {
  const enScore = scoreText(en, { lang: 'en' });
  const arScore = scoreText(ar, { lang: 'ar' });
  const flags = [...enScore.flags.map((f) => `en:${f}`), ...arScore.flags.map((f) => `ar:${f}`)];
  return { en: enScore, ar: arScore, flags, min_score: Math.min(enScore.score, arScore.score) };
}

module.exports = { scoreText, scoreArticle, repetitionDensity, GLOBAL_BANNED_PHRASES, QUALITY_FLOOR: 70 };
