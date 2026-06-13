'use strict';

// Phase 100 — X (Twitter) adapter. Text + link; graphic optional.
const { BaseAdapter } = require('./base-adapter');

class XAdapter extends BaseAdapter {
  constructor() { super('x'); }

  credentialPreflight(env = process.env) {
    const need = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'];
    const missing = need.filter((k) => !env[k]);
    return { ok: missing.length === 0, missing };
  }

  // INTEGRATION POINT (future phase): real X API v2 POST /2/tweets here, using
  // the preflighted OAuth credentials. Intentionally performs NO network I/O in
  // this phase — returns a not-implemented marker so nothing can post yet.
  async _deliver(/* item */) {
    return { delivered: false, status: 'live_delivery_not_implemented', external_post_id: null };
  }
}

module.exports = { XAdapter };
