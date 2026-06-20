'use strict';

// Phase 216 CP11 — Changes Hub validators.
// Subcommands (selected with --check):
//   --check=events          check:change-events
//   --check=classifications check:change-classifications
//   --check=hub             check:changes-hub
//   --check=history         check:changes-history
//   --check=discovery       check:changes-discovery
// Self-tests with --self-test.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);

const ALLOWED_CLASSES = new Set(['improving', 'weakening', 'stable', 'deteriorating', 'leadership_gain', 'leadership_loss', 'confirmation_gain', 'confirmation_loss', 'regime_shift', 'narrative_shift']);
const ALLOWED_ENTITY_TYPES = new Set(['asset', 'sector', 'equity', 'etf', 'regime', 'narrative']);
const ALLOWED_CONFIDENCE = new Set(['high', 'moderate', 'low']);
const FORBIDDEN_LANG = [
  /\bplaceholder\b/i, /\btbd\b/i, /\blorem\b/i,
  /\bbuy\b/i, /\bsell\b/i, /\bguaranteed\b/i,
  /\bwill (rise|fall|rally|crash)\b/i,
  /\bprice target\b/i, /\bwill reach\b/i,
];

function readJson(p, f = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; }
}

function failFor(name, fails) {
  if (fails.length) {
    fails.forEach((f) => console.error(`[${name}] FAIL: ${f}`));
    return false;
  }
  console.log(`[${name}] OK`);
  return true;
}

// ─── check:change-events ───────────────────────────────────────────────────
function checkEvents(events) {
  const fails = [];
  if (!events) return ['change-events artifact missing'];
  if (events.source_layer !== 'change-events') fails.push('source_layer mismatch');
  if (!Array.isArray(events.events)) return ['events array missing'];
  const ids = new Set();
  for (const ev of events.events) {
    const id = ev && ev.id || '?';
    if (!ev.id || ids.has(ev.id)) fails.push(`${id}: missing or duplicate id`);
    ids.add(ev.id);
    if (!ev.entity || !ev.entity_type) fails.push(`${id}: missing entity / entity_type`);
    if (!ALLOWED_ENTITY_TYPES.has(ev.entity_type)) fails.push(`${id}: entity_type ${ev.entity_type} not allowed`);
    if (!ALLOWED_CLASSES.has(ev.change_type)) fails.push(`${id}: change_type ${ev.change_type} not allowed`);
    if (ev.confidence && !ALLOWED_CONFIDENCE.has(ev.confidence)) fails.push(`${id}: confidence ${ev.confidence} not allowed`);
    if (!Array.isArray(ev.evidence) || ev.evidence.length === 0) fails.push(`${id}: missing evidence`);
    if (!ev.source) fails.push(`${id}: missing source`);
    // Anti-fabrication: timestamp when present must parse, and source must
    // reference a known artifact prefix (no anonymous fabrication).
    if (ev.timestamp && Number.isNaN(Date.parse(ev.timestamp))) fails.push(`${id}: invalid timestamp ${ev.timestamp}`);
    const knownSources = /^(asset|sector|equity|etf)-history(\(.+\))?$|^leadership-dashboard(\(.+\))?$|^regime-history$|^regime-transitions$|^market-narrative$|^regime-history-timeline$/;
    if (!knownSources.test(ev.source)) fails.push(`${id}: unknown source ${ev.source}`);
  }
  // Counts honesty.
  if (events.counts && typeof events.counts === 'object') {
    for (const k of Object.keys(events.counts)) {
      if (!ALLOWED_CLASSES.has(k)) fails.push(`unknown counts key ${k}`);
      const real = events.events.filter((e) => e.change_type === k).length;
      if (events.counts[k] !== real) fails.push(`counts mismatch for ${k}: ${events.counts[k]} != ${real}`);
    }
  }
  const txt = JSON.stringify(events);
  if (/\bundefined\b|\bNaN\b/.test(txt)) fails.push('artifact leaks undefined/NaN');
  for (const re of FORBIDDEN_LANG) if (re.test(txt)) fails.push(`forbidden language ${re}`);
  return fails;
}

// ─── check:change-classifications ──────────────────────────────────────────
function checkClassifications(cls, events) {
  const fails = [];
  if (!cls) return ['classifications artifact missing'];
  if (cls.source_layer !== 'change-classifications') fails.push('source_layer mismatch');
  if (!cls.classes || typeof cls.classes !== 'object') return ['classes missing'];
  for (const k of Object.keys(cls.classes)) {
    if (!ALLOWED_CLASSES.has(k)) fails.push(`unknown class key ${k}`);
    for (const entry of cls.classes[k]) {
      if (!entry.entity || !entry.entity_type) fails.push(`${k}/${entry.entity || '?'}: missing entity / entity_type`);
      if (!ALLOWED_ENTITY_TYPES.has(entry.entity_type)) fails.push(`${k}/${entry.entity}: entity_type not allowed`);
      if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) fails.push(`${k}/${entry.entity}: missing evidence`);
      // Anti-fabrication: each classification entry must point back to a real event id.
      if (events && Array.isArray(events.events) && entry.event_id && !events.events.some((e) => e.id === entry.event_id)) {
        fails.push(`${k}/${entry.entity}: event_id ${entry.event_id} not found in events`);
      }
    }
  }
  // Allowed-classes list parity.
  if (!Array.isArray(cls.allowed_classes) || cls.allowed_classes.length !== ALLOWED_CLASSES.size) fails.push('allowed_classes drift from validator set');
  for (const a of cls.allowed_classes || []) if (!ALLOWED_CLASSES.has(a)) fails.push(`allowed_classes contains unknown ${a}`);
  return fails;
}

// ─── check:changes-hub ─────────────────────────────────────────────────────
function checkHub() {
  const fails = [];
  const required = ['changes-summary', 'changes-significant', 'changes-latest', 'changes-paths', 'changes-disclaimer'];
  for (const [loc, p] of [['EN', path.join(ROOT, 'changes/index.html')], ['AR', path.join(ROOT, 'ar/changes/index.html')]]) {
    if (!fs.existsSync(p)) { fails.push(`${loc}: hub page missing`); continue; }
    const html = fs.readFileSync(p, 'utf8');
    for (const sec of required) if (!html.includes('id="' + sec + '"')) fails.push(`${loc}: missing ${sec}`);
    if (!html.includes('rel="canonical"')) fails.push(`${loc}: missing canonical`);
    if (loc === 'AR' && !html.includes('dir="rtl"')) fails.push('AR: missing dir=rtl');
    if (/\bundefined\b|\bNaN\b/.test(html)) fails.push(`${loc}: leaks undefined/NaN`);
    if (html.includes('data/intelligence/') && html.includes('.json')) fails.push(`${loc}: leaks raw artifact url`);
    for (const re of FORBIDDEN_LANG) if (re.test(html)) fails.push(`${loc}: forbidden language ${re}`);
  }
  // Category pages exist and have shared id.
  for (const cat of ['assets', 'sectors', 'equities', 'etfs']) {
    for (const [loc, p] of [['EN', path.join(ROOT, 'changes/' + cat + '/index.html')], ['AR', path.join(ROOT, 'ar/changes/' + cat + '/index.html')]]) {
      if (!fs.existsSync(p)) { fails.push(`${loc}/${cat}: page missing`); continue; }
      const html = fs.readFileSync(p, 'utf8');
      if (!html.includes('id="changes-category"')) fails.push(`${loc}/${cat}: missing changes-category section`);
      if (loc === 'AR' && !html.includes('dir="rtl"')) fails.push(`AR/${cat}: missing dir=rtl`);
    }
  }
  // Regime page exists with required sections.
  for (const [loc, p] of [['EN', path.join(ROOT, 'changes/regime/index.html')], ['AR', path.join(ROOT, 'ar/changes/regime/index.html')]]) {
    if (!fs.existsSync(p)) { fails.push(`${loc}/regime: page missing`); continue; }
    const html = fs.readFileSync(p, 'utf8');
    if (!html.includes('id="changes-regime-current"')) fails.push(`${loc}/regime: missing current section`);
    if (!html.includes('id="changes-regime-transitions"')) fails.push(`${loc}/regime: missing transitions section`);
  }
  // EN/AR section parity for hub.
  if (fs.existsSync(path.join(ROOT, 'changes/index.html')) && fs.existsSync(path.join(ROOT, 'ar/changes/index.html'))) {
    const en = (fs.readFileSync(path.join(ROOT, 'changes/index.html'), 'utf8').match(/id="changes-[a-z-]+"/g) || []).sort();
    const ar = (fs.readFileSync(path.join(ROOT, 'ar/changes/index.html'), 'utf8').match(/id="changes-[a-z-]+"/g) || []).sort();
    if (JSON.stringify(en) !== JSON.stringify(ar)) fails.push('EN/AR section parity broken on hub');
  }
  return fails;
}

// ─── check:changes-history ─────────────────────────────────────────────────
function checkHistory(timeline) {
  const fails = [];
  if (!timeline) return ['change-timeline artifact missing'];
  if (timeline.source_layer !== 'change-timeline') fails.push('source_layer mismatch');
  if (!Array.isArray(timeline.entries)) return ['entries missing'];
  if (timeline.entries.length > (timeline.cap || 200)) fails.push('entries exceed cap');
  for (const e of timeline.entries) {
    if (!e.id || !e.entity_type || !e.change_type) fails.push(`${e.id || '?'}: missing required field`);
    if (!ALLOWED_CLASSES.has(e.change_type)) fails.push(`${e.id}: change_type not allowed`);
    if (!ALLOWED_ENTITY_TYPES.has(e.entity_type)) fails.push(`${e.id}: entity_type not allowed`);
    if (e.timestamp && Number.isNaN(Date.parse(e.timestamp))) fails.push(`${e.id}: invalid timestamp`);
  }
  // history pages exist.
  for (const [loc, p] of [['EN', path.join(ROOT, 'changes/history/index.html')], ['AR', path.join(ROOT, 'ar/changes/history/index.html')]]) {
    if (!fs.existsSync(p)) { fails.push(`${loc}/history: page missing`); continue; }
    const html = fs.readFileSync(p, 'utf8');
    if (!html.includes('id="changes-timeline-stream"')) fails.push(`${loc}/history: missing timeline-stream section`);
    if (loc === 'AR' && !html.includes('dir="rtl"')) fails.push('AR/history: missing dir=rtl');
    for (const re of FORBIDDEN_LANG) if (re.test(html)) fails.push(`${loc}/history: forbidden language ${re}`);
  }
  return fails;
}

// ─── check:changes-discovery ───────────────────────────────────────────────
function checkDiscovery() {
  const fails = [];
  // The 7 EN + 7 AR URLs must exist as files.
  const surfaces = [
    'changes/index.html', 'changes/assets/index.html', 'changes/sectors/index.html', 'changes/equities/index.html',
    'changes/etfs/index.html', 'changes/regime/index.html', 'changes/history/index.html',
    'ar/changes/index.html', 'ar/changes/assets/index.html', 'ar/changes/sectors/index.html', 'ar/changes/equities/index.html',
    'ar/changes/etfs/index.html', 'ar/changes/regime/index.html', 'ar/changes/history/index.html',
  ];
  for (const s of surfaces) {
    if (!fs.existsSync(path.join(ROOT, s))) fails.push(`missing surface ${s}`);
  }
  // Sitemap coverage.
  const sitemap = (() => { try { return fs.readFileSync(path.join(ROOT, 'sitemap-core.xml'), 'utf8'); } catch { return ''; } })();
  const sitemapAr = (() => { try { return fs.readFileSync(path.join(ROOT, 'sitemap-ar.xml'), 'utf8'); } catch { return ''; } })();
  const enCount = (sitemap.match(/\/changes\/[a-z]*\/?</g) || []).length;
  const arCount = (sitemapAr.match(/\/ar\/changes\/[a-z]*\/?</g) || []).length;
  if (enCount < 7) fails.push(`sitemap-core missing changes URLs (have ${enCount}, need 7)`);
  if (arCount < 7) fails.push(`sitemap-ar missing changes URLs (have ${arCount}, need 7)`);
  // Nav coverage — every cloned-header surface should advertise the hub link.
  const hubLinkRe = /href="\/changes\/"/;
  const hubLinkArRe = /href="\/ar\/changes\/"/;
  for (const surface of ['research/index.html', 'etfs/coverage/index.html', 'market-terminal/index.html', 'changes/index.html']) {
    const p = path.join(ROOT, surface);
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, 'utf8');
    if (!hubLinkRe.test(html)) fails.push(`${surface}: nav missing Changes Hub link`);
  }
  for (const surface of ['ar/research/index.html', 'ar/etfs/coverage/index.html', 'ar/market-terminal/index.html', 'ar/changes/index.html']) {
    const p = path.join(ROOT, surface);
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, 'utf8');
    if (!hubLinkArRe.test(html)) fails.push(`${surface}: nav missing Changes Hub AR link`);
  }
  return fails;
}

function main() {
  const args = new Set(process.argv.slice(2));
  let check = null;
  for (const a of args) { const m = /^--check=(.+)$/.exec(a); if (m) check = m[1]; }
  if (!check) { console.error('usage: node tools/check-changes.js --check=<name>'); process.exit(2); }
  const events = readJson(J('change-events.json'));
  const cls = readJson(J('change-classifications.json'));
  const timeline = readJson(J('change-timeline.json'));
  let fails; let name;
  if (check === 'events') { name = 'check:change-events'; fails = checkEvents(events); }
  else if (check === 'classifications') { name = 'check:change-classifications'; fails = checkClassifications(cls, events); }
  else if (check === 'hub') { name = 'check:changes-hub'; fails = checkHub(); }
  else if (check === 'history') { name = 'check:changes-history'; fails = checkHistory(timeline); }
  else if (check === 'discovery') { name = 'check:changes-discovery'; fails = checkDiscovery(); }
  else { console.error(`unknown check ${check}`); process.exit(2); }
  if (!failFor(name, fails)) process.exit(1);
}

function selfTest() {
  const events = readJson(J('change-events.json'), { events: [], counts: {} });
  const cls = readJson(J('change-classifications.json'), { classes: {}, allowed_classes: [] });
  const timeline = readJson(J('change-timeline.json'), { entries: [] });
  const cases = [
    ['events clean', () => checkEvents(events).length === 0, true],
    ['events bad change_type', () => { const m = JSON.parse(JSON.stringify(events)); if (m.events[0]) m.events[0].change_type = 'forecast'; return checkEvents(m).length > 0; }, true],
    ['events bad entity_type', () => { const m = JSON.parse(JSON.stringify(events)); if (m.events[0]) m.events[0].entity_type = 'currency'; return checkEvents(m).length > 0; }, true],
    ['events missing evidence', () => { const m = JSON.parse(JSON.stringify(events)); if (m.events[0]) m.events[0].evidence = []; return checkEvents(m).length > 0; }, true],
    ['events unknown source', () => { const m = JSON.parse(JSON.stringify(events)); if (m.events[0]) m.events[0].source = 'made-up'; return checkEvents(m).length > 0; }, true],
    ['classifications clean', () => checkClassifications(cls, events).length === 0, true],
    ['classifications fake event id', () => { const m = JSON.parse(JSON.stringify(cls)); const k = Object.keys(m.classes).find((k) => m.classes[k].length); if (k) m.classes[k][0].event_id = 'fake0000000000'; return checkClassifications(m, events).length > 0; }, true],
    ['hub clean', () => checkHub().length === 0, true],
    ['history clean', () => checkHistory(timeline).length === 0, true],
    ['discovery clean', () => checkDiscovery().length === 0, true],
  ];
  let ok = 0;
  for (const [name, fn, expect] of cases) {
    const r = fn();
    if (r === expect) ok += 1; else console.error('  fail:', name);
  }
  console.log(`[changes] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main();
}

module.exports = { checkEvents, checkClassifications, checkHub, checkHistory, checkDiscovery, ALLOWED_CLASSES, ALLOWED_ENTITY_TYPES };
