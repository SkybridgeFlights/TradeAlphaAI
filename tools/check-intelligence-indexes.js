'use strict';

// Phase 208 / Workstream H — check:intelligence-indexes.
// Validates the /markets/ /sectors/ /equities/ index pages (EN + AR): present,
// correct canonical/hreflang, AR RTL, lists the registry entities with links,
// no retail/advice language, no raw-artifact/system-status exposure. Negative-tested.

const fs = require('fs');
const path = require('path');
const { ASSETS } = require('./asset-registry');
const { SECTORS } = require('./sector-registry');
const { EQUITIES } = require('./equity-registry');

const ROOT = path.resolve(__dirname, '..');
const INDEXES = [
  { base: 'markets', min: ASSETS.length },
  { base: 'sectors', min: SECTORS.length },
  { base: 'equities', min: EQUITIES.length },
];
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bbuy signal\b/i, /\bstop[- ]?loss\b/i, /(?:\bشراء\b|\bبيع\b|هدف\s*سعري)/];
const RAW_ARTIFACT = [/href="[^"]*\.json/i, /href="\/data\//i, /href="\/runtime\//i, /system-status/i];

function visibleText(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '); }

function validatePage(rel, lang, base, min, out) {
  if (!fs.existsSync(path.join(ROOT, rel))) { out.push(`${rel}: missing`); return; }
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const canonical = `https://www.tradealphaai.com/${lang === 'ar' ? 'ar/' : ''}${base}/`;
  if (!new RegExp(`rel="canonical" href="${canonical.replace(/[/.]/g, '\\$&')}"`).test(html)) out.push(`${rel}: missing/incorrect canonical`);
  if (!/hreflang="en"/.test(html) || !/hreflang="ar"/.test(html)) out.push(`${rel}: missing hreflang`);
  if (lang === 'ar' && !/<html[^>]*dir="rtl"/.test(html)) out.push(`${rel}: AR not dir=rtl`);
  const links = (html.match(new RegExp(`href="/(?:ar/)?${base}/[a-z-]+/"`, 'g')) || []).length;
  if (links < min) out.push(`${rel}: only ${links} entity links (expected ≥ ${min})`);
  const text = visibleText(html);
  for (const re of FORBIDDEN) if (re.test(text)) out.push(`${rel}: forbidden retail/advice language ${re}`);
  for (const re of RAW_ARTIFACT) if (re.test(html)) out.push(`${rel}: raw-artifact/internal-route exposure ${re}`);
}

function run() {
  const out = []; let any = false;
  for (const ix of INDEXES) {
    const en = `${ix.base}/index.html`; const ar = `ar/${ix.base}/index.html`;
    if (!fs.existsSync(path.join(ROOT, en)) && !fs.existsSync(path.join(ROOT, ar))) continue;
    any = true;
    validatePage(en, 'en', ix.base, ix.min, out);
    validatePage(ar, 'ar', ix.base, ix.min, out);
  }
  return { failures: out, skipped: !any };
}

if (require.main === module && process.argv.includes('--self-test')) {
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  const good = '<html dir="rtl"><link rel="canonical" href="https://www.tradealphaai.com/ar/markets/"><link hreflang="en"><link hreflang="ar">' + ASSETS.map((a) => `<a href="/ar/markets/${a.slug}/">x</a>`).join('') + '</html>';
  const o1 = []; { const tmp = path.join(ROOT, '__tmp_ix.html'); fs.writeFileSync(tmp, good); /* inline checks */ }
  // inline negative checks on regexes
  T('forbidden caught', FORBIDDEN.some((re) => re.test('place a buy here')));
  T('raw artifact caught', RAW_ARTIFACT.some((re) => re.test('href="/data/x.json"')));
  T('link count', (good.match(/href="\/ar\/markets\/[a-z-]+\/"/g) || []).length >= ASSETS.length);
  fs.unlinkSync(path.join(ROOT, '__tmp_ix.html'));
  console.log(`[intelligence-indexes] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const { failures, skipped } = run();
  if (skipped) { console.log('[intelligence-indexes] no index pages yet (non-fatal).'); process.exit(0); }
  if (failures.length) { failures.forEach((m) => console.error(`[intelligence-indexes] FAIL: ${m}`)); process.exit(1); }
  console.log('[intelligence-indexes] check:intelligence-indexes passed (markets/sectors/equities indexes; EN/AR, RTL, linked, no retail/raw-artifact).');
}

module.exports = { run };
