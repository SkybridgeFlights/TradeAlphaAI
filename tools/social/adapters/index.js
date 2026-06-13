'use strict';

// Phase 100 — adapter registry. Telegram is intentionally absent: its live,
// URL-verified delivery is the existing canonical path and is not routed
// through this controlled-activation layer.
const { XAdapter } = require('./x-adapter');
const { FacebookAdapter } = require('./facebook-adapter');
const { InstagramAdapter } = require('./instagram-adapter');
const { LinkedInAdapter } = require('./linkedin-adapter');

const ADAPTERS = {
  x: new XAdapter(),
  facebook: new FacebookAdapter(),
  instagram: new InstagramAdapter(),
  linkedin: new LinkedInAdapter(),
};

function getAdapter(platform) {
  return ADAPTERS[platform] || null;
}

module.exports = { ADAPTERS, getAdapter };
