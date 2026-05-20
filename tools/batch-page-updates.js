'use strict';
/* tools/batch-page-updates.js
   Run: node tools/batch-page-updates.js
   Does two things:
     1. Fixes HTML-escaped JSON-LD blocks on all affected pages.
     2. Injects the Related Content Engine section + script tag on every
        stock, ETF, hub, insight, and screener page.
*/
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ---- Pages with HTML-escaped JSON-LD bug ---- */
const BUG_PAGES = [
  'dividend-etfs.html', 'growth-stocks.html', 'semiconductor-stocks.html',
  'etfs/schd.html', 'etfs/soxx.html', 'etfs/iwm.html', 'etfs/xlk.html',
  'etfs/gld.html',  'etfs/tlt.html',  'etfs/voo.html', 'etfs/qqq.html', 'etfs/vti.html',
  'stocks/pltr.html', 'stocks/smci.html', 'stocks/amd.html',  'stocks/avgo.html',
  'stocks/googl.html','stocks/meta.html', 'stocks/amzn.html', 'stocks/msft.html',
  'stocks/tsla.html', 'stocks/aapl.html'
];

/* ---- RC injection targets: [relPath, data-rc key, script src prefix] ---- */
const RC_PAGES = [
  /* Stock pages */
  ['stocks/nvda.html',  'nvda',             '../'],
  ['stocks/amd.html',   'amd',              '../'],
  ['stocks/msft.html',  'msft',             '../'],
  ['stocks/amzn.html',  'amzn',             '../'],
  ['stocks/googl.html', 'googl',            '../'],
  ['stocks/meta.html',  'meta',             '../'],
  ['stocks/avgo.html',  'avgo',             '../'],
  ['stocks/smci.html',  'smci',             '../'],
  ['stocks/pltr.html',  'pltr',             '../'],
  ['stocks/aapl.html',  'aapl',             '../'],
  ['stocks/tsla.html',  'tsla',             '../'],
  /* ETF pages */
  ['etfs/spy.html',     'spy',              '../'],
  ['etfs/qqq.html',     'qqq',              '../'],
  ['etfs/soxx.html',    'soxx',             '../'],
  ['etfs/xlk.html',     'xlk',              '../'],
  ['etfs/vti.html',     'vti',              '../'],
  ['etfs/voo.html',     'voo',              '../'],
  ['etfs/gld.html',     'gld',              '../'],
  ['etfs/tlt.html',     'tlt',              '../'],
  ['etfs/schd.html',    'schd',             '../'],
  ['etfs/iwm.html',     'iwm',              '../'],
  /* Hub pages */
  ['ai-stocks.html',            'hub-ai-stocks',     './'],
  ['semiconductor-stocks.html', 'hub-semiconductor', './'],
  ['growth-stocks.html',        'hub-growth',        './'],
  ['dividend-etfs.html',        'hub-dividends',     './'],
  /* Insights articles */
  ['insights/ai-infrastructure-demand.html',  'ins-ai-infra',   '../'],
  ['insights/spy-vs-qqq-explained.html',      'ins-spy-qqq',    '../'],
  ['insights/semiconductor-cycle-risks.html', 'ins-semi-cycle', '../'],
];

/* ---- Helpers ---- */
function read(rel) {
  const fp = path.join(ROOT, rel);
  return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
}

function write(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
}

/* ---- Fix HTML-escaped JSON-LD ---- */
function decodeJsonLd(html) {
  return html.replace(
    /&lt;script type=&quot;application\/ld\+json&quot;&gt;([\s\S]*?)&lt;\/script&gt;/g,
    function (_, inner) {
      const decoded = inner
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g,   '<')
        .replace(/&gt;/g,   '>')
        .replace(/&amp;/g,  '&')
        .replace(/&#39;/g,  "'");
      return '<script type="application/ld+json">' + decoded + '</script>';
    }
  );
}

/* ---- Inject RC section + script tag ---- */
function injectRc(html, rcKey, scriptPfx) {
  if (html.includes('data-rc=')) return null; /* already injected */

  const section = [
    '',
    '      <!-- RELATED CONTENT ENGINE -->',
    '      <section class="market-section">',
    '        <div class="market-panel">',
    '          <span class="eyebrow">Related Research</span>',
    '          <h2>Explore connected market research</h2>',
    '          <div data-rc="' + rcKey + '"></div>',
    '        </div>',
    '      </section>',
  ].join('\n');

  const scriptLine = '  <script src="' + scriptPfx + 'js/related-content.js"></script>';

  /* Insert section before the closing .wrap + </main> tags */
  const WRAP_END = '\n    </div>\n  </main>';
  const idx = html.lastIndexOf(WRAP_END);
  if (idx === -1) {
    console.warn('  WARN: wrap-end marker not found in', rcKey, '— skipping');
    return null;
  }

  html = html.slice(0, idx) + section + html.slice(idx);

  /* Add script before </body> */
  if (!html.includes(scriptLine)) {
    html = html.replace('\n</body>', '\n' + scriptLine + '\n</body>');
  }

  return html;
}

/* ============================================================
   PASS 1 — Fix JSON-LD encoding
============================================================ */
console.log('=== PASS 1: Fix HTML-escaped JSON-LD ===\n');
let fixCount = 0;
for (const rel of BUG_PAGES) {
  const orig = read(rel);
  if (!orig) { console.log('  NOT FOUND:', rel); continue; }
  const fixed = decodeJsonLd(orig);
  if (fixed !== orig) {
    write(rel, fixed);
    console.log('  FIXED:', rel);
    fixCount++;
  } else {
    console.log('  clean :', rel);
  }
}
console.log('\n  JSON-LD fix: ' + fixCount + ' file(s) updated.\n');

/* ============================================================
   PASS 2 — Inject Related Content Engine
============================================================ */
console.log('=== PASS 2: Inject Related Content sections ===\n');
let injectCount = 0, skipCount = 0;
for (const [rel, rcKey, pfx] of RC_PAGES) {
  const orig = read(rel);
  if (!orig) { console.log('  NOT FOUND:', rel); continue; }
  const updated = injectRc(orig, rcKey, pfx);
  if (updated === null) {
    console.log('  skip  (' + rcKey + '):', rel);
    skipCount++;
  } else {
    write(rel, updated);
    console.log('  inject(' + rcKey + '):', rel);
    injectCount++;
  }
}
console.log('\n  RC inject: ' + injectCount + ' file(s) updated, ' + skipCount + ' already present.\n');

console.log('Done.');
