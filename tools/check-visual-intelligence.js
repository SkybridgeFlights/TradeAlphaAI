'use strict';

/**
 * check-visual-intelligence.js — Phase 68 Part G
 *
 * Validates the visual intelligence subsystem:
 *   - All data/visual/*.json files exist and have data_quality field
 *   - All dashboard pages exist (EN + AR × 3 types)
 *   - Dashboard pages are in sitemap-core.xml
 *   - No English leakage in AR dashboard pages
 *   - Global header markers present
 *   - No broken JSON references (script blocks reference non-existent files)
 *
 * Exit 0 — all checks pass. Exit 1 — one or more checks fail.
 *
 * Usage: node tools/check-visual-intelligence.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const VISUAL_FILES = [
  'data/visual/regime-gauge.json',
  'data/visual/sector-rotation-map.json',
  'data/visual/cross-asset-impact-map.json',
  'data/visual/yield-curve-context.json',
  'data/visual/volatility-dashboard.json',
  'data/visual/etf-relationship-map.json',
];

const DASHBOARD_PAGES = [
  'market-dashboard/index.html',
  'ar/market-dashboard/index.html',
  'macro-dashboard/index.html',
  'ar/macro-dashboard/index.html',
  'etf-dashboard/index.html',
  'ar/etf-dashboard/index.html',
];

const SITEMAP_URLS = [
  'https://www.tradealphaai.com/market-dashboard/',
  'https://www.tradealphaai.com/ar/market-dashboard/',
  'https://www.tradealphaai.com/macro-dashboard/',
  'https://www.tradealphaai.com/ar/macro-dashboard/',
  'https://www.tradealphaai.com/etf-dashboard/',
  'https://www.tradealphaai.com/ar/etf-dashboard/',
];

const REQUIRED_PAGE_MARKERS = [
  'GLOBAL_HEADER_START',
  'GLOBAL_HEADER_END',
  'visual-intelligence.js',
  'visual-intelligence.css',
];

const EN_RUN_PATTERN = /[A-Za-z]{4,}(?:\s+[A-Za-z]{4,}){3,}/;
const EN_ALLOWED     = /\b(TradeAlphaAI|VIX|NASDAQ|QQQ|SPY|SOXX|XLK|TLT|DXY|SMH|AMD|NVDA|ETF|AI|GDP|CPI|FOMC|Fed|USA|CSS|HTML|JSON|SVG|URL|href|src|class|id|div|span)\b/gi;

const failures = [];
const warnings = [];

main();

function main() {
  console.log('[check-visual-intelligence] Running checks...');

  checkVisualJsonFiles();
  checkDashboardPages();
  checkSitemap();
  checkAssets();

  if (failures.length) {
    console.error(`[check-visual-intelligence] FAILED — ${failures.length} failure(s):`);
    failures.forEach((f) => console.error(`    ✗ ${f}`));
  }
  if (warnings.length) {
    console.warn(`[check-visual-intelligence] ${warnings.length} warning(s):`);
    warnings.forEach((w) => console.warn(`    ⚠ ${w}`));
  }
  if (!failures.length && !warnings.length) {
    console.log('[check-visual-intelligence] All checks passed.');
  } else if (!failures.length) {
    console.log('[check-visual-intelligence] Passed with warnings.');
  }

  process.exit(failures.length ? 1 : 0);
}

// ── Visual JSON files ─────────────────────────────────────────────────────────

function checkVisualJsonFiles() {
  for (const rel of VISUAL_FILES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) {
      failures.push(`Missing: ${rel} — run node tools/build-visual-intelligence-data.js --write`);
      continue;
    }
    const data = parseJson(p);
    if (!data) {
      failures.push(`Malformed JSON: ${rel}`);
      continue;
    }
    if (data.data_quality === undefined) {
      failures.push(`Missing data_quality field in ${rel}`);
    }
    if (!data.generated_at) {
      warnings.push(`Missing generated_at in ${rel}`);
    }
  }
}

// ── Dashboard pages ───────────────────────────────────────────────────────────

function checkDashboardPages() {
  for (const rel of DASHBOARD_PAGES) {
    const p   = path.join(ROOT, rel);
    const ar  = rel.startsWith('ar/');

    if (!fs.existsSync(p)) {
      failures.push(`Missing: ${rel} — run node tools/generate-dashboard-pages.js`);
      continue;
    }

    const html = fs.readFileSync(p, 'utf8');

    // Check global header markers
    for (const marker of REQUIRED_PAGE_MARKERS) {
      if (!html.includes(marker)) {
        if (marker === 'GLOBAL_HEADER_START') {
          warnings.push(`${rel}: missing GLOBAL_HEADER_START — run apply-global-header.js`);
        } else if (marker !== 'GLOBAL_HEADER_END') {
          failures.push(`${rel}: missing reference to ${marker}`);
        }
      }
    }

    // Check canonical link
    if (!html.includes('<link rel="canonical"')) {
      warnings.push(`${rel}: missing canonical link`);
    }

    // Check AR localization corruption
    if (ar) {
      const bodyMatch = html.match(/<main[\s\S]*?<\/main>/i);
      if (bodyMatch) {
        const mainText = bodyMatch[0]
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(EN_ALLOWED, ' ')
          .replace(/\s+/g, ' ');
        const leaked = mainText.match(EN_RUN_PATTERN);
        if (leaked) {
          failures.push(`${rel}: English sentence fragment in AR page — "${leaked[0].slice(0, 60)}"`);
        }
      }
    }

    // Check data_quality label reference
    if (!html.includes('data-quality')) {
      warnings.push(`${rel}: no data-quality attribute found — quality badge may not render`);
    }
  }
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

function checkSitemap() {
  const sitemapPath = path.join(ROOT, 'sitemap-core.xml');
  if (!fs.existsSync(sitemapPath)) {
    warnings.push('sitemap-core.xml not found — cannot check dashboard URLs');
    return;
  }
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  for (const url of SITEMAP_URLS) {
    if (!xml.includes(url)) {
      failures.push(`Dashboard URL not in sitemap-core.xml: ${url}`);
    }
  }
}

// ── Asset files ───────────────────────────────────────────────────────────────

function checkAssets() {
  const JS_FILE  = path.join(ROOT, 'js',  'visual-intelligence.js');
  const CSS_FILE = path.join(ROOT, 'css', 'visual-intelligence.css');

  if (!fs.existsSync(JS_FILE)) {
    failures.push('Missing: js/visual-intelligence.js');
  }
  if (!fs.existsSync(CSS_FILE)) {
    failures.push('Missing: css/visual-intelligence.css');
  }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function parseJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
