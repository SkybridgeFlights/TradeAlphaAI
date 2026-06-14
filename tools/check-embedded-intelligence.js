'use strict';

// Phase 113 — check:embedded-intelligence. Integrity gate for the research-desk
// intelligence rail embedded in published articles (market-news/*.html + ar/).
// HARD-FAILS if an embedded block is disconnected from the narrative, claims
// real-time "live" data dishonestly, leaks null/undefined, leaves an English
// value in the Arabic rail (untranslated), exceeds the clutter threshold, breaks
// RTL, or uses retail-dashboard/trading-signal language. Passes when nothing is
// published (the generator self-gates and embeds the rail deterministically).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  { dir: path.join(ROOT, 'market-news'), lang: 'en', sub: 'market-news' },
  { dir: path.join(ROOT, 'ar', 'market-news'), lang: 'ar', sub: 'market-news' },
  // Phase 116 — the structure surface embeds the same research-desk rail.
  { dir: path.join(ROOT, 'market-structure'), lang: 'en', sub: 'market-structure' },
  { dir: path.join(ROOT, 'ar', 'market-structure'), lang: 'ar', sub: 'market-structure' },
];
const REFERENCE = { en: /research-desk intelligence rail/i, ar: /استخبارات مكتب الأبحاث/ };
const LIVE_WORDING = /\b(live|real-?time|streaming|up-to-the-second)\b/i;
const RETAIL = [/\bbuy\b/i, /\bsell\b/i, /\bRSI\b/, /\bMACD\b/, /\bbreakout\b/i, /\bprice target\b/i, /\bsignal\b/i];
const MAX_CARDS = 7;

const failures = [];
const fail = (m) => failures.push(m);

function articles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html');
}
function railBlock(html) {
  const m = html.match(/<aside class="research-intel-rail"[\s\S]*?<\/aside>/i);
  return m ? m[0] : null;
}

let scanned = 0;
for (const { dir, lang, sub } of TARGETS) {
  for (const f of articles(dir)) {
    const rel = `${lang === 'ar' ? 'ar/' : ''}${sub}/${f}`;
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const rail = railBlock(html);
    if (!rail) { fail(`${rel}: research-desk intelligence rail missing`); continue; }
    scanned += 1;
    const railText = rail.replace(/<[^>]+>/g, ' ');

    // Disconnected: the rail must be referenced in the article body.
    if (!REFERENCE[lang].test(html.replace(rail, ''))) fail(`${rel}: embedded intelligence rail is not referenced in the narrative (disconnected)`);

    // Honest freshness: no real-time "live" wording; an "as of" snapshot date must be present.
    if (LIVE_WORDING.test(railText)) fail(`${rel}: rail uses unsupported real-time/live wording`);
    if (!/(?:as of|بتاريخ)/i.test(railText)) fail(`${rel}: rail missing honest "as of" freshness`);

    // No null/undefined/NaN leaked.
    if (/\b(undefined|NaN|null)\b/.test(railText)) fail(`${rel}: rail leaks undefined/null/NaN`);

    // Retail / trading-signal language.
    for (const re of RETAIL) if (re.test(railText)) fail(`${rel}: rail uses retail/trading-signal language ${re}`);

    // Clutter.
    const cards = (rail.match(/class="ri-card"/g) || []).length;
    if (cards > MAX_CARDS) fail(`${rel}: rail clutter (${cards} cards > ${MAX_CARDS})`);
    if (cards === 0) fail(`${rel}: rail has no context cards`);

    // Arabic rail must be RTL and must not leak raw English regime/liquidity values.
    if (lang === 'ar') {
      if (!/<html[^>]+dir="rtl"/.test(html)) fail(`${rel}: AR article not RTL`);
      const values = [...rail.matchAll(/class="ri-value">([^<]*)</g)].map((m) => m[1].trim());
      for (const v of values) {
        if (/[A-Za-z]{4,}/.test(v) && v !== '—') fail(`${rel}: AR rail value not translated ("${v}")`);
      }
    }
  }
}

if (failures.length) {
  failures.forEach((f) => console.error(`[embedded-intelligence] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[embedded-intelligence] check:embedded-intelligence passed (${scanned} embedded rail(s); connected, honest freshness, bilingual, flag-free).`);
