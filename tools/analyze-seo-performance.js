'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRACKER = path.join(ROOT, 'data', 'seo-performance-tracker.json');
const failures = [];
const tracker = readJson(TRACKER);
const pages = Array.isArray(tracker.pages) ? tracker.pages : [];

if (!pages.length) failures.push('data/seo-performance-tracker.json: pages must not be empty');
for (const page of pages) validatePage(page);
if (failures.length) {
  console.error('SEO performance tracker check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const analyzed = pages.map(analyzePage).sort((a, b) => b.opportunity_score - a.opportunity_score);
const buckets = {
  high_impressions_low_ctr: analyzed.filter((item) => item.flags.includes('high_impressions_low_ctr')),
  low_impressions_high_priority: analyzed.filter((item) => item.flags.includes('low_impressions_high_priority')),
  indexed_low_clicks: analyzed.filter((item) => item.flags.includes('indexed_low_clicks')),
  discovered_not_indexed: analyzed.filter((item) => item.flags.includes('discovered_not_indexed') || item.flags.includes('crawled_not_indexed')),
  position_8_20: analyzed.filter((item) => item.flags.includes('position_8_20')),
  arabic_reinforcement: analyzed.filter((item) => item.flags.includes('arabic_reinforcement'))
};

console.log(`SEO performance analysis passed for ${pages.length} tracked page(s).`);
console.log('\nTop opportunities:');
for (const item of analyzed.slice(0, 12)) {
  console.log(`${item.opportunity_score.toFixed(1)} | ${item.recommended_action} | ${item.page.locale} | ${item.page.page_type} | ${item.page.url}`);
  console.log(`  flags=${item.flags.join(', ') || 'monitor'} impressions28=${item.page.impressions_28d} clicks28=${item.page.clicks_28d} ctr28=${formatPct(item.page.ctr_28d)} position28=${item.page.avg_position_28d}`);
}

console.log('\nOpportunity buckets:');
for (const [name, items] of Object.entries(buckets)) {
  console.log(`${name}: ${items.length}`);
}

function analyzePage(page) {
  const flags = [];
  const impressions = num(page.impressions_28d);
  const clicks = num(page.clicks_28d);
  const ctr = num(page.ctr_28d);
  const position = num(page.avg_position_28d);
  const priority = num(page.priority);
  let score = priority / 10;

  if (impressions >= 1000 && ctr < 0.035) {
    flags.push('high_impressions_low_ctr');
    score += 35;
  }
  if (impressions < 250 && priority >= 80) {
    flags.push('low_impressions_high_priority');
    score += 24;
  }
  if (page.indexing_status === 'indexed' && clicks < 10 && impressions >= 100) {
    flags.push('indexed_low_clicks');
    score += 18;
  }
  if (page.indexing_status === 'discovered_not_indexed') {
    flags.push('discovered_not_indexed');
    score += 40;
  }
  if (page.indexing_status === 'crawled_not_indexed') {
    flags.push('crawled_not_indexed');
    score += 38;
  }
  if (position >= 8 && position <= 20) {
    flags.push('position_8_20');
    score += 22;
  }
  if (page.locale === 'ar' && (ctr < 0.025 || impressions < 250 || position > 20)) {
    flags.push('arabic_reinforcement');
    score += 20;
  }

  return {
    page,
    flags,
    opportunity_score: Math.min(100, score),
    recommended_action: recommend(page, flags)
  };
}

function recommend(page, flags) {
  if (flags.includes('discovered_not_indexed')) return 'request indexing and add internal links';
  if (flags.includes('crawled_not_indexed')) return 'strengthen content uniqueness and depth';
  if (flags.includes('arabic_reinforcement')) return 'add Arabic internal links';
  if (flags.includes('high_impressions_low_ctr')) return 'improve title/meta';
  if (flags.includes('position_8_20')) return 'add internal links and expand content';
  if (flags.includes('indexed_low_clicks')) return 'improve FAQ/schema and related links';
  if (flags.includes('low_impressions_high_priority')) return 'add related article or hub links';
  return page.recommended_action || 'monitor';
}

function validatePage(page) {
  const label = page.url || '<missing url>';
  if (!/^https:\/\/www\.tradealphaai\.com\//.test(label)) failures.push(`${label}: url must use https://www.tradealphaai.com/`);
  for (const key of ['page_type', 'locale', 'cluster', 'target_query_group', 'indexing_status', 'last_checked', 'action_status', 'recommended_action']) {
    if (!page[key]) failures.push(`${label}: missing ${key}`);
  }
  if (!['en', 'ar'].includes(page.locale)) failures.push(`${label}: locale must be en or ar`);
  for (const key of ['priority', 'impressions_7d', 'clicks_7d', 'ctr_7d', 'avg_position_7d', 'impressions_28d', 'clicks_28d', 'ctr_28d', 'avg_position_28d']) {
    if (typeof page[key] !== 'number') failures.push(`${label}: ${key} must be numeric`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(page.last_checked || '')) failures.push(`${label}: last_checked must be YYYY-MM-DD`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${path.relative(ROOT, file)}: ${error.message}`);
    return {};
  }
}

function num(value) {
  return Number(value) || 0;
}

function formatPct(value) {
  return `${(num(value) * 100).toFixed(1)}%`;
}
