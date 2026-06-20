'use strict';

// Phase 221 — Personal State Engine (contract phase).
//
// Defines the per-account file layout that future Phase 221 LIVE wiring
// will write to when a Clerk session arrives. No real account data is
// committed; only the layout, key derivation, lifecycle and example
// templates with __PLACEHOLDER_account_id__ values.
//
// Output: data/intelligence/personal-state-contracts.json

const fs = require('fs');
const path = require('path');
const { ALLOWED_PREFERENCES } = require('./build-account-foundation');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

const STATE_FILES = ['preferences.json', 'watchlists.json', 'workspace.json', 'followed.json', 'alerts-subscriptions.json'];

function build() {
  const stamp = new Date().toISOString();
  const exampleAccountId = '__PLACEHOLDER_account_id__';
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'personal-state-contracts',
    contracts_version: '1.0.0',
    mode: 'contract',
    write_enabled: false,
    storage: {
      // Per-account files land under data/accounts/<account_id>/. The
      // <account_id> is the opaque sub claim from the auth provider.
      // The directory is created by Phase 221 live wiring; never by hand.
      root_dir: 'data/accounts/',
      key_field: 'account_id',
      file_layout: STATE_FILES,
      ignored_in_repo: true,
      note_en: 'Per-account state lives under data/accounts/<account_id>/ at build time only. The directory is .gitignore-d to prevent leaking accounts into the repo. Future deploys mount it from secure storage.',
      note_ar: 'حالة كل حساب تعيش تحت data/accounts/<account_id>/ في وقت البناء فقط. الدليل مُستبعد عبر .gitignore لمنع تسرّب الحسابات إلى المستودع. ستركّبه عمليات النشر المستقبلية من تخزين آمن.',
    },
    example_template: {
      account_id: exampleAccountId,
      files: {
        'preferences.json': {
          account_id: exampleAccountId,
          overrides: {
            preferred_language: 'en',
            preferred_homepage: 'workspace',
            preferred_market_focus: 'broad',
          },
          updated_at: '__PLACEHOLDER_iso8601__',
        },
        'watchlists.json': {
          account_id: exampleAccountId,
          personal: [
            { id: '__PLACEHOLDER_wl_id__', title_en: 'My Watchlist', title_ar: 'قائمتي', entities: [{ type: 'asset', symbol: '__PLACEHOLDER_symbol__' }] },
          ],
        },
        'workspace.json': {
          account_id: exampleAccountId,
          followed_watchlist_ids: [],
          followed_research_ids: [],
          followed_regime_states: [],
        },
        'followed.json': {
          account_id: exampleAccountId,
          entities: [],
          research: [],
          regimes: [],
        },
        'alerts-subscriptions.json': {
          account_id: exampleAccountId,
          subscribed_classes: [],
          channels: { telegram: { enabled: false }, email: { enabled: false }, in_app: { enabled: true } },
        },
      },
    },
    integration_points: {
      auth_provider: 'data/intelligence/auth-foundation.json',
      identity_schema: 'data/intelligence/account-identity.json',
      preference_enums: 'data/intelligence/preferences.json',
      alert_classes: 'data/intelligence/alert-contracts.json',
    },
    lifecycle: {
      create_en: 'On first sign-in callback, Phase 221 live wiring creates data/accounts/<account_id>/ and seeds each file with safe defaults from the foundation contracts.',
      create_ar: 'في أول استدعاء لتسجيل الدخول، يُنشئ ربط Phase 221 الحيّ data/accounts/<account_id>/ ويزرع كل ملف بالقيم الافتراضية الآمنة من العقود التأسيسية.',
      update_en: 'Per-account writes go through validators that enforce ALLOWED_PREFERENCES enums + ALLOWED entity types + ALLOWED alert classes — the same validators the foundation contracts use.',
      update_ar: 'تمرّ كتابات كل حساب عبر مدقّقات تفرض قيم التفضيلات المسموح بها وأنواع الكيانات وأصناف التنبيهات — نفس المدقّقات التي تستخدمها العقود التأسيسية.',
      delete_en: 'Account deletion removes the whole data/accounts/<account_id>/ subtree atomically. No tombstone left behind.',
      delete_ar: 'حذف الحساب يزيل الشجرة الفرعية data/accounts/<account_id>/ بالكامل بشكل ذرّي. دون أي علامة قبور متروكة.',
    },
    governance: {
      no_real_account_ids_in_repo: true,
      no_email_addresses_in_repo: true,
      no_session_tokens_in_repo: true,
      gitignored_accounts_dir: true,
      validator_enforced_writes: true,
    },
    attribution: {
      sources: ['tools/build-personal-state.js', 'data/intelligence/auth-foundation.json', 'data/intelligence/account-identity.json', 'data/intelligence/preferences.json', 'data/intelligence/watchlist-contracts.json', 'data/intelligence/alert-contracts.json'],
      note: 'Personal state contract — per-account file layout + lifecycle + integration points. Foundation only; no real accounts exist, no writes happen until Phase 221 live wiring connects auth callbacks.',
    },
    allowed_preference_keys: Object.keys(ALLOWED_PREFERENCES),
  };
}

if (require.main === module) {
  const out = build();
  console.log(`[personal-state] mode=${out.mode} write_enabled=${out.write_enabled} files=${out.storage.file_layout.length} root=${out.storage.root_dir}`);
  if (WRITE) {
    fs.writeFileSync(J('personal-state-contracts.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log('[personal-state] wrote personal-state-contracts.json');
  }
}

module.exports = { build, STATE_FILES };
