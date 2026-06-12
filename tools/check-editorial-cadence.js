'use strict';

// Phase 86 validation — editorial cadence and human analyst realism.
// Hard rhythm detection on PENDING DRAFTS (gate) and published market-outlook
// pages (warn-only — published content is never retro-failed):
//   - uniform paragraph rhythm (template fingerprint)
//   - repeated paragraph openers (EN and AR)
//   - robotic transition density (furthermore/moreover/… and Arabic
//     translated-rhythm chains بالإضافة إلى ذلك/علاوة على ذلك/…)
//   - buzzword density (landscape/navigate/robust/…)
//   - symmetrical section structure (identical paragraph counts everywhere)
//   - SEO-listicle fingerprints ("Top N", numbered-reasons headlines)
//   - editorial visual-slot marker integrity (kind vocabulary, unique ids)
//
// Scope notes: detectors run on body copy only; thresholds are deliberately
// conservative so genuine analyst style never trips them.

const fs = require('fs');
const path = require('path');
const { validateSlotMarkers } = require('./editorial-visual-contracts');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];

const ROBOTIC_TRANSITIONS_EN = /\b(furthermore|moreover|additionally|in conclusion|to summarize|it is worth noting|it is important to note|in today's fast-paced|in the ever-evolving)\b/gi;
const ROBOTIC_TRANSITIONS_AR = /(بالإضافة إلى ذلك|علاوة على ذلك|ومن الجدير بالذكر|في الختام|وفي نهاية المطاف)/g;
const BUZZWORDS_EN = /\b(landscape|navigate|navigating|robust|dynamic landscape|underscores?|delve|delving|game.changer)\b/gi;
const LISTICLE = /\b(top\s+\d+|[0-9]+\s+(reasons|things|ways|tips)\b)/i;

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractParagraphs(html) {
  return [...String(html || '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter((p) => p.split(/\s+/).length >= 6);
}

function words(text) { return text.split(/\s+/).filter(Boolean).length; }

function analyze(html, label, isArabic, report, warnReport) {
  const warn = warnReport || report;
  const paragraphs = extractParagraphs(html);
  const body = paragraphs.join(' ');
  const totalWords = words(body);
  if (paragraphs.length < 4 || totalWords < 150) return; // too short to fingerprint

  // 1. Uniform paragraph rhythm.
  const lengths = paragraphs.map(words);
  const mean = lengths.reduce((s, n) => s + n, 0) / lengths.length;
  const cv = Math.sqrt(lengths.reduce((s, n) => s + (n - mean) ** 2, 0) / lengths.length) / mean;
  if (lengths.length >= 6 && cv < 0.18) {
    report(`${label}: uniform paragraph rhythm (cv=${cv.toFixed(2)}) — template fingerprint, vary pacing`);
  }

  // 2. Repeated paragraph openers.
  const openers = paragraphs.map((p) => p.trim().split(/\s+/)[0]).filter(Boolean);
  const openerCounts = new Map();
  for (const o of openers) openerCounts.set(o, (openerCounts.get(o) || 0) + 1);
  const maxOpener = Math.max(...openerCounts.values());
  if (openers.length >= 6 && maxOpener / openers.length > 0.45) {
    report(`${label}: ${Math.round((maxOpener / openers.length) * 100)}% of paragraphs share the same opener — vary entries`);
  }
  // Arabic: consecutive paragraphs opening with the same particle.
  if (isArabic) {
    let consecutive = 0;
    for (let i = 1; i < openers.length; i += 1) {
      if (/^(إن|و|كما|في)/.test(openers[i]) && openers[i][0] === openers[i - 1][0]) consecutive += 1;
    }
    if (consecutive >= 3) report(`${label}: translated-rhythm Arabic openers (${consecutive} consecutive same-particle starts)`);
  }

  // 3. Robotic transition density.
  const transitions = (body.match(isArabic ? ROBOTIC_TRANSITIONS_AR : ROBOTIC_TRANSITIONS_EN) || []).length;
  if (transitions / (totalWords / 1000) > 4 || transitions >= 4) {
    report(`${label}: ${transitions} robotic transition phrase(s) — move through market logic, not connective filler`);
  }

  // 4. Buzzword density (EN only; warn-level — the prompt layer and the
  //    [PUBLISH_QUALITY] scorer apply the gating pressure here).
  if (!isArabic) {
    const buzz = (body.match(BUZZWORDS_EN) || []).length;
    if (buzz / (totalWords / 1000) > 6 || buzz >= 6) {
      warn(`${label}: buzzword density ${buzz} — prefer concrete market language`);
    }
  }

  // 5. SEO-listicle fingerprints in headings.
  const headings = [...String(html).matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => stripHtml(m[1]));
  for (const h of headings) {
    if (LISTICLE.test(h)) report(`${label}: listicle-style heading "${h.slice(0, 60)}" — institutional research, not content marketing`);
  }

  // 6. Symmetrical section structure.
  const sections = String(html).split(/<h[23][^>]*>/i).slice(1);
  if (sections.length >= 3) {
    const counts = sections.map((s) => extractParagraphs(s).length).filter((n) => n > 0);
    if (counts.length >= 3 && new Set(counts).size === 1 && counts[0] >= 2) {
      report(`${label}: perfectly symmetrical sections (${counts[0]} paragraphs each) — machine structure`);
    }
  }

  // 7. Visual-slot marker integrity (architecture contract).
  for (const f of validateSlotMarkers(html, label)) report(f);
}

function scanDir(dir, isPublished) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return 0;
  let scanned = 0;
  const entries = fs.readdirSync(full);
  const fail = isPublished ? (m) => warnings.push(m) : (m) => failures.push(m);
  const warn = (m) => warnings.push(m);
  for (const entry of entries) {
    const p = path.join(full, entry);
    if (fs.statSync(p).isDirectory()) {
      for (const f of fs.readdirSync(p).filter((x) => x.endsWith('.html'))) {
        const html = fs.readFileSync(path.join(p, f), 'utf8');
        const isArabic = /lang="ar"|dir="rtl"/.test(html.slice(0, 600)) || f.includes('-ar');
        analyze(html, `${dir}/${entry}/${f}`, isArabic, fail, warn);
        scanned += 1;
      }
    } else if (entry.endsWith('.html') && entry !== 'index.html') {
      // Listing/index pages are navigation surfaces, not articles.
      const html = fs.readFileSync(p, 'utf8');
      const isArabic = /lang="ar"|dir="rtl"/.test(html.slice(0, 600));
      analyze(html, `${dir}/${entry}`, isArabic, fail, warn);
      scanned += 1;
    }
  }
  return scanned;
}

// Pending drafts gate; published pages warn-only (never retro-failed).
const draftCount = scanDir('drafts/market-outlook', false) + scanDir('drafts/editorial', false);
const publishedCount = scanDir('market-outlook', true);

console.log(`[editorial-cadence] scanned drafts=${draftCount} published=${publishedCount} warnings=${warnings.length} failures=${failures.length}`);
warnings.slice(0, 10).forEach((w) => console.warn(`[editorial-cadence] WARN: ${w}`));

if (failures.length) {
  failures.forEach((f) => console.error(`[editorial-cadence] FAIL: ${f}`));
  process.exit(1);
}
console.log('[editorial-cadence] check:editorial-cadence passed.');
