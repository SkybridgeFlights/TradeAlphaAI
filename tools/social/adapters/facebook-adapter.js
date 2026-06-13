'use strict';

// Phase 100 — Facebook Page adapter. Simplified summary + link; graphic optional.
const { BaseAdapter } = require('./base-adapter');

class FacebookAdapter extends BaseAdapter {
  constructor() { super('facebook'); }

  credentialPreflight(env = process.env) {
    const need = ['FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'];
    const missing = need.filter((k) => !env[k]);
    return { ok: missing.length === 0, missing };
  }

  // INTEGRATION POINT (future phase): real Graph API POST /{page-id}/feed here.
  // No network I/O in this phase.
  async _deliver(/* item */) {
    return { delivered: false, status: 'live_delivery_not_implemented', external_post_id: null };
  }
}

module.exports = { FacebookAdapter };
