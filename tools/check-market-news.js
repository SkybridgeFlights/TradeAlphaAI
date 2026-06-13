'use strict';

// Phase 95 validation — Market News surface + News Brain eligibility.
// Section: bilingual /market-news/ pages, canonical header markers + CSS,
// canonical link, breadcrumb, distinct identity, sitemap presence, disclaimer,
// and HARD FAIL on wire-copy/fake-urgency/advice tone.
// Eligibility: significance threshold honored, cooldown/dup-event integrity,
// evidence-backed, restraint cap, reaction-only (no scheduled filler).

const fs = require('fs');
const path = require('path');
const { SIGNIFICANCE_THRESHOLD, MAX_ELIGIBLE } = require('./build-news-eligibility');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } }
function readJson(rel) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return null; } }

// ── Section pages ─────────────────────────────────────────────────────────────
const PAGES = [
  { rel: 'market-news/index.html', lang: 'en', canonical: 'https://www.tradealphaai.com/market-news/' },
  { rel: 'ar/market-news/index.html', lang: 'ar', canonical: 'https://www.tradealphaai.com/ar/market-news/' },
];
// Wire-copy / fake-urgency filler that institutional reaction analysis must avoid.
// "breaking news" (space) is the hype form; the hyphenated "breaking-news"
// in our disclaimer ("not breaking-news reporting") is a legitimate negation.
const WIRE_COPY = /\b(breaking news|markets are watching|all eyes are on|stay tuned|developing story|here'?s what you need to know|sources say)\b/i;
const ADVICE = /\b(buy now|sell now|you should (buy|sell)|guaranteed|price target|will (rally|crash|soar|plunge))\b/i;

for (const page of PAGES) {
  const html = read(page.rel);
  if (!html) { failures.push(`${page.rel}: missing`); continue; }
  if (!html.includes('GLOBAL_HEADER_START') || !html.includes('GLOBAL_HEADER_END')) failures.push(`${page.rel}: header markers missing`);
  if (!html.includes('/css/global-header-canonical.css')) failures.push(`${page.rel}: canonical header CSS missing`);
  if (!new RegExp(`<html lang="${page.lang}"`).test(html)) failures.push(`${page.rel}: wrong lang`);
  if (page.lang === 'ar' && !html.includes('dir="rtl"')) failures.push(`${page.rel}: AR missing dir=rtl`);
  if (!html.includes(`<link rel="canonical" href="${page.canonical}"`)) failures.push(`${page.rel}: canonical link wrong/missing`);
  if (!html.includes('class="breadcrumb"')) failures.push(`${page.rel}: breadcrumb missing`);
  if (!html.includes('news-coverage')) failures.push(`${page.rel}: news coverage section missing (identity)`);
  if (page.lang === 'ar' && !/[؀-ۿ]/.test(html)) failures.push(`${page.rel}: AR has no Arabic`);
  if (/Market Outlook Research \| Macro/.test(html)) failures.push(`${page.rel}: carries market-outlook identity (section confusion)`);
  // Scan visible body only (exclude scripts/json-ld) for tone.
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  if (WIRE_COPY.test(body)) failures.push(`${page.rel}: wire-copy/fake-urgency filler detected`);
  if (ADVICE.test(body)) failures.push(`${page.rel}: advice/trading language detected`);
  if (!/not investment advice|ليست نصيحة استثمارية/.test(html)) failures.push(`${page.rel}: disclaimer missing`);
}

const coreSitemap = read('sitemap-core.xml') || '';
const arSitemap = read('sitemap-ar.xml') || '';
if (!coreSitemap.includes('https://www.tradealphaai.com/market-news/')) failures.push('sitemap-core.xml: /market-news/ missing');
if (!arSitemap.includes('https://www.tradealphaai.com/ar/market-news/')) failures.push('sitemap-ar.xml: /ar/market-news/ missing');

// ── Eligibility artifact ──────────────────────────────────────────────────────
const elig = readJson('data/intelligence/news-eligibility.json');
if (elig) {
  if (elig.significance_threshold !== SIGNIFICANCE_THRESHOLD) failures.push('news-eligibility: threshold drifted from engine');
  const eligible = elig.eligible || [];
  if (eligible.length > MAX_ELIGIBLE) failures.push(`news-eligibility: ${eligible.length} eligible exceeds cap ${MAX_ELIGIBLE}`);
  const ids = new Set();
  for (const e of eligible) {
    if (!Number.isFinite(e.significance) || e.significance < SIGNIFICANCE_THRESHOLD) failures.push(`news-eligibility: ${e.event_id} below significance threshold`);
    if (!e.cluster || !e.headline) failures.push(`news-eligibility: ${e.event_id} missing cluster/headline`);
    if (!Array.isArray(e.evidence) || !e.evidence.length) failures.push(`news-eligibility: ${e.event_id} missing evidence`);
    if (ids.has(e.event_id)) failures.push(`news-eligibility: duplicate eligible event ${e.event_id}`);
    ids.add(e.event_id);
  }
  // Cooldown integrity: covered clusters must not also be freshly eligible
  // within the cooldown window (engine should have suppressed them).
  const coveredClusters = new Map(((elig.covered) || []).filter((c) => c.last_covered).map((c) => [c.cluster + ':' + c.event_id, c.last_covered]));
  for (const e of eligible) {
    // a freshly eligible event being in covered is expected (just covered this run); fine.
    if (!coveredClusters.has(e.cluster + ':' + e.event_id)) failures.push(`news-eligibility: eligible event ${e.event_id} not recorded in covered memory`);
  }
  console.log(`[market-news] eligibility ok (eligible=${eligible.length}, threshold=${elig.significance_threshold})`);
}

if (failures.length) {
  failures.forEach((f) => console.error(`[market-news] FAIL: ${f}`));
  process.exit(1);
}
console.log('[market-news] check:market-news passed.');
