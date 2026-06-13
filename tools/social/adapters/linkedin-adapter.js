'use strict';

// Phase 100 — LinkedIn adapter. Professional summary + link; graphic optional.
const { BaseAdapter } = require('./base-adapter');

class LinkedInAdapter extends BaseAdapter {
  constructor() { super('linkedin'); }

  credentialPreflight(env = process.env) {
    const need = ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_AUTHOR_URN'];
    const missing = need.filter((k) => !env[k]);
    return { ok: missing.length === 0, missing };
  }

  // INTEGRATION POINT (future phase): real UGC Posts API (POST /v2/ugcPosts)
  // here. No network I/O in this phase.
  async _deliver(/* item */) {
    return { delivered: false, status: 'live_delivery_not_implemented', external_post_id: null };
  }
}

module.exports = { LinkedInAdapter };
