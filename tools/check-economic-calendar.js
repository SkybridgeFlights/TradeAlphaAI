'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const CACHE_PATH = path.join(ROOT, 'data', 'cache', 'economic-calendar-cache.json');
const EN_PAGE = path.join(ROOT, 'economic-calendar', 'index.html');
const AR_PAGE = path.join(ROOT, 'ar', 'economic-calendar', 'index.html');

const STALE_THRESHOLD_HOURS = 25;
const failures = [];
const warnings = [];

// ── 1. Pages exist ────────────────────────────────────────────────────────────
if (!fs.existsSync(EN_PAGE)) failures.push('economic-calendar/index.html does not exist');
if (!fs.existsSync(AR_PAGE)) failures.push('ar/economic-calendar/index.html does not exist');

if (fs.existsSync(EN_PAGE)) {
  const en = fs.readFileSync(EN_PAGE, 'utf8');
  if (!/<link rel="canonical" href="https:\/\/www\.tradealphaai\.com\/economic-calendar\/"/.test(en))
    failures.push('EN page: missing canonical URL with www.');
  if (!/<meta property="og:locale" content="en_US"/.test(en))
    failures.push('EN page: missing og:locale');
  if (!/<link rel="alternate" hreflang="ar"/.test(en))
    failures.push('EN page: missing hreflang ar alternate');
  if (!/\/data\/economic-calendar\.json/.test(en))
    failures.push('EN page: does not reference /data/economic-calendar.json');
}

if (fs.existsSync(AR_PAGE)) {
  const ar = fs.readFileSync(AR_PAGE, 'utf8');
  if (!/<html[^>]+lang="ar"[^>]+dir="rtl"/.test(ar))
    failures.push('AR page: missing lang="ar" dir="rtl" on <html>');
  if (!/<link rel="canonical" href="https:\/\/www\.tradealphaai\.com\/ar\/economic-calendar\/"/.test(ar))
    failures.push('AR page: missing canonical URL with www.');
  if (!/<meta property="og:locale" content="ar_AR"/.test(ar))
    failures.push('AR page: missing og:locale ar_AR');
  if (!/<link rel="alternate" hreflang="en"/.test(ar))
    failures.push('AR page: missing hreflang en alternate');
}

// ── 2. Calendar data file ─────────────────────────────────────────────────────
if (!fs.existsSync(CALENDAR_PATH)) {
  failures.push('data/economic-calendar.json does not exist');
} else {
  let cal;
  try {
    cal = JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf8'));
  } catch (err) {
    failures.push(`data/economic-calendar.json is not valid JSON: ${err.message}`);
  }

  if (cal) {
    if (cal.version !== '2.0') warnings.push(`data/economic-calendar.json: expected version 2.0, found ${cal.version}`);

    if (!cal.updated_at) {
      warnings.push('data/economic-calendar.json: updated_at is null — calendar has never been fetched');
    } else {
      const ageHours = (Date.now() - Date.parse(cal.updated_at)) / 3600000;
      if (ageHours > STALE_THRESHOLD_HOURS) {
        warnings.push(`data/economic-calendar.json: data is ${Math.round(ageHours)}h old (threshold: ${STALE_THRESHOLD_HOURS}h) — run calendar:update --fetch --write`);
      } else {
        console.log(`[calendar] data/economic-calendar.json age: ${Math.round(ageHours * 10) / 10}h — OK`);
      }
    }

    if (!Array.isArray(cal.events)) {
      failures.push('data/economic-calendar.json: events must be an array');
    } else {
      console.log(`[calendar] ${cal.events.length} event(s) in calendar`);
      const highCount = cal.events.filter((e) => e.importance === 'high').length;
      const pending = cal.events.filter((e) => e.status === 'scheduled').length;
      console.log(`[calendar]   high-impact: ${highCount}, pending: ${pending}`);

      // Validate each event has required fields
      const badEvents = cal.events.filter((e) => !e.event_name || !e.event_time || !e.country || !e.importance);
      if (badEvents.length) {
        failures.push(`${badEvents.length} event(s) missing required fields (event_name, event_time, country, importance)`);
      }
    }
  }
}

// ── 3. Cache freshness ────────────────────────────────────────────────────────
if (fs.existsSync(CACHE_PATH)) {
  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    if (cache.fetched_at) {
      const cacheAgeHours = (Date.now() - Date.parse(cache.fetched_at)) / 3600000;
      console.log(`[calendar] cache age: ${Math.round(cacheAgeHours * 10) / 10}h`);
    }
  } catch {
    warnings.push('data/cache/economic-calendar-cache.json exists but is not valid JSON');
  }
} else {
  console.log('[calendar] no cache file yet (will be created on first --fetch run)');
}

// ── 4. Nav links ──────────────────────────────────────────────────────────────
const navPages = [
  ['index.html', '/economic-calendar/'],
  ['ar/index.html', '/ar/economic-calendar/']
];
for (const [relPath, href] of navPages) {
  const absPath = path.join(ROOT, relPath);
  if (fs.existsSync(absPath)) {
    const html = fs.readFileSync(absPath, 'utf8');
    if (!html.includes(`href="${href}"`)) {
      warnings.push(`${relPath}: nav does not contain link to ${href}`);
    }
  }
}

// ── 5. Sitemap ────────────────────────────────────────────────────────────────
const sitemapPath = path.join(ROOT, 'sitemap-core.xml');
if (fs.existsSync(sitemapPath)) {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  if (!sitemap.includes('/economic-calendar/')) warnings.push('sitemap-core.xml: missing /economic-calendar/ entry');
  if (!sitemap.includes('/ar/economic-calendar/')) warnings.push('sitemap-core.xml: missing /ar/economic-calendar/ entry');
}

// ── Report ────────────────────────────────────────────────────────────────────
if (warnings.length) {
  warnings.forEach((w) => console.warn(`[calendar] WARN: ${w}`));
}

if (failures.length) {
  failures.forEach((f) => console.error(`[calendar] FAIL: ${f}`));
  process.exit(1);
}

console.log('[calendar] check:economic-calendar passed.');
