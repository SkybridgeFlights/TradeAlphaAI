'use strict';

// Phase 114 — check:inline-visuals. Integrity gate for chart-intelligence SVG
// panels embedded inline in published articles (market-news/*.html + ar/).
// HARD-FAILS if a panel exceeds the visual cap, duplicates a type, lacks an
// analytical/narrative caption (disconnected), lacks source attribution or an
// honest "as of" freshness, has a malformed/non-RTL SVG, leaks null/undefined,
// uses retail-TA language, claims real-time "live", or (AR) leaves an English
// caption. Passes when nothing is published (the generator self-gates).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  { dir: path.join(ROOT, 'market-news'), lang: 'en', sub: 'market-news' },
  { dir: path.join(ROOT, 'ar', 'market-news'), lang: 'ar', sub: 'market-news' },
  // Phase 116 — the structure surface embeds the same inline panels.
  { dir: path.join(ROOT, 'market-structure'), lang: 'en', sub: 'market-structure' },
  { dir: path.join(ROOT, 'ar', 'market-structure'), lang: 'ar', sub: 'market-structure' },
];
const MAX_PANELS = 2;
const RETAIL = [/\bbuy\b/i, /\bsell\b/i, /\bRSI\b/, /\bMACD\b/, /\bbreakout\b/i, /\bprice target\b/i, /\bsignal\b/i, /\bto the moon\b/i];
const LIVE = /\b(live|real-?time|streaming)\b/i;
// A panel caption must reference the visual (a panel/snapshot/matrix/rail word).
const REF = { en: /\b(panel|snapshot|matrix|rail|chart)\b/i, ar: /(اللوحة|مسار|مصفوفة|لقطة|المخطط)/ };

const failures = [];
const fail = (m) => failures.push(m);

function articles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html');
}

let scanned = 0;
for (const { dir, lang, sub } of TARGETS) {
  for (const f of articles(dir)) {
    const rel = `${lang === 'ar' ? 'ar/' : ''}${sub}/${f}`;
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const figs = [...html.matchAll(/<figure class="article-evidence-panel"[\s\S]*?<\/figure>/gi)].map((m) => m[0]);
    if (!figs.length) continue; // no inline panels — clean article, allowed
    scanned += figs.length;

    if (figs.length > MAX_PANELS) fail(`${rel}: ${figs.length} inline panels exceeds cap ${MAX_PANELS}`);

    const seenType = new Set();
    for (const fig of figs) {
      const typeM = fig.match(/data-chart-type="([^"]+)"/);
      const type = typeM ? typeM[1] : null;
      if (!type) fail(`${rel}: panel missing data-chart-type`);
      else { if (seenType.has(type)) fail(`${rel}: duplicate inline panel type "${type}"`); seenType.add(type); }

      // SVG present + well-formed + (AR) RTL.
      const svgM = fig.match(/<svg[\s\S]*?<\/svg>/i);
      if (!svgM) { fail(`${rel}: panel ${type} has no SVG`); continue; }
      const svg = svgM[0];
      if (!/^<svg[\s>]/.test(svg.trim())) fail(`${rel}: panel ${type} SVG malformed`);
      if (lang === 'ar' && !/direction="rtl"/.test(svg)) fail(`${rel}: panel ${type} AR SVG not RTL`);

      const capM = fig.match(/<figcaption[\s\S]*?<\/figcaption>/i);
      const capText = (capM ? capM[0] : '').replace(/<[^>]+>/g, ' ');
      if (!capM || !capText.trim()) fail(`${rel}: panel ${type} has no caption (disconnected)`);
      if (!REF[lang].test(capText)) fail(`${rel}: panel ${type} caption does not reference the visual (disconnected)`);
      if (!/source|المصدر/i.test(capText)) fail(`${rel}: panel ${type} missing source attribution`);
      if (!/(as of|بتاريخ)/i.test(capText)) fail(`${rel}: panel ${type} missing "as of" freshness`);
      if (LIVE.test(capText)) fail(`${rel}: panel ${type} caption claims real-time/live`);
      if (/\b(undefined|NaN|null)\b/.test(capText)) fail(`${rel}: panel ${type} caption leaks undefined/null`);
      for (const re of RETAIL) if (re.test(capText)) fail(`${rel}: panel ${type} caption retail/TA language ${re}`);
      // AR caption must be native (no long English words in the hook).
      if (lang === 'ar') {
        const hookM = fig.match(/class="aep-hook">([^<]*)</);
        if (hookM && /[A-Za-z]{5,}/.test(hookM[1])) fail(`${rel}: panel ${type} AR caption not translated`);
      }
    }
  }
}

if (failures.length) {
  failures.forEach((f) => console.error(`[inline-visuals] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[inline-visuals] check:inline-visuals passed (${scanned} inline panel(s); capped, connected, attributed, bilingual, well-formed).`);
