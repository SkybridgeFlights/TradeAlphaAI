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
