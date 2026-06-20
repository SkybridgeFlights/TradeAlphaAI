'use strict';

// Phase 225 — Billing & Tiers Foundation (contract phase).
//
// Defines the billing provider contract (Stripe via Vercel Marketplace),
// three tiers (free, premium, institutional), the tier→capability matrix,
// and the env-var contract. NO live billing, NO Stripe SDK, NO subscriptions
// stored. billing.enabled stays false in account-foundation. Public content
// stays unwalled at every tier.
//
// Output: data/intelligence/billing-contracts.json

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

const ALLOWED_TIERS = ['free', 'premium', 'institutional'];
const ALLOWED_BILLING_PROVIDERS = ['stripe', 'paddle', 'lemonsqueezy'];

function build() {
  const stamp = new Date().toISOString();
  const primary = {
    id: 'stripe',
    label_en: 'Stripe',
    marketplace: 'vercel',
    docs_url: 'https://stripe.com/docs',
    env_vars: [
      { name: 'STRIPE_PUBLISHABLE_KEY', required: true, surface: 'client', value_present: false },
      { name: 'STRIPE_SECRET_KEY', required: true, surface: 'server', value_present: false },
      { name: 'STRIPE_WEBHOOK_SECRET', required: true, surface: 'server', value_present: false },
      { name: 'STRIPE_PRICE_ID_PREMIUM', required: true, surface: 'server', value_present: false },
      { name: 'STRIPE_PRICE_ID_INSTITUTIONAL', required: true, surface: 'server', value_present: false },
    ],
    endpoints: {
      checkout_local: '/account/billing/checkout/',
      portal_local: '/account/billing/portal/',
      webhook_local: '/api/webhooks/stripe',
      checkout_hosted_placeholder: 'https://checkout.stripe.com/<session_id>',
    },
    flow_description_en: 'Future live wiring: /account/billing/ links to Stripe-hosted checkout. Webhook updates the per-account tier under data/accounts/<account_id>/billing.json. Public content remains accessible at every tier — Premium adds personal scope (watchlists count, alert classes, faster cadence), it does NOT gate public intelligence.',
    flow_description_ar: 'الربط الحيّ المستقبلي: تربط /account/billing/ بمحفظة Stripe المستضافة. يحدّث Webhook طبقة كل حساب تحت data/accounts/<account_id>/billing.json. يبقى المحتوى العام متاحاً في كل طبقة — تضيف Premium نطاقاً شخصياً (عدد قوائم المتابعة، أصناف التنبيهات، تواتر أسرع)، ولا تحجب الاستخبارات العامة.',
  };
  // Tier definitions — capability ceilings only. No content gates.
  const tiers = {
    free: {
      label_en: 'Free', label_ar: 'مجاني',
      monthly_usd: 0,
      capabilities: {
        personal_watchlists_max: 3,
        watchlist_entities_max_per_list: 12,
        alert_classes: ['regime_change', 'change_event'],
        alert_channels: ['in_app'],
        alert_cadence: 'standard',
        copilot_queries_per_day: 0,
      },
      public_content: 'all Phase 200-224 surfaces accessible',
    },
    premium: {
      label_en: 'Premium', label_ar: 'بريميوم',
      monthly_usd: null,
      capabilities: {
        personal_watchlists_max: 25,
        watchlist_entities_max_per_list: 50,
        alert_classes: ['regime_change', 'ranking_change', 'leadership_change', 'narrative_change', 'watchlist_change', 'research_change', 'change_event'],
        alert_channels: ['in_app', 'email', 'telegram'],
        alert_cadence: 'faster',
        copilot_queries_per_day: 50,
      },
      public_content: 'all Phase 200-224 surfaces accessible (same as free)',
    },
    institutional: {
      label_en: 'Institutional', label_ar: 'مؤسسي',
      monthly_usd: null,
      capabilities: {
        personal_watchlists_max: 100,
        watchlist_entities_max_per_list: 200,
        alert_classes: ['regime_change', 'ranking_change', 'leadership_change', 'narrative_change', 'watchlist_change', 'research_change', 'change_event'],
        alert_channels: ['in_app', 'email', 'telegram'],
        alert_cadence: 'priority',
        copilot_queries_per_day: 500,
        custom_research_briefs: true,
        export_csv: true,
      },
      public_content: 'all Phase 200-224 surfaces accessible (same as free)',
    },
  };
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'billing-contracts',
    contracts_version: '1.0.0',
    mode: 'contract',
    enabled: false,
    allowed_providers: ALLOWED_BILLING_PROVIDERS,
    allowed_tiers: ALLOWED_TIERS,
    primary_provider: primary.id,
    providers: [primary],
    tiers,
    governance: {
      no_payments_collected: true,
      no_subscriptions_stored: true,
      no_public_content_gates: true,
      public_intelligence_free_forever: true,
      no_dark_patterns: true,
      stripe_only_via_hosted_checkout: true,
      no_card_numbers_in_repo: true,
    },
    pages: ['/account/billing/', '/account/subscription/'],
    pages_ar: ['/ar/account/billing/', '/ar/account/subscription/'],
    attribution: {
      sources: ['tools/build-billing-contracts.js'],
      note: 'Billing CONTRACT only. No live Stripe wiring, no payments, no subscriptions. Public intelligence stays free at every tier; tiers only modulate the PERSONAL scope (watchlist counts, alert breadth, copilot quota).',
    },
  };
}

if (require.main === module) {
  const out = build();
  console.log(`[billing-contracts] mode=${out.mode} enabled=${out.enabled} provider=${out.primary_provider} tiers=${Object.keys(out.tiers).length} env_vars=${out.providers[0].env_vars.length}`);
  if (WRITE) {
    fs.writeFileSync(J('billing-contracts.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log('[billing-contracts] wrote billing-contracts.json');
  }
}

module.exports = { build, ALLOWED_TIERS, ALLOWED_BILLING_PROVIDERS };
