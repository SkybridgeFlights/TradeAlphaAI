'use strict';

const fs = require('fs');
const path = require('path');
const { ALLOWED_MODELS, ALLOWED_TOOLS, ALLOWED_SCOPES } = require('./build-copilot-contracts');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const SECRET_PATTERNS = [/\bsk-[A-Za-z0-9_-]{20,}/, /\beyJ[A-Za-z0-9_-]{20,}\./];

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function check(c) {
  const fails = [];
  if (!c) return ['copilot-contracts missing'];
  if (c.source_layer !== 'copilot-contracts') fails.push('source_layer mismatch');
  if (c.mode !== 'contract') fails.push("mode must be 'contract'");
  if (c.enabled !== false) fails.push('enabled must be false');
  if (!ALLOWED_MODELS.includes(c.primary_model)) fails.push(`primary_model ${c.primary_model} not allowed`);
  if (JSON.stringify((c.allowed_models || []).slice().sort()) !== JSON.stringify(ALLOWED_MODELS.slice().sort())) fails.push('allowed_models drift');
  if (JSON.stringify((c.allowed_tools || []).slice().sort()) !== JSON.stringify(ALLOWED_TOOLS.slice().sort())) fails.push('allowed_tools drift');
  if (JSON.stringify((c.allowed_scopes || []).slice().sort()) !== JSON.stringify(ALLOWED_SCOPES.slice().sort())) fails.push('allowed_scopes drift');
  for (const v of c.env_vars || []) {
    if (Object.prototype.hasOwnProperty.call(v, 'value')) fails.push(`env_var ${v.name}: must not carry value`);
    if (v.value_present !== false) fails.push(`env_var ${v.name}: value_present must be false`);
  }
  // Context must not allow reading raw emails / session tokens / billing /
  // other accounts. These are HARD invariants the live copilot must inherit.
  for (const flag of ['reads_raw_emails', 'reads_session_tokens', 'reads_billing_data', 'reads_other_accounts']) {
    if (!c.context || c.context[flag] !== false) fails.push(`context.${flag} must be false`);
  }
  // Response governance flags all true.
  for (const flag of ['no_signals', 'no_forecasts', 'no_price_targets', 'no_buy_sell_recommendations', 'no_guarantees', 'cite_evidence_required', 'cite_artifact_paths_required', 'educational_context_only']) {
    if (!c.response_governance || c.response_governance[flag] !== true) fails.push(`response_governance.${flag} must be true`);
  }
  // Free tier copilot quota = 0 (no free copilot — premium gate).
  if (!c.rate_limiting || c.rate_limiting.per_account_per_day_free !== 0) fails.push('rate_limiting.per_account_per_day_free must be 0 (no free copilot)');
  // Forbidden prompt patterns must be defined and non-empty.
  if (!Array.isArray(c.forbidden_prompts) || c.forbidden_prompts.length === 0) fails.push('forbidden_prompts must be non-empty');
  // Integration points must reference real artifacts.
  for (const k of Object.keys(c.integration_points || {})) {
    if (!fs.existsSync(path.join(ROOT, c.integration_points[k]))) fails.push(`integration_points.${k} -> ${c.integration_points[k]} does not exist`);
  }
  // Page exists + noindex + no <form> + no Anthropic SDK loaded.
  for (const p of ['account/copilot/index.html', 'ar/account/copilot/index.html']) {
    if (!fs.existsSync(path.join(ROOT, p))) fails.push(`page missing: ${p}`);
    else {
      const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
      if (!html.includes('noindex')) fails.push(`${p}: must be noindex`);
      if (/<form[\s>]/i.test(html)) fails.push(`${p}: <form> forbidden`);
      if (/<script[^>]+(anthropic|claude)/i.test(html)) fails.push(`${p}: AI SDK must not be loaded`);
    }
  }
  const text = JSON.stringify(c);
  for (const re of SECRET_PATTERNS) if (re.test(text)) fails.push(`secret-like content matched ${re}`);
  return fails;
}

function run() {
  const c = readJson(J('copilot-contracts.json'));
  const fails = check(c);
  if (fails.length) { fails.forEach((f) => console.error(`[check:copilot-contracts] FAIL: ${f}`)); process.exit(1); }
  console.log('[check:copilot-contracts] OK');
}

function selfTest() {
  const c = readJson(J('copilot-contracts.json'), {});
  const cases = [
    ['clean', () => check(c).length === 0, true],
    ['enabled true', () => { const m = JSON.parse(JSON.stringify(c)); m.enabled = true; return check(m).length > 0; }, true],
    ['reads_raw_emails true', () => { const m = JSON.parse(JSON.stringify(c)); m.context.reads_raw_emails = true; return check(m).length > 0; }, true],
    ['reads_other_accounts true', () => { const m = JSON.parse(JSON.stringify(c)); m.context.reads_other_accounts = true; return check(m).length > 0; }, true],
    ['gov flag off', () => { const m = JSON.parse(JSON.stringify(c)); m.response_governance.cite_evidence_required = false; return check(m).length > 0; }, true],
    ['env with value', () => { const m = JSON.parse(JSON.stringify(c)); m.env_vars[0].value = 'sk-anthropic-real-key-12345678'; return check(m).length > 0; }, true],
    ['free tier nonzero', () => { const m = JSON.parse(JSON.stringify(c)); m.rate_limiting.per_account_per_day_free = 5; return check(m).length > 0; }, true],
  ];
  let ok = 0; for (const [n, fn, expect] of cases) { if (fn() === expect) ok += 1; else console.error('  fail:', n); }
  console.log(`[check:copilot-contracts] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest(); else run();
}

module.exports = { check };
