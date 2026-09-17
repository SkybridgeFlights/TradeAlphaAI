'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const failures = [];
for (const [rel, prefix] of [['index.html', '/'], ['ar/index.html', '/ar/']]) {
  const h = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const count = (h.match(/id="product-discovery"/g) || []).length;
  if (count !== 1) failures.push(`${rel}: expected one product discovery section, got ${count}`);
  if (!h.includes('class="product-discovery-grid"')) failures.push(`${rel}: discovery grid missing`);
  if (!h.includes('href="#systems"')) failures.push(`${rel}: trading products shortcut missing`);
  if (!h.includes(`href="${prefix}market-terminal/"`)) failures.push(`${rel}: terminal shortcut missing`);
  if (!h.includes(`href="${prefix}etfs/"`)) failures.push(`${rel}: ETF shortcut missing`);
  const discovery = h.match(/<section class="section section-tight product-discovery"[\s\S]*?<\/section>/)?.[0] || '';
  if ((discovery.match(/product-discovery-card(?: |")/g) || []).length !== 3) failures.push(`${rel}: expected three discovery cards`);
}
if (failures.length) { failures.forEach(x => console.error(`[phase231-step2] FAIL: ${x}`)); process.exit(1); }
console.log('[phase231-step2] homepage product discovery checks passed (EN+AR, 3 routes each).');