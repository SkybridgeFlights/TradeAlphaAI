'use strict';

// Phase 100 — per-platform content validation rules.
//
// Pure, side-effect-free validators. Each returns a list of violation strings
// (empty = valid). Used by the approval-queue builder (to attach risk_flags),
// the approval runner (to block bad payloads pre-delivery), and the
// check:social-activation validator (to hard-fail malformed payloads).
//
// Limits are conservative institutional caps, not the platforms' absolute
// maxima, so captions stay readable and on-brand.

const LIMITS = {
  x:         { maxChars: 280,  maxHashtags: 3, visualFirst: false, allowsLink: true },
  facebook:  { maxChars: 1200, maxHashtags: 4, visualFirst: false, allowsLink: true },
  instagram: { maxChars: 2200, maxHashtags: 8, visualFirst: true,  allowsLink: false },
  linkedin:  { maxChars: 2600, maxHashtags: 5, visualFirst: false, allowsLink: true },
};

// Language the platform must never carry — advice, hype, fabricated urgency,
// guarantees. Matched case-insensitively against the caption body.
const ADVICE_PATTERNS = [
  /\bbuy now\b/i, /\bsell now\b/i, /\bstrong buy\b/i, /\bprice target\b/i,
  /\bguaranteed?\b/i, /\bcan'?t lose\b/i, /\bsure thing\b/i, /\bto the moon\b/i,
  /\bget rich\b/i, /\b\d+x\s+returns?\b/i, /\bfinancial advice\b/i,
  /\byou should (?:buy|sell|invest)\b/i,
];
const HYPE_PATTERNS = [
  /\bexplodes?\b/i, /\bskyrocket/i, /\bmassive gains\b/i, /\bhuge profit/i,
  /\bdon'?t miss out\b/i, /\bact (?:now|fast)\b/i, /\blast chance\b/i,
  /\burgent\b/i, /\bhurry\b/i, /\b🚀+/u,
];

function captionText(item) {
  // The deliverable caption is body + cta; hook is the headline portion.
  return [item.caption, item.body, item.hook, item.cta].filter(Boolean).join(' ').trim();
}

function countHashtags(text) {
  return (text.match(/#[\p{L}\p{N}_]+/gu) || []).length;
}

function isHttp200Url(url) {
  return typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url);
}

// Validate a single approval-queue item / preview payload for a platform.
function validatePayload(item) {
  const violations = [];
  const platform = item.platform;
  const limits = LIMITS[platform];
  if (!limits) {
    violations.push(`unknown platform "${platform}"`);
    return violations;
  }

  const text = captionText(item);
  if (!text) violations.push('empty caption');
  if (text.length > limits.maxChars) {
    violations.push(`caption ${text.length} chars exceeds ${platform} limit ${limits.maxChars}`);
  }

  const tags = countHashtags(text);
  if (tags > limits.maxHashtags) {
    violations.push(`${tags} hashtags exceeds ${platform} max ${limits.maxHashtags}`);
  }

  // Visual-first platforms (Instagram) require a graphic.
  if (limits.visualFirst && !item.graphic_path) {
    violations.push(`${platform} is visual-first but no graphic_path provided`);
  }

  // Link policy.
  const hasLink = /https?:\/\//i.test(text);
  if (hasLink && !limits.allowsLink) {
    violations.push(`${platform} does not support inline links in caption`);
  }

  // Source URL must be a well-formed http(s) URL (liveness is checked at run time).
  if (item.source_url && !/^\//.test(item.source_url) && !isHttp200Url(item.source_url)) {
    violations.push(`malformed source_url "${item.source_url}"`);
  }

  // No advice / hype / fabricated urgency.
  for (const re of ADVICE_PATTERNS) if (re.test(text)) violations.push(`advice language: ${re}`);
  for (const re of HYPE_PATTERNS)   if (re.test(text)) violations.push(`hype/urgency language: ${re}`);

  return violations;
}

module.exports = {
  LIMITS,
  ADVICE_PATTERNS,
  HYPE_PATTERNS,
  captionText,
  countHashtags,
  validatePayload,
};
