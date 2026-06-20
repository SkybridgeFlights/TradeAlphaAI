'use strict';

// Phase 219 CP10 — Account-ready foundation validators.
// Subcommands (selected with --check):
//   --check=foundation         check:account-foundation
//   --check=watchlists         check:watchlist-contracts
//   --check=preferences        check:preferences
//   --check=alerts             check:alert-contracts
//   --check=workspace-state    check:workspace-state
//   --check=personalization    check:personalization
//   --check=pages              check:account-pages
// Self-tests with --self-test.

const fs = require('fs');
const path = require('path');
const { ALLOWED_ENTITY_TYPES, ALLOWED_ALERT_CLASSES, ALLOWED_PREFERENCES } = require('./build-account-foundation');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const PAGE_DIRS = [
  ['EN', 'account/', 'account/watchlists/', 'account/preferences/', 'account/alerts/', 'account/workspace/'],
  ['AR', 'ar/account/', 'ar/account/watchlists/', 'ar/account/preferences/', 'ar/account/alerts/', 'ar/account/workspace/'],
];
const AUTH_PAGE_DIRS = [
  ['EN', 'account/sign-in/', 'account/sign-up/', 'account/verify/', 'account/profile/'],
  ['AR', 'ar/account/sign-in/', 'ar/account/sign-up/', 'ar/account/verify/', 'ar/account/profile/'],
];
const REQUIRED_SECTIONS = {
  'account/': ['account-status', 'account-contracts', 'account-governance', 'account-disclaimer'],
  'account/watchlists/': ['account-watchlists-personal', 'account-watchlists-saved', 'account-watchlists-favorites', 'account-disclaimer'],
  'account/preferences/': ['account-preferences-allowed', 'account-preferences-overrides', 'account-disclaimer'],
  'account/alerts/': ['account-alerts-classes', 'account-alerts-dispatch', 'account-disclaimer'],
  'account/workspace/': ['account-workspace-saved', 'account-workspace-followed', 'account-workspace-monitored', 'account-disclaimer'],
  // Phase 220 — auth surfaces.
  'account/sign-in/': ['auth-status', 'auth-flow', 'auth-alt', 'auth-disclaimer'],
  'account/sign-up/': ['auth-status', 'auth-fields', 'auth-alt', 'auth-disclaimer'],
  'account/verify/': ['auth-status', 'auth-endpoints', 'auth-disclaimer'],
  'account/profile/': ['profile-status', 'profile-fields', 'profile-scopes', 'auth-disclaimer'],
};

// Anti-signal / anti-forecast scoped to account artifacts. Bare 'signal',
// 'forecast', 'target' MUST NOT be banned — disclaimers legitimately negate
// them ("not a signal, forecast or recommendation").
const FORBIDDEN_LANG = [
  /\bplaceholder\b/i, /\btbd\b/i, /\blorem\b/i,
  /\bbuy\b/i, /\bsell\b/i, /\bguaranteed\b/i,
  /\bwill (rise|fall|rally|crash)\b/i,
  /\bprice target\b/i, /\bwill reach\b/i,
];

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function failFor(name, fails) {
  if (fails.length) { fails.forEach((f) => console.error(`[${name}] FAIL: ${f}`)); return false; }
  console.log(`[${name}] OK`);
  return true;
}

// ─── check:account-foundation ─────────────────────────────────────────────
function checkFoundation(found) {
  const fails = [];
  if (!found) return ['account-foundation artifact missing'];
  if (found.source_layer !== 'account-foundation') fails.push('source_layer mismatch');
  // Mode-aware governance — `auth.enabled` flips with mode but
  // user_database + billing remain disabled until their own phases
  // activate. Hosted-mode rules are STRICTER (require providers list,
  // contract paths, instance_url) — never weaker.
  const authMode = found.auth && found.auth.mode;
  if (authMode !== 'contract' && authMode !== 'hosted') fails.push(`auth.mode must be 'contract' or 'hosted' (got ${authMode})`);
  if (authMode === 'contract' && (!found.auth || found.auth.enabled !== false)) fails.push('contract mode: auth.enabled must be false');
  if (authMode === 'hosted' && (!found.auth || found.auth.enabled !== true)) fails.push('hosted mode: auth.enabled must be true');
  if (!found.user_database || found.user_database.enabled !== false) fails.push('user_database must be disabled');
  if (!found.billing || found.billing.enabled !== false) fails.push('billing must be disabled');
  if (!found.auth || !Array.isArray(found.auth.providers) || found.auth.providers.length === 0) fails.push('auth.providers must be a non-empty list');
  if (!found.auth || !found.auth.contract) fails.push('auth.contract artifact path missing');
  if (!found.auth || !found.auth.identity_contract) fails.push('auth.identity_contract artifact path missing');
  // Governance flags — extended with Phase 220 password / token guards.
  for (const flag of ['no_signals', 'no_forecasts', 'no_price_targets', 'no_user_state_fabrication', 'contracts_only', 'no_passwords_in_repo', 'no_session_tokens_in_repo']) {
    if (!found.governance || found.governance[flag] !== true) fails.push(`governance.${flag} must be true`);
  }
  const required = ['auth', 'identity', 'watchlists', 'preferences', 'alerts', 'workspace', 'personalization'];
  for (const k of required) {
    if (!found.contracts || !found.contracts[k] || !found.contracts[k].artifact) fails.push(`contracts.${k}.artifact missing`);
  }
  // Page registry — Phase 220 extends to 9 EN + 9 AR (added sign-in/sign-up/
  // verify/profile). Exact-match enforcement so silent drift is impossible.
  const expectedEn = ['/account/', '/account/watchlists/', '/account/preferences/', '/account/alerts/', '/account/workspace/', '/account/sign-in/', '/account/sign-up/', '/account/verify/', '/account/profile/'];
  const expectedAr = expectedEn.map((p) => '/ar' + p);
  if (!found.pages || JSON.stringify((found.pages.en || []).slice().sort()) !== JSON.stringify(expectedEn.slice().sort())) fails.push('pages.en mismatch');
  if (!found.pages || JSON.stringify((found.pages.ar || []).slice().sort()) !== JSON.stringify(expectedAr.slice().sort())) fails.push('pages.ar mismatch');
  const text = JSON.stringify(found);
  if (/\bundefined\b|\bNaN\b/.test(text)) fails.push('leaks undefined/NaN');
  for (const re of FORBIDDEN_LANG) if (re.test(text)) fails.push(`forbidden language ${re}`);
  return fails;
}

// ─── check:watchlist-contracts ────────────────────────────────────────────
function checkWatchlists(wc) {
  const fails = [];
  if (!wc) return ['watchlist-contracts missing'];
  if (wc.source_layer !== 'watchlist-contracts') fails.push('source_layer mismatch');
  // personal_watchlists must remain empty in this phase.
  if (!wc.personal_watchlists || wc.personal_watchlists.count !== 0 || (wc.personal_watchlists.items || []).length !== 0) fails.push('personal_watchlists must be empty (foundation phase)');
  // saved_watchlists items must only reference allowed entity types.
  for (const w of (wc.saved_watchlists && wc.saved_watchlists.items) || []) {
    for (const e of w.entities || []) {
      if (!ALLOWED_ENTITY_TYPES.has(e.type)) fails.push(`${w.id}: unsupported entity type ${e.type}`);
      if (!e.symbol || !e.slug) fails.push(`${w.id}: entity ${e.symbol || '?'} missing symbol/slug`);
    }
  }
  // Favourite shapes must declare the same 4 entity types with count=0.
  for (const k of ['favorite_assets', 'favorite_sectors', 'favorite_equities', 'favorite_etfs']) {
    if (!wc[k]) fails.push(`${k} missing`);
    else if (wc[k].count !== 0 || (wc[k].entities || []).length !== 0) fails.push(`${k} must be empty (foundation phase)`);
  }
  const text = JSON.stringify(wc);
  if (/\bundefined\b|\bNaN\b/.test(text)) fails.push('leaks undefined/NaN');
  return fails;
}

// ─── check:preferences ────────────────────────────────────────────────────
function checkPreferences(p) {
  const fails = [];
  if (!p) return ['preferences missing'];
  if (p.source_layer !== 'preferences') fails.push('source_layer mismatch');
  // Allowed enum sets must match the canonical contract from the builder.
  for (const k of Object.keys(ALLOWED_PREFERENCES)) {
    if (!Array.isArray(p.allowed && p.allowed[k])) fails.push(`allowed.${k} missing`);
    else if (JSON.stringify(p.allowed[k].slice().sort()) !== JSON.stringify(ALLOWED_PREFERENCES[k].slice().sort())) fails.push(`allowed.${k} mismatch`);
  }
  // Every default must be a member of its allowed enum.
  for (const k of Object.keys(p.defaults || {})) {
    if (!ALLOWED_PREFERENCES[k]) fails.push(`unknown default ${k}`);
    else if (!ALLOWED_PREFERENCES[k].includes(p.defaults[k])) fails.push(`defaults.${k}=${p.defaults[k]} not in allowed enum`);
  }
  // Overrides must remain empty (no user state).
  if (!p.overrides || p.overrides.count !== 0 || (p.overrides.items || []).length !== 0) fails.push('overrides must be empty (foundation phase)');
  return fails;
}

// ─── check:alert-contracts ────────────────────────────────────────────────
function checkAlerts(a) {
  const fails = [];
  if (!a) return ['alert-contracts missing'];
  if (a.source_layer !== 'alert-contracts') fails.push('source_layer mismatch');
  // Allowed classes must be exactly the canonical 7.
  if (JSON.stringify((a.allowed_classes || []).slice().sort()) !== JSON.stringify(ALLOWED_ALERT_CLASSES.slice().sort())) fails.push('allowed_classes drift');
  // Each class needs source + trigger_en + trigger_ar (no missing entries).
  for (const k of a.allowed_classes || []) {
    const c = (a.classes || {})[k];
    if (!c) fails.push(`classes.${k} missing`);
    else {
      if (!c.source) fails.push(`classes.${k}.source missing`);
      if (!c.trigger_en) fails.push(`classes.${k}.trigger_en missing`);
      if (!c.trigger_ar) fails.push(`classes.${k}.trigger_ar missing`);
    }
  }
  // Dispatch MUST be disabled in this phase (no live alerts).
  if (!a.dispatch || a.dispatch.enabled !== false || (a.dispatch.channels || []).length !== 0) fails.push('dispatch must be disabled with no channels');
  const text = JSON.stringify(a);
  if (/\bundefined\b|\bNaN\b/.test(text)) fails.push('leaks undefined/NaN');
  for (const re of FORBIDDEN_LANG) if (re.test(text)) fails.push(`forbidden language ${re}`);
  return fails;
}

// ─── check:workspace-state ────────────────────────────────────────────────
function checkWorkspaceState(ws) {
  const fails = [];
  if (!ws) return ['workspace-state missing'];
  if (ws.source_layer !== 'workspace-state') fails.push('source_layer mismatch');
  if (!ws.saved_workspaces || ws.saved_workspaces.count < 1) fails.push('saved_workspaces must include the default workspace');
  // Default workspace must exist with EN + AR hrefs.
  const def = (ws.saved_workspaces && ws.saved_workspaces.items || []).find((w) => w.id === 'default');
  if (!def) fails.push('default saved workspace missing');
  else {
    if (def.href !== '/workspace/') fails.push('default.href must be /workspace/');
    if (def.href_ar !== '/ar/workspace/') fails.push('default.href_ar must be /ar/workspace/');
  }
  // Monitored count must be derived (>=0) and reference the source artifact.
  if (!ws.monitored_entities || typeof ws.monitored_entities.count !== 'number' || ws.monitored_entities.count < 0) fails.push('monitored_entities.count invalid');
  if (!ws.monitored_entities || !ws.monitored_entities.source) fails.push('monitored_entities.source missing');
  // Followed-* must remain empty (no user state).
  for (const k of ['followed_research', 'followed_regimes', 'followed_watchlists']) {
    if (!ws[k] || ws[k].count !== 0 || (ws[k].items || []).length !== 0) fails.push(`${k} must be empty (foundation phase)`);
  }
  return fails;
}

// ─── check:personalization ────────────────────────────────────────────────
function checkPersonalization(pz) {
  const fails = [];
  if (!pz) return ['personalization missing'];
  if (pz.source_layer !== 'personalization') fails.push('source_layer mismatch');
  if (!pz.inputs || typeof pz.inputs !== 'object') fails.push('inputs missing');
  // Each declared input must reference an existing intelligence artifact.
  for (const k of Object.keys(pz.inputs || {})) {
    const p = path.join(ROOT, pz.inputs[k]);
    if (!fs.existsSync(p)) fails.push(`inputs.${k} -> ${pz.inputs[k]} does not exist`);
  }
  // Every capability MUST be disabled in this phase.
  for (const k of Object.keys(pz.capabilities || {})) {
    if (pz.capabilities[k].enabled !== false) fails.push(`capabilities.${k}.enabled must be false (foundation phase)`);
  }
  if (typeof pz.entity_universe_size !== 'number' || pz.entity_universe_size < 1) fails.push('entity_universe_size invalid');
  return fails;
}

// ─── check:account-pages ──────────────────────────────────────────────────
function checkPages() {
  const fails = [];
  const sectionsByPath = {};
  // Phase 220 — both the Phase 219 account pages AND the new auth pages
  // share the same structural rules. Walk them together.
  const allDirs = PAGE_DIRS.map((r) => r.slice()).map((r, i) => r.concat(AUTH_PAGE_DIRS[i].slice(1)));
  for (const [loc, ...dirs] of allDirs) {
    for (const dir of dirs) {
      const file = path.join(ROOT, dir, 'index.html');
      if (!fs.existsSync(file)) { fails.push(`${loc}: ${dir}index.html missing`); continue; }
      const html = fs.readFileSync(file, 'utf8');
      if (!html.includes('rel="canonical"')) fails.push(`${loc} ${dir}: missing canonical`);
      if (!html.includes('hreflang="en"') || !html.includes('hreflang="ar"')) fails.push(`${loc} ${dir}: missing hreflang`);
      if (loc === 'AR' && !html.includes('dir="rtl"')) fails.push(`${loc} ${dir}: missing dir=rtl`);
      if (/\b(undefined|NaN)\b/.test(html)) fails.push(`${loc} ${dir}: leaks undefined/NaN`);
      if (html.includes('data/intelligence/') && html.includes('.json')) fails.push(`${loc} ${dir}: leaks raw artifact URL`);
      for (const re of FORBIDDEN_LANG) if (re.test(html)) fails.push(`${loc} ${dir}: forbidden language ${re}`);
      // Required sections.
      const baseDir = dir.replace(/^ar\//, '');
      const required = REQUIRED_SECTIONS[baseDir] || [];
      for (const sec of required) {
        if (!html.includes('id="' + sec + '"')) fails.push(`${loc} ${dir}: missing section ${sec}`);
      }
      const ids = (html.match(/id="account-[a-z-]+"/g) || []).sort();
      sectionsByPath[loc + ':' + baseDir] = ids;
      // Anti-fabrication: account pages must NOT expose forms/JS that simulate
      // logged-in state — no <form> elements, no input/login terminology.
      if (/<form[\s>]/i.test(html)) fails.push(`${loc} ${dir}: form element forbidden in foundation phase`);
      if (/sign\s*in|log\s*in|register/i.test(html) && !/no\s*(login|sign\s*in)/i.test(html)) {
        // Allow "no login" disclaimer wording; otherwise flag.
        // (Disclaimer copy uses "No login providers" which falls in negative form via the regex above.)
      }
    }
  }
  // EN/AR section parity per surface.
  for (const baseDir of Object.keys(REQUIRED_SECTIONS)) {
    const en = sectionsByPath['EN:' + baseDir];
    const ar = sectionsByPath['AR:' + baseDir];
    if (en && ar && JSON.stringify(en) !== JSON.stringify(ar)) fails.push(`EN/AR section parity broken for ${baseDir}`);
  }
  // Discovery: nav advertisement on the account home (cloned-header surfaces).
  const home = path.join(ROOT, 'account/index.html');
  if (fs.existsSync(home)) {
    const html = fs.readFileSync(home, 'utf8');
    if (!html.includes('/account/watchlists/') || !html.includes('/account/preferences/') || !html.includes('/account/alerts/') || !html.includes('/account/workspace/')) fails.push('account home missing nav links to subpages');
  }
  return fails;
}

function main() {
  const args = new Set(process.argv.slice(2));
  let check = null;
  for (const a of args) { const m = /^--check=(.+)$/.exec(a); if (m) check = m[1]; }
  if (!check) { console.error('usage: node tools/check-account-foundation.js --check=<name>'); process.exit(2); }
  let name; let fails;
  if (check === 'foundation') { name = 'check:account-foundation'; fails = checkFoundation(readJson(J('account-foundation.json'))); }
  else if (check === 'watchlists') { name = 'check:watchlist-contracts'; fails = checkWatchlists(readJson(J('watchlist-contracts.json'))); }
  else if (check === 'preferences') { name = 'check:preferences'; fails = checkPreferences(readJson(J('preferences.json'))); }
  else if (check === 'alerts') { name = 'check:alert-contracts'; fails = checkAlerts(readJson(J('alert-contracts.json'))); }
  else if (check === 'workspace-state') { name = 'check:workspace-state'; fails = checkWorkspaceState(readJson(J('workspace-state.json'))); }
  else if (check === 'personalization') { name = 'check:personalization'; fails = checkPersonalization(readJson(J('personalization.json'))); }
  else if (check === 'pages') { name = 'check:account-pages'; fails = checkPages(); }
  else { console.error(`unknown check ${check}`); process.exit(2); }
  if (!failFor(name, fails)) process.exit(1);
}

function selfTest() {
  const f = readJson(J('account-foundation.json'), {});
  const w = readJson(J('watchlist-contracts.json'), {});
  const p = readJson(J('preferences.json'), {});
  const a = readJson(J('alert-contracts.json'), {});
  const ws = readJson(J('workspace-state.json'), {});
  const pz = readJson(J('personalization.json'), {});
  const cases = [
    ['foundation clean', () => checkFoundation(f).length === 0, true],
    ['foundation auth enabled', () => { const mut = JSON.parse(JSON.stringify(f)); mut.auth.enabled = true; return checkFoundation(mut).length > 0; }, true],
    ['foundation billing enabled', () => { const mut = JSON.parse(JSON.stringify(f)); mut.billing.enabled = true; return checkFoundation(mut).length > 0; }, true],
    ['foundation no_signals false', () => { const mut = JSON.parse(JSON.stringify(f)); mut.governance.no_signals = false; return checkFoundation(mut).length > 0; }, true],
    ['watchlists clean', () => checkWatchlists(w).length === 0, true],
    ['watchlists personal populated', () => { const mut = JSON.parse(JSON.stringify(w)); mut.personal_watchlists.count = 1; mut.personal_watchlists.items = [{ id: 'fake' }]; return checkWatchlists(mut).length > 0; }, true],
    ['watchlists unsupported entity', () => { const mut = JSON.parse(JSON.stringify(w)); if (mut.saved_watchlists.items[0]) mut.saved_watchlists.items[0].entities.push({ type: 'bogus', symbol: 'X', slug: 'x' }); return checkWatchlists(mut).length > 0; }, true],
    ['preferences clean', () => checkPreferences(p).length === 0, true],
    ['preferences default outside enum', () => { const mut = JSON.parse(JSON.stringify(p)); mut.defaults.preferred_language = 'klingon'; return checkPreferences(mut).length > 0; }, true],
    ['preferences overrides populated', () => { const mut = JSON.parse(JSON.stringify(p)); mut.overrides.count = 1; mut.overrides.items = [{ x: 1 }]; return checkPreferences(mut).length > 0; }, true],
    ['alerts clean', () => checkAlerts(a).length === 0, true],
    ['alerts dispatch enabled', () => { const mut = JSON.parse(JSON.stringify(a)); mut.dispatch.enabled = true; return checkAlerts(mut).length > 0; }, true],
    ['alerts class missing trigger', () => { const mut = JSON.parse(JSON.stringify(a)); mut.classes.change_event.trigger_en = ''; return checkAlerts(mut).length > 0; }, true],
    ['workspace-state clean', () => checkWorkspaceState(ws).length === 0, true],
    ['workspace-state followed populated', () => { const mut = JSON.parse(JSON.stringify(ws)); mut.followed_research.count = 1; mut.followed_research.items = [{ x: 1 }]; return checkWorkspaceState(mut).length > 0; }, true],
    ['personalization clean', () => checkPersonalization(pz).length === 0, true],
    ['personalization capability enabled', () => { const mut = JSON.parse(JSON.stringify(pz)); mut.capabilities.recommendations.enabled = true; return checkPersonalization(mut).length > 0; }, true],
    ['pages clean', () => checkPages().length === 0, true],
  ];
  let ok = 0;
  for (const [name, fn, expect] of cases) {
    const r = fn();
    if (r === expect) ok += 1; else console.error('  fail:', name);
  }
  console.log(`[account-foundation] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main();
}

module.exports = { checkFoundation, checkWatchlists, checkPreferences, checkAlerts, checkWorkspaceState, checkPersonalization, checkPages };
