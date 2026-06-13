'use strict';

// Phase 100 — base social adapter: the gated delivery state machine.
//
// SAFETY CONTRACT (enforced here and re-checked by check:social-activation):
//   * The ONLY method that may ever touch an external network is _deliver().
//   * _deliver() is unreachable unless EVERY gate below passes AND the resolved
//     mode is 'live'. In 'disabled' (default) and 'dry_run' modes the method is
//     never called and `network_attempted` stays false.
//   * The concrete adapters' _deliver() is, in this phase, a documented stub
//     that performs NO network I/O and returns live_delivery_not_implemented.
//     Real HTTP integration is a deliberate future flip — so even a fully
//     mis-flagged environment (posting=true, dry-run=false, approved, creds
//     present, URL 200) still cannot emit an external post today.
//
// Gates, in order: payload validity → approval → credentials → URL liveness →
// duplicate ledger → rate limit → mode. Any failed gate returns a structured
// blocked outcome and records nothing as posted.

const { modeFor, requireApproval } = require('../social-flags');
const { validatePayload } = require('../platform-content-rules');
const ledgerModule = require('../social-ledger');

class BaseAdapter {
  constructor(platform) {
    this.platform = platform;
  }

  // Read this platform's credentials from env. NEVER throws, NEVER fails CI —
  // missing credentials simply mean we stay preview-only. Override per platform.
  credentialPreflight(/* env */) {
    return { ok: false, missing: ['<not configured>'], note: 'no credential schema wired yet' };
  }

  // Rate-limit guard: at most one genuine post per duplicate key per window, and
  // a soft cap of recent posts. The ledger is the source of truth.
  rateLimitGuard(ledger, windowMinutes = 10, maxPerWindow = 5) {
    const since = Date.now() - windowMinutes * 60000;
    const recent = (ledger.records || []).filter(
      (r) => r.platform === this.platform && r.status === 'posted' && r.posted_at && new Date(r.posted_at).getTime() >= since,
    );
    return { ok: recent.length < maxPerWindow, recent: recent.length };
  }

  // The single external-delivery seam. Concrete adapters override this. In this
  // phase it MUST NOT perform network I/O — it returns a not-implemented marker.
  async _deliver(/* item */) {
    return { delivered: false, status: 'live_delivery_not_implemented', external_post_id: null };
  }

  // Orchestrate all gates. Returns a structured outcome; never throws on a
  // gating failure (only on programmer error).
  async post(item, { env = process.env, ledger, urlChecker } = {}) {
    const lg = ledger || ledgerModule.load();
    const base = { platform: this.platform, language: item.language || 'en', posted: false, network_attempted: false };

    const mode = modeFor(this.platform, env);

    // Gate 0: disabled (the default) — short-circuit, never look further.
    if (mode === 'disabled') {
      return { ...base, status: 'preview', mode, reason: 'posting flag false (default)' };
    }

    // Gate 1: payload validity.
    const violations = validatePayload(item);
    if (violations.length) {
      return { ...base, status: 'blocked_invalid_payload', mode, violations };
    }

    // Gate 2: approval.
    if (requireApproval(env) && item.approval_status !== 'approved') {
      return { ...base, status: 'blocked_unapproved', mode, reason: `approval_status=${item.approval_status || 'pending'}` };
    }

    // Gate 3: credentials.
    const cred = this.credentialPreflight(env);
    if (!cred.ok) {
      return { ...base, status: 'blocked_no_credentials', mode, missing: cred.missing };
    }

    // Gate 4: production URL must be live (200). Relative URLs are resolved by
    // the caller's urlChecker; absence of a checker is treated as "cannot verify".
    if (item.source_url) {
      if (typeof urlChecker !== 'function') {
        return { ...base, status: 'blocked_url_unverified', mode, reason: 'no url checker provided' };
      }
      const live = await urlChecker(item.source_url);
      if (!live) {
        return { ...base, status: 'blocked_url_not_live', mode, reason: `source_url not 200: ${item.source_url}` };
      }
    }

    // Gate 5: duplicate ledger.
    if (ledgerModule.alreadyPosted(lg, item)) {
      return { ...base, status: 'blocked_duplicate', mode, reason: 'duplicate_key already posted' };
    }

    // Gate 6: rate limit.
    const rl = this.rateLimitGuard(lg);
    if (!rl.ok) {
      return { ...base, status: 'blocked_rate_limited', mode, recent: rl.recent };
    }

    // Gate 7: dry-run rehearsal — all gates passed but we deliberately do not
    // deliver. This is the "approved + flagged but rehearsing" safe state.
    if (mode === 'dry_run') {
      return { ...base, status: 'dry_run', mode, reason: 'all gates passed; SOCIAL_DRY_RUN on — not delivering' };
    }

    // Mode === 'live': the only path that may attempt delivery.
    let result;
    try {
      result = await this._deliver(item);
    } catch (err) {
      return { ...base, status: 'failed', mode, network_attempted: true, error: String(err && err.message || err) };
    }
    const delivered = Boolean(result && result.delivered);
    return {
      ...base,
      posted: delivered,
      network_attempted: true,
      status: delivered ? 'posted' : (result && result.status) || 'not_delivered',
      external_post_id: (result && result.external_post_id) || null,
    };
  }
}

module.exports = { BaseAdapter };
