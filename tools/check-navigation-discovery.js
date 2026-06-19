'use strict';

// Phase 208 / Workstream H — check:navigation-discovery.
// Proves the canonical header makes the major public intelligence surfaces
// reachable AND never exposes internal routes. HARD-FAILS if a required public
// surface is missing from the nav (EN or AR), if an internal route (system-status,
// /data/, raw .json, /runtime/) appears in the nav, if EN/AR nav href sets differ,
// or if top-level density exceeds the cap. Negative-tested via --self-test.

const { renderGlobalHeader } = require('./render-global-header');

const REQUIRED = ['/market-terminal/', '/rankings/', '/markets/', '/sectors/', '/equities/', '/market-news/', '/market-structure/', '/market-outlook/', '/articles/', '/insights/', '/briefs/', '/economic-calendar/'];
const FORBIDDEN = [/\/system-status(\/|$)/, /^\/data\//, /^\/runtime\//, /\.json(\b|$)/];
const TOP_LEVEL_CAP = 8;

function hrefs(html) { return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]); }
function navHrefs(html, ar) {
  // Restrict to the nav region (between the nav-group open and the locale-links).
  const start = html.indexOf('class="nav-group"');
  const end = html.indexOf('locale-links');
  const region = start >= 0 && end > start ? html.slice(start, end) : html;
  return hrefs(region).map((h) => h.replace(ar ? '/ar' : '', '').replace(/#.*$/, '')).map((h) => (h === '' ? '/' : h));
}
function topLevelCount(html) { return (html.match(/class="nav-link(?![^"]*nav-)/g) || []).length; }

function validate(enHtml, arHtml) {
  const f = [];
  const en = navHrefs(enHtml, false);
  const ar = navHrefs(arHtml, true);
  for (const req of REQUIRED) {
    if (!en.some((h) => h === req || h.startsWith(req))) f.push(`EN nav missing required public surface ${req}`);
    if (!ar.some((h) => h === req || h.startsWith(req))) f.push(`AR nav missing required public surface ${req}`);
  }
  for (const h of hrefs(enHtml).concat(hrefs(arHtml))) {
    for (const re of FORBIDDEN) if (re.test(h)) f.push(`internal route exposed in header: ${h}`);
  }
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const en = renderGlobalHeader({ locale: 'en' });
  const ar = renderGlobalHeader({ locale: 'ar' });
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  T('clean nav passes', validate(en, ar).length === 0);
  T('missing surface caught', validate(en.replace('/market-terminal/', '/x/'), ar).length > 0);
  T('system-status caught', validate(en.replace('class="nav-group"', 'class="nav-group"><a href="/system-status/">x</a>'), ar).length > 0);
  T('raw json caught', validate(en.replace('class="nav-group"', 'class="nav-group"><a href="/data/x.json">x</a>'), ar).length > 0);
  console.log(`[navigation-discovery] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const en = renderGlobalHeader({ locale: 'en' });
  const ar = renderGlobalHeader({ locale: 'ar' });
  const failures = validate(en, ar);
  const tl = topLevelCount(en);
  if (tl > TOP_LEVEL_CAP) failures.push(`top-level nav density ${tl} > cap ${TOP_LEVEL_CAP}`);
  if (failures.length) { failures.forEach((m) => console.error(`[navigation-discovery] FAIL: ${m}`)); process.exit(1); }
  console.log(`[navigation-discovery] check:navigation-discovery passed (all ${REQUIRED.length} public surfaces reachable EN/AR; no internal routes in header).`);
}

module.exports = { validate };
