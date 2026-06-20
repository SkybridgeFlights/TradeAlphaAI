'use strict';

// Phase 220 CP1 + CP2 — Authentication & Account Identity foundation.
//
// Extends Phase 219's account-ready foundation by introducing the first
// authentication contract. This phase does NOT bring a live auth provider
// online (no SDK installed, no keys committed). It declares the contract a
// future auth wiring will satisfy.
//
// Why hosted UI: the rest of the platform is static HTML. Embedding an auth
// SDK would change the framework. Hosted UI (Clerk's hosted sign-in URL,
// Auth0's Universal Login, etc.) lets us link out to a provider's hosted
// surface and receive a session via callback, without touching the static
// architecture.
//
// Outputs (data/intelligence/):
//   auth-foundation.json       (provider registry + env var contract +
//                                endpoint contract + flow contract)
//   account-identity.json      (account_id + session_id + scope schema;
//                                no real users)
//
// Safety: every field declares intent only. mode='contract' (no live
// integration). Phase 219's check:account-foundation rule that
// account-foundation.auth.enabled === false stays satisfied.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

// Allowed providers — closed set, validator-enforced. Adding a provider
// requires updating both the allowed set here and the validator's
// canonical reference. This prevents silent provider drift.
const ALLOWED_PROVIDERS = ['clerk', 'auth0', 'descope'];
const ALLOWED_FLOWS = ['hosted_ui', 'embedded_ui', 'api_only'];
const ALLOWED_MODES = ['contract', 'hosted', 'live'];
const ALLOWED_SCOPES = ['account.read', 'preferences.read', 'preferences.write', 'watchlists.read', 'watchlists.write', 'alerts.subscribe'];

function readJson(p, f = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; }
}

// ─── CP1 — auth-foundation.json ───────────────────────────────────────────
function buildAuthFoundation(stamp) {
  const primary = {
    id: 'clerk',
    label_en: 'Clerk',
    label_ar: 'Clerk',
    flow: 'hosted_ui',
    marketplace: 'vercel',
    docs_url: 'https://clerk.com/docs',
    // The env var contract: lists the variable NAMES the future live wiring
    // will read. Values must NEVER appear here. The validator enforces that
    // every var has a string name and no string-looking key value.
    env_vars: [
      { name: 'CLERK_PUBLISHABLE_KEY', required: true, surface: 'client', value_present: false },
      { name: 'CLERK_SECRET_KEY', required: true, surface: 'server', value_present: false },
      { name: 'CLERK_INSTANCE_URL', required: true, surface: 'both', value_present: false },
      { name: 'CLERK_SIGN_IN_URL', required: false, surface: 'client', value_present: false },
      { name: 'CLERK_SIGN_UP_URL', required: false, surface: 'client', value_present: false },
    ],
    endpoints: {
      sign_in_local: '/account/sign-in/',
      sign_up_local: '/account/sign-up/',
      verify_local: '/account/verify/',
      profile_local: '/account/profile/',
      sign_in_hosted_placeholder: 'https://<your-clerk-frontend>/sign-in',
      sign_up_hosted_placeholder: 'https://<your-clerk-frontend>/sign-up',
    },
    flow_description_en: 'Future live wiring: the local /account/sign-in/ page redirects to Clerk\'s hosted sign-in UI, which authenticates the user and redirects back to /account/verify/ with a session. Account state then lives behind Clerk; the platform only reads scopes it has been granted.',
    flow_description_ar: 'الربط الحيّ المستقبلي: تعيد الصفحة المحلية /account/sign-in/ التوجيه إلى واجهة تسجيل دخول Clerk المستضافة، التي تصادق المستخدم ثم تعيد التوجيه إلى /account/verify/ مع جلسة. حالة الحساب تبقى لدى Clerk؛ والمنصّة تقرأ فقط الصلاحيات الممنوحة لها.',
  };
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'auth-foundation',
    contracts_version: '1.0.0',
    mode: 'contract',
    enabled: false,
    allowed_providers: ALLOWED_PROVIDERS,
    allowed_flows: ALLOWED_FLOWS,
    allowed_modes: ALLOWED_MODES,
    primary_provider: primary.id,
    providers: [primary],
    governance: {
      no_passwords_in_repo: true,
      no_session_tokens_in_repo: true,
      no_user_state_fabrication: true,
      hosted_ui_only: true,
      contract_only: true,
    },
    attribution: {
      sources: ['tools/build-auth-foundation.js'],
      note: 'Authentication foundation contract. Declares the first auth provider (Clerk via hosted UI) without installing an SDK or storing credentials. The future live wiring sets mode to hosted then live; until then sign-in flows render informational shells only.',
    },
  };
}

// ─── CP2 — account-identity.json ──────────────────────────────────────────
function buildAccountIdentity(stamp) {
  // Field schema — the shape a future authenticated session will carry. Every
  // field here is a CONTRACT; no real account_id values are committed.
  const fields = {
    account_id: { type: 'string', source: 'auth provider sub claim', example_shape: 'user_*', validator: 'non-empty string, opaque' },
    session_id: { type: 'string', source: 'auth provider session token', example_shape: 'sess_*', validator: 'non-empty string, opaque' },
    primary_email_hash: { type: 'string', source: 'sha256 of primary email at auth provider', validator: '64-char hex', note_en: 'Email itself is never stored — only the hash for joining alert subscriptions.', note_ar: 'البريد الإلكتروني نفسه لا يُخزَّن — فقط التجزئة لربط اشتراكات التنبيهات.' },
    locale: { type: 'string', allowed: ['en', 'ar'], default: 'en' },
    created_at: { type: 'string', format: 'iso8601' },
    last_seen_at: { type: 'string', format: 'iso8601' },
    scopes: { type: 'array<string>', allowed_values: ALLOWED_SCOPES, default: ['account.read', 'preferences.read'] },
    tier: { type: 'string', allowed: ['free', 'premium', 'institutional'], default: 'free', note_en: 'Tier is reserved for Phase 225; default free until billing is enabled.', note_ar: 'الطبقة محجوزة لـ Phase 225؛ الافتراضي free حتى تفعيل الفوترة.' },
  };
  // Sample template — illustrates the SHAPE only. NO real account_id. Validator
  // enforces that this template's account_id matches the literal placeholder.
  const sample_template = {
    account_id: '__PLACEHOLDER_account_id__',
    session_id: '__PLACEHOLDER_session_id__',
    primary_email_hash: '__PLACEHOLDER_email_hash__',
    locale: 'en',
    created_at: '__PLACEHOLDER_iso8601__',
    last_seen_at: '__PLACEHOLDER_iso8601__',
    scopes: ['account.read', 'preferences.read'],
    tier: 'free',
  };
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'account-identity',
    contracts_version: '1.0.0',
    mode: 'contract',
    accounts_count: 0,
    fields,
    allowed_scopes: ALLOWED_SCOPES,
    sample_template,
    attribution: {
      sources: ['tools/build-auth-foundation.js'],
      note: 'Account identity schema contract. accounts_count is 0 because no live sessions exist; sample_template uses literal __PLACEHOLDER_*__ values so a validator can prove no real account leaked. Email is hashed at auth provider before reaching this contract — the platform never sees raw emails.',
    },
  };
}

function build() {
  const stamp = new Date().toISOString();
  return {
    authFoundation: buildAuthFoundation(stamp),
    accountIdentity: buildAccountIdentity(stamp),
  };
}

if (require.main === module) {
  const out = build();
  console.log(`[auth-foundation] provider=${out.authFoundation.primary_provider} mode=${out.authFoundation.mode} enabled=${out.authFoundation.enabled} env_vars=${out.authFoundation.providers[0].env_vars.length}`);
  console.log(`[account-identity] mode=${out.accountIdentity.mode} accounts=${out.accountIdentity.accounts_count} scopes=${out.accountIdentity.allowed_scopes.length}`);
  if (WRITE) {
    fs.writeFileSync(J('auth-foundation.json'), `${JSON.stringify(out.authFoundation, null, 2)}\n`, 'utf8');
    fs.writeFileSync(J('account-identity.json'), `${JSON.stringify(out.accountIdentity, null, 2)}\n`, 'utf8');
    console.log('[auth-foundation] wrote auth-foundation.json + account-identity.json');
  }
}

module.exports = { build, ALLOWED_PROVIDERS, ALLOWED_FLOWS, ALLOWED_MODES, ALLOWED_SCOPES };
