'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'intelligence', 'publishing-report.json');
const TELEGRAM_STATUS = path.join(ROOT, 'data', 'intelligence', 'telegram-status.json');

function buildPublishingReport(decision = {}) {
  const topic = String(decision.topic || decision.selected_topic || '').trim();
  const slug = extractSlug(topic);
  const publicPages = findPublicPages(slug);
  const drafts = findDrafts(slug);
  const publishResult = String(decision.publish_result || 'not requested');
  const stopReason = String(decision.stop_reason || '').trim();
  const blockReason = deriveBlockReason(decision, publishResult, stopReason);
  const telegram = readJson(TELEGRAM_STATUS, {});
  // Authoritative publication signal: filesystem verification takes precedence
  // over string matching so callers don't need to match publish_result text.
  const published = publicPages.length > 0 || /^published/i.test(publishResult);

  return {
    timestamp: new Date().toISOString(),
    brain_mode: decision.selected_mode || decision.brain_mode || 'unknown',
    selected_topic: topic || null,
    selected_content_type: decision.selected_content_type || 'unknown',
    generation_result: decision.generation_result || 'not requested',
    publish_result: publishResult,
    published,
    publish_block_reason: blockReason,
    telegram_sent: telegram.sent === true || /\b(sent|published)\b/i.test(String(decision.telegram_result || '')),
    public_pages_created: publicPages,
    drafts_created: drafts,
    quality_score: parseQualityScore(decision.quality_score),
    approval_state: deriveApprovalState(decision, published),
    cooldown_blocked: /cooldown/i.test(`${blockReason} ${decision.duplicate_cooldown_result || ''}`),
    manual_review_required: /manual[_ -]?revision|required manual|manual review/i.test(
      `${blockReason} ${decision.current_state || ''} ${decision.review_result || ''}`
    )
  };
}

function writePublishingReport(decision = {}) {
  const report = buildPublishingReport(decision);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[publishing-report] Wrote ${path.relative(ROOT, OUTPUT).replaceAll('\\', '/')}`);
  return report;
}

function printFinalDecision(report) {
  const published = report.published === true;
  const generatedDraft = /draft/i.test(String(report.generation_result));
  const mode = published ? 'published' : generatedDraft ? 'draft_only' : 'blocked';
  const reason = published ? 'quality_and_publish_gates_passed' : normalizeReason(report.publish_block_reason || report.publish_result);
  const telegramAllowed = published ? 'yes' : 'no';
  console.log('\n[PUBLISH DECISION]');
  console.log(`mode=${mode}`);
  console.log(`reason=${reason}`);
  console.log(`telegram=${report.telegram_sent ? 'yes' : 'no'}`);
  if (!report.telegram_sent && !published) console.log('telegram_reason=not_published');
  console.log(`public_pages=${report.public_pages_created.length}`);
  console.log(`drafts=${report.drafts_created.length}`);
  console.log(`approval_state=${report.approval_state}`);
  console.log('\n[PUBLISH REPORT]');
  console.log(`published=${published}`);
  console.log(`publish_result=${report.publish_result}`);
  console.log(`telegram_allowed=${telegramAllowed}`);
}

function findPublicPages(slug) {
  if (!slug) return [];
  return [
    `insights/${slug}.html`,
    `en/insights/${slug}.html`,
    `ar/insights/${slug}.html`,
    `market-outlook/${slug}.html`,
    `en/market-outlook/${slug}.html`,
    `ar/market-outlook/${slug}.html`
  ].filter((relative) => fs.existsSync(path.join(ROOT, relative)));
}

function findDrafts(slug) {
  if (!slug) return [];
  const candidates = [
    `drafts/editorial/${slug}/en.html`,
    `drafts/editorial/${slug}/ar.html`,
    `drafts/market-outlook/${slug}/en.html`,
    `drafts/market-outlook/${slug}/ar.html`,
    `drafts/news-analysis/${slug}.json`
  ];
  return candidates.filter((relative) => fs.existsSync(path.join(ROOT, relative)));
}

function extractSlug(topic) {
  if (!topic) return '';
  const match = topic.match(/[a-z0-9]+(?:-[a-z0-9]+)+/i);
  return match ? match[0].toLowerCase() : '';
}

function deriveBlockReason(decision, publishResult, stopReason) {
  if (/^published/i.test(publishResult)) return '';
  const detailedPublishReason = /^blocked:\s*(.+)/i.exec(publishResult);
  const reason = stopReason && stopReason !== 'none'
    ? stopReason
    : detailedPublishReason
      ? detailedPublishReason[1]
      : String(decision.publish_gate_result || publishResult || 'not published');
  return normalizeReason(reason);
}

function deriveApprovalState(decision, published = false) {
  if (published || /^published/i.test(String(decision.publish_result))) return 'published';
  if (/manual[_ -]?revision/i.test(`${decision.publish_result || ''} ${decision.transition_path || ''}`)) return 'manual_revision_required';
  if (/approved/i.test(String(decision.publish_gate_result))) return 'approved';
  return decision.current_state || 'not_approved';
}

function parseQualityScore(value) {
  if (Number.isFinite(value)) return value;
  const match = String(value || '').match(/(\d+(?:\.\d+)?)\s*\//);
  return match ? Number(match[1]) : null;
}

function normalizeReason(value) {
  return String(value || 'not_published')
    .toLowerCase()
    .replace(/^blocked:\s*/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 160) || 'not_published';
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

if (require.main === module) {
  const input = process.argv.find((arg) => arg.startsWith('--input='));
  const payload = input ? readJson(path.resolve(ROOT, input.slice(8)), {}) : {};
  const report = writePublishingReport(payload);
  printFinalDecision(report);
}

module.exports = {
  buildPublishingReport,
  printFinalDecision,
  writePublishingReport
};
