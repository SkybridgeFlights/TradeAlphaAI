'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];
const today = new Date().toISOString().slice(0, 10);
const forbiddenCertainty = /\b(?:guaranteed returns?|guaranteed profits?|certain profits?|will definitely|must buy|must sell|sure profit|can't lose|price target is certain|buy now|sell now)\b/i;
const fabricatedStats = /\b(?:according to unnamed sources|sources say|rumored data|estimated official CPI|fabricated|made-up)\b/i;
const excessiveBrand = /(?:TradeAlphaAI[\s\S]*){5,}/i;
const OUTLOOK_DISCLAIMER_EN = 'This analysis is educational market commentary only and is not investment advice.';
const OUTLOOK_DISCLAIMER_AR = 'هذا التحليل عبارة عن تعليق تعليمي على الأسواق فقط ولا يُعتبر نصيحة استثمارية.';

checkEconomicCalendar();
checkMarketRegime();
checkEditorialQueue();
checkMarketOutlookQueue();
checkNewsQueue();
checkDraftTree(path.join(ROOT, 'drafts', 'editorial'), 'editorial');
checkDraftTree(path.join(ROOT, 'drafts', 'market-outlook'), 'market_outlook');
checkDraftTree(path.join(ROOT, 'drafts', 'news-analysis'), 'news_analysis');

if (warnings.length) {
  console.warn('Publishing safety warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (failures.length) {
  console.error('Publishing safety check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Publishing safety check passed.');

function checkEconomicCalendar() {
  const calendar = readJson('data/economic-calendar.json', { events: [] });
  const allowed = new Set(calendar.source_policy?.allowed_event_types || []);
  const seen = new Set();
  for (const event of calendar.events || []) {
    if (seen.has(event.id)) failures.push(`economic-calendar:${event.id}: duplicate event id`);
    seen.add(event.id);
    if (!allowed.has(event.type)) failures.push(`economic-calendar:${event.id}: unsupported event type ${event.type}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date || '')) failures.push(`economic-calendar:${event.id}: date must be YYYY-MM-DD`);
    if (!/^https?:\/\//.test(event.source_url || '')) failures.push(`economic-calendar:${event.id}: missing real source_url`);
    if (event.status !== 'confirmed') failures.push(`economic-calendar:${event.id}: status must be confirmed`);
  }
}

function checkMarketRegime() {
  const regime = readJson('data/market-regime-state.json', { state: {}, sources: [] });
  const state = regime.state || {};
  const sourceRequired = Object.values(state).some((value) => Array.isArray(value) ? value.length : value && value !== 'unverified');
  if (sourceRequired && (!Array.isArray(regime.sources) || !regime.sources.length)) failures.push('market-regime-state: verified regime labels require source URLs');
  for (const source of regime.sources || []) {
    if (!/^https?:\/\//.test(source.url || '')) failures.push('market-regime-state: source missing valid URL');
  }
}

function checkEditorialQueue() {
  const queue = readJson('data/editorial-topic-queue.json', { topics: [] });
  checkQueueBasics('editorial', queue.topics || []);
  checkClusterCooldown('editorial', queue.topics || [], 3);
}

function checkMarketOutlookQueue() {
  const queue = readJson('data/market-outlook-queue.json', { topics: [] });
  checkQueueBasics('market_outlook', queue.topics || []);
  checkClusterCooldown('market_outlook', queue.topics || [], 14);
  if (queue.policy) {
    if (queue.policy.disclaimer_en !== OUTLOOK_DISCLAIMER_EN) failures.push('market_outlook policy: required EN disclaimer mismatch');
    if (queue.policy.disclaimer_ar !== OUTLOOK_DISCLAIMER_AR) failures.push('market_outlook policy: required AR disclaimer mismatch');
  }
  for (const topic of queue.topics || []) {
    const text = JSON.stringify(topic);
    if (topic.disclaimer_en && !text.includes(OUTLOOK_DISCLAIMER_EN)) failures.push(`${topic.slug}: market outlook missing required EN disclaimer`);
    if (topic.disclaimer_ar && !text.includes(OUTLOOK_DISCLAIMER_AR)) failures.push(`${topic.slug}: market outlook missing required AR disclaimer`);
  }
}

function checkNewsQueue() {
  const queue = readJson('data/news-analysis-queue.json', { topics: [] });
  checkQueueBasics('news_analysis', queue.topics || []);
  for (const topic of queue.topics || []) {
    if (!Array.isArray(topic.sources) || topic.sources.length === 0) failures.push(`${topic.slug}: news_analysis requires explicit real sources`);
    for (const source of topic.sources || []) {
      if (!source.url || !/^https?:\/\//.test(source.url)) failures.push(`${topic.slug}: news_analysis source missing valid URL`);
    }
  }
}

function checkQueueBasics(name, topics) {
  const slugs = new Set();
  const titles = [];
  for (const topic of topics) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug || '')) failures.push(`${name}: malformed slug ${topic.slug || '<missing>'}`);
    if (slugs.has(topic.slug)) failures.push(`${name}: duplicate slug ${topic.slug}`);
    slugs.add(topic.slug);
    const title = normalize(topic.title_en || topic.title || '');
    if (title) {
      const duplicate = titles.find((existing) => similarity(existing, title) >= 0.82);
      if (duplicate) failures.push(`${name}:${topic.slug}: near-identical title to "${duplicate}"`);
      titles.push(title);
    }
  }
}

function checkClusterCooldown(name, topics, cooldownDays) {
  const recent = topics
    .filter((topic) => ['reviewed', 'scheduled', 'published'].includes(topic.status))
    .filter((topic) => topic.target_publish_date || topic.published_at)
    .sort((a, b) => String(a.target_publish_date || a.published_at).localeCompare(String(b.target_publish_date || b.published_at)));
  const lastByCluster = new Map();
  for (const topic of recent) {
    const cluster = topic.discovery_cluster || topic.category || topic.topic_cluster;
    if (!cluster) continue;
    const day = topic.target_publish_date || topic.published_at || today;
    const previous = lastByCluster.get(cluster);
    if (previous && daysBetween(previous.day, day) < cooldownDays) {
      warnings.push(`${name}:${topic.slug}: cluster "${cluster}" repeats within ${cooldownDays} days of ${previous.slug}`);
    }
    lastByCluster.set(cluster, { slug: topic.slug, day });
  }
}

function checkDraftTree(dir, type) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(dir, entry.name);
    for (const name of ['en.html', 'ar.html']) {
      const file = path.join(folder, name);
      if (!fs.existsSync(file)) continue;
      const rel = relative(file);
      const html = fs.readFileSync(file, 'utf8');
      const plain = stripHtml(html);
      if (/[\uFFFD]/.test(html) || /\?{3,}/.test(html)) failures.push(`${rel}: malformed UTF-8 or placeholder text`);
      if (name === 'ar.html' && !/<html[^>]+lang="ar"[^>]+dir="rtl"/.test(html)) failures.push(`${rel}: missing Arabic RTL marker`);
      if (forbiddenCertainty.test(plain)) failures.push(`${rel}: forbidden overconfident or advice language`);
      if (fabricatedStats.test(plain)) failures.push(`${rel}: fabricated-source wording found`);
      if (excessiveBrand.test(plain)) failures.push(`${rel}: excessive TradeAlphaAI repetition`);
      if (!/educational-disclaimer|Educational disclaimer|insight-disclaimer|إخلاء المسؤولية التعليمي|تنبيه تعليمي|educational market commentary|تعليق تعليمي/.test(html)) {
        failures.push(`${rel}: missing educational disclaimer`);
      }
      if (type === 'market_outlook' && !plain.includes(name === 'ar.html' ? OUTLOOK_DISCLAIMER_AR : OUTLOOK_DISCLAIMER_EN)) {
        failures.push(`${rel}: missing required market outlook disclaimer`);
      }
    }
  }
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(a, b) {
  const aSet = new Set(a.split(' ').filter(Boolean));
  const bSet = new Set(b.split(' ').filter(Boolean));
  if (!aSet.size || !bSet.size) return 0;
  const overlap = [...aSet].filter((word) => bSet.has(word)).length;
  return overlap / Math.max(aSet.size, bSet.size);
}

function daysBetween(a, b) {
  return Math.abs((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

function stripHtml(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function readJson(rel, fallback) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}
