'use strict';

/**
 * check-market-intelligence-quality.js
 *
 * Validates generated market-outlook articles against intelligence quality standards.
 *
 * Checks:
 *   1. Ticker over-mention: same ticker >5 times in article body
 *   2. Repeated paragraph patterns: consecutive paragraphs with >80% word overlap
 *   3. Narrative duplication: same dominant theme across last 3 published articles
 *   4. Excessive disclaimers: >3 disclaimer sentences in one article
 *   5. Macro reference coverage: article must mention ≥1 macro indicator
 *
 * Usage:
 *   node tools/check-market-intelligence-quality.js [--slug=<slug>] [--all]
 *
 * Exit codes: 0 = pass, 1 = fail
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');
const MEMORY_PATH= path.join(ROOT, 'data', 'narrative-memory.json');

// ── Constants ─────────────────────────────────────────────────────────────────

const TICKERS_TO_CHECK = ['NVDA', 'AMD', 'QQQ', 'SOXX', 'XLK', 'SPY', 'TLT', 'SMH'];
const TICKER_MAX       = 5;
const OVERLAP_THRESHOLD   = 0.80;
const MIN_PARAGRAPH_WORDS = 15;
const EN_DISCLAIMER_MAX   = 3;
const AR_DISCLAIMER_MAX   = 3;
const MACRO_MIN           = 2;
const CLUSTER_MAX_REPEAT  = 3;

const EN_DISCLAIMER_PATTERNS = [
  /not financial advice/gi,
  /not investment advice/gi,
  /educational[^.]*only/gi,
  /not a recommendation to buy or sell/gi,
  /market conditions can change/gi,
];

const MACRO_INDICATORS = [
  /\bVIX\b/, /\byield\b/i, /\bCPI\b/, /\bFed\b/, /\bfederal reserve\b/i,
  /\binflation\b/i, /\binterest rate\b/i, /\blabor\b/i, /\bGDP\b/,
  /\btreasury\b/i, /\bbreadth\b/i, /\bvolatility\b/i, /\bregime\b/i,
];

const AR_MACRO_INDICATORS = [
  /التقلب/, /العائد/, /الفائدة/, /التضخم/, /السيولة/,
  /نظام الم/, /اتساع السوق/, /القطاع/, /الذكاء الاصطناعي/, /أشباه الموصلات/,
];

const AR_DISCLAIMER_PATTERNS = [
  /ليست? توصية/gi,
  /تعليمي فقط/gi,
  /للتعليم والتوعية/gi,
  /ليست? نصيحة/gi,
  /لا يُعتبر نصيحة/gi,
  /هذا التحليل عبارة عن تعليق تعليمي/gi,
];

// ─────────────────────────────────────────────────────────────────────────────

const slugArg = argValue('--slug');
const checkAll = process.argv.includes('--all');

const failures  = [];
const warnings  = [];

main();

function main() {
  const queue   = readJson(QUEUE_PATH, { topics: [] });
  const memory  = readJson(MEMORY_PATH, { snapshots: [] });

  const published = (queue.topics || []).filter((t) => t.status === 'published');

  let targets = [];
  if (slugArg) {
    const t = published.find((p) => p.slug === slugArg);
    if (!t) {
      console.error(`[check-market-intelligence-quality] Slug not found in published queue: ${slugArg}`);
      process.exit(1);
    }
    targets = [t];
  } else if (checkAll) {
    targets = published;
  } else {
    // Default: check the most recently published article
    targets = published.slice(-1);
  }

  if (!targets.length) {
    console.log('[check-market-intelligence-quality] No published articles to check.');
    process.exit(0);
  }

  // Per-article checks
  for (const topic of targets) {
    checkArticleQuality(topic);
  }

  // Cross-article narrative duplication check (uses last 3 published)
  checkNarrativeDuplication(published.slice(-3), memory);

  // Report
  if (warnings.length) {
    console.warn(`[check-market-intelligence-quality] Warnings (${warnings.length}):`);
    warnings.forEach((w) => console.warn(`  ! ${w}`));
  }

  if (failures.length) {
    console.error(`[check-market-intelligence-quality] FAILED (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log(`[check-market-intelligence-quality] Passed. ${targets.length} article(s) checked.`);
}

// ── Per-article checks ────────────────────────────────────────────────────────

function checkArticleQuality(topic) {
  const enPath = path.join(ROOT, 'market-outlook', `${topic.slug}.html`);
  const arPath = path.join(ROOT, 'ar', 'market-outlook', `${topic.slug}.html`);

  if (!fs.existsSync(enPath)) {
    warnings.push(`${topic.slug}: EN page not found at market-outlook/${topic.slug}.html`);
    return;
  }

  const enHtml = fs.readFileSync(enPath, 'utf8');
  const enText = stripHtml(enHtml);

  checkTickerOverMention(topic.slug, enText);
  checkRepeatedParagraphs(topic.slug, enHtml);
  checkDisclaimerCount(topic.slug, enText);
  checkMacroReferences(topic.slug, enText);

  // AR quality checks
  if (fs.existsSync(arPath)) {
    const arHtml = fs.readFileSync(arPath, 'utf8');
    const arText = stripHtml(arHtml);
    checkArDisclaimerCount(topic.slug, arText);
    checkArMacroReferences(topic.slug, arText);
  }
}

// Check 1: Ticker over-mention
function checkTickerOverMention(slug, text) {
  for (const ticker of TICKERS_TO_CHECK) {
    const re = new RegExp(`\\b${ticker}\\b`, 'g');
    const matches = text.match(re) || [];
    if (matches.length > TICKER_MAX) {
      failures.push(`${slug}: Ticker ${ticker} mentioned ${matches.length} times (max ${TICKER_MAX}). Use generic terms after threshold.`);
    }
  }
}

// Check 2: Repeated paragraph patterns
function checkRepeatedParagraphs(slug, html) {
  const paragraphs = extractParagraphs(html)
    .filter((p) => wordCount(p) >= MIN_PARAGRAPH_WORDS);

  for (let i = 0; i < paragraphs.length - 1; i++) {
    const overlap = wordOverlap(paragraphs[i], paragraphs[i + 1]);
    if (overlap >= OVERLAP_THRESHOLD) {
      const preview = paragraphs[i].slice(0, 60).replace(/\s+/g, ' ');
      failures.push(`${slug}: Consecutive paragraphs have ${Math.round(overlap * 100)}% word overlap (threshold: ${Math.round(OVERLAP_THRESHOLD * 100)}%). Near: "${preview}..."`);
    }
  }
}

// Check 3: Disclaimer count (EN)
function checkDisclaimerCount(slug, text) {
  let total = 0;
  for (const pattern of EN_DISCLAIMER_PATTERNS) {
    const matches = text.match(pattern) || [];
    total += matches.length;
  }
  if (total > EN_DISCLAIMER_MAX) {
    failures.push(`${slug}: ${total} disclaimer phrases detected (max ${EN_DISCLAIMER_MAX}). Consolidate into the disclaimer section.`);
  }
}

// Check 4: Macro reference coverage (EN)
function checkMacroReferences(slug, text) {
  const found = MACRO_INDICATORS.filter((re) => re.test(text));
  if (found.length < MACRO_MIN) {
    failures.push(`${slug}: Article contains only ${found.length} macro indicator reference(s) (minimum: ${MACRO_MIN}). Ensure macro context is present.`);
  }
}

// Check 4b: AR macro references
function checkArMacroReferences(slug, text) {
  const found = AR_MACRO_INDICATORS.filter((re) => re.test(text));
  if (found.length < 2) {
    warnings.push(`${slug}: AR page has limited macro indicator coverage (${found.length} detected).`);
  }
}

// Check 3b: AR disclaimer count
function checkArDisclaimerCount(slug, text) {
  let total = 0;
  for (const pattern of AR_DISCLAIMER_PATTERNS) {
    const matches = text.match(pattern) || [];
    total += matches.length;
  }
  if (total > AR_DISCLAIMER_MAX) {
    warnings.push(`${slug}: AR page has ${total} disclaimer phrases (max ${AR_DISCLAIMER_MAX}). Consider consolidating.`);
  }
}

// ── Cross-article narrative duplication ───────────────────────────────────────

function checkNarrativeDuplication(recentPublished, memory) {
  const snapshots = (memory.snapshots || []).slice(-CLUSTER_MAX_REPEAT);

  // Check topic clusters
  const clusters = recentPublished.map((t) => t.topic_cluster).filter(Boolean);
  const clusterCounts = {};
  for (const c of clusters) {
    clusterCounts[c] = (clusterCounts[c] || 0) + 1;
  }

  for (const [cluster, count] of Object.entries(clusterCounts)) {
    if (count >= CLUSTER_MAX_REPEAT) {
      warnings.push(`Narrative cluster "${cluster}" has appeared ${count} consecutive times. Consider rotating emphasis to avoid reader fatigue.`);
    }
  }

  // Check dominant narratives in memory
  const narratives = snapshots.map((s) => s.dominant_macro_narrative).filter(Boolean);
  const uniq = new Set(narratives);
  if (narratives.length >= CLUSTER_MAX_REPEAT && uniq.size === 1) {
    const n = [...uniq][0];
    warnings.push(`Dominant narrative "${n}" has repeated ${narratives.length} times in memory. Intelligence rotation recommended.`);
  }
}

// ── HTML parsing utilities ─────────────────────────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g,  '<')
    .replace(/&gt;/g,  '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractParagraphs(html) {
  const matches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  return matches.map((m) => stripHtml(m)).filter(Boolean);
}

function wordCount(text) {
  return (text.match(/\S+/g) || []).length;
}

function wordOverlap(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  let shared = 0;
  for (const w of setA) { if (setB.has(w)) shared++; }
  const total = Math.max(setA.size, setB.size);
  return total > 0 ? shared / total : 0;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function argValue(name) {
  const match = process.argv.find((a) => a.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}
