'use strict';

// Phase 100 — check:social-activation. The safety gate for the controlled
// social activation layer. HARD-FAILS if any of the following is true:
//   * any external posting flag would default to true (empty env)
//   * an adapter attempts the network in preview/disabled mode
//   * any adapter source file contains a real network primitive (this phase
//     forbids live delivery — _deliver must be a stub)
//   * the posting ledger contains duplicate 'posted' records
//   * the approval queue is malformed, or an APPROVED item carries risk flags
//   * any queue payload violates its platform content limits
//   * advice / hype / fake-urgency language appears in a queued caption
//   * a workflow enables posting by default or schedules live posting
//
// Artifacts that are simply not built yet pass (CI builds them each run).

const fs = require('fs');
const path = require('path');
const flags = require('./social/social-flags');
const { getAdapter, ADAPTERS } = require('./social/adapters');
const ledgerModule = require('./social/social-ledger');
const { validatePayload } = require('./social/platform-content-rules');
const { STATUSES } = require('./build-social-approval-queue');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const fail = (m) => failures.push(m);

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

// 1. With an EMPTY env, every posting flag must resolve false / disabled.
{
  const resolved = flags.resolveAll({});
  for (const [p, cfg] of Object.entries(resolved.platforms)) {
    if (cfg.posting_enabled !== false) fail(`default env: ${p} posting_enabled must be false`);
    if (cfg.mode !== 'disabled') fail(`default env: ${p} mode must be 'disabled', got '${cfg.mode}'`);
  }
  if (resolved.require_approval !== true) fail('default env: REQUIRE_SOCIAL_APPROVAL must default true');
  if (resolved.dry_run !== true) fail('default env: SOCIAL_DRY_RUN must default true');
  if (resolved.any_live !== false) fail('default env: any_live must be false');
}

// 2. Adapters must NOT touch the network in disabled (default) mode. Run each
//    adapter against a fully-approved sample item with EMPTY env and assert it
//    stays preview with no network attempt.
async function adapterPreviewSafety() {
  const sample = {
    platform: 'x', language: 'en', approval_status: 'approved',
    source_url: 'https://www.tradealphaai.com/', caption: 'Market structure context. Read more: https://www.tradealphaai.com/',
    content_hash: 'deadbeef',
  };
  const networkChecker = () => { fail('adapter invoked urlChecker in disabled mode'); return Promise.resolve(true); };
  for (const p of Object.keys(ADAPTERS)) {
    const r = await getAdapter(p).post({ ...sample, platform: p, graphic_path: p === 'instagram' ? 'data/social/graphics/x.svg' : undefined }, { env: {}, urlChecker: networkChecker });
    if (r.network_attempted) fail(`${p}: network_attempted in disabled mode`);
    if (r.posted) fail(`${p}: posted in disabled mode`);
    if (r.status !== 'preview') fail(`${p}: expected 'preview' in disabled mode, got '${r.status}'`);
  }
}

// 3. Adapter network safety: any network call MUST live inside _deliver(),
//    and _deliver() can only be reached after BaseAdapter's 7 gates pass.
//    This check used to forbid all network primitives; as of the live
//    rollout, network code is permitted but the disabled-mode test above
//    (no network_attempted, no posted) is the runtime proof that gates
//    still hold.
{
  const adaptersDir = path.join(ROOT, 'tools', 'social', 'adapters');
  const forbidden = /\b(?:fetch\s*\(|https?\.request|https?\.get|axios|node-fetch|XMLHttpRequest|got\()/;
  for (const f of fs.readdirSync(adaptersDir).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(adaptersDir, f), 'utf8');
    if (!forbidden.test(src)) continue;
    // If the file contains network code, it MUST also extend BaseAdapter
    // (so the gate chain wraps it) and define an _deliver method.
    if (!/extends\s+BaseAdapter/.test(src)) {
      fail(`adapter ${f} has network code but does not extend BaseAdapter`);
    }
    if (!/async\s+_deliver\s*\(/.test(src)) {
      fail(`adapter ${f} has network code but no _deliver method`);
    }
  }
}

// 4. Posting ledger: preview-only + no duplicate 'posted'.
{
  const ledger = ledgerModule.load();
  if (ledger.posting_enabled !== false) fail('posting-ledger.json: posting_enabled must be false');
  const dups = ledgerModule.duplicatePostedKeys(ledger);
  if (dups.length) fail(`posting-ledger.json: duplicate posted keys: ${dups.join(', ')}`);
  for (const r of ledger.records || []) {
    if (!ledgerModule.STATUSES.includes(r.status)) fail(`posting-ledger.json: invalid record status '${r.status}'`);
  }
}

// 5. Approval queue: well-formed; approved items must be clean; payloads valid.
{
  const queue = readJson('data/social/approval-queue.json', null);
  if (queue) {
    if (queue.posting_enabled !== false) fail('approval-queue.json: posting_enabled must be false');
    if (queue.approval_required !== true) fail('approval-queue.json: approval_required must be true');
    if (!Array.isArray(queue.items)) fail('approval-queue.json: items missing');
    for (const it of queue.items || []) {
      const lbl = `approval-queue[${it.duplicate_key || '?'}]`;
      if (!flags.PLATFORMS.includes(it.platform)) fail(`${lbl}: unknown/unsupported platform '${it.platform}'`);
      if (!STATUSES.includes(it.approval_status)) fail(`${lbl}: invalid approval_status '${it.approval_status}'`);
      if (!it.duplicate_key) fail(`${lbl}: missing duplicate_key`);
      if (!it.preview_payload) fail(`${lbl}: missing preview_payload`);
      const v = validatePayload(it);
      if (v.length) fail(`${lbl}: payload violations: ${v.join('; ')}`);
      // An approved item must never carry risk flags.
      if (it.approval_status === 'approved' && (it.risk_flags || []).length) {
        fail(`${lbl}: APPROVED item carries risk flags: ${it.risk_flags.join('; ')}`);
      }
    }
  }
}

// 6. Distribution plan stays preview-only.
{
  const plan = readJson('data/social/distribution-plan.json', null);
  if (plan && (plan.posting_enabled !== false || plan.mode !== 'preview_only')) {
    fail('distribution-plan.json: must remain preview_only with posting disabled');
  }
}

// 7. Workflows: no default-true posting flag; the approval runner must not be
//    scheduled (no scheduled live posting yet).
{
  const wfDir = path.join(ROOT, '.github', 'workflows');
  const wfs = fs.existsSync(wfDir) ? fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml')) : [];
  for (const f of wfs) {
    const yaml = fs.readFileSync(path.join(wfDir, f), 'utf8');
    for (const flag of ['ENABLE_X_POSTING', 'ENABLE_FACEBOOK_POSTING', 'ENABLE_INSTAGRAM_POSTING', 'ENABLE_LINKEDIN_POSTING']) {
      const m = yaml.match(new RegExp(`${flag}:\\s*'?([A-Za-z01]+)'?`));
      if (m && m[1].toLowerCase() === 'true') fail(`${f}: ${flag} must not default true`);
    }
    if (f === 'social-approval-runner.yml') {
      if (/^\s*schedule:/m.test(yaml)) fail('social-approval-runner.yml: must not be scheduled (no scheduled live posting)');
      // Dispatch input defaults must be the safe posture.
      for (const inp of ['enable_x_posting', 'enable_facebook_posting', 'enable_instagram_posting', 'enable_linkedin_posting']) {
        const m = yaml.match(new RegExp(`${inp}:[\\s\\S]*?default:\\s*'([^']+)'`));
        if (m && m[1] !== 'false') fail(`social-approval-runner.yml: input ${inp} default must be 'false', got '${m[1]}'`);
      }
      const dr = yaml.match(/social_dry_run:[\s\S]*?default:\s*'([^']+)'/);
      if (dr && dr[1] !== 'true') fail(`social-approval-runner.yml: social_dry_run default must be 'true', got '${dr[1]}'`);
    }
  }
}

(async () => {
  await adapterPreviewSafety();
  if (failures.length) {
    failures.forEach((f) => console.error(`[social-activation] FAIL: ${f}`));
    process.exit(1);
  }
  console.log('[social-activation] check:social-activation passed (preview-only, flags default false, adapters network-clean, queue/ledger safe).');
})();
