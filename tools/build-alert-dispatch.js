'use strict';

// Phase 222 — Alert Dispatch Contract (regime_change only).
//
// Extends Phase 219's alert-contracts.json with a DISPATCH-LAYER contract
// that defines HOW the first alert class (regime_change — sparsest, highest
// confidence, lowest blast radius) will eventually fire. No actual dispatch
// happens. The existing controlled Telegram path stays untouched.
//
// Output: data/intelligence/alert-dispatch.json

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

const ALLOWED_CHANNELS = ['telegram', 'email', 'in_app'];

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function build() {
  const stamp = new Date().toISOString();
  // Pull recent regime events from change-events so the contract's
  // example payload uses REAL-shape data (no fabrication; if no
  // regime events exist the example is honestly empty).
  const events = readJson(J('change-events.json'), { events: [] });
  const sampleEvent = (events.events || []).find((e) => e.change_type === 'regime_shift') || null;
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'alert-dispatch',
    contracts_version: '1.0.0',
    mode: 'contract',
    dispatch_enabled: false,
    primary_class: 'regime_change',
    allowed_channels: ALLOWED_CHANNELS,
    // Phase 222 shipped regime_change first. Phase 224 extends to all 7
    // allowed classes — each with its own confidence + throttle contract.
    // dispatch_enabled stays false; this just defines per-class rules.
    classes_with_dispatch: ['regime_change', 'ranking_change', 'leadership_change', 'narrative_change', 'watchlist_change', 'research_change', 'change_event'],
    channels: {
      telegram: {
        enabled: false,
        path: '.github/workflows/distribution-brain.yml (existing controlled path)',
        gate_en: 'URL-200-gated. ENABLE_TELEGRAM_PUBLISH must be exactly "true" AND TELEGRAM_* secrets must be present. The dispatch layer NEVER bypasses these gates.',
        gate_ar: 'محكوم بشرط URL=200. يجب أن يكون ENABLE_TELEGRAM_PUBLISH بالضبط "true" وأن تكون أسرار TELEGRAM_* موجودة. لا تتجاوز طبقة الإرسال هذه الشروط أبداً.',
        rate_limit_per_account: '1 message per regime transition per account',
      },
      email: {
        enabled: false,
        path: 'Reserved for future provider (e.g. Resend via Vercel Marketplace)',
        env_vars_needed: ['EMAIL_PROVIDER_API_KEY', 'EMAIL_FROM_ADDRESS'],
        rate_limit_per_account: '1 message per regime transition per account',
      },
      in_app: {
        enabled: false,
        path: '/account/alerts/inbox/ (built by Phase 224)',
        rate_limit_per_account: 'no rate limit (in_app inbox is pull, not push)',
      },
    },
    classes: {
      regime_change: {
        source: 'data/intelligence/change-events.json (filtered to entity_type=regime)',
        trigger_en: 'A regime_shift event with confidence=high is emitted by build-change-events.',
        trigger_ar: 'إصدار حدث regime_shift بثقة عالية من build-change-events.',
        min_confidence: 'high',
        throttle: { per_account_per_day: 1, per_account_per_week: 3, global_cooldown_minutes: 60 },
        payload_shape: {
          alert_id: 'sha256(class|account_id|event_id|date) — 16-char short id',
          class: 'regime_change',
          account_id: '__PLACEHOLDER_account_id__',
          event_id: '__PLACEHOLDER_event_id__',
          from_state: 'string', to_state: 'string', confidence: 'high', generated_at: 'iso8601',
          href: '/changes/regime/',
        },
        sample_event_id: sampleEvent ? sampleEvent.id : null,
        sample_evidence: sampleEvent ? (sampleEvent.evidence || []).slice(0, 2) : ['no regime_shift event in current change-events.json — sample left empty (honest)'],
      },
      ranking_change: {
        source: 'data/intelligence/change-events.json (filtered to entity_type in [asset,sector,equity,etf] + change_type in [improving,weakening,deteriorating])',
        trigger_en: 'An entity ranking transitions to a meaningfully different label between snapshots.',
        trigger_ar: 'انتقال ترتيب كيان إلى تصنيف مختلف بشكل ملموس بين لقطتين.',
        min_confidence: 'high', throttle: { per_account_per_day: 5, per_account_per_week: 20, global_cooldown_minutes: 30 },
        payload_shape: { alert_id: 'sha256', class: 'ranking_change', account_id: '__PLACEHOLDER_account_id__', entity: 'symbol', entity_type: 'asset|sector|equity|etf', from_state: 'string', to_state: 'string', confidence: 'high', generated_at: 'iso8601', href: '/changes/<entity_type>s/' },
      },
      leadership_change: {
        source: 'data/intelligence/change-events.json (filtered to change_type in [leadership_gain,leadership_loss])',
        trigger_en: 'A leadership_gain or leadership_loss event for a watchlist entity is emitted.',
        trigger_ar: 'إصدار حدث اكتساب أو فقدان قيادة لكيان من قائمة المتابعة.',
        min_confidence: 'high', throttle: { per_account_per_day: 3, per_account_per_week: 12, global_cooldown_minutes: 45 },
        payload_shape: { alert_id: 'sha256', class: 'leadership_change', account_id: '__PLACEHOLDER_account_id__', entity: 'symbol', entity_type: 'asset|sector|equity', change_type: 'leadership_gain|leadership_loss', confidence: 'high', generated_at: 'iso8601' },
      },
      narrative_change: {
        source: 'data/intelligence/change-events.json (filtered to change_type=narrative_shift)',
        trigger_en: 'The dominant market narrative transitions vs a recorded prior stance.',
        trigger_ar: 'انتقال السردية المهيمنة في السوق مقابل موقف سابق مسجّل.',
        min_confidence: 'high', throttle: { per_account_per_day: 1, per_account_per_week: 2, global_cooldown_minutes: 120 },
        payload_shape: { alert_id: 'sha256', class: 'narrative_change', account_id: '__PLACEHOLDER_account_id__', from_state: 'string', to_state: 'string', confidence: 'high', generated_at: 'iso8601', href: '/research/regime/' },
      },
      watchlist_change: {
        source: 'data/intelligence/watchlist-monitoring.json (per-entity monitor_state/rank/recent_change_count deltas)',
        trigger_en: 'A watchlist entity\'s monitor_state, rank or recent_change_count changes between runs.',
        trigger_ar: 'تغيّر حالة المتابعة أو الرتبة أو عدد التغيرات الأخيرة لكيان في قائمة المتابعة بين تشغيلين.',
        min_confidence: 'moderate', throttle: { per_account_per_day: 8, per_account_per_week: 35, global_cooldown_minutes: 20 },
        payload_shape: { alert_id: 'sha256', class: 'watchlist_change', account_id: '__PLACEHOLDER_account_id__', watchlist_id: 'string', entity: 'symbol', from_state: 'string', to_state: 'string', confidence: 'moderate', generated_at: 'iso8601' },
      },
      research_change: {
        source: 'data/intelligence/research-hub.json + data/intelligence/research-coverage.json (category/item composition deltas)',
        trigger_en: 'A research category or item composition changes between runs.',
        trigger_ar: 'تغيّر تكوين فئة أبحاث أو عنصر بحثي بين تشغيلين.',
        min_confidence: 'moderate', throttle: { per_account_per_day: 4, per_account_per_week: 15, global_cooldown_minutes: 60 },
        payload_shape: { alert_id: 'sha256', class: 'research_change', account_id: '__PLACEHOLDER_account_id__', category: 'string', delta: 'string', confidence: 'moderate', generated_at: 'iso8601', href: '/research/feed/' },
      },
      change_event: {
        source: 'data/intelligence/change-events.json (any allowed change_type that does not match a more specific class above)',
        trigger_en: 'Catch-all — any new change event emitted that did not match a more specific class.',
        trigger_ar: 'فئة شاملة — أي حدث تغيير جديد لم يطابق فئة أكثر تحديداً أعلاه.',
        min_confidence: 'moderate', throttle: { per_account_per_day: 10, per_account_per_week: 50, global_cooldown_minutes: 15 },
        payload_shape: { alert_id: 'sha256', class: 'change_event', account_id: '__PLACEHOLDER_account_id__', event_id: '__PLACEHOLDER_event_id__', change_type: 'string', confidence: 'moderate', generated_at: 'iso8601' },
      },
    },
    governance: {
      no_signals: true,
      no_forecasts: true,
      no_price_targets: true,
      no_dispatch_in_contract_phase: true,
      url_200_gated: true,
      opt_in_only: true,
      respects_existing_telegram_gates: true,
      no_fabricated_alerts: true,
    },
    integration_points: {
      alert_contracts: 'data/intelligence/alert-contracts.json',
      change_events: 'data/intelligence/change-events.json',
      personal_state: 'data/intelligence/personal-state-contracts.json',
      account_identity: 'data/intelligence/account-identity.json',
    },
    attribution: {
      sources: ['data/intelligence/alert-contracts.json', 'data/intelligence/change-events.json', 'tools/build-alert-dispatch.js'],
      note: 'Alert dispatch CONTRACT for regime_change only. dispatch_enabled=false; no message is ever sent. The existing controlled Telegram pipeline is not touched.',
    },
  };
}

if (require.main === module) {
  const out = build();
  console.log(`[alert-dispatch] mode=${out.mode} dispatch_enabled=${out.dispatch_enabled} classes_with_dispatch=${out.classes_with_dispatch.length} channels=${out.allowed_channels.length}`);
  if (WRITE) {
    fs.writeFileSync(J('alert-dispatch.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log('[alert-dispatch] wrote alert-dispatch.json');
  }
}

module.exports = { build, ALLOWED_CHANNELS };
