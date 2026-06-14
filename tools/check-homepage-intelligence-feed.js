'use strict';

// Phase 117 — check:homepage-feed. Integrity gate for the Homepage Intelligence
// Feed on index.html (EN) and ar/index.html (AR). HARD-FAILS on: missing
// markers/section, null/undefined/NaN leak, fake freshness (a determinate regime
// value shown while the artifact is stale), stale shown as live, missing surface
// links, duplicate latest-content cards, over-clutter, advice/retail language,
// untranslated Arabic state values, EN feed leaking Arabic, and (AR) non-RTL.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STALE_HOURS = 72;
const MAX_STATE_CARDS = 5;
const MAX_LATEST = 6;
const ADVICE = [/\bbuy now\b/i, /\bsell now\b/i, /\bprice target\b/i, /\btarget price\b/i, /\bbreakout trade\b/i, /\bRSI\b/, /\bMACD\b/, /\bguaranteed\b/i, /\bbullish signal\b/i, /\bbearish signal\b/i, /\bstop loss\b/i, /\btake profit\b/i];

const failures = [];
const fail = (m) => failures.push(m);
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function ageHours(iso) { try { return (Date.now() - new Date(iso).getTime()) / 3600000; } catch { return Infinity; } }

function feedBlock(html) {
  const m = html.match(/<!-- generated:intelligence-feed:start -->[\s\S]*?<!-- generated:intelligence-feed:end -->/);
  return m ? m[0] : null;
}

const regime = readJson(path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json'), {});
const regimeFresh = regime.generated_at && ageHours(regime.generated_at) <= STALE_HOURS;
const educationalTopics = readJson(path.join(ROOT, 'data', 'intelligence', 'educational-topics.json'), { history: [] });
const latestEducational = (educationalTopics.history || [])
  .filter((item) => item.status === 'published' && item.slug && item.published_at)
  .sort((left, right) => Date.parse(right.published_at) - Date.parse(left.published_at))[0] || null;
// English forms of the regime/liquidity values (with spaces) — used to detect
// fake freshness: a determinate value displayed while the artifact is stale.
const determinateEn = new Set(['broad risk support', 'healthy risk expansion', 'narrow leadership', 'crowded growth positioning', 'defensive rotation', 'liquidity stress', 'unstable rally', 'volatility transition', 'yield pressure regime', 'macro fragility', 'easing', 'tightening', 'yield pressure', 'defensive demand', 'volatility absorption', 'volatility rejection', 'neutral']);

for (const [rel, ar] of [['index.html', false], ['ar/index.html', true]]) {
  const file = path.join(ROOT, rel);
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { fail(`${rel}: not found`); continue; }
  const block = feedBlock(html);
  if (!block) { fail(`${rel}: intelligence-feed markers/section missing`); continue; }
  const text = block.replace(/<[^>]+>/g, ' ');

  if (/\b(undefined|NaN|null)\b/.test(text)) fail(`${rel}: feed leaks undefined/NaN/null`);
  for (const re of ADVICE) if (re.test(text)) fail(`${rel}: feed uses advice/retail/signal language ${re}`);

  // Surface links present.
  for (const href of [`${ar ? '/ar' : ''}/market-structure/`, `${ar ? '/ar' : ''}/market-news/`, `${ar ? '/ar' : ''}/economic-calendar/`]) {
    if (!block.includes(`href="${href}"`)) fail(`${rel}: feed missing surface link ${href}`);
  }

  // As-of present (honest freshness).
  if (!/(as of|بتاريخ|Awaiting|بانتظار)/i.test(text)) fail(`${rel}: feed missing honest as-of / awaiting line`);

  // Clutter caps.
  const stateCards = (block.match(/class="intel-widget-card/g) || []).length;
  const latest = (block.match(/class="intel-widget-card intel-feed-item"/g) || []).length;
  const pureState = stateCards - latest;
  if (pureState > MAX_STATE_CARDS) fail(`${rel}: ${pureState} state cards exceeds ${MAX_STATE_CARDS}`);
  if (latest > MAX_LATEST) fail(`${rel}: ${latest} latest-content cards exceeds ${MAX_LATEST}`);

  // Duplicate latest-content links.
  const hrefs = [...block.matchAll(/intel-feed-title"><a href="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  for (const h of hrefs) { if (seen.has(h)) fail(`${rel}: duplicate latest-content card ${h}`); seen.add(h); }

  // Latest educational content must follow publication history, not filesystem
  // timestamps, and each locale must carry its native article title.
  if (latestEducational) {
    const expectedHref = `${ar ? '/ar' : ''}/articles/${latestEducational.slug}.html`;
    if (!block.includes(`href="${expectedHref}"`)) fail(`${rel}: latest educational history article missing (${expectedHref})`);
    const articlePath = path.join(ROOT, ar ? 'ar' : '', 'articles', `${latestEducational.slug}.html`);
    try {
      const article = fs.readFileSync(articlePath, 'utf8');
      const title = (article.match(/<h1>([\s\S]*?)<\/h1>/i) || [])[1];
      const cleanTitle = title && title.replace(/<[^>]+>/g, '').trim();
      if (!cleanTitle || !block.includes(cleanTitle)) fail(`${rel}: latest educational title is not localized from ${articlePath}`);
    } catch {
      fail(`${rel}: latest educational article file missing (${articlePath})`);
    }
  }

  // State values.
  const values = [...block.matchAll(/intel-widget-value">([^<]*)</g)].map((m) => m[1].trim());
  for (const v of values) {
    if (ar) {
      if (/[A-Za-z]{4,}/.test(v) && v !== '—') fail(`${rel}: AR state value not translated ("${v}")`);
    } else {
      // EN feed must not leak Arabic in state values.
      if (/[؀-ۿ]/.test(v)) fail(`${rel}: EN feed leaks Arabic state value ("${v}")`);
      // Fake freshness: a determinate EN value shown while the artifact is stale.
      if (determinateEn.has(v.toLowerCase()) && !regimeFresh) fail(`${rel}: determinate state "${v}" shown while liquidity-regime is stale (fake freshness)`);
    }
  }

  // AR page must be RTL on the feed (section dir or page dir).
  if (ar && !/dir="rtl"/.test(block) && !/<html[^>]+dir="rtl"/.test(html)) fail(`${rel}: AR feed not RTL`);
}

if (failures.length) {
  failures.forEach((m) => console.error(`[homepage-feed] FAIL: ${m}`));
  process.exit(1);
}
console.log('[homepage-feed] check:homepage-feed passed (EN+AR feed present, honest freshness, bilingual, linked, uncluttered, no advice language).');
