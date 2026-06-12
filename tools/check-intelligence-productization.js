'use strict';

// Phase 80 validators: product schema, advice safety, Telegram realism,
// bilingual parity, sensitivity integrity, and homepage integration.

const fs = require('fs');
const path = require('path');
const { ASSETS, MODULE_CONTRACTS } = require('./build-intelligence-briefs');
const { URGENCY_LEVELS } = require('./build-intraday-brief');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  catch (error) { failures.push(`${rel}: ${error.message}`); return null; }
}

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch (error) { failures.push(`${rel}: ${error.message}`); return ''; }
}

const brief = readJson('data/intelligence/daily-intelligence-brief.json');
const intraday = readJson('data/intelligence/intraday-brief.json');
const homeEn = read('index.html');
const homeAr = read('ar/index.html');

const unsafeEnglish = /\b(buy|sell|short|long now|enter|entry|exit|stop[- ]loss|take[- ]profit|target price|guaranteed return)\b/i;
const unsafeArabic = /(اشتر|اشتري|بع الآن|ادخل الصفقة|اخرج من الصفقة|وقف الخسارة|جني الأرباح|هدف سعري|عائد مضمون)/;

if (brief) {
  if (brief.version !== '2.0' || brief.product !== 'Daily Market Brief 2.0') failures.push('daily brief: invalid product contract');
  if (typeof brief.verified !== 'boolean') failures.push('daily brief: verified flag missing');
  if (!brief.desk_lead?.en || !brief.desk_lead?.ar) failures.push('daily brief: bilingual desk lead missing');
  if (!brief.regime?.coherence || !('score' in brief.regime.coherence)) failures.push('daily brief: regime coherence missing');
  if (!Array.isArray(brief.monitoring_checklist) || brief.monitoring_checklist.length < 3) failures.push('daily brief: monitoring checklist too small');
  if (!Array.isArray(brief.asset_sensitivity) || brief.asset_sensitivity.length !== ASSETS.length) failures.push('daily brief: sensitivity universe incomplete');
  if (!Array.isArray(brief.premium_module_contracts) || brief.premium_module_contracts.length !== MODULE_CONTRACTS.length) failures.push('daily brief: premium module contracts incomplete');

  const serialized = JSON.stringify(brief);
  if (unsafeEnglish.test(serialized) || unsafeArabic.test(serialized)) failures.push('daily brief: direct advice or trade instruction language detected');
  if (!/[؀-ۿ]/.test(brief.desk_lead.ar)) failures.push('daily brief: Arabic desk lead is not Arabic');

  for (const item of brief.monitoring_checklist || []) {
    if (!item.id || !item.en || !item.ar || !item.source) failures.push('daily brief: malformed monitoring checklist item');
    if (!/^(Watch|Monitor)/.test(item.en)) failures.push(`daily brief: checklist ${item.id} is not monitoring language`);
    if (!/[؀-ۿ]/.test(item.ar)) failures.push(`daily brief: checklist ${item.id} lacks Arabic parity`);
    if (unsafeEnglish.test(item.en) || unsafeArabic.test(item.ar)) failures.push(`daily brief: unsafe checklist item ${item.id}`);
  }

  const rankedAssets = new Set();
  let lastScore = Infinity;
  for (const item of brief.asset_sensitivity || []) {
    if (!ASSETS.includes(item.asset)) failures.push(`daily brief: unknown sensitivity asset ${item.asset}`);
    if (rankedAssets.has(item.asset)) failures.push(`daily brief: duplicate sensitivity asset ${item.asset}`);
    rankedAssets.add(item.asset);
    if (!Number.isFinite(item.score) || item.score < 0 || item.score > 100) failures.push(`daily brief: invalid score for ${item.asset}`);
    if (item.score > lastScore) failures.push('daily brief: sensitivity ranking not descending');
    lastScore = item.score;
    if (!item.drivers_en?.length || item.drivers_en.length !== item.drivers_ar?.length) failures.push(`daily brief: driver parity failure for ${item.asset}`);
  }

  const leadLength = brief.desk_lead.en.length;
  if (leadLength < 80 || leadLength > 1200) failures.push('daily brief: Telegram desk lead fails realism length');
  if (!/Macro Desk:/.test(brief.desk_lead.en) || !/مكتب الماكرو:/.test(brief.desk_lead.ar)) failures.push('daily brief: institutional Telegram voice missing');
}

if (intraday) {
  const requiredArrays = ['pulse_shift', 'quote_driven_changes', 'new_contradictions', 'pressure_buildup', 'new_alerts', 'catalyst_countdown', 'changes'];
  for (const key of requiredArrays) if (!Array.isArray(intraday[key])) failures.push(`intraday: ${key} must be an array`);
  if (!URGENCY_LEVELS.includes(intraday.urgency)) failures.push('intraday: invalid urgency');
  if (typeof intraday.telegram?.eligible !== 'boolean' || typeof intraday.telegram?.sent !== 'boolean') failures.push('intraday: Telegram gate missing');
  if (intraday.telegram?.eligible !== (intraday.urgency === 'high')) failures.push('intraday: Telegram eligibility threshold violated');
  if (intraday.telegram?.sent) failures.push('intraday: artifact must not claim Telegram delivery');
  if (!intraday.snapshot || typeof intraday.snapshot.verified !== 'boolean') failures.push('intraday: snapshot contract missing');
}

for (const [name, html] of [['index.html', homeEn], ['ar/index.html', homeAr]]) {
  if ((html.match(/class="nr-watch"/g) || []).length !== 1) failures.push(`${name}: What to Watch block missing or duplicated`);
  if (!html.includes('data-intelligence-product="phase-80"')) failures.push(`${name}: Phase 80 product marker missing`);
}
if (!/[؀-ۿ]/.test((homeAr.match(/<div class="nr-watch"[\s\S]*?<\/div>\s*<div class="newsroom-pulse-strip">/) || [''])[0])) {
  failures.push('ar/index.html: What to Watch block lacks native Arabic');
}

if (failures.length) {
  failures.forEach((failure) => console.error(`[phase-80] FAIL: ${failure}`));
  process.exit(1);
}
console.log('[phase-80] intelligence productization checks passed.');
