'use strict';

// Phase 116 — check:structure-articles. Quality + safety gate for PUBLISHED
// market-structure notes (market-structure/*.html + ar/, excluding index).
// HARD-FAILS on: retail/signal vocabulary (the Phase 116 forbidden list),
// editorial-quality flags or sub-floor score, missing disclaimer / canonical /
// hreflang, broken EN↔AR pairing, non-RTL Arabic, null/undefined/NaN leaks,
// predictive certainty, and repetitive/duplicate structure narratives (two
// published notes whose body text is near-identical). Passes when nothing is
// published. Panels + rail on these pages are additionally covered by
// check:inline-visuals and check:embedded-intelligence (extended to this surface).

const fs = require('fs');
const path = require('path');
const { scoreArticle, QUALITY_FLOOR } = require('./editorial-quality');
const { STRUCTURE_FORBIDDEN, MIN_WORDS } = require('./generate-market-news-article');

const ROOT = path.resolve(__dirname, '..');
const EN_DIR = path.join(ROOT, 'market-structure');
const AR_DIR = path.join(ROOT, 'ar', 'market-structure');
const PREDICTION = [/\bwill (?:rise|fall|rally|drop|surge|plunge|reach|hit)\b/i, /\bprices? will\b/i, /\bguaranteed\b/i, /\bis (?:going|set) to (?:rise|fall|rally|drop)\b/i];

const failures = [];
const fail = (m) => failures.push(m);

function articles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html');
}
function bodyText(html) {
  const m = html.match(/<main[\s\S]*?<\/main>/i);
  const main = m ? m[0] : html;
  return main.replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
// 6-gram shingle Jaccard for duplicate-narrative detection.
function shingles(text) {
  const w = text.toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g, '').split(/\s+/).filter(Boolean);
  const s = new Set();
  for (let i = 0; i + 6 <= w.length; i += 1) s.add(w.slice(i, i + 6).join(' '));
  return s;
}
function jaccard(a, b) { let inter = 0; for (const x of a) if (b.has(x)) inter += 1; const uni = a.size + b.size - inter; return uni ? inter / uni : 0; }

const enFiles = articles(EN_DIR);
const arFiles = articles(AR_DIR);
const enBodies = [];

for (const f of enFiles) {
  const lbl = `market-structure/${f}`;
  const html = fs.readFileSync(path.join(EN_DIR, f), 'utf8');
  const text = bodyText(html);
  enBodies.push({ f, text });

  for (const re of STRUCTURE_FORBIDDEN) if (re.test(text)) fail(`${lbl}: forbidden retail/signal language ${re}`);
  for (const re of PREDICTION) if (re.test(text)) fail(`${lbl}: predictive certainty ${re}`);
  if (/\b(undefined|NaN|null)\b/.test(text)) fail(`${lbl}: leaks undefined/null/NaN`);
  if (!/canonical/.test(html)) fail(`${lbl}: missing canonical`);
  if (!/hreflang="ar"/.test(html)) fail(`${lbl}: missing hreflang`);
  if (!/disclaimer/i.test(html) && !/not investment advice/i.test(html)) fail(`${lbl}: missing educational disclaimer`);
  if (!fs.existsSync(path.join(AR_DIR, f))) fail(`${lbl}: missing AR counterpart ar/market-structure/${f}`);

  const arHtml = fs.existsSync(path.join(AR_DIR, f)) ? fs.readFileSync(path.join(AR_DIR, f), 'utf8') : '';
  const arText = arHtml ? bodyText(arHtml) : '';
  if (arHtml) {
    if (!/<html[^>]+dir="rtl"/.test(arHtml)) fail(`ar/market-structure/${f}: AR article not RTL`);
    for (const re of STRUCTURE_FORBIDDEN) if (re.test(arText)) fail(`ar/market-structure/${f}: forbidden language ${re}`);
  }
  const q = scoreArticle({ en: text, ar: arText });
  if (q.flags.length) fail(`${lbl}: editorial-quality flags ${JSON.stringify(q.flags)}`);
  if (q.min_score < QUALITY_FLOOR) fail(`${lbl}: editorial-quality ${q.min_score} < ${QUALITY_FLOOR}`);
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < MIN_WORDS.en) fail(`${lbl}: too short (${words} < ${MIN_WORDS.en})`);
}

// Orphan AR notes (AR without EN counterpart).
for (const f of arFiles) if (!enFiles.includes(f)) fail(`ar/market-structure/${f}: missing EN counterpart market-structure/${f}`);

// Repetitive / duplicate structure narratives.
for (let i = 0; i < enBodies.length; i += 1) {
  for (let j = i + 1; j < enBodies.length; j += 1) {
    const sim = jaccard(shingles(enBodies[i].text), shingles(enBodies[j].text));
    if (sim > 0.6) fail(`duplicate/repetitive structure narrative: ${enBodies[i].f} ~ ${enBodies[j].f} (similarity ${sim.toFixed(2)})`);
  }
}

if (failures.length) {
  failures.forEach((m) => console.error(`[structure-articles] FAIL: ${m}`));
  process.exit(1);
}
console.log(`[structure-articles] check:structure-articles passed (${enFiles.length} note(s); no retail/signal language, quality-gated, bilingual, non-repetitive).`);
