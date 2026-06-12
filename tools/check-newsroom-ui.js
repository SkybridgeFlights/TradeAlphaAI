'use strict';

// Phase 72 validation — newsroom UI integrity.
// Ensures both homepages carry exactly one newsroom module section, the
// newsroom stylesheet is linked, rendered output contains no leaked template
// values, the AR section is genuinely Arabic and RTL, and no fake realtime
// claims appear (the section must carry a verified data timestamp or an
// explicit awaiting-data note).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; }
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

for (const page of ['index.html', 'ar/index.html']) {
  const html = read(page);
  if (!html) { failures.push(`${page}: missing`); continue; }

  if (count(html, '<!-- generated:newsroom-modules:start -->') !== 1) failures.push(`${page}: newsroom start marker count != 1`);
  if (count(html, '<!-- generated:newsroom-modules:end -->') !== 1) failures.push(`${page}: newsroom end marker count != 1`);
  if (!html.includes('/css/newsroom.css')) failures.push(`${page}: newsroom.css not linked`);

  const section = html.split('<!-- generated:newsroom-modules:start -->')[1]?.split('<!-- generated:newsroom-modules:end -->')[0] || '';
  if (section.includes('id="newsroom-live"')) {
    if (count(html, 'id="newsroom-live"') !== 1) failures.push(`${page}: duplicate newsroom-live sections`);
    if (/undefined|NaN|\[object Object\]/.test(section)) failures.push(`${page}: leaked template value in newsroom section`);
    if (!/Data as of|البيانات حتى|Awaiting first data cycle|بانتظار دورة البيانات الأولى/.test(section)) {
      failures.push(`${page}: newsroom section missing verified timestamp / awaiting-data note`);
    }
    if (/\blive prices\b|\breal[- ]time quotes\b/i.test(section)) failures.push(`${page}: fake realtime claim detected`);

    // Phase 73 terminal checks: asset strip rendered once with unique symbols,
    // edition label present, desk modules present.
    if (count(section, 'nr-asset-strip') !== 1) failures.push(`${page}: asset strip count != 1`);
    const symbols = [...section.matchAll(/nr-asset-sym">([A-Z0-9]+)</g)].map((m) => m[1]);
    if (symbols.length && new Set(symbols).size !== symbols.length) failures.push(`${page}: duplicate asset symbols in strip`);
    if (!section.includes('nr-edition')) failures.push(`${page}: session edition label missing`);
    if (!section.includes('nr-hero-ribbon')) failures.push(`${page}: hero intelligence ribbon missing`);
    if (count(section, 'data-desk="risk"') !== 1 || count(section, 'data-desk="macro"') !== 1) {
      failures.push(`${page}: desk modules missing or duplicated`);
    }

    // Phase 74 cognition checks: alerts/memory/timeline desks rendered exactly
    // once, continuity indicator present, and no alert badge without the
    // cognition artifact actually carrying alerts.
    for (const desk of ['alerts', 'memory', 'timeline', 'conviction', 'scenarios']) {
      if (count(section, `data-desk="${desk}"`) !== 1) failures.push(`${page}: cognition desk "${desk}" missing or duplicated`);
    }
    // Phase 75: contradiction markers and conviction content require the macro
    // cognition artifact to actually carry them (no decorative intelligence).
    if (section.includes('data-contradiction=') || section.includes('data-escalated="true"')) {
      let macro = null;
      try { macro = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/intelligence/macro-cognition.json'), 'utf8')); } catch {}
      const active = ((macro && macro.contradictions) || []).filter((c) => c.active_today);
      if (!active.length) failures.push(`${page}: rendered contradictions without macro-cognition source`);
    }
    if (!section.includes('nr-continuity')) failures.push(`${page}: continuity indicator missing`);
    if (count(section, 'class="nr-lead"') !== 1) failures.push(`${page}: desk lead block missing or duplicated`);
    if (!section.includes('nr-lead-headline')) failures.push(`${page}: desk lead headline missing`);
    if (section.includes('data-severity=')) {
      let cognition = null;
      try { cognition = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/intelligence/market-cognition.json'), 'utf8')); } catch {}
      if (!cognition || !(cognition.alerts || []).length) failures.push(`${page}: rendered alerts without cognition alert source`);
    }
    if (page === 'ar/index.html') {
      if (!section.includes('dir="rtl"')) failures.push('ar/index.html: newsroom section missing dir="rtl"');
      if (!/[؀-ۿ]/.test(section)) failures.push('ar/index.html: newsroom section contains no Arabic text');
    }
  }
}

if (!fs.existsSync(path.join(ROOT, 'css', 'newsroom.css'))) failures.push('css/newsroom.css missing');

if (failures.length) {
  failures.forEach((f) => console.error(`[newsroom-ui] FAIL: ${f}`));
  process.exit(1);
}
console.log('[newsroom-ui] check:newsroom-ui passed.');
