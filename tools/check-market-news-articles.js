'use strict';

// Phase 107 — check:market-news-articles. Quality gate for any PUBLISHED
// market-news article (market-news/*.html + ar/market-news/*.html, excluding
// index). HARD-FAILS if an article is wire-copy, too short, lacks source
// attribution, shows a proxy as consensus, uses advice/trading language, leaks
// undefined/null, breaks EN/AR pairing, or omits the disclaimer/canonical.
// When no articles are published yet, passes (the publisher self-gates).

const fs = require('fs');
const path = require('path');
const { MIN_WORDS } = require('./generate-market-news-article');

const ROOT = path.resolve(__dirname, '..');
const EN_DIR = path.join(ROOT, 'market-news');
const AR_DIR = path.join(ROOT, 'ar', 'market-news');

const ADVICE = [/\bbuy\b/i, /\bsell\b/i, /\bstrong buy\b/i, /\bprice target\b/i, /\bgo long\b/i, /\bgo short\b/i, /\bguaranteed\b/i, /\bto the moon\b/i, /\bRSI\b/, /\bMACD\b/];
const WIRE = [/\baccording to (?:reuters|bloomberg|ap|reporting)\b/i, /\(reuters\)/i, /\(bloomberg\)/i, /\bsources said\b/i];

const failures = [];
const fail = (m) => failures.push(m);

function articles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html');
}
function bodyText(html) {
  const m = html.match(/<main[\s\S]*?<\/main>/i);
  const region = m ? m[0] : html;
  return region.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function wordCount(html) { return bodyText(html).split(/\s+/).filter(Boolean).length; }

const enArticles = articles(EN_DIR);
for (const f of enArticles) {
  const lbl = `market-news/${f}`;
  const html = fs.readFileSync(path.join(EN_DIR, f), 'utf8');
  const text = bodyText(html);

  if (wordCount(html) < MIN_WORDS.en) fail(`${lbl}: too short (${wordCount(html)} < ${MIN_WORDS.en})`);
  for (const re of ADVICE) if (re.test(text)) fail(`${lbl}: advice/trading language ${re}`);
  for (const re of WIRE) if (re.test(text)) fail(`${lbl}: wire-copy marker ${re}`);
  if (/\b(undefined|NaN)\b/.test(text) || /\bnull\b/.test(text)) fail(`${lbl}: leaked undefined/null/NaN`);
  if (!/source|bureau|statistics|federal reserve|central bank|eurostat|treasury|official/i.test(text)) fail(`${lbl}: missing source attribution`);
  if (!/not investment advice|educational/i.test(text)) fail(`${lbl}: missing educational disclaimer`);
  if (!/rel="canonical"/.test(html)) fail(`${lbl}: missing canonical`);
  if (!/hreflang="ar"/.test(html)) fail(`${lbl}: missing AR hreflang`);
  // Proxy must never be called consensus.
  if (/historical proxy/i.test(text) && /\bconsensus\b/i.test(text)) {
    // allowed only if it explicitly says NOT consensus
    if (!/not (?:as )?consensus|not consensus/i.test(text)) fail(`${lbl}: proxy possibly presented as consensus`);
  }
  // EN must have an AR counterpart.
  if (!fs.existsSync(path.join(AR_DIR, f))) fail(`${lbl}: missing AR counterpart ar/market-news/${f}`);
}

// AR articles: RTL + counterpart + length.
for (const f of articles(AR_DIR)) {
  const lbl = `ar/market-news/${f}`;
  const html = fs.readFileSync(path.join(AR_DIR, f), 'utf8');
  if (!/<html[^>]+dir="rtl"/.test(html)) fail(`${lbl}: not RTL`);
  if (wordCount(html) < MIN_WORDS.ar) fail(`${lbl}: too short (${wordCount(html)} < ${MIN_WORDS.ar})`);
  if (!fs.existsSync(path.join(EN_DIR, f))) fail(`${lbl}: missing EN counterpart market-news/${f}`);
  const text = bodyText(html);
  if (/\b(undefined|NaN|null)\b/.test(text)) fail(`${lbl}: leaked undefined/null/NaN`);
}

if (failures.length) {
  failures.forEach((f) => console.error(`[market-news-articles] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[market-news-articles] check:market-news-articles passed (${enArticles.length} published article(s); quality + EN/AR parity verified).`);
