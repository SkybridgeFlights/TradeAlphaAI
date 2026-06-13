'use strict';

// Phase 100 — posting ledger: the idempotency + audit spine of social delivery.
//
// The ledger is the ONLY authority on what has actually been posted. Every
// genuine delivery (and every recorded failure) appends a record keyed by a
// duplicate_key (platform + content_hash + language). The runner consults the
// ledger BEFORE any delivery so the same item can never be posted twice, and
// EN/AR can never collide because language is part of the key.
//
// posting_enabled stays false here; this module records outcomes, it does not
// decide whether posting is allowed (that is the flags + approval + adapter).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LEDGER_PATH = path.join(ROOT, 'data', 'social', 'posting-ledger.json');

const STATUSES = ['posted', 'failed', 'skipped', 'dry_run'];

function emptyLedger() {
  return {
    version: '2.0',
    posting_enabled: false,
    note: 'Records actual delivery outcomes only. No record is written in preview/dry-run for a real post; dry-run rehearsals are marked status=dry_run and never count as posted.',
    records: [],
  };
}

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    if (!Array.isArray(data.records)) data.records = [];
    if (typeof data.posting_enabled !== 'boolean') data.posting_enabled = false;
    if (!data.version) data.version = '2.0';
    return data;
  } catch {
    return emptyLedger();
  }
}

function save(ledger) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

function duplicateKey(item) {
  return `${item.platform}:${item.language || 'en'}:${item.content_hash || item.duplicate_key || ''}`;
}

// Has a real post already been delivered for this duplicate key?
// dry_run rehearsals do NOT count — only a genuine 'posted' record blocks.
function alreadyPosted(ledger, item) {
  const key = duplicateKey(item);
  return ledger.records.some((r) => r.duplicate_key === key && r.status === 'posted');
}

// Append an outcome record. Idempotent for 'posted': refuses to add a second
// 'posted' record for the same duplicate key.
function record(ledger, entry) {
  if (!STATUSES.includes(entry.status)) {
    throw new Error(`invalid ledger status "${entry.status}"`);
  }
  const key = entry.duplicate_key || duplicateKey(entry);
  if (entry.status === 'posted' && ledger.records.some((r) => r.duplicate_key === key && r.status === 'posted')) {
    return { added: false, reason: 'duplicate_posted' };
  }
  ledger.records.push({
    platform: entry.platform,
    source_url: entry.source_url || null,
    content_hash: entry.content_hash || null,
    graphic_hash: entry.graphic_hash || null,
    language: entry.language || 'en',
    posted_at: entry.status === 'posted' ? new Date().toISOString() : null,
    external_post_id: entry.external_post_id || null,
    status: entry.status,
    error: entry.error || null,
    retry_count: Number.isFinite(entry.retry_count) ? entry.retry_count : 0,
    duplicate_key: key,
    recorded_at: new Date().toISOString(),
  });
  return { added: true };
}

// Find duplicate 'posted' records (validator support).
function duplicatePostedKeys(ledger) {
  const seen = new Map();
  const dups = [];
  for (const r of ledger.records) {
    if (r.status !== 'posted') continue;
    seen.set(r.duplicate_key, (seen.get(r.duplicate_key) || 0) + 1);
  }
  for (const [k, n] of seen) if (n > 1) dups.push(k);
  return dups;
}

module.exports = {
  LEDGER_PATH,
  STATUSES,
  emptyLedger,
  load,
  save,
  duplicateKey,
  alreadyPosted,
  record,
  duplicatePostedKeys,
};
