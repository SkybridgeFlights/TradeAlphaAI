'use strict';

// Phase 227 — PWA + Final Closure validator.
// Two sub-checks:
//   --check=pwa      check:pwa (manifest + sw + mobile page + nav SW registration)
//   --check=closure  check:closure (every Phase 219-227 contract artifact present
//                     + governance-flag matrix intact across all of them)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function failFor(name, fails) {
  if (fails.length) { fails.forEach((f) => console.error(`[${name}] FAIL: ${f}`)); return false; }
  console.log(`[${name}] OK`);
  return true;
}

// ─── check:pwa ────────────────────────────────────────────────────────────
function checkPwa() {
  const fails = [];
  const manifestPath = path.join(ROOT, 'manifest.json');
  if (!fs.existsSync(manifestPath)) fails.push('manifest.json missing');
  else {
    const m = readJson(manifestPath, {});
    for (const k of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color']) {
      if (!m[k]) fails.push(`manifest.json missing ${k}`);
    }
    if (m.display !== 'standalone') fails.push('manifest.json display must be standalone');
    if (!Array.isArray(m.icons) || m.icons.length === 0) fails.push('manifest.json icons required');
    if (!Array.isArray(m.shortcuts) || m.shortcuts.length < 1) fails.push('manifest.json shortcuts required');
  }
  const swPath = path.join(ROOT, 'sw.js');
  if (!fs.existsSync(swPath)) fails.push('sw.js missing');
  else {
    const sw = readText(swPath);
    for (const h of ['install', 'activate', 'fetch', 'push', 'notificationclick']) {
      if (!new RegExp(`addEventListener\\('${h}'`).test(sw)) fails.push(`sw.js missing ${h} handler`);
    }
    if (!/skipWaiting/.test(sw)) fails.push('sw.js should call skipWaiting()');
    if (!/clients\.claim/.test(sw)) fails.push('sw.js should call clients.claim()');
  }
  // /account/mobile/ pages must exist EN+AR and be noindex.
  for (const p of ['account/mobile/index.html', 'ar/account/mobile/index.html']) {
    if (!fs.existsSync(path.join(ROOT, p))) fails.push(`page missing: ${p}`);
    else {
      const html = readText(path.join(ROOT, p));
      if (!html.includes('noindex')) fails.push(`${p}: must be noindex`);
      if (!html.includes('rel="manifest"')) fails.push(`${p}: must link /manifest.json`);
      if (!html.includes('theme-color')) fails.push(`${p}: must include theme-color meta`);
    }
  }
  // Service worker registration must be advertised in the global header
  // scripts (sample any baked page).
  const samples = ['index.html', 'account/index.html', 'workspace/index.html'];
  let registered = false;
  for (const s of samples) {
    const html = readText(path.join(ROOT, s));
    if (/navigator\.serviceWorker\.register\(['"]\/sw\.js['"]\)/.test(html)) { registered = true; break; }
  }
  if (!registered) fails.push('service worker registration not found in any sampled baked page');
  return fails;
}

// ─── check:closure ────────────────────────────────────────────────────────
function checkClosure() {
  const fails = [];
  // Every Phase 219-227 contract artifact must exist on disk.
  const required = [
    'account-foundation.json', 'watchlist-contracts.json', 'preferences.json',
    'alert-contracts.json', 'workspace-state.json', 'personalization.json',
    'auth-foundation.json', 'account-identity.json',
    'personal-state-contracts.json', 'alert-dispatch.json',
    'personalized-research.json', 'billing-contracts.json', 'copilot-contracts.json',
  ];
  for (const r of required) {
    if (!fs.existsSync(J(r))) fails.push(`required artifact missing: data/intelligence/${r}`);
  }
  // Cross-contract invariants — the foundation phase MUST keep auth disabled,
  // billing disabled, dispatch disabled, copilot disabled, real account count
  // 0 everywhere. These are the platform-level "no live wiring" guarantees.
  const af = readJson(J('account-foundation.json'), {});
  const auth = readJson(J('auth-foundation.json'), {});
  const ident = readJson(J('account-identity.json'), {});
  const personal = readJson(J('personal-state-contracts.json'), {});
  const dispatch = readJson(J('alert-dispatch.json'), {});
  const pres = readJson(J('personalized-research.json'), {});
  const billing = readJson(J('billing-contracts.json'), {});
  const copilot = readJson(J('copilot-contracts.json'), {});
  // Mode-aware auth — flips with the foundation's mode. Hosted mode is a
  // legitimate, validator-approved live state. user_database / billing /
  // dispatch / etc. remain disabled until their own activation phases.
  const authMode = (af.auth && af.auth.mode) || 'contract';
  if (authMode === 'contract' && af.auth && af.auth.enabled !== false) fails.push('contract mode: account-foundation.auth.enabled must be false');
  if (authMode === 'hosted' && af.auth && af.auth.enabled !== true) fails.push('hosted mode: account-foundation.auth.enabled must be true');
  if (af.billing && af.billing.enabled !== false) fails.push('account-foundation.billing.enabled must be false');
  if (af.user_database && af.user_database.enabled !== false) fails.push('account-foundation.user_database.enabled must be false');
  if (authMode === 'contract' && auth.enabled !== false) fails.push('contract mode: auth-foundation.enabled must be false');
  if (authMode === 'hosted' && auth.enabled !== true) fails.push('hosted mode: auth-foundation.enabled must be true');
  // The two foundations must AGREE on mode — drift is a bug.
  if (auth.mode !== authMode) fails.push(`mode drift: account-foundation.auth.mode=${authMode} vs auth-foundation.mode=${auth.mode}`);
  if (ident.accounts_count !== 0) fails.push('account-identity.accounts_count must be 0');
  if (personal.write_enabled !== false) fails.push('personal-state.write_enabled must be false');
  if (dispatch.dispatch_enabled !== false) fails.push('alert-dispatch.dispatch_enabled must be false');
  if (pres.accounts && pres.accounts.real_count !== 0) fails.push('personalized-research.accounts.real_count must be 0');
  if (billing.enabled !== false) fails.push('billing-contracts.enabled must be false');
  if (copilot.enabled !== false) fails.push('copilot-contracts.enabled must be false');
  // Every contract that has governance must keep no_signals/no_forecasts/
  // no_price_targets (or the equivalent) true. Centralized invariant —
  // catches drift in any single contract.
  const govPairs = [
    ['account-foundation', af.governance, ['no_signals', 'no_forecasts', 'no_price_targets', 'no_user_state_fabrication', 'contracts_only', 'no_passwords_in_repo', 'no_session_tokens_in_repo']],
    // auth-foundation contract_only flag is mode-dependent — required in
    // contract mode, forbidden in hosted mode. Other 4 flags survive both.
    ['auth-foundation', auth.governance, authMode === 'contract'
      ? ['no_passwords_in_repo', 'no_session_tokens_in_repo', 'no_user_state_fabrication', 'hosted_ui_only', 'contract_only']
      : ['no_passwords_in_repo', 'no_session_tokens_in_repo', 'no_user_state_fabrication', 'hosted_ui_only']],
    ['personal-state-contracts', personal.governance, ['no_real_account_ids_in_repo', 'no_email_addresses_in_repo', 'no_session_tokens_in_repo', 'gitignored_accounts_dir', 'validator_enforced_writes']],
    ['alert-dispatch', dispatch.governance, ['no_signals', 'no_forecasts', 'no_price_targets', 'no_dispatch_in_contract_phase', 'url_200_gated', 'opt_in_only', 'respects_existing_telegram_gates', 'no_fabricated_alerts']],
    ['personalized-research', pres.governance, ['no_signals', 'no_forecasts', 'no_price_targets', 'no_fabricated_edges', 'registry_bounded', 'evidence_backed_only']],
    ['billing-contracts', billing.governance, ['no_payments_collected', 'no_subscriptions_stored', 'no_public_content_gates', 'public_intelligence_free_forever', 'no_dark_patterns', 'stripe_only_via_hosted_checkout', 'no_card_numbers_in_repo']],
    ['copilot-contracts (response_governance)', copilot.response_governance, ['no_signals', 'no_forecasts', 'no_price_targets', 'no_buy_sell_recommendations', 'no_guarantees', 'cite_evidence_required', 'cite_artifact_paths_required', 'educational_context_only']],
  ];
  for (const [name, gov, flags] of govPairs) {
    for (const f of flags) {
      if (!gov || gov[f] !== true) fails.push(`${name} governance.${f} must be true`);
    }
  }
  // .gitignore must include data/accounts/ (no per-account leaks).
  const gi = readText(path.join(ROOT, '.gitignore'));
  if (!gi.split(/\r?\n/).some((line) => line.trim() === 'data/accounts/')) fails.push('.gitignore must include data/accounts/');
  return fails;
}

function main() {
  const args = new Set(process.argv.slice(2));
  let check = null;
  for (const a of args) { const m = /^--check=(.+)$/.exec(a); if (m) check = m[1]; }
  if (!check) { console.error('usage: node tools/check-pwa-closure.js --check=pwa|closure'); process.exit(2); }
  let fails; let name;
  if (check === 'pwa') { name = 'check:pwa'; fails = checkPwa(); }
  else if (check === 'closure') { name = 'check:closure'; fails = checkClosure(); }
  else { console.error('unknown check'); process.exit(2); }
  if (!failFor(name, fails)) process.exit(1);
}

if (require.main === module) main();

module.exports = { checkPwa, checkClosure };
