'use strict';

// Phase 100 — Instagram adapter. Visual-first: requires a graphic asset; the
// platform-content-rules validator blocks text-only Instagram payloads.
const { BaseAdapter } = require('./base-adapter');

class InstagramAdapter extends BaseAdapter {
  constructor() { super('instagram'); }

  credentialPreflight(env = process.env) {
    const need = ['INSTAGRAM_BUSINESS_ACCOUNT_ID', 'INSTAGRAM_ACCESS_TOKEN'];
    const missing = need.filter((k) => !env[k]);
    return { ok: missing.length === 0, missing };
  }

  // INTEGRATION POINT (future phase): real Graph API container + publish flow
  // (POST /{ig-id}/media then /media_publish) with a rasterized graphic. No
  // network I/O in this phase.
  async _deliver(/* item */) {
    return { delivered: false, status: 'live_delivery_not_implemented', external_post_id: null };
  }
}

module.exports = { InstagramAdapter };
