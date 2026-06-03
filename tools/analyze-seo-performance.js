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
  arabic_reinforcement: analyzed.filter((item) => item.flags.includes('arabic_reinforcement')),
  ctr_opportunity: analyzed.filter((item) => item.flags.includes('ctr_opportunity')),
  cluster_gap: analyzed.filter((item) => item.flags.includes('cluster_gap')),
};

console.log(`SEO performance analysis passed for ${pages.length} tracked page(s).`);

// --- Top opportunities ---
console.log('\n=== TOP OPPORTUNITIES ===');
for (const item of analyzed.slice(0, 12)) {
  console.log(`${item.opportunity_score.toFixed(1)} | ${item.recommended_action} | ${item.page.locale} | ${item.page.page_type} | ${item.page.url}`);
  console.log(`  flags=${item.flags.join(', ') || 'monitor'} impressions28=${item.page.impressions_28d} clicks28=${item.page.clicks_28d} ctr28=${formatPct(item.page.ctr_28d)} position28=${item.page.avg_position_28d}`);
}

// --- Position 8–20 targets ---
console.log('\n=== POSITION 8–20 OPPORTUNITIES ===');
const pos8_20 = analyzed.filter((item) => item.flags.includes('position_8_20')).sort((a, b) => num(a.page.avg_position_28d) - num(b.page.avg_position_28d));
if (!pos8_20.length) {
  console.log('  None in range.');
} else {
  for (const item of pos8_20) {
    const p = item.page;
    const potentialClicks = Math.round(num(p.impressions_28d) * 0.10) - num(p.clicks_28d);
    console.log(`  pos=${p.avg_position_28d.toFixed(1)} impressions=${p.impressions_28d} ctr=${formatPct(p.ctr_28d)} potential_extra_clicks~${Math.max(0, potentialClicks)}`);
    console.log(`    action: ${item.recommended_action}`);
    console.log(`    ${p.url}`);
  }
}

// --- CTR opportunity reporting ---
console.log('\n=== CTR OPPORTUNITIES (impressions high, CTR low) ===');
const ctrOpp = analyzed
  .filter((item) => num(item.page.impressions_28d) >= 200 && num(item.page.ctr_28d) < 0.04)
  .sort((a, b) => num(b.page.impressions_28d) - num(a.page.impressions_28d));
if (!ctrOpp.length) {
  console.log('  No low-CTR pages with meaningful impressions found.');
} else {
  for (const item of ctrOpp.slice(0, 10)) {
    const p = item.page;
    const targetCtr = 0.05;
    const addedClicks = Math.round(num(p.impressions_28d) * (targetCtr - num(p.ctr_28d)));
    console.log(`  impressions=${p.impressions_28d} ctr=${formatPct(p.ctr_28d)} → target 5% CTR would add ~${addedClicks} clicks/28d`);
    console.log(`    url: ${p.url}`);
    console.log(`    fix: rewrite title/description; add FAQPage schema if missing`);
  }
}

// --- Arabic underperformance ---
console.log('\n=== ARABIC UNDERPERFORMANCE ===');
const arPages = analyzed.filter((item) => item.page.locale === 'ar');
const arUnderperform = arPages.filter((item) => {
  const p = item.page;
  return num(p.ctr_28d) < 0.025 || num(p.avg_position_28d) > 20 || num(p.impressions_28d) < 200;
});
if (!arUnderperform.length) {
  console.log(`  All ${arPages.length} Arabic pages are performing adequately.`);
} else {
  console.log(`  ${arUnderperform.length}/${arPages.length} Arabic pages underperforming:`);
  for (const item of arUnderperform) {
    const p = item.page;
    const reason = num(p.impressions_28d) < 200 ? 'low impressions'
      : num(p.avg_position_28d) > 20 ? `position ${p.avg_position_28d.toFixed(0)}`
      : `ctr ${formatPct(p.ctr_28d)}`;
    console.log(`  [${reason}] ${p.url}`);
    console.log(`    add AR internal links from hub; verify hreflang pairing with EN counterpart`);
  }
}

// --- Cluster opportunity report ---
console.log('\n=== CLUSTER HEALTH SUMMARY ===');
const clusters = {};
for (const item of analyzed) {
  const c = item.page.cluster || 'unclustered';
  if (!clusters[c]) clusters[c] = { pages: [], total_impressions: 0, avg_position_sum: 0, count: 0, issues: 0 };
  clusters[c].pages.push(item);
  clusters[c].total_impressions += num(item.page.impressions_28d);
  if (num(item.page.avg_position_28d) > 0) {
    clusters[c].avg_position_sum += num(item.page.avg_position_28d);
    clusters[c].count++;
  }
  if (item.flags.length > 0) clusters[c].issues++;
}
for (const [name, data] of Object.entries(clusters).sort((a, b) => b[1].total_impressions - a[1].total_impressions)) {
  const avgPos = data.count > 0 ? (data.avg_position_sum / data.count).toFixed(1) : 'n/a';
  const grade = data.issues === 0 ? 'GOOD' : data.issues <= data.pages.length * 0.4 ? 'FAIR' : 'WEAK';
  console.log(`  [${grade}] ${name}: ${data.pages.length} pages impressions=${data.total_impressions} avg_pos=${avgPos} issues=${data.issues}`);
}

// --- Cluster gap: next article ideas ---
console.log('\n=== SUGGESTED NEXT ARTICLES (cluster gaps) ===');
const clusterArticleIdeas = {
  'semiconductor investing': [
    'AI chip demand cycles: hyperscaler capex and GPU procurement patterns',
    'ASML vs AMAT: semiconductor equipment stocks compared',
    'AI inference vs training: chip demand differences explained',
  ],
  'dividend investing': [
    'SCHD vs DGRO: dividend quality ETF comparison',
    'How dividend growth investing works: VIG and VYM explained',
    'Covered call income ETFs: JEPI vs XYLD risk and yield comparison',
  ],
  'ETF education': [
    'How ETF creation/redemption keeps prices close to NAV',
    'Smart beta ETFs: factor investing and methodology explained',
    'Tax efficiency in ETFs vs mutual funds: a research overview',
  ],
  'defensive investing': [
    'Minimum volatility ETFs: USMV vs SPLV compared',
    'Bond ETF duration risk: BND vs TLT during rate cycles',
    'Healthcare sector ETFs: XLV vs VHT defensive positioning',
  ],
  'comparing ETFs': [
    'VTI vs VT: domestic vs global broad market ETF comparison',
    'SPY vs IVV vs VOO: comparing S&P 500 ETF options',
    'Growth ETFs compared: VUG vs SCHG vs SPYG',
  ],
};

// Find which clusters have the most underperforming pages
const weakClusters = Object.entries(clusters)
  .filter(([, data]) => data.issues > 0)
  .sort((a, b) => (b[1].issues / b[1].pages.length) - (a[1].issues / a[1].pages.length))
  .slice(0, 5);

for (const [name] of weakClusters) {
  const ideas = clusterArticleIdeas[name];
  if (ideas) {
    console.log(`\n  Cluster: ${name} (has underperforming pages — reinforce with:`);
    for (const idea of ideas) {
      console.log(`    - ${idea}`);
    }
  }
}

// --- Reinforcement targets ---
console.log('\n=== REINFORCEMENT TARGETS ===');
const reinforcementNeeded = analyzed
  .filter((item) => item.flags.some((f) => ['indexed_low_clicks', 'low_impressions_high_priority', 'position_8_20'].includes(f)))
  .sort((a, b) => b.opportunity_score - a.opportunity_score)
  .slice(0, 10);

if (!reinforcementNeeded.length) {
  console.log('  No reinforcement targets identified.');
} else {
  for (const item of reinforcementNeeded) {
    const p = item.page;
    console.log(`  score=${item.opportunity_score.toFixed(0)} cluster=${p.cluster} ${p.url}`);
    console.log(`    action: ${item.recommended_action}`);
  }
}

// --- Bucket summary ---
console.log('\n=== OPPORTUNITY BUCKET SUMMARY ===');
for (const [name, items] of Object.entries(buckets)) {
  console.log(`  ${name}: ${items.length}`);
}

// --- Functions ---

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
  if (impressions >= 200 && ctr < 0.04 && position >= 5) {
    flags.push('ctr_opportunity');
    score += 12;
  }
  if (priority >= 70 && impressions < 100) {
    flags.push('cluster_gap');
    score += 15;
  }

  return {
    page,
    flags,
    opportunity_score: Math.min(100, score),
    recommended_action: recommend(page, flags),
  };
}

function recommend(page, flags) {
  if (flags.includes('discovered_not_indexed')) return 'request indexing and add internal links';
  if (flags.includes('crawled_not_indexed')) return 'strengthen content uniqueness and depth';
  if (flags.includes('high_impressions_low_ctr')) return 'rewrite title and meta description';
  if (flags.includes('position_8_20')) return 'add internal links, expand FAQ, and strengthen content';
  if (flags.includes('arabic_reinforcement')) return 'add Arabic internal links from hub pages';
  if (flags.includes('indexed_low_clicks')) return 'add FAQPage schema and related page links';
  if (flags.includes('ctr_opportunity')) return 'test improved title targeting the query group';
  if (flags.includes('low_impressions_high_priority')) return 'add hub and compare page cross-links';
  if (flags.includes('cluster_gap')) return 'link from cluster hub and related insight pages';
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
