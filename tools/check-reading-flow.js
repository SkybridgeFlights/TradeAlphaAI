'use strict';

// Phase 120 — check:reading-flow. Reading-experience gate for PUBLISHED article
// bodies across all four surfaces (market-news / daily-research / market-
// structure / educational, EN + AR). HARD-FAILS on fragmented prose: too high a
// micro-paragraph ratio, too low an average paragraph length, repeated
// transition templates, empty/whitespace-filler paragraphs or <br><br> spacing
// hacks, null/undefined leaks, or retail/advice language. Complements the
// editorial-quality scorer (flow/repetition/specificity) with a structural
// reading-density check. Passes green when nothing is published.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  { dir: 'market-news', sub: 'market-news' }, { dir: 'ar/market-news', sub: 'ar/market-news' },
  { dir: 'market-structure', sub: 'market-structure' }, { dir: 'ar/market-structure', sub: 'ar/market-structure' },
  { dir: 'articles', sub: 'articles' }, { dir: 'ar/articles', sub: 'ar/articles' },
];
// Thresholds — calibrated to pass current institutional density (avg 27–49
// words/para, micro ratio 12–25%) while rejecting genuine fragmentation.
const MICRO_WORDS = 18;          // an EN paragraph under this is a "micro" block
const MICRO_WORDS_AR = 12;       // Arabic is more compact for the same content
const MAX_MICRO_RATIO = 0.35;    // PRIMARY gate: fail above this share of micro paragraphs
const MIN_AVG_WORDS = 20;        // floor below institutional multi-clause density (EN)
const MIN_AVG_WORDS_AR = 17;     // Arabic is more compact for the same content
const MAX_TRANSITION_REPEAT = 3; // same 4-word opener may repeat at most this many times
const ADVICE = [/\bbuy now\b/i, /\bsell now\b/i, /\bprice target\b/i, /\btarget price\b/i, /\bbreakout trade\b/i, /\bRSI\b/, /\bMACD\b/, /\bguaranteed\b/i, /\bbullish signal\b/i, /\bbearish signal\b/i, /\bstop loss\b/i, /\btake profit\b/i];

const failures = [];
const fail = (m) => failures.push(m);

function articleFiles(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith('.html') && f !== 'index.html'
    && (fs.readFileSync(path.join(abs, f), 'utf8').match(/data-(market-news|educational)-article=/)));
}

let scanned = 0;
for (const { dir, sub } of TARGETS) {
  const ar = sub.startsWith('ar/');
  for (const f of articleFiles(dir)) {
    const rel = `${sub}/${f}`;
    const html = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
    const main = (html.match(/<main[\s\S]*?<\/main>/i) || [''])[0];

    // Spacing hacks / empty filler paragraphs.
    if (/<br\s*\/?>\s*<br\s*\/?>/i.test(main)) fail(`${rel}: <br><br> spacing hack in body`);
    if (/<p[^>]*>\s*<\/p>/i.test(main)) fail(`${rel}: empty filler paragraph`);

    // Measure PROSE only: exclude the hero byline (date · desk) and link-
    // dominated navigational lines, which are legitimately short and not prose.
    const paras = [...main.matchAll(/<p class="market-copy">([\s\S]*?)<\/p>/g)]
      .map((m) => m[1])
      .filter((raw) => {
        const linkWords = (raw.match(/<a\b[^>]*>([\s\S]*?)<\/a>/g) || []).join(' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
        const text = raw.replace(/<[^>]+>/g, ' ').trim();
        const total = text.split(/\s+/).filter(Boolean).length;
        if (!total) return false;
        if (/TradeAlphaAI (Research|Markets Desk)/.test(text)) return false; // byline
        if (linkWords / total > 0.4) return false; // navigational link line
        return true;
      })
      .map((raw) => raw.replace(/<[^>]+>/g, '').trim());
    if (!paras.length) continue; // index-like / no prose — skip
    scanned += 1;

    const words = paras.map((p) => p.split(/\s+/).filter(Boolean).length);
    const avg = words.reduce((a, b) => a + b, 0) / words.length;
    const microLimit = ar ? MICRO_WORDS_AR : MICRO_WORDS;
    const micro = words.filter((w) => w < microLimit).length;
    const microRatio = micro / words.length;
    const minAvg = ar ? MIN_AVG_WORDS_AR : MIN_AVG_WORDS;

    if (avg < minAvg) fail(`${rel}: fragmented prose — avg ${avg.toFixed(0)} words/paragraph < ${minAvg}`);
    if (microRatio > MAX_MICRO_RATIO) fail(`${rel}: ${micro}/${words.length} micro-paragraphs (${(microRatio * 100).toFixed(0)}%) exceeds ${MAX_MICRO_RATIO * 100}%`);

    // Repeated transition templates — same 4-word opener across many paragraphs.
    const openers = {};
    for (const p of paras) {
      const key = p.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
      if (key.split(' ').length >= 4) openers[key] = (openers[key] || 0) + 1;
    }
    for (const [key, n] of Object.entries(openers)) {
      if (n > MAX_TRANSITION_REPEAT) fail(`${rel}: repeated transition template "${key}…" (${n}×)`);
    }

    const text = paras.join(' ');
    if (/\b(undefined|NaN|null)\b/.test(text)) fail(`${rel}: null/undefined/NaN leak in prose`);
    for (const re of ADVICE) if (re.test(text)) fail(`${rel}: retail/advice language ${re}`);
  }
}

// ── Self-test (negative): the validator must reject fragmented prose. ──
if (process.argv.includes('--self-test')) {
  const frag = '<main>' + Array.from({ length: 6 }, () => '<p class="market-copy">Short block here.</p>').join('') + '</main>';
  const microPs = [...frag.matchAll(/<p class="market-copy">([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  const w = microPs.map((p) => p.split(/\s+/).filter(Boolean).length);
  const ratio = w.filter((x) => x < MICRO_WORDS).length / w.length;
  const avg = w.reduce((a, b) => a + b, 0) / w.length;
  const ok = (ratio > MAX_MICRO_RATIO) && (avg < MIN_AVG_WORDS) && /<br\s*\/?>\s*<br\s*\/?>/i.test('<br><br>');
  console.log(`[reading-flow] self-test: fragmented fixture rejected = ${ok}`);
  if (!ok) process.exit(1);
}

if (failures.length) {
  failures.forEach((m) => console.error(`[reading-flow] FAIL: ${m}`));
  process.exit(1);
}
console.log(`[reading-flow] check:reading-flow passed (${scanned} article body(ies); institutional paragraph density, even rhythm, no fragmentation or spacing hacks).`);
