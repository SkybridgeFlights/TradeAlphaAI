'use strict';

const fs = require('fs');
const path = require('path');
const { ALLOWED_TIERS, ALLOWED_BILLING_PROVIDERS } = require('./build-billing-contracts');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const SECRET_PATTERNS = [/\bsk_(test|live)_[A-Za-z0-9]{16,}/, /\bpk_(test|live)_[A-Za-z0-9]{16,}/, /\b\d{13,19}\b/]; // last = card-number-ish

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function check(b) {
  const fails = [];
  if (!b) return ['billing-contracts artifact missing'];
  if (b.source_layer !== 'billing-contracts') fails.push('source_layer mismatch');
  if (b.mode !== 'contract') fails.push("mode must be 'contract'");
  if (b.enabled !== false) fails.push('enabled must be false');
  if (JSON.stringify((b.allowed_tiers || []).slice().sort()) !== JSON.stringify(ALLOWED_TIERS.slice().sort())) fails.push('allowed_tiers drift');
  if (JSON.stringify((b.allowed_providers || []).slice().sort()) !== JSON.stringify(ALLOWED_BILLING_PROVIDERS.slice().sort())) fails.push('allowed_providers drift');
  if (!ALLOWED_BILLING_PROVIDERS.includes(b.primary_provider)) fails.push(`primary_provider ${b.primary_provider} not allowed`);
  for (const p of b.providers || []) {
    if (!ALLOWED_BILLING_PROVIDERS.includes(p.id)) fails.push(`provider ${p.id} not allowed`);
    for (const v of p.env_vars || []) {
      if (Object.prototype.hasOwnProperty.call(v, 'value')) fails.push(`provider ${p.id} env var ${v.name}: must not carry value`);
      if (v.value_present !== false) fails.push(`provider ${p.id} env var ${v.name}: value_present must be false`);
    }
  }
  // Free tier must always exist and must always have public_content unwalled.
  if (!b.tiers || !b.tiers.free) fails.push('tiers.free missing');
  for (const tid of Object.keys(b.tiers || {})) {
    if (!ALLOWED_TIERS.includes(tid)) fails.push(`tier ${tid} not allowed`);
    const t = b.tiers[tid];
    if (!t.public_content || !/accessible/i.test(t.public_content)) fails.push(`tier ${tid}: public_content must declare accessibility`);
    if (!t.capabilities) fails.push(`tier ${tid}: capabilities missing`);
  }
  for (const flag of ['no_payments_collected', 'no_subscriptions_stored', 'no_public_content_gates', 'public_intelligence_free_forever', 'no_dark_patterns', 'stripe_only_via_hosted_checkout', 'no_card_numbers_in_repo']) {
    if (!b.governance || b.governance[flag] !== true) fails.push(`governance.${flag} must be true`);
  }
  // Pages exist + are noindex + no <form>.
  for (const p of ['account/billing/index.html', 'ar/account/billing/index.html', 'account/subscription/index.html', 'ar/account/subscription/index.html']) {
    if (!fs.existsSync(path.join(ROOT, p))) fails.push(`page missing: ${p}`);
    else {
      const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
      if (!html.includes('noindex')) fails.push(`${p}: must be noindex`);
      if (/<form[\s>]/i.test(html)) fails.push(`${p}: <form> forbidden`);
      if (/<script[^>]+stripe/i.test(html)) fails.push(`${p}: Stripe SDK must not be loaded`);
    }
  }
  const text = JSON.stringify(b);
  for (const re of SECRET_PATTERNS) if (re.test(text)) fails.push(`secret/card-like content matched ${re}`);
  return fails;
}

function run() {
  const b = readJson(J('billing-contracts.json'));
  const fails = check(b);
  if (fails.length) { fails.forEach((f) => console.error(`[check:billing-contracts] FAIL: ${f}`)); process.exit(1); }
  console.log('[check:billing-contracts] OK');
}

function selfTest() {
  const b = readJson(J('billing-contracts.json'), {});
  const cases = [
    ['clean', () => check(b).length === 0, true],
    ['enabled true', () => { const m = JSON.parse(JSON.stringify(b)); m.enabled = true; return check(m).length > 0; }, true],
    ['env var with value', () => { const m = JSON.parse(JSON.stringify(b)); m.providers[0].env_vars[0].value = 'sk_test_real_key_value_here'; return check(m).length > 0; }, true],
    ['governance flag off', () => { const m = JSON.parse(JSON.stringify(b)); m.governance.public_intelligence_free_forever = false; return check(m).length > 0; }, true],
    ['secret leaked', () => { const m = JSON.parse(JSON.stringify(b)); m.providers[0].docs_url = 'https://x.com?key=sk_live_ABCDEFGHIJKLMNOP1234'; return check(m).length > 0; }, true],
    ['unknown tier', () => { const m = JSON.parse(JSON.stringify(b)); m.tiers.crypto_premium = { label_en: 'x', public_content: 'accessible', capabilities: {} }; return check(m).length > 0; }, true],
  ];
  let ok = 0; for (const [n, fn, expect] of cases) { if (fn() === expect) ok += 1; else console.error('  fail:', n); }
  console.log(`[check:billing-contracts] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest(); else run();
}

module.exports = { check };
