'use strict';

// Phase 100 — Social approval queue builder.
//
// Transforms the per-platform social previews (and rendered graphic exports)
// into an explicit, human-auditable approval queue. NOTHING in this file posts
// anything or reads a credential. Each candidate becomes a queue item that
// starts 'pending' and can only leave that state via an explicit human/edit
// decision (approved/rejected) — the approval runner posts approved items only,
// behind the platform flags + URL + ledger gates.
//
// Telegram is intentionally excluded — it has its own live, URL-verified path.
//
// Decisions are STICKY: an existing queue's approved/rejected/posted status for
// a duplicate_key is preserved across rebuilds, so a rebuild never silently
// re-opens something a human already decided. Past-expiry pending items flip to
// 'expired'.
//
// Output: data/social/approval-queue.json
// Usage:  node tools/build-social-approval-queue.js [--write]

const fs = require('fs');
const path = require('path');
const { validatePayload } = require('./social/platform-content-rules');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'social', 'approval-queue.json');
const PREVIEW_PATH = path.join(ROOT, 'data', 'social', 'social-preview.json');
const EXPORTS_PATH = path.join(ROOT, 'data', 'social', 'graphic-exports.json');
const EXPIRY_HOURS = 48;

const QUEUE_PLATFORMS = new Set(['x', 'facebook', 'instagram', 'linkedin']);
const STATUSES = ['pending', 'approved', 'rejected', 'expired', 'posted', 'failed'];
const STICKY = new Set(['approved', 'rejected', 'posted', 'failed']);

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function extractUrl(text) {
  const m = String(text || '').match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

function graphicFor(exportsArtifact, platform, language) {
  if (!exportsArtifact || exportsArtifact.verified !== true) return null;
  const exp = (exportsArtifact.exports || []).find((e) => e.platform === platform);
  if (!exp || !exp.files) return null;
  return exp.files[language] || exp.files.en || null;
}

function buildQueue() {
  const preview = readJson(PREVIEW_PATH, { previews: [] });
  const exportsArtifact = readJson(EXPORTS_PATH, null);
  const existing = readJson(OUT_PATH, { items: [] });
  const nowIso = new Date().toISOString();

  // Index prior decisions by duplicate_key so they remain sticky.
  const priorByKey = new Map();
  for (const it of existing.items || []) priorByKey.set(it.duplicate_key, it);

  const items = [];
  for (const p of preview.previews || []) {
    const platform = p.platform === 'x-thread' ? 'x' : p.platform;
    if (!QUEUE_PLATFORMS.has(platform)) continue; // telegram excluded

    const language = p.language || 'en';
    const duplicateKey = `${platform}:${language}:${p.content_hash || p.dedupe_hash || ''}`;
    const sourceUrl = extractUrl(p.cta) || (language === 'ar' ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/');
    const caption = [p.body, p.cta].filter(Boolean).join('\n\n');
    const graphicPath = graphicFor(exportsArtifact, platform, language);

    const item = {
      platform,
      content_type: 'social-preview',
      source_url: sourceUrl,
      caption,
      graphic_path: graphicPath,
      language,
      duplicate_key: duplicateKey,
      content_hash: p.content_hash || null,
      created_at: nowIso,
      expiration: new Date(Date.now() + EXPIRY_HOURS * 3600000).toISOString(),
      approval_status: 'pending',
      risk_flags: [],
      preview_payload: {
        title: p.title || null,
        hook: p.hook || null,
        body: p.body || null,
        cta: p.cta || null,
        hashtags: p.hashtags || [],
        disclaimer: p.disclaimer || null,
        distribution_status: p.distribution_status || null,
        suppression_reasons: p.suppression_reasons || [],
        urgency_level: p.urgency_level || null,
        distribution_relevance_score: p.distribution_relevance_score ?? null,
      },
    };

    // Risk flags: platform content violations + carried suppression reasons.
    item.risk_flags = [
      ...validatePayload(item),
      ...((p.suppression_reasons || []).map((r) => `preview_suppressed:${r}`)),
    ];

    // Sticky prior decision wins (keeps human/posted decisions stable, but a
    // freshly-failing payload still surfaces its risk_flags for re-review).
    const prior = priorByKey.get(duplicateKey);
    if (prior && STICKY.has(prior.approval_status)) {
      item.approval_status = prior.approval_status;
      item.created_at = prior.created_at || item.created_at;
      if (prior.posted_at) item.posted_at = prior.posted_at;
    } else if (prior && prior.approval_status === 'pending' && prior.expiration && Date.parse(prior.expiration) < Date.now()) {
      item.approval_status = 'expired';
    }

    items.push(item);
  }

  const pending = items.filter((i) => i.approval_status === 'pending').length;
  return {
    version: '1.0',
    updated_at: nowIso,
    mode: 'preview_only',
    posting_enabled: false,
    credentials_required: false,
    approval_required: true,
    statuses: STATUSES,
    note: 'Approval queue. Items start pending; only explicitly approved items are eligible for delivery, and only when the platform posting flag is true, credentials exist, the source URL is 200, and the posting ledger is clear. Telegram excluded (separate canonical path).',
    counts: {
      total: items.length,
      pending,
      approved: items.filter((i) => i.approval_status === 'approved').length,
      rejected: items.filter((i) => i.approval_status === 'rejected').length,
      expired: items.filter((i) => i.approval_status === 'expired').length,
      posted: items.filter((i) => i.approval_status === 'posted').length,
      with_risk_flags: items.filter((i) => i.risk_flags.length).length,
    },
    items,
  };
}

function main() {
  const write = process.argv.includes('--write');
  const queue = buildQueue();
  console.log(`[approval-queue] items=${queue.counts.total} pending=${queue.counts.pending} risk_flagged=${queue.counts.with_risk_flags} (preview-only, posting disabled)`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
    console.log('[approval-queue] wrote data/social/approval-queue.json');
  }
}

if (require.main === module) main();

module.exports = { buildQueue, QUEUE_PLATFORMS, STATUSES };
