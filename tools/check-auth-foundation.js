'use strict';

// Phase 220 CP7 — Authentication & Account Identity validators.
// Subcommands (selected with --check):
//   --check=foundation     check:auth-foundation
//   --check=identity       check:account-identity
//   --check=pages          check:auth-pages
// Self-tests with --self-test.

const fs = require('fs');
const path = require('path');
const { ALLOWED_PROVIDERS, ALLOWED_FLOWS, ALLOWED_MODES, ALLOWED_SCOPES } = require('./build-auth-foundation');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);

// Secret-looking patterns that MUST NOT appear in the auth artifacts. Validator
// hard-fails if any field looks like a key/token/password.
const SECRET_PATTERNS = [
  /\bsk_(test|live)_[A-Za-z0-9]{16,}/,           // Stripe/Clerk secret-key prefixes
  /\bpk_(test|live)_[A-Za-z0-9]{16,}/,           // publishable-key real values
  /\bsess_[A-Za-z0-9]{16,}/,                       // real session prefixes
  /\bsk-[A-Za-z0-9]{20,}/,                         // OpenAI-style keys
  /\bAKIA[0-9A-Z]{16}\b/,                          // AWS access keys
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,            // PEM private keys
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,   // JWT
];
const FORBIDDEN_LANG = [
  /\bplaceholder text\b/i, /\btbd\b/i, /\blorem\b/i,
  /\bbuy\b/i, /\bsell\b/i, /\bguaranteed\b/i,
  /\bwill (rise|fall|rally|crash)\b/i,
  /\bprice target\b/i, /\bwill reach\b/i,
];

const AUTH_PAGES = [
  ['EN', 'account/sign-in/', 'account/sign-up/', 'account/verify/', 'account/profile/'],
  ['AR', 'ar/account/sign-in/', 'ar/account/sign-up/', 'ar/account/verify/', 'ar/account/profile/'],
];
const REQUIRED_AUTH_SECTIONS = {
  'account/sign-in/': ['auth-status', 'auth-flow', 'auth-alt', 'auth-disclaimer'],
  'account/sign-up/': ['auth-status', 'auth-fields', 'auth-alt', 'auth-disclaimer'],
  'account/verify/': ['auth-status', 'auth-endpoints', 'auth-disclaimer'],
  'account/profile/': ['profile-status', 'profile-fields', 'profile-scopes', 'auth-disclaimer'],
};

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function failFor(name, fails) {
  if (fails.length) { fails.forEach((f) => console.error(`[${name}] FAIL: ${f}`)); return false; }
  console.log(`[${name}] OK`);
  return true;
}

function looksLikeSecret(text) {
  for (const re of SECRET_PATTERNS) if (re.test(text)) return re;
  return null;
}

// ─── check:auth-foundation ────────────────────────────────────────────────
function checkAuthFoundation(a) {
  const fails = [];
  if (!a) return ['auth-foundation artifact missing'];
  if (a.source_layer !== 'auth-foundation') fails.push('source_layer mismatch');
  if (a.mode !== 'contract') fails.push("mode must be 'contract' in this phase");
  if (a.enabled !== false) fails.push('enabled must be false in this phase');
  // Allowed enums must match canonical sets (no silent provider drift).
  if (JSON.stringify((a.allowed_providers || []).slice().sort()) !== JSON.stringify(ALLOWED_PROVIDERS.slice().sort())) fails.push('allowed_providers drift');
  if (JSON.stringify((a.allowed_flows || []).slice().sort()) !== JSON.stringify(ALLOWED_FLOWS.slice().sort())) fails.push('allowed_flows drift');
  if (JSON.stringify((a.allowed_modes || []).slice().sort()) !== JSON.stringify(ALLOWED_MODES.slice().sort())) fails.push('allowed_modes drift');
  // Primary provider must be in allowed set and present in providers[].
  if (!ALLOWED_PROVIDERS.includes(a.primary_provider)) fails.push(`primary_provider ${a.primary_provider} not allowed`);
  if (!Array.isArray(a.providers) || a.providers.length === 0) fails.push('providers must be non-empty');
  for (const p of a.providers || []) {
    if (!ALLOWED_PROVIDERS.includes(p.id)) fails.push(`provider ${p.id} not allowed`);
    if (!ALLOWED_FLOWS.includes(p.flow)) fails.push(`provider ${p.id}: flow ${p.flow} not allowed`);
    if (!Array.isArray(p.env_vars) || p.env_vars.length === 0) fails.push(`provider ${p.id}: env_vars missing`);
    for (const v of p.env_vars || []) {
      if (!v.name || typeof v.name !== 'string') fails.push(`provider ${p.id}: env var missing name`);
      // CRITICAL: env vars in the contract must NEVER carry a value. The
      // contract advertises NAMES + presence flags only.
      if (Object.prototype.hasOwnProperty.call(v, 'value')) fails.push(`provider ${p.id}: env var ${v.name} must not carry a value field`);
      if (v.value_present !== false) fails.push(`provider ${p.id}: env var ${v.name} value_present must be false in contract phase`);
    }
    if (!p.endpoints || !p.endpoints.sign_in_local || !p.endpoints.sign_up_local || !p.endpoints.verify_local || !p.endpoints.profile_local) fails.push(`provider ${p.id}: endpoints missing local set`);
  }
  // Governance flags — all must be true.
  for (const flag of ['no_passwords_in_repo', 'no_session_tokens_in_repo', 'no_user_state_fabrication', 'hosted_ui_only', 'contract_only']) {
    if (!a.governance || a.governance[flag] !== true) fails.push(`governance.${flag} must be true`);
  }
  // Secret leakage scan over the whole artifact.
  const text = JSON.stringify(a);
  const sec = looksLikeSecret(text);
  if (sec) fails.push(`secret-like content matched ${sec}`);
  if (/\bundefined\b|\bNaN\b/.test(text)) fails.push('leaks undefined/NaN');
  for (const re of FORBIDDEN_LANG) if (re.test(text)) fails.push(`forbidden language ${re}`);
  return fails;
}

// ─── check:account-identity ───────────────────────────────────────────────
function checkAccountIdentity(i) {
  const fails = [];
  if (!i) return ['account-identity artifact missing'];
  if (i.source_layer !== 'account-identity') fails.push('source_layer mismatch');
  if (i.mode !== 'contract') fails.push("mode must be 'contract' in this phase");
  // accounts_count MUST be 0 — no real accounts exist in this phase.
  if (i.accounts_count !== 0) fails.push('accounts_count must be 0 in this phase');
  // Allowed scopes must match canonical set.
  if (JSON.stringify((i.allowed_scopes || []).slice().sort()) !== JSON.stringify(ALLOWED_SCOPES.slice().sort())) fails.push('allowed_scopes drift');
  // Required schema fields must each declare a type.
  for (const k of ['account_id', 'session_id', 'primary_email_hash', 'locale', 'created_at', 'last_seen_at', 'scopes', 'tier']) {
    if (!i.fields || !i.fields[k] || !i.fields[k].type) fails.push(`fields.${k}.type missing`);
  }
  // Sample template must use literal __PLACEHOLDER_*__ values (proof that no
  // real account leaked into the contract).
  if (!i.sample_template) fails.push('sample_template missing');
  else {
    for (const k of ['account_id', 'session_id', 'primary_email_hash', 'created_at', 'last_seen_at']) {
      const v = i.sample_template[k];
      if (typeof v !== 'string' || !v.startsWith('__PLACEHOLDER_') || !v.endsWith('__')) fails.push(`sample_template.${k} must be a __PLACEHOLDER_*__ literal`);
    }
    if (i.sample_template.tier !== 'free') fails.push('sample_template.tier must default to free in this phase');
    if (!Array.isArray(i.sample_template.scopes)) fails.push('sample_template.scopes must be an array');
    for (const s of i.sample_template.scopes || []) if (!ALLOWED_SCOPES.includes(s)) fails.push(`sample_template.scopes: ${s} not in allowed set`);
  }
  // Secret leakage scan.
  const text = JSON.stringify(i);
  const sec = looksLikeSecret(text);
  if (sec) fails.push(`secret-like content matched ${sec}`);
  if (/\bundefined\b|\bNaN\b/.test(text)) fails.push('leaks undefined/NaN');
  return fails;
}

// ─── check:auth-pages ─────────────────────────────────────────────────────
function checkAuthPages() {
  const fails = [];
  const sectionsByPath = {};
  for (const [loc, ...dirs] of AUTH_PAGES) {
    for (const dir of dirs) {
      const file = path.join(ROOT, dir, 'index.html');
      if (!fs.existsSync(file)) { fails.push(`${loc}: ${dir}index.html missing`); continue; }
      const html = fs.readFileSync(file, 'utf8');
      if (!html.includes('rel="canonical"')) fails.push(`${loc} ${dir}: missing canonical`);
      if (!html.includes('hreflang="en"') || !html.includes('hreflang="ar"')) fails.push(`${loc} ${dir}: missing hreflang`);
      if (loc === 'AR' && !html.includes('dir="rtl"')) fails.push(`${loc} ${dir}: missing dir=rtl`);
      // Phase 220 — auth pages MUST be noindex. They are scaffolding, not
      // content the search index should rank, and the live flow redirects to
      // the hosted UI anyway.
      if (!html.includes('noindex')) fails.push(`${loc} ${dir}: missing noindex robots directive`);
      if (/\b(undefined|NaN)\b/.test(html)) fails.push(`${loc} ${dir}: leaks undefined/NaN`);
      if (html.includes('data/intelligence/') && html.includes('.json')) fails.push(`${loc} ${dir}: leaks raw artifact URL`);
      // Foundation phase forbids <form> elements (no simulated live auth).
      if (/<form[\s>]/i.test(html)) fails.push(`${loc} ${dir}: form element forbidden in foundation phase`);
      // Forbid loading an actual Clerk SDK in the foundation phase.
      if (/clerk[._-]?(js|browser|sdk)\b/i.test(html) || /<script[^>]+clerk/i.test(html)) fails.push(`${loc} ${dir}: Clerk SDK must not be loaded in contract phase`);
      // Secret-looking content scan.
      const sec = looksLikeSecret(html);
      if (sec) fails.push(`${loc} ${dir}: secret-like content matched ${sec}`);
      for (const re of FORBIDDEN_LANG) if (re.test(html)) fails.push(`${loc} ${dir}: forbidden language ${re}`);
      const baseDir = dir.replace(/^ar\//, '');
      const required = REQUIRED_AUTH_SECTIONS[baseDir] || [];
      for (const sec2 of required) {
        if (!html.includes('id="' + sec2 + '"')) fails.push(`${loc} ${dir}: missing section ${sec2}`);
      }
      const ids = (html.match(/id="(auth|profile)-[a-z-]+"/g) || []).sort();
      sectionsByPath[loc + ':' + baseDir] = ids;
    }
  }
  // EN/AR section parity per surface.
  for (const baseDir of Object.keys(REQUIRED_AUTH_SECTIONS)) {
    const en = sectionsByPath['EN:' + baseDir];
    const ar = sectionsByPath['AR:' + baseDir];
    if (en && ar && JSON.stringify(en) !== JSON.stringify(ar)) fails.push(`EN/AR section parity broken for ${baseDir}`);
  }
  return fails;
}

function main() {
  const args = new Set(process.argv.slice(2));
  let check = null;
  for (const a of args) { const m = /^--check=(.+)$/.exec(a); if (m) check = m[1]; }
  if (!check) { console.error('usage: node tools/check-auth-foundation.js --check=<name>'); process.exit(2); }
  let name; let fails;
  if (check === 'foundation') { name = 'check:auth-foundation'; fails = checkAuthFoundation(readJson(J('auth-foundation.json'))); }
  else if (check === 'identity') { name = 'check:account-identity'; fails = checkAccountIdentity(readJson(J('account-identity.json'))); }
  else if (check === 'pages') { name = 'check:auth-pages'; fails = checkAuthPages(); }
  else { console.error(`unknown check ${check}`); process.exit(2); }
  if (!failFor(name, fails)) process.exit(1);
}

function selfTest() {
  const a = readJson(J('auth-foundation.json'), {});
  const i = readJson(J('account-identity.json'), {});
  const cases = [
    ['auth-foundation clean', () => checkAuthFoundation(a).length === 0, true],
    ['auth-foundation mode live', () => { const mut = JSON.parse(JSON.stringify(a)); mut.mode = 'live'; return checkAuthFoundation(mut).length > 0; }, true],
    ['auth-foundation enabled true', () => { const mut = JSON.parse(JSON.stringify(a)); mut.enabled = true; return checkAuthFoundation(mut).length > 0; }, true],
    ['auth-foundation unknown provider', () => { const mut = JSON.parse(JSON.stringify(a)); mut.providers[0].id = 'bogus'; return checkAuthFoundation(mut).length > 0; }, true],
    ['auth-foundation env var with value', () => { const mut = JSON.parse(JSON.stringify(a)); mut.providers[0].env_vars[0].value = 'sk_live_ABCDEFGHIJKLMNOP'; return checkAuthFoundation(mut).length > 0; }, true],
    ['auth-foundation secret leaked', () => { const mut = JSON.parse(JSON.stringify(a)); mut.providers[0].docs_url = 'https://x.com?key=sk_live_ABCDEFGHIJKLMNOP1234'; return checkAuthFoundation(mut).length > 0; }, true],
    ['auth-foundation governance flag off', () => { const mut = JSON.parse(JSON.stringify(a)); mut.governance.no_passwords_in_repo = false; return checkAuthFoundation(mut).length > 0; }, true],
    ['account-identity clean', () => checkAccountIdentity(i).length === 0, true],
    ['account-identity accounts_count nonzero', () => { const mut = JSON.parse(JSON.stringify(i)); mut.accounts_count = 1; return checkAccountIdentity(mut).length > 0; }, true],
    ['account-identity sample_template real value', () => { const mut = JSON.parse(JSON.stringify(i)); mut.sample_template.account_id = 'user_real_123'; return checkAccountIdentity(mut).length > 0; }, true],
    ['account-identity unknown scope', () => { const mut = JSON.parse(JSON.stringify(i)); mut.sample_template.scopes.push('billing.write'); return checkAccountIdentity(mut).length > 0; }, true],
    ['auth-pages clean', () => checkAuthPages().length === 0, true],
  ];
  let ok = 0;
  for (const [name, fn, expect] of cases) {
    const r = fn();
    if (r === expect) ok += 1; else console.error('  fail:', name);
  }
  console.log(`[auth-foundation] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main();
}

module.exports = { checkAuthFoundation, checkAccountIdentity, checkAuthPages };
