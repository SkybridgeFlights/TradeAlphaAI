'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'intelligent-link-suggestions.json');
const write = process.argv.includes('--write');
const editorial = readJson('data/editorial-topic-queue.json', { topics: [] }).topics || [];
const outlook = readJson('data/market-outlook-queue.json', { topics: [] }).topics || [];
const suggestions = [];

for (const topic of [...editorial, ...outlook]) {
  const links = [];
  for (const symbol of topic.related_etfs || []) links.push(link(`/etfs/${slugify(symbol)}.html`, `/ar/etfs/${slugify(symbol)}.html`, symbol, 'etf'));
  for (const symbol of topic.related_stocks || []) links.push(link(`/stocks/${slugify(symbol)}.html`, `/ar/stocks/${slugify(symbol)}.html`, symbol, 'stock'));
  for (const comparison of topic.related_comparisons || []) links.push(link(`/compare/${comparison}.html`, `/ar/compare/${comparison}.html`, comparison.toUpperCase().replace(/-/g, ' '), 'comparison'));
  for (const hub of topic.related_hubs || []) links.push(link(`/${hub}.html`, `/ar/${hub}.html`, titleCase(hub), 'hub'));
  links.push(link('/rankings.html', '/ar/rankings.html', 'Market rankings', 'ranking'));
  links.push(link('/insights/index.html', '/ar/insights/index.html', 'Educational insights', 'insight_index'));
  suggestions.push({
    slug: topic.slug,
    content_type: topic.content_type || (topic.topic_cluster ? 'market_outlook' : 'insight'),
    cluster: topic.discovery_cluster || topic.topic_cluster || topic.category,
    links: dedupeLinks(links).slice(0, 10)
  });
}

const output = { version: '1.0', updated: new Date().toISOString().slice(0, 10), max_links_per_article: 10, suggestions };
if (!write) {
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}
fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Wrote ${suggestions.length} intelligent link suggestion set(s).`);

function link(en, ar, anchor, type) {
  return { en, ar, anchor, type };
}

function dedupeLinks(links) {
  const seen = new Set();
  return links.filter((item) => {
    const key = `${item.en}:${item.anchor.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return exists(item.en.slice(1)) || item.type === 'ranking' || item.type === 'insight_index';
  });
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function titleCase(value) {
  return String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function readJson(rel, fallback) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}
