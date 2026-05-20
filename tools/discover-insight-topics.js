'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SEEDS_PATH = path.join(ROOT, 'data', 'insight-topic-seeds.json');
const QUEUE_PATH = path.join(ROOT, 'data', 'insight-topic-queue.json');
const EXISTING_PATH = path.join(ROOT, 'data', 'insight-topics.json');

const limit = Number(argValue('--limit') || 24);
const seeds = readJson(SEEDS_PATH);
const queue = readJson(QUEUE_PATH, { version: 1, topics: [] });
const existing = readJson(EXISTING_PATH, { articles: [] });

const knownSlugs = new Set([
  ...(existing.articles || []).map((a) => a.slug),
  ...(queue.topics || []).map((t) => t.slug),
  ...listInsightFiles()
]);

const candidates = [];
for (const cluster of seeds.clusters || []) {
  const angles = cluster.angles || [];
  for (let i = 0; i < angles.length; i += 1) {
    const angle = angles[i];
    const title = titleFor(cluster, angle);
    const slug = slugify(title);
    if (knownSlugs.has(slug)) continue;
    candidates.push({
      slug,
      title,
      category: cluster.category,
      targetKeywords: unique([...(cluster.keywords || []), ...keywordsFromAngle(angle)]).slice(0, 8),
      relatedStocks: (cluster.stocks || []).slice(0, 4),
      relatedETFs: (cluster.etfs || []).slice(0, 3),
      relatedHubs: (cluster.hubs || []).slice(0, 2),
      angle,
      audienceIntent: cluster.intent,
      priorityScore: Number((cluster.basePriority - i * 0.025).toFixed(3)),
      status: seeds.qualityRules.defaultStatus || 'candidate',
      sourceCluster: cluster.key,
      discoveredAt: today()
    });
  }
}

candidates
  .sort((a, b) => b.priorityScore - a.priorityScore || a.slug.localeCompare(b.slug))
  .slice(0, limit)
  .forEach((topic) => {
    queue.topics.push(topic);
    knownSlugs.add(topic.slug);
  });

queue.updatedAt = today();
writeJson(QUEUE_PATH, queue);

console.log(`Discovered ${Math.min(candidates.length, limit)} candidate insight topics.`);
console.log(`Queue now contains ${queue.topics.length} topics.`);

function titleFor(cluster, angle) {
  const prefix = {
    'ai-infrastructure': 'AI Infrastructure Research',
    semiconductors: 'Semiconductor Market Research',
    'gpu-market': 'GPU Market Research',
    'cloud-ai': 'Cloud AI Market Research',
    'etf-education': 'ETF Education',
    'market-cycles': 'Market Cycle Research',
    'interest-rates': 'Interest Rate Research',
    'growth-vs-value': 'Growth vs Value Research',
    diversification: 'Portfolio Diversification Research',
    volatility: 'Volatility Research',
    'dividend-etfs': 'Dividend ETF Research',
    'mega-cap-tech': 'Mega-Cap Tech Research',
    'macro-risks': 'Macro Risk Research'
  }[cluster.key] || cluster.category;
  return `${prefix}: ${titleCase(angle)}`;
}

function keywordsFromAngle(angle) {
  return String(angle).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4).slice(0, 4);
}

function titleCase(value) {
  return String(value).replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function slugify(value) {
  return String(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 78);
}

function listInsightFiles() {
  const dir = path.join(ROOT, 'insights');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.html') && name !== 'index.html').map((name) => name.replace(/\.html$/, ''));
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : fallback;
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
