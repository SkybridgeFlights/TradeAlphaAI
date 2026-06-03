'use strict';

/**
 * Analyze internal link authority across the TradeAlphaAI static site.
 * Scans HTML files for <a href> links, builds an inbound-link map,
 * detects orphan/weakly-linked pages, and reports cluster health.
 * No external APIs — purely local file analysis.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Page groups that form topical clusters
const CLUSTERS = {
  'dividend-etf': {
    hubs: ['dividend-etfs.html', 'rankings.html'],
    pages: [
      'etfs/schd.html', 'etfs/jepi.html', 'etfs/vig.html',
      'compare/jepi-vs-schd.html', 'compare/schd-vs-vig.html',
      'insights/dividend-etfs-explained.html',
    ],
  },
  'semiconductor': {
    hubs: ['semiconductor-stocks.html', 'ai-stocks.html', 'rankings.html'],
    pages: [
      'compare/nvda-vs-amd.html',
      'insights/semiconductor-stocks-outlook.html',
    ],
  },
  'beginner-etf': {
    hubs: ['etfs.html', 'rankings.html'],
    pages: [
      'etfs/spy.html', 'etfs/qqq.html',
      'compare/spy-vs-qqq.html',
      'insights/spy-vs-qqq-etf-comparison-guide.html',
      'insights/etf-expense-ratios-explained.html',
      'insights/etf-research-methodology.html',
      'insights/etf-diversification-guide.html',
      'insights/portfolio-diversification-basics.html',
    ],
  },
  'defensive-investing': {
    hubs: ['defensive-etfs.html', 'defensive-stocks.html'],
    pages: [
      'etfs/bnd.html', 'etfs/xlv.html',
      'compare/bnd-vs-ief.html',
      'insights/defensive-investing-explained.html',
    ],
  },
};

// Directories to scan for HTML files
const SCAN_DIRS = [
  '',            // root *.html
  'insights',
  'compare',
  'etfs',
  'ar',
  'ar/insights',
  'ar/compare',
  'ar/etfs',
];

function collectHtmlFiles() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    const absDir = path.join(ROOT, dir);
    if (!fs.existsSync(absDir)) continue;
    for (const entry of fs.readdirSync(absDir)) {
      if (entry.endsWith('.html')) {
        files.push(dir ? `${dir}/${entry}` : entry);
      }
    }
  }
  return files;
}

function extractLinks(html, sourceFile) {
  const links = new Set();
  const re = /href="([^"#?]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    let href = m[1].trim();
    // Skip external, mailto, tel
    if (/^(https?:|mailto:|tel:|\/\/)/i.test(href)) continue;
    // Normalise absolute paths → relative from root
    if (href.startsWith('/')) href = href.slice(1);
    // Normalise relative paths against the source file's directory
    else {
      const base = path.dirname(sourceFile).replace(/\\/g, '/');
      href = base === '.' ? href : `${base}/${href}`;
    }
    // Strip trailing index.html and leading ./
    href = href.replace(/^\.\//, '').replace(/\/index\.html$/, '/').replace(/^index\.html$/, '');
    if (href && href !== sourceFile) links.add(href);
  }
  return links;
}

function buildLinkMap(files) {
  // inbound[target] = Set of source files
  const inbound = {};
  const outbound = {};
  for (const file of files) {
    const absPath = path.join(ROOT, file);
    if (!fs.existsSync(absPath)) continue;
    const html = fs.readFileSync(absPath, 'utf8');
    const links = extractLinks(html, file);
    outbound[file] = links;
    for (const link of links) {
      if (!inbound[link]) inbound[link] = new Set();
      inbound[link].add(file);
    }
  }
  return { inbound, outbound };
}

function authorityScore(file, inbound) {
  const ibl = (inbound[file] || new Set()).size;
  // Simple log-weighted score: 0 inbound = 0, 1 = 10, 5 = 30, 20+ = ~60
  if (ibl === 0) return 0;
  return Math.min(100, Math.round(10 * Math.log2(ibl + 1) * 3.5));
}

function clusterHealth(clusterName, cluster, inbound, allFiles) {
  const allClusterPages = [...cluster.hubs, ...cluster.pages];
  const existing = allClusterPages.filter((f) => allFiles.includes(f));
  const missing = allClusterPages.filter((f) => !allFiles.includes(f));
  const scores = existing.map((f) => authorityScore(f, inbound));
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const orphans = existing.filter((f) => (inbound[f] || new Set()).size === 0);
  const weak = existing.filter((f) => {
    const ibl = (inbound[f] || new Set()).size;
    return ibl > 0 && ibl <= 2;
  });

  // Cross-link density: how well do cluster members link to each other?
  let crossLinks = 0;
  for (const src of existing) {
    const out = outbound_cache[src] || new Set();
    for (const dst of existing) {
      if (src !== dst && out.has(dst)) crossLinks++;
    }
  }
  const maxPossible = existing.length * (existing.length - 1);
  const density = maxPossible > 0 ? crossLinks / maxPossible : 0;

  return {
    cluster: clusterName,
    pages_tracked: existing.length,
    pages_missing: missing,
    avg_authority_score: Math.round(avgScore),
    cross_link_density: `${(density * 100).toFixed(1)}%`,
    orphans,
    weak_pages: weak,
    health_grade: avgScore >= 40 && orphans.length === 0 && density >= 0.25 ? 'GOOD'
      : avgScore >= 20 || density >= 0.1 ? 'FAIR'
      : 'WEAK',
  };
}

// We need outbound at cluster health time — store globally
let outbound_cache = {};

function run() {
  const allFiles = collectHtmlFiles();
  const { inbound, outbound } = buildLinkMap(allFiles);
  outbound_cache = outbound;

  const insights = allFiles.filter((f) => f.startsWith('insights/') && !f.includes('ar/'));
  const compares = allFiles.filter((f) => f.startsWith('compare/') && !f.includes('ar/'));
  const etfPages = allFiles.filter((f) => f.startsWith('etfs/') && !f.includes('ar/'));
  const hubs = allFiles.filter((f) => !f.includes('/') && f.endsWith('.html') && f !== 'index.html');

  // Authority scores for all non-AR EN pages
  const enPages = allFiles.filter((f) => !f.startsWith('ar/'));
  const scored = enPages.map((f) => ({
    file: f,
    inbound_count: (inbound[f] || new Set()).size,
    outbound_count: (outbound[f] || new Set()).size,
    authority_score: authorityScore(f, inbound),
  })).sort((a, b) => b.inbound_count - a.inbound_count);

  const orphans = scored.filter((p) => p.inbound_count === 0 && !p.file.endsWith('index.html'));
  const weakPages = scored.filter((p) => p.inbound_count >= 1 && p.inbound_count <= 2);
  const strongPages = scored.filter((p) => p.inbound_count >= 5);

  console.log('=== Internal Authority Analysis ===\n');
  console.log(`Scanned: ${allFiles.length} total HTML files`);
  console.log(`EN pages: ${enPages.length} | Insights: ${insights.length} | Comparisons: ${compares.length} | ETF pages: ${etfPages.length} | Hubs: ${hubs.length}\n`);

  // Orphan risk
  console.log(`--- ORPHAN RISK (0 inbound internal links): ${orphans.length} pages ---`);
  for (const p of orphans.slice(0, 20)) {
    console.log(`  [ORPHAN] ${p.file}`);
  }
  if (orphans.length > 20) console.log(`  ... and ${orphans.length - 20} more`);

  // Weakly linked
  console.log(`\n--- WEAKLY LINKED (1-2 inbound links): ${weakPages.length} pages ---`);
  for (const p of weakPages.slice(0, 20)) {
    console.log(`  [WEAK-${p.inbound_count}] ${p.file}`);
  }
  if (weakPages.length > 20) console.log(`  ... and ${weakPages.length - 20} more`);

  // Top authority pages
  console.log(`\n--- TOP AUTHORITY PAGES (5+ inbound links) ---`);
  for (const p of strongPages.slice(0, 15)) {
    console.log(`  score=${p.authority_score} ibl=${p.inbound_count} obl=${p.outbound_count} ${p.file}`);
  }

  // Cluster health
  console.log('\n--- TOPICAL CLUSTER HEALTH ---');
  for (const [name, cluster] of Object.entries(CLUSTERS)) {
    const health = clusterHealth(name, cluster, inbound, allFiles);
    console.log(`\n[${health.health_grade}] ${health.cluster}`);
    console.log(`  pages_tracked=${health.pages_tracked} avg_authority=${health.avg_authority_score} cross_link_density=${health.cross_link_density}`);
    if (health.orphans.length) console.log(`  orphans: ${health.orphans.join(', ')}`);
    if (health.weak_pages.length) console.log(`  weak: ${health.weak_pages.join(', ')}`);
    if (health.pages_missing.length) console.log(`  missing_files: ${health.pages_missing.join(', ')}`);
  }

  // Arabic reinforcement audit
  const arFiles = allFiles.filter((f) => f.startsWith('ar/'));
  const arOrphans = arFiles.filter((f) => (inbound[f] || new Set()).size === 0);
  const arWeak = arFiles.filter((f) => {
    const ibl = (inbound[f] || new Set()).size;
    return ibl >= 1 && ibl <= 2;
  });
  console.log(`\n--- ARABIC REINFORCEMENT ---`);
  console.log(`  Arabic files: ${arFiles.length} | Orphans: ${arOrphans.length} | Weakly linked: ${arWeak.length}`);
  for (const f of arOrphans.slice(0, 10)) console.log(`  [AR-ORPHAN] ${f}`);

  // Reinforcement actions
  console.log('\n--- REINFORCEMENT ACTIONS (priority order) ---');
  const actions = [];

  // Cluster orphans → highest priority
  for (const [name, cluster] of Object.entries(CLUSTERS)) {
    const health = clusterHealth(name, cluster, inbound, allFiles);
    for (const p of health.orphans) {
      actions.push({ priority: 10, action: `add internal links TO ${p} (cluster: ${name})` });
    }
    for (const p of health.weak_pages) {
      actions.push({ priority: 7, action: `add 2+ links TO ${p} (cluster: ${name}, only ${(inbound[p] || new Set()).size} now)` });
    }
    if (health.health_grade === 'WEAK') {
      actions.push({ priority: 8, action: `strengthen ${name} cluster: add cross-links between hub and pages` });
    }
  }

  // High-value insight orphans
  const insightOrphans = orphans.filter((p) => p.file.startsWith('insights/'));
  for (const p of insightOrphans.slice(0, 5)) {
    actions.push({ priority: 6, action: `link to ${p.file} from a relevant hub or compare page` });
  }

  // Arabic orphans
  for (const f of arOrphans.slice(0, 5)) {
    actions.push({ priority: 5, action: `add AR internal link to ${f}` });
  }

  actions.sort((a, b) => b.priority - a.priority);
  for (const a of actions.slice(0, 20)) {
    console.log(`  [P${a.priority}] ${a.action}`);
  }

  // Summary stats
  const orphanRate = enPages.length > 0 ? (orphans.length / enPages.length * 100).toFixed(1) : '0';
  const weakRate = enPages.length > 0 ? (weakPages.length / enPages.length * 100).toFixed(1) : '0';
  console.log('\n--- SUMMARY ---');
  console.log(`  Orphan rate: ${orphanRate}% (${orphans.length}/${enPages.length})`);
  console.log(`  Weak link rate: ${weakRate}% (${weakPages.length}/${enPages.length})`);
  console.log(`  Strong pages: ${strongPages.length}`);
  console.log(`  AR orphan rate: ${arFiles.length > 0 ? (arOrphans.length / arFiles.length * 100).toFixed(1) : '0'}% (${arOrphans.length}/${arFiles.length})`);
}

run();
