'use strict';

// Phase 88 validator - preview safety, platform discipline, bilingual parity,
// relevance restraint, dedupe integrity, and disabled posting architecture.

const fs = require('fs');
const path = require('path');
const { PLATFORM_CONTRACTS, SOURCES } = require('./build-social-intelligence');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; }
}
function readJson(rel) {
  try { return JSON.parse(read(rel)); } catch { return null; }
}

const ADVICE = /\b(buy|sell|go long|go short|entry point|exit point|take profit|stop loss|price target|guaranteed return)\b/i;
const ADVICE_AR = /(اشتر|بيع الآن|ادخل الصفقة|اخرج من الصفقة|نقطة دخول|وقف الخسارة|جني الأرباح|عائد مضمون|هدف سعري)/;
const HYPE = /\b(don'?t miss|act now|huge opportunity|insane|shocking|you won'?t believe|to the moon|rocket|easy money)\b/i;
const HYPE_AR = /(لا تفوت|الحق الآن|فرصة ضخمة|صادم|لن تصدق|إلى القمر|أرباح سهلة)/;
const FAKE_PERFORMANCE = /\b(guaranteed|won \d+%|made \d+%|turned \$?\d+ into \$?\d+|outperformed by \d+%)\b/i;
const FAKE_URGENCY = /\b(breaking|urgent|immediately|right now|last chance)\b/i;
const RETAIL_TONE = /\b(bagholder|diamond hands|ape in|load up|massive breakout|pump|moonshot|lottery ticket)\b/i;
const ARABIC_TRANSLATION_RHYTHM = /(في نهاية اليوم|خذ بعين الاعتبار|قم بمراقبة|من المهم أن نلاحظ أن)/;

const master = readJson('data/social/social-preview.json');
if (!master) {
  failures.push('social-preview.json missing or invalid');
} else {
  if (master.version !== '2.0') failures.push('master: version must be 2.0');
  if (master.mode !== 'preview_only' || master.posting_enabled !== false) failures.push('master: preview-only posting guard missing');
  if (master.credentials_required !== false) failures.push('master: new platform credentials must not be required');
  if (master.distribution_policy?.max_story_per_platform_per_run !== 1) failures.push('master: per-platform restraint cap missing');
  if (master.distribution_policy?.max_platforms_per_story !== 3) failures.push('master: cross-platform story cap missing');
  if (master.distribution_policy?.narrative_overlap_threshold !== 0.72) failures.push('master: narrative overlap suppression missing');
  if (master.future_distribution?.retry_policy?.enabled !== false) failures.push('master: retry architecture must remain disabled');
  if (!Array.isArray(master.future_distribution?.adapters) || master.future_distribution.adapters.some((item) => item.status !== 'disabled')) {
    failures.push('master: provider adapters must exist and remain disabled');
  }

  const previews = master.previews || [];
  const dedupe = new Set();
  const platformCounts = new Map();
  for (const preview of previews) {
    const label = `${preview.platform}/${preview.language}`;
    const contract = PLATFORM_CONTRACTS[preview.platform];
    if (!contract) failures.push(`${label}: unknown platform`);
    if (!['en', 'ar'].includes(preview.language)) failures.push(`${label}: invalid language`);
    for (const field of [
      'source_artifact', 'generated_at', 'title', 'hook', 'body', 'cta', 'evidence_references',
      'related_symbols', 'hashtags', 'no_advice', 'dedupe_hash', 'source_hash',
      'visual_recommendation', 'urgency_level',
    ]) {
      if (preview[field] === undefined || preview[field] === null) failures.push(`${label}: missing ${field}`);
    }
    if (!Object.values(SOURCES).includes(preview.source_artifact)) failures.push(`${label}: unknown source artifact`);
    if (!Array.isArray(preview.evidence_references) || !preview.evidence_references.length) failures.push(`${label}: evidence references missing`);
    if (preview.no_advice !== true || preview.auto_post_allowed !== false || preview.approval_required !== true) failures.push(`${label}: safety/approval flags invalid`);
    if (!['preview_ready', 'suppressed'].includes(preview.distribution_status)) failures.push(`${label}: invalid distribution status`);
    if (preview.distribution_relevance_score < contract.threshold) failures.push(`${label}: below platform relevance threshold`);
    if (String(preview.body).length > contract.limit) failures.push(`${label}: body exceeds ${contract.limit} characters`);
    if ((preview.hashtags || []).length > contract.hashtag_cap) failures.push(`${label}: hashtag cap exceeded`);
    if (dedupe.has(preview.dedupe_hash)) failures.push(`${label}: duplicate dedupe hash in artifact`);
    dedupe.add(preview.dedupe_hash);

    const text = [preview.title, preview.hook, preview.body, ...(preview.thread || []),
      ...((preview.carousel_outline || []).map((item) => item.text))].join(' ');
    if (ADVICE.test(text) || ADVICE_AR.test(text)) failures.push(`${label}: financial advice or trade instruction detected`);
    if (HYPE.test(text) || HYPE_AR.test(text)) failures.push(`${label}: clickbait/hype detected`);
    if (FAKE_PERFORMANCE.test(text)) failures.push(`${label}: performance claim detected`);
    if (FAKE_URGENCY.test(text) && !['high', 'critical'].includes(preview.urgency_level)) failures.push(`${label}: fabricated urgency detected`);
    if (RETAIL_TONE.test(text)) failures.push(`${label}: retail-finfluencer tone detected`);
    if (preview.language === 'ar') {
      if (!/[\u0600-\u06ff]/.test(text)) failures.push(`${label}: Arabic content missing`);
      if (ARABIC_TRANSLATION_RHYTHM.test(text)) failures.push(`${label}: translated Arabic cadence detected`);
      const latinWords = (text.match(/[A-Za-z]{4,}/g) || []).length;
      const arabicWords = (text.match(/[\u0600-\u06ff]+/g) || []).length;
      if (arabicWords < 8 || latinWords > arabicWords) failures.push(`${label}: Arabic cadence/parity is too weak`);
    }
    if (preview.visual_recommendation?.render !== false) failures.push(`${label}: visual recommendation must not render`);

    const key = `${preview.platform}:${preview.language}`;
    platformCounts.set(key, (platformCounts.get(key) || 0) + 1);
    if (platformCounts.get(key) > 1) failures.push(`${label}: more than one story selected for a platform/language`);
  }

  for (const platform of new Set(previews.map((item) => item.platform))) {
    const languages = new Set(previews.filter((item) => item.platform === platform).map((item) => item.language));
    if (!languages.has('en') || !languages.has('ar')) failures.push(`${platform}: bilingual parity missing`);
  }
  for (const queued of master.approval_queue || []) {
    const preview = previews.find((item) => item.dedupe_hash === queued.dedupe_hash);
    if (!preview || preview.distribution_status !== 'preview_ready') failures.push('approval queue contains a suppressed or missing preview');
  }
}

for (const platform of ['telegram', 'x', 'instagram', 'facebook', 'linkedin']) {
  const artifact = readJson(`data/social/latest-${platform}-preview.json`);
  if (!artifact) failures.push(`latest-${platform}-preview.json missing`);
  else if (artifact.posting_enabled !== false || artifact.mode !== 'preview_only') failures.push(`latest-${platform}: posting guard missing`);
}

const ledger = readJson('data/social/posting-ledger.json');
if (!ledger || ledger.posting_enabled !== false || !Array.isArray(ledger.records)) failures.push('posting ledger foundation missing or active');

const builder = read('tools/build-social-intelligence.js') || '';
for (const forbidden of [
  'api.twitter.com', 'graph.facebook.com', 'graph.instagram.com', 'api.linkedin.com',
  'TWITTER_TOKEN', 'FACEBOOK_TOKEN', 'INSTAGRAM_TOKEN', 'LINKEDIN_TOKEN',
]) {
  if (builder.includes(forbidden)) failures.push(`builder: forbidden live provider reference ${forbidden}`);
}
if (/https?\.request|fetch\(/.test(builder)) failures.push('builder: network calls forbidden in preview mode');

const telegramSender = read('tools/send-published-article-telegram.js') || '';
if (!telegramSender || telegramSender.includes('build-social-intelligence')) failures.push('canonical Telegram sender must remain independent');
if (!read('tools/check-telegram-delivery-ledger.js')) failures.push('Telegram delivery ledger validator missing');

if (failures.length) {
  failures.forEach((failure) => console.error(`[social-intelligence] FAIL: ${failure}`));
  process.exit(1);
}
console.log(`[social-intelligence] passed (${(master?.previews || []).length} bilingual platform previews).`);
