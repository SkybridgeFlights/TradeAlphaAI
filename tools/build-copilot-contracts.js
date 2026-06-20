'use strict';

// Phase 226 — AI Copilot Foundation (contract phase).
//
// Declares the copilot architecture: model selection, scope contracts,
// allowed tools, governance. NO API keys committed, NO model loaded, NO
// queries dispatched. The copilot CONTEXT contract limits what the future
// copilot can READ — never the public intelligence (which is open) but only
// the per-account scope (account_id + preferences + watchlists + recent
// events) plus the existing artifact set.
//
// Output: data/intelligence/copilot-contracts.json

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

const ALLOWED_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7', 'claude-opus-4-8'];
const ALLOWED_TOOLS = ['read_research_hub', 'read_entity_research_graph', 'read_change_events', 'read_personal_watchlist', 'read_preferences', 'cite_evidence'];
const ALLOWED_SCOPES = ['account.read', 'preferences.read', 'watchlists.read', 'research.read', 'changes.read', 'evidence.read'];

function build() {
  const stamp = new Date().toISOString();
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'copilot-contracts',
    contracts_version: '1.0.0',
    mode: 'contract',
    enabled: false,
    allowed_models: ALLOWED_MODELS,
    allowed_tools: ALLOWED_TOOLS,
    allowed_scopes: ALLOWED_SCOPES,
    primary_model: 'claude-haiku-4-5-20251001',
    env_vars: [
      { name: 'ANTHROPIC_API_KEY', required: true, surface: 'server', value_present: false },
      { name: 'COPILOT_MODEL', required: false, surface: 'server', value_present: false, default: 'claude-haiku-4-5-20251001' },
    ],
    context: {
      reads_public_intelligence: true,
      reads_per_account_state: true,
      reads_raw_emails: false,
      reads_session_tokens: false,
      reads_billing_data: false,
      reads_other_accounts: false,
      max_context_artifacts_per_query: 8,
    },
    response_governance: {
      no_signals: true,
      no_forecasts: true,
      no_price_targets: true,
      no_buy_sell_recommendations: true,
      no_guarantees: true,
      cite_evidence_required: true,
      cite_artifact_paths_required: true,
      educational_context_only: true,
      max_response_tokens: 2000,
    },
    rate_limiting: {
      per_account_per_day_free: 0,
      per_account_per_day_premium: 50,
      per_account_per_day_institutional: 500,
      global_concurrent_max: 10,
    },
    forbidden_prompts: [
      'predict price for X',
      'should I buy X',
      'guaranteed return',
      'price target for X',
      'will X rise/fall',
    ],
    integration_points: {
      personal_state: 'data/intelligence/personal-state-contracts.json',
      account_identity: 'data/intelligence/account-identity.json',
      research_hub: 'data/intelligence/research-hub.json',
      entity_research_graph: 'data/intelligence/entity-research-graph.json',
      change_events: 'data/intelligence/change-events.json',
      billing_contracts: 'data/intelligence/billing-contracts.json',
    },
    pages: ['/account/copilot/'],
    pages_ar: ['/ar/account/copilot/'],
    attribution: {
      sources: ['tools/build-copilot-contracts.js'],
      note: 'Copilot CONTRACT only. No model loaded, no API key, no queries dispatched. The contract bounds scope (read-only, evidence-cited, no buy/sell/forecast/target/guarantee, rate-limited per tier, capped context size).',
    },
  };
}

if (require.main === module) {
  const out = build();
  console.log(`[copilot-contracts] mode=${out.mode} enabled=${out.enabled} model=${out.primary_model} tools=${out.allowed_tools.length} scopes=${out.allowed_scopes.length}`);
  if (WRITE) {
    fs.writeFileSync(J('copilot-contracts.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log('[copilot-contracts] wrote copilot-contracts.json');
  }
}

module.exports = { build, ALLOWED_MODELS, ALLOWED_TOOLS, ALLOWED_SCOPES };
