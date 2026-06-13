'use strict';

// Phase 103 — check:economic-calendar-ui. Static safety gate for the public
// economic calendar intelligence surfacing in js/economic-calendar.js (+ css +
// pages). The rendering is client-side, so this validates the SOURCE for the
// required honest-degradation behaviours and the forbidden ones. HARD-FAILS if:
//   * the forecast merge could let a proxy fill the consensus forecast field
//   * the proxy is not styled/labelled distinctly from consensus
//   * there is no release-state badge system
//   * the "unavailable / awaiting consensus" fallback is missing
//   * release-state labels are not translated in BOTH locales
//   * confidence can be shown without source attribution
//   * retail TA / buy-sell / prediction language appears
//   * a raw null/undefined could be concatenated into the DOM (numVal guard)
//   * RTL handling for the new badges is missing

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JS = path.join(ROOT, 'js', 'economic-calendar.js');
const CSS = path.join(ROOT, 'css', 'economic-calendar.css');
const EN_PAGE = path.join(ROOT, 'economic-calendar', 'index.html');
const AR_PAGE = path.join(ROOT, 'ar', 'economic-calendar', 'index.html');

const failures = [];
const fail = (m) => failures.push(m);

if (!fs.existsSync(JS)) { fail('js/economic-calendar.js missing'); }
const js = fs.existsSync(JS) ? fs.readFileSync(JS, 'utf8') : '';
const css = fs.existsSync(CSS) ? fs.readFileSync(CSS, 'utf8') : '';

// 1. Artifact wiring present.
if (!/economic-intelligence\.json/.test(js)) fail('JS does not load the economic-intelligence artifact');
if (!/attachEconIntel|econ_intel/.test(js)) fail('JS does not merge econ intelligence onto events');

// 2. Forecast merge must gate the forecast field on PROVIDER quality only —
//    a proxy must never become the displayed consensus forecast.
const mergeOk = /providerForecast\s*=\s*ci\.forecast_quality\s*===\s*'provider_consensus'\s*\|\|\s*ci\.forecast_quality\s*===\s*'single_provider'/.test(js)
  && /\(e\.forecast === null \|\| e\.forecast === undefined\) && providerForecast/.test(js);
if (!mergeOk) fail('forecast merge does not gate the forecast field strictly on provider consensus (proxy could leak as consensus)');

// 3. Proxy styled/labelled distinctly from consensus.
if (!/ec-fc-proxy/.test(js) || !/ec-fc-proxy/.test(css)) fail('historical proxy lacks a distinct class (ec-fc-proxy) in JS/CSS');
if (!/ec-fc-consensus/.test(js)) fail('consensus lacks a distinct class (ec-fc-consensus)');
if (!/fcProxy/.test(js)) fail('JS does not reference the Historical Proxy label');

// 4. Release-state badge system present.
if (!/releaseStateBadgeHtml|ec-state-badge/.test(js)) fail('no release-state badge system in JS');
if (!/\.ec-state-badge\b/.test(css)) fail('no .ec-state-badge styling in CSS');

// 5. Unavailable / awaiting-consensus fallback present (no blank forecast).
if (!/fcUnavailable|awaitingConsensus/.test(js)) fail('no honest "awaiting consensus / unavailable" fallback for forecast');

// 5b. Phase 105 — macro reaction rendering must be present and gated on observed
// data (a reaction is shown only when has_reaction_data, else awaiting fallback).
if (!/macro_reaction|macro-reactions\.json/.test(js)) fail('JS does not surface macro reaction intelligence');
if (/macro_reaction/.test(js) && !/rx\.has_reaction_data && rx\.classification !== 'awaiting_data'/.test(js)) {
  fail('reaction rendering not gated on has_reaction_data (could show a fabricated reaction)');
}
if (/macro_reaction/.test(js) && !/reactionAwaiting/.test(js)) fail('no awaiting-reaction-data fallback');

// 6. Release-state labels translated in BOTH locales.
const stateKeys = ['stateScheduled', 'stateAwaiting', 'stateReleased', 'stateParsed', 'stateRevised', 'stateDelayed', 'stateArchived'];
const enBlock = (js.match(/en:\s*\{[\s\S]*?\n\s{4}\},/) || [''])[0];
const arBlock = (js.match(/ar:\s*\{[\s\S]*?\n\s{4}\}\s*\n\s*\};/) || [''])[0];
for (const k of stateKeys) {
  if (!new RegExp(k + '\\s*:').test(enBlock)) fail(`EN locale missing release-state label ${k}`);
  if (!new RegExp(k + '\\s*:').test(arBlock)) fail(`AR locale missing release-state label ${k}`);
}

// 7. Confidence shown only WITH source attribution.
if (/ci\.confidence/.test(js) && !/typeof ci\.confidence === 'number' && ci\.source/.test(js)) {
  fail('confidence may be shown without source attribution');
}

// 8. No retail TA / advice / prediction language in the rendered surface.
const TA = [/\bbuy now\b/i, /\bsell now\b/i, /\bstrong buy\b/i, /\bprice target\b/i, /\bbreakout\b/i, /\bgo long\b/i, /\bgo short\b/i, /\bRSI\b/, /\bMACD\b/, /\bto the moon\b/i, /\bguaranteed\b/i];
for (const re of TA) if (re.test(js)) fail(`retail TA / advice language in JS: ${re}`);

// 9. numVal guards null/undefined → no raw null reaches the DOM.
if (!/function numVal[\s\S]*?n === null \|\| n === undefined[\s\S]*?return '—'/.test(js)) {
  fail('numVal does not guard null/undefined (raw null could render)');
}

// 10. RTL handling for the new badges.
if (!/\[dir="rtl"\]\s*\.ec-state-badge/.test(css)) fail('no RTL handling for .ec-state-badge');

// 11. Pages still reference the calendar assets + are bilingual.
for (const [label, p] of [['EN', EN_PAGE], ['AR', AR_PAGE]]) {
  if (!fs.existsSync(p)) { fail(`${label} economic-calendar page missing`); continue; }
  const html = fs.readFileSync(p, 'utf8');
  if (!/\/js\/economic-calendar\.js/.test(html)) fail(`${label} page does not load economic-calendar.js`);
}
if (fs.existsSync(AR_PAGE) && !/<html[^>]+dir="rtl"/.test(fs.readFileSync(AR_PAGE, 'utf8'))) fail('AR page not RTL');

if (failures.length) {
  failures.forEach((f) => console.error(`[ec-ui] FAIL: ${f}`));
  process.exit(1);
}
console.log('[ec-ui] check:economic-calendar-ui passed (intelligence surfaced, proxy≠consensus, states translated, honest fallbacks, no TA language, RTL handled).');
