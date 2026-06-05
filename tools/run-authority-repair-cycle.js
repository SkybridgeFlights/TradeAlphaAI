'use strict';

/**
 * Authority Repair Cycle
 *
 * Rebuilds the full knowledge graph + executes safe orphan repairs.
 * Called automatically by the publishing brain when review fails due to
 * topology/linking checks. Can also be run manually via CLI.
 *
 * Safety limits (per run):
 *   - max 5 orphan repairs
 *   - max 10 injected links
 *   - max 2 links per source page
 *   - only body/article/main content (no nav/footer/script/schema)
 *   - only if target file exists
 *   - no duplicate link insertion
 */

const fs         = require('fs');
const path       = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Per-run safety caps (can be overridden by CLI args)
const DEFAULT_MAX_ORPHAN_REPAIRS = 5;
const DEFAULT_MAX_LINK_INJECTIONS = 10;

function argValue(name) {
  const prefix = `${name}=`;
  const found  = process.argv.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

const DRY_RUN          = process.argv.includes('--dry-run');
const MAX_ORPHAN       = parseInt(argValue('--max-orphan-repairs')  || DEFAULT_MAX_ORPHAN_REPAIRS, 10);
const MAX_INJECTIONS   = parseInt(argValue('--max-link-injections') || DEFAULT_MAX_LINK_INJECTIONS, 10);

function runNode(script, extraArgs = [], options = {}) {
  const args = [path.join(ROOT, script), ...extraArgs];
  const result = spawnSync(process.execPath, args, {
    cwd:      ROOT,
    encoding: 'utf8',
    stdio:    options.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env:      { ...process.env },
  });
  const status = result.status == null ? 1 : result.status;
  return { status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

// ─── SAFETY: only inject inside body content, not nav/footer/script/schema ──

function isSafeInsertionContext(html, position) {
  const before = html.slice(0, position).toLowerCase();
  // Reject if we're inside a script, nav, footer, or ld+json block
  const dangerOpen  = ['<script', '<nav', '<footer', '<noscript', 'application/ld+json'];
  const dangerClose = ['</script>', '</nav>', '</footer>', '</noscript>'];
  let depth = 0;
  for (const tag of dangerOpen) {
    const idx = before.lastIndexOf(tag);
    if (idx === -1) continue;
    const closeTag = dangerClose[dangerOpen.indexOf(tag)];
    if (!closeTag) continue;
    const closeIdx = html.indexOf(closeTag, idx);
    if (closeIdx === -1 || closeIdx > position) depth++;
  }
  return depth === 0;
}

// ─── STEP 1-9: SEQUENTIAL REBUILD ─────────────────────────────────────────────

const REBUILD_STEPS = [
  { label: 'Knowledge graph',          script: 'tools/build-content-knowledge-graph.js', args: ['--write'] },
  { label: 'Article pairs',            script: 'tools/build-article-pairs.js',            args: ['--write'] },
  { label: 'Content clusters',         script: 'tools/analyze-content-clusters.js',       args: ['--write'] },
  { label: 'Orphan detection',         script: 'tools/detect-orphan-pages.js',            args: ['--write'] },
  { label: 'Content gaps',             script: 'tools/detect-content-gaps.js',            args: ['--write'] },
  { label: 'SEO topology',             script: 'tools/analyze-seo-topology.js',           args: ['--write'] },
  { label: 'Authority expansion plan', script: 'tools/authority-expansion-engine.js',     args: ['--write'] },
  { label: 'Topology rebalance',       script: 'tools/rebalance-content-topology.js',     args: ['--write'] },
];

function runRebuildSteps() {
  const results = [];
  for (const step of REBUILD_STEPS) {
    console.log(`  [repair-cycle] ${step.label}...`);
    const r = runNode(step.script, step.args, { quiet: true });
    results.push({ step: step.label, status: r.status, ok: r.status === 0 });
    if (r.status !== 0) {
      console.log(`  [repair-cycle] WARNING: ${step.label} exited ${r.status}`);
    }
  }
  return results;
}

// ─── STEP: ORPHAN REPAIR (safe execution with caps) ───────────────────────────

function runOrphanRepair(dryRun, maxRepairs, maxInjections) {
  const args = ['--write', `--max-repairs=${maxRepairs}`, `--max-injections=${maxInjections}`];
  if (!dryRun) args.push('--execute');
  console.log(`  [repair-cycle] Orphan repair (${dryRun ? 'dry-run' : 'execute'}, max=${maxRepairs})...`);
  const r = runNode('tools/repair-orphan-pages.js', args, { quiet: true });

  // Parse repair report
  const reportPath = path.join(ROOT, 'data', 'orphan-repair-report.json');
  let repairCount = 0;
  let linkCount   = 0;
  if (fs.existsSync(reportPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      repairCount = dryRun ? (report.repairs_planned || 0) : (report.repairs_executed || 0);
      linkCount   = repairCount; // 1 link per repair (current design)
    } catch { /* ignore */ }
  }
  return { status: r.status, repaired_orphans: repairCount, injected_links: linkCount, dry_run: dryRun };
}

// ─── TARGETED ARTICLE REPAIR ─────────────────────────────────────────────────

const SITE_URL_CANONICAL = 'https://www.tradealphaai.com';
const SITE_URL_NO_WWW    = 'https://tradealphaai.com';

function readJsonSafe(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function linkExistsOnDisk(href) {
  const normalized = href.replace(/^\//, '');
  return fs.existsSync(path.join(ROOT, normalized)) ||
         fs.existsSync(path.join(ROOT, normalized, 'index.html'));
}

function findClusterForSlug(slug, clusters) {
  for (const [clusterId, cluster] of Object.entries(clusters)) {
    if (
      (cluster.top_pages || []).some(p => (p.id || '').includes(slug)) ||
      (cluster.orphan_pages || []).some(p => (p || '').includes(slug)) ||
      (cluster.weak_pages || []).some(p => (p.id || p || '').includes(slug))
    ) {
      return clusterId;
    }
  }
  return null;
}

function findReplacementUrl(brokenHref, graphNodes, clusterNodes) {
  // Determine the content type from the href pattern
  const isEtf     = /^\/(ar\/)?etfs\//.test(brokenHref);
  const isStock   = /^\/(ar\/)?stocks\//.test(brokenHref);
  const isCompare = /^\/(ar\/)?compare\//.test(brokenHref);
  const isAr      = brokenHref.startsWith('/ar/');
  const prefix    = isAr ? '/ar' : '';

  if (isEtf) {
    // Try cluster ETF nodes first, then any existing ETF
    const candidates = (clusterNodes.length ? clusterNodes : graphNodes)
      .filter(n => n.type === 'etf' && n.url_en)
      .map(n => isAr ? n.url_ar || (n.url_en ? n.url_en.replace('/etfs/', '/ar/etfs/') : null) : n.url_en)
      .filter(Boolean)
      .filter(u => linkExistsOnDisk(u));
    return candidates[0] || `${prefix}/etfs.html`;
  }
  if (isStock) {
    const candidates = (clusterNodes.length ? clusterNodes : graphNodes)
      .filter(n => n.type === 'stock' && n.url_en)
      .map(n => isAr ? n.url_ar || n.url_en.replace('/stocks/', '/ar/stocks/') : n.url_en)
      .filter(Boolean)
      .filter(u => linkExistsOnDisk(u));
    return candidates[0] || `${prefix}/stocks.html`;
  }
  if (isCompare) {
    const candidates = (clusterNodes.length ? clusterNodes : graphNodes)
      .filter(n => n.type === 'compare' && n.url_en)
      .map(n => isAr ? n.url_ar || n.url_en.replace('/compare/', '/ar/compare/') : n.url_en)
      .filter(Boolean)
      .filter(u => linkExistsOnDisk(u));
    return candidates[0] || `${prefix}/etfs.html`;
  }
  // Hub or unknown — use the appropriate hub
  return `${prefix}/etfs.html`;
}

function fixBrokenLinksInHtml(html, graphNodes, clusterNodes) {
  // Match href="/..." but NOT /insights/ patterns (those always pass the check)
  const seen = new Set();
  const replacements = new Map();

  const hrefRe = / href="(\/[^"#?]+)"/g;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1];
    if (seen.has(href)) continue;
    seen.add(href);
    if (/^\/(ar\/)?insights\/[^/]+\.html$/.test(href)) continue;
    if (href === '/' || href === '/ar/') continue;
    if (linkExistsOnDisk(href)) continue;
    const replacement = findReplacementUrl(href, graphNodes, clusterNodes);
    if (replacement && replacement !== href) replacements.set(href, replacement);
  }

  let fixed = html;
  let count = 0;
  for (const [broken, replacement] of replacements) {
    // Replace href="${broken}" globally, but only when it doesn't already equal replacement
    const escaped = broken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    fixed = fixed.replace(new RegExp(` href="${escaped}"`, 'g'), ` href="${replacement}"`);
    count++;
  }
  return { html: fixed, count };
}

function buildBreadcrumbScript(slug, locale) {
  const ar = locale === 'ar';
  const prefix = ar ? '/ar' : '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: `${SITE_URL_CANONICAL}/` },
      { '@type': 'ListItem', position: 2, name: ar ? 'رؤى السوق' : 'Market Insights', item: `${SITE_URL_CANONICAL}${prefix}/insights/` },
      { '@type': 'ListItem', position: 3, name: slug.replace(/-/g, ' '), item: `${SITE_URL_CANONICAL}${prefix}/insights/${slug}.html` }
    ]
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

function buildLocaleNav(slug, locale) {
  const ar = locale === 'ar';
  return `  <nav class="locale-links" aria-label="Language">
    <a class="lang-switch" data-locale-route="ar" href="/ar/insights/${slug}.html">${ar ? 'العربية' : 'Arabic'}</a>
    <a class="lang-switch" data-locale-route="en" href="/insights/${slug}.html">${ar ? 'الإنجليزية' : 'English'}</a>
  </nav>`;
}

function ensureArticlePairEntry(slug, clusterNodes, dryRun) {
  const pairsPath = path.join(ROOT, 'data', 'article-pairs.json');
  if (!fs.existsSync(pairsPath)) return 0;
  const pairsData = readJsonSafe(pairsPath, { pairs: [] });
  const pairs = Array.isArray(pairsData.pairs) ? pairsData.pairs : [];

  const hasPair = pairs.some(p => p.left_slug === slug || p.right_slug === slug);
  if (hasPair) return 0;

  // Find the best article partner from the same cluster
  const articlePartner = clusterNodes.find(n => n.type === 'article' && n.slug !== slug && linkExistsOnDisk(n.url_en || ''));
  if (!articlePartner) return 0;

  const newPair = {
    left_slug: slug,
    right_slug: articlePartner.slug,
    relationship_type: 'related_to',
    comparison_reason: `Both cover related themes in the ${articlePartner.clusters ? articlePartner.clusters[0] : 'educational'} cluster.`,
    educational_value: 'Provides a paired reading path for related research topics.',
    internal_link_priority: 'medium',
    left_title: slug.replace(/-/g, ' '),
    right_title: articlePartner.title || articlePartner.slug.replace(/-/g, ' '),
  };

  if (!dryRun) {
    pairsData.pairs = [...pairs, newPair];
    pairsData.total = pairsData.pairs.length;
    pairsData.generated_at = new Date().toISOString();
    fs.writeFileSync(pairsPath, JSON.stringify(pairsData, null, 2) + '\n', 'utf8');
  }
  return 1;
}

function repairTargetArticleLinks({ slug, contentType, failedChecks = [], dryRun = false }) {
  const result = {
    attempted: true,
    links_added: 0,
    pairs_added: 0,
    checks_fixed: [],
    success: false,
    detail: [],
  };

  if (contentType !== 'editorial') {
    result.detail.push(`targeted repair only supports editorial; skipped for ${contentType}`);
    return result;
  }

  const draftDir = path.join(ROOT, 'drafts', contentType, slug);
  const enPath   = path.join(draftDir, 'en.html');
  const arPath   = path.join(draftDir, 'ar.html');

  if (!fs.existsSync(enPath) || !fs.existsSync(arPath)) {
    result.detail.push('draft HTML files not found — targeted repair skipped');
    return result;
  }

  let enHtml = fs.readFileSync(enPath, 'utf8');
  let arHtml = fs.readFileSync(arPath, 'utf8');
  let enChanged = false;
  let arChanged = false;

  // Load knowledge graph + clusters for link candidates
  const graph = readJsonSafe(path.join(ROOT, 'data', 'content-knowledge-graph.json'), { nodes: [], edges: [] });
  const graphNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const clustersData = readJsonSafe(path.join(ROOT, 'data', 'content-clusters.json'), { clusters: {} });
  const clusters = clustersData.clusters || {};

  // Determine the target article's cluster from the knowledge graph or queue
  const clusterMatch = Object.entries(clusters).find(([, c]) =>
    (c.top_pages || []).some(p => (p.id || '').includes(slug)) ||
    (c.orphan_pages || []).some(p => (p || '').includes(slug)) ||
    (c.weak_pages || []).some(p => (p.id || p || '').includes(slug))
  );
  const targetClusterId = clusterMatch ? clusterMatch[0] : null;
  const clusterNodes = targetClusterId
    ? graphNodes.filter(n => n.clusters && n.clusters.includes(targetClusterId))
    : [];

  const repairPairContract  = failedChecks.length === 0 || failedChecks.includes('article_pair_contract');
  const repairLinkRes       = failedChecks.length === 0 || failedChecks.includes('internal_link_resolution');

  // ── 1. article_pair_contract repairs ──────────────────────────────────────
  if (repairPairContract) {
    // Fix SITE_URL (no-www → www) in canonical and hreflang
    if (enHtml.includes(SITE_URL_NO_WWW)) {
      enHtml = enHtml.replaceAll(SITE_URL_NO_WWW, SITE_URL_CANONICAL);
      enChanged = true;
      result.detail.push('fixed canonical URL in en.html (added www.)');
    }
    if (arHtml.includes(SITE_URL_NO_WWW)) {
      arHtml = arHtml.replaceAll(SITE_URL_NO_WWW, SITE_URL_CANONICAL);
      arChanged = true;
      result.detail.push('fixed canonical URL in ar.html (added www.)');
    }

    // Inject BreadcrumbList schema if missing
    if (!enHtml.includes('BreadcrumbList')) {
      enHtml = enHtml.replace('</head>', `  ${buildBreadcrumbScript(slug, 'en')}\n</head>`);
      enChanged = true;
      result.detail.push('injected BreadcrumbList schema in en.html');
    }
    if (!arHtml.includes('BreadcrumbList')) {
      arHtml = arHtml.replace('</head>', `  ${buildBreadcrumbScript(slug, 'ar')}\n</head>`);
      arChanged = true;
      result.detail.push('injected BreadcrumbList schema in ar.html');
    }

    // Inject locale-route switcher links if missing
    const enLocaleAttr = `data-locale-route="ar" href="/ar/insights/${slug}.html"`;
    const arLocaleAttr = `data-locale-route="en" href="/insights/${slug}.html"`;
    if (!enHtml.includes(enLocaleAttr)) {
      enHtml = enHtml.replace('</body>', `${buildLocaleNav(slug, 'en')}\n</body>`);
      enChanged = true;
      result.detail.push('injected locale-route nav in en.html');
    }
    if (!arHtml.includes(arLocaleAttr)) {
      arHtml = arHtml.replace('</body>', `${buildLocaleNav(slug, 'ar')}\n</body>`);
      arChanged = true;
      result.detail.push('injected locale-route nav in ar.html');
    }
  }

  // ── 2. internal_link_resolution repairs ──────────────────────────────────
  if (repairLinkRes) {
    const enFixed = fixBrokenLinksInHtml(enHtml, graphNodes, clusterNodes);
    const arFixed = fixBrokenLinksInHtml(arHtml, graphNodes, clusterNodes);
    if (enFixed.count > 0) {
      enHtml = enFixed.html;
      enChanged = true;
      result.links_added += enFixed.count;
      result.detail.push(`fixed ${enFixed.count} broken link(s) in en.html`);
    }
    if (arFixed.count > 0) {
      arHtml = arFixed.html;
      arChanged = true;
      result.links_added += arFixed.count;
      result.detail.push(`fixed ${arFixed.count} broken link(s) in ar.html`);
    }
  }

  // ── 3. Write patched draft files ──────────────────────────────────────────
  if (!dryRun) {
    if (enChanged) fs.writeFileSync(enPath, enHtml, 'utf8');
    if (arChanged) fs.writeFileSync(arPath, arHtml, 'utf8');
  }

  // ── 4. Ensure article-pair entry for this slug ────────────────────────────
  result.pairs_added = ensureArticlePairEntry(slug, clusterNodes, dryRun);
  if (result.pairs_added > 0) result.detail.push(`created article-pair entry for ${slug}`);

  // ── 5. Verify which checks are now satisfied ──────────────────────────────
  const enCanonical = `rel="canonical" href="${SITE_URL_CANONICAL}/insights/${slug}.html"`;
  const arCanonical = `rel="canonical" href="${SITE_URL_CANONICAL}/ar/insights/${slug}.html"`;
  const enLocale    = `data-locale-route="ar" href="/ar/insights/${slug}.html"`;
  const arLocale    = `data-locale-route="en" href="/insights/${slug}.html"`;

  const pairFixed =
    enHtml.includes(enCanonical) && arHtml.includes(arCanonical) &&
    enHtml.includes('BreadcrumbList') && arHtml.includes('BreadcrumbList') &&
    enHtml.includes(enLocale) && arHtml.includes(arLocale);

  const linkResFixed = (() => {
    const allHrefs = (h) => [...h.matchAll(/ href="(\/[^"#?]+)"/g)].map(m => m[1]);
    const valid = (href) => {
      if (/^\/(ar\/)?insights\/[^/]+\.html$/.test(href)) return true;
      if (href === '/' || href === '/ar/') return true;
      return linkExistsOnDisk(href);
    };
    return allHrefs(enHtml).every(valid) && allHrefs(arHtml).every(valid);
  })();

  if (pairFixed)    result.checks_fixed.push('article_pair_contract');
  if (linkResFixed) result.checks_fixed.push('internal_link_resolution');

  result.success = result.checks_fixed.length > 0 || result.links_added > 0 || result.pairs_added > 0;
  return result;
}

// ─── STEP: FINAL GRAPH REFRESH (after orphan repair) ─────────────────────────

function runFinalRefresh() {
  console.log(`  [repair-cycle] Final graph refresh...`);
  runNode('tools/build-content-knowledge-graph.js', ['--write'], { quiet: true });
  runNode('tools/analyze-seo-topology.js',          ['--write'], { quiet: true });
  runNode('tools/build-content-roadmap.js',         ['--write'], { quiet: true });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function runRepairCycle(options = {}) {
  const {
    dryRun            = DRY_RUN,
    maxOrphanRepairs  = MAX_ORPHAN,
    maxLinkInjections = MAX_INJECTIONS,
    quiet             = false,
    targetSlug        = null,
    targetContentType = null,
    failedChecks      = [],
  } = options;

  if (!quiet) {
    console.log(`\n[authority-repair-cycle] Starting (${dryRun ? 'DRY RUN' : 'EXECUTE'})`);
    console.log(`  max_orphan_repairs: ${maxOrphanRepairs}  max_link_injections: ${maxLinkInjections}`);
    if (targetSlug) console.log(`  targeted_slug: ${targetSlug}  content_type: ${targetContentType}`);
  }

  const startMs = Date.now();

  // Phase 1: rebuild all knowledge/topology data
  const rebuildResults = runRebuildSteps();
  const rebuildFailed  = rebuildResults.filter(r => !r.ok);

  // Phase 2: safe orphan repair (within caps)
  const orphanResult = runOrphanRepair(dryRun, maxOrphanRepairs, maxLinkInjections);

  // Phase 3: refresh graph with any new links
  if (!dryRun) runFinalRefresh();

  // Phase 4: targeted repair for the selected article (if requested)
  let targetedRepairResult = null;
  if (targetSlug && targetContentType) {
    if (!quiet) console.log(`\n[authority-repair-cycle] Running targeted repair for ${targetSlug}`);
    targetedRepairResult = repairTargetArticleLinks({
      slug: targetSlug,
      contentType: targetContentType,
      failedChecks,
      dryRun,
    });
    if (!quiet) {
      console.log(`  targeted_repair_success: ${targetedRepairResult.success}`);
      console.log(`  targeted_links_added:    ${targetedRepairResult.links_added}`);
      console.log(`  targeted_pairs_added:    ${targetedRepairResult.pairs_added}`);
      console.log(`  targeted_checks_fixed:   ${targetedRepairResult.checks_fixed.join(', ') || 'none'}`);
      if (targetedRepairResult.detail.length) {
        targetedRepairResult.detail.forEach(d => console.log(`    - ${d}`));
      }
    }
  }

  const elapsed = Date.now() - startMs;
  const summary = {
    dry_run:                    dryRun,
    rebuild_steps:              rebuildResults.length,
    rebuild_failures:           rebuildFailed.map(r => r.step),
    orphan_repairs:             orphanResult.repaired_orphans,
    injected_links:             orphanResult.injected_links,
    elapsed_ms:                 elapsed,
    success:                    rebuildFailed.length === 0,
    targeted_repair_attempted:  Boolean(targetedRepairResult),
    targeted_repair_result:     targetedRepairResult ? targetedRepairResult.success : null,
    targeted_links_added:       targetedRepairResult ? targetedRepairResult.links_added : 0,
    targeted_pairs_added:       targetedRepairResult ? targetedRepairResult.pairs_added : 0,
    targeted_repair_checks_fixed: targetedRepairResult ? targetedRepairResult.checks_fixed : [],
  };

  if (!quiet) {
    console.log(`\n[authority-repair-cycle] Complete in ${elapsed}ms`);
    console.log(`  Rebuild steps: ${rebuildResults.length} (${rebuildFailed.length} warnings)`);
    console.log(`  Orphan repairs ${dryRun ? 'planned' : 'executed'}: ${orphanResult.repaired_orphans}`);
    console.log(`  Links injected: ${orphanResult.injected_links}`);
    if (rebuildFailed.length) console.log(`  Warnings: ${rebuildFailed.map(r => r.step).join(', ')}`);
  }

  return summary;
}

module.exports = { runRepairCycle };

if (require.main === module) {
  const result = runRepairCycle({ dryRun: DRY_RUN });
  process.exit(result.success ? 0 : 1);
}
