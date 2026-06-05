'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const GRAPH_PATH = path.join(ROOT, 'data', 'content-knowledge-graph.json');
const ORPHAN_PATH= path.join(ROOT, 'data', 'orphan-pages-report.json');
const PLAN_PATH  = path.join(ROOT, 'data', 'authority-expansion-plan.json');
const OUT        = path.join(ROOT, 'data', 'orphan-repair-report.json');

const DRY_RUN = !process.argv.includes('--execute');
const WRITE   =  process.argv.includes('--write');
const MAX_REPAIRS_PER_PAGE = 2;
const MIN_RELEVANCE_SCORE  = 25;

// Support --max-repairs=N and --max-injections=N CLI args (used by repair cycle)
function cliInt(name, fallback) {
  const prefix = `${name}=`;
  const found  = process.argv.find(a => a.startsWith(prefix));
  return found ? Math.max(1, parseInt(found.slice(prefix.length), 10) || fallback) : fallback;
}
const MAX_REPAIRS_TOTAL    = cliInt('--max-repairs', 30);
const MAX_INJECTIONS_TOTAL = cliInt('--max-injections', 60);

// Safety: forbidden injection zones inside source HTML
const DANGER_OPEN_TAGS  = ['<script', '<nav ', '<nav>', '<footer', '<noscript', 'application/ld+json'];
const DANGER_CLOSE_TAGS = ['</script>', '</nav>', '</footer>', '</noscript>', '</script>'];

function isSafeInsertionPoint(html) {
  // Quick heuristic: find the </main> or </article> position and verify it's in body content
  const lc = html.toLowerCase();
  const mainClose    = lc.lastIndexOf('</main>');
  const articleClose = lc.lastIndexOf('</article>');
  const insertPos    = Math.max(mainClose, articleClose);
  if (insertPos === -1) return false;

  const before = lc.slice(0, insertPos);
  // Reject if the last unclosed dangerous block extends past insertion point
  for (const dangerTag of DANGER_OPEN_TAGS) {
    const lastOpen = before.lastIndexOf(dangerTag);
    if (lastOpen === -1) continue;
    const closeFor = DANGER_CLOSE_TAGS[DANGER_OPEN_TAGS.indexOf(dangerTag)];
    if (!closeFor) continue;
    const lastClose = before.lastIndexOf(closeFor);
    if (lastClose < lastOpen) return false; // unclosed dangerous block before insertion
  }
  return true;
}

// Blocks insertion in these files (they are templates or pure listings)
const SKIP_SOURCES = new Set([
  'index.html', 'etfs.html', 'stocks.html', 'rankings.html',
  'methodology.html', 'etf.html', 'stock.html',
]);

function readJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function loadGraph() {
  return readJson(GRAPH_PATH, { nodes: [], edges: [] });
}

// ─── RELEVANCE SCORING ───────────────────────────────────────────────────────

function relevanceScore(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) return 0;
  let score = 0;

  // Shared clusters
  const srcClusters = new Set(sourceNode.clusters || []);
  const tgtClusters = new Set(targetNode.clusters || []);
  for (const c of tgtClusters) if (srcClusters.has(c)) score += 30;

  // Shared ETF entities
  const srcEtfs = new Set(sourceNode.etf_entities || []);
  const tgtEtfs = new Set(targetNode.etf_entities || []);
  for (const e of tgtEtfs) if (srcEtfs.has(e)) score += 8;

  // Shared stock entities
  const srcStocks = new Set(sourceNode.stock_entities || []);
  const tgtStocks = new Set(targetNode.stock_entities || []);
  for (const s of tgtStocks) if (srcStocks.has(s)) score += 5;

  // Same type bonus
  if (sourceNode.type === targetNode.type) score += 10;

  // Authority flow: prefer linking from higher-authority pages
  const authDelta = (sourceNode.authority_score || 0) - (targetNode.authority_score || 0);
  if (authDelta > 20) score += 12;
  else if (authDelta > 5) score += 6;

  return Math.min(100, score);
}

// ─── SOURCE PAGE FINDER ──────────────────────────────────────────────────────

function findRepairCandidates(orphanNode, graph) {
  const nodeMap = new Map((graph.nodes || []).map(n => [n.id, n]));
  const existingInbound = new Set(
    (graph.edges || [])
      .filter(e => e.relationship === 'links_to' && e.to === orphanNode.id)
      .map(e => e.from)
  );

  // Find pages related by graph edges (not already linking to orphan)
  const semanticNeighbors = new Set();
  for (const edge of graph.edges || []) {
    if (['related_to', 'asset_exposure', 'curated_pair'].includes(edge.relationship)) {
      if (edge.from === orphanNode.id) semanticNeighbors.add(edge.to);
      if (edge.to   === orphanNode.id) semanticNeighbors.add(edge.from);
    }
  }

  const candidates = [];
  for (const candidateId of semanticNeighbors) {
    if (candidateId === orphanNode.id) continue;
    if (existingInbound.has(candidateId)) continue;
    const base = path.basename(candidateId);
    if (SKIP_SOURCES.has(base)) continue;

    const candidateNode = nodeMap.get(candidateId);
    if (!candidateNode) continue;
    if (!fs.existsSync(path.join(ROOT, candidateId))) continue;

    const score = relevanceScore(candidateNode, orphanNode);
    if (score >= MIN_RELEVANCE_SCORE) {
      candidates.push({ id: candidateId, node: candidateNode, relevance: score });
    }
  }

  // Also check same-cluster pages not in semantic neighbors
  const orphanClusters = new Set(orphanNode.clusters || []);
  for (const node of graph.nodes || []) {
    if (node.id === orphanNode.id) continue;
    if (existingInbound.has(node.id)) continue;
    if (semanticNeighbors.has(node.id)) continue;
    if (SKIP_SOURCES.has(path.basename(node.id))) continue;
    if (!node.clusters || !node.clusters.some(c => orphanClusters.has(c))) continue;
    if (!fs.existsSync(path.join(ROOT, node.id))) continue;

    const score = relevanceScore(node, orphanNode);
    if (score >= MIN_RELEVANCE_SCORE) {
      candidates.push({ id: node.id, node, relevance: score });
    }
  }

  candidates.sort((a, b) => b.relevance - a.relevance);
  return candidates.slice(0, MAX_REPAIRS_PER_PAGE);
}

// ─── LINK INJECTION ──────────────────────────────────────────────────────────

function buildLinkHtml(targetNode, targetPath) {
  const title  = targetNode.title || path.basename(targetPath).replace('.html', '').replace(/-/g, ' ');
  const href   = '/' + targetPath.replace(/\\/g, '/');
  const desc   = targetNode.type === 'market_outlook' ? 'Market outlook' :
                 targetNode.type === 'article'         ? 'Research article' :
                 targetNode.type === 'compare'         ? 'Comparison guide' : 'Research';
  return `<a href="${href}" class="related-link">${title} <span class="link-meta">${desc}</span></a>`;
}

function hasExistingRelatedSection(html) {
  return /class="[^"]*related[^"]*"|id="[^"]*related[^"]*"|Further Reading|Related Articles|Related Research/i.test(html);
}

function injectLinkIntoPage(sourceHtml, targetNode, targetPath) {
  const linkHtml = buildLinkHtml(targetNode, targetPath);

  // Strategy 1: Append to existing "related" section
  const relatedMatch = sourceHtml.match(/(class="[^"]*(?:related|further-reading|see-also)[^"]*"[^>]*>)([\s\S]*?)(<\/(?:section|div|aside)>)/i);
  if (relatedMatch) {
    return {
      html: sourceHtml.replace(relatedMatch[0], relatedMatch[1] + relatedMatch[2] + '\n      ' + linkHtml + '\n    ' + relatedMatch[3]),
      strategy: 'appended_to_related_section',
    };
  }

  // Strategy 2: Insert before </article> or </main>
  const closeTag = sourceHtml.match(/<\/article>|<\/main>/i);
  if (closeTag) {
    const tag = closeTag[0];
    const insertBlock = `\n  <aside class="related-research" aria-label="Related research">\n    <h3>Related Research</h3>\n    ${linkHtml}\n  </aside>\n${tag}`;
    return {
      html: sourceHtml.replace(tag, insertBlock),
      strategy: 'inserted_before_close_tag',
    };
  }

  return { html: null, strategy: 'no_insertion_point' };
}

function alreadyLinksTo(sourceHtml, targetPath) {
  const href = '/' + targetPath.replace(/\\/g, '/');
  return sourceHtml.includes(`href="${href}"`) || sourceHtml.includes(`href='${href}'`);
}

// ─── MAIN REPAIR LOGIC ───────────────────────────────────────────────────────

function repairOrphans(options = {}) {
  const { dryRun = true, maxRepairs = MAX_REPAIRS_TOTAL, maxInjections = MAX_INJECTIONS_TOTAL } = options;
  const graph   = loadGraph();
  const orphanReport = readJson(ORPHAN_PATH, { orphans: [] });
  const nodeMap = new Map((graph.nodes || []).map(n => [n.id, n]));

  const orphans = (orphanReport.orphans || [])
    .filter(o => (o.risk_score || o.orphan_risk_score || 0) >= 30)
    .sort((a, b) => (b.risk_score || b.orphan_risk_score || 0) - (a.risk_score || a.orphan_risk_score || 0));

  const repairs    = [];
  const skipped    = [];
  let repairCount  = 0;
  let linkCount    = 0;

  for (const orphan of orphans) {
    if (repairCount >= maxRepairs) break;
    if (linkCount   >= maxInjections) break;

    const orphanNode = nodeMap.get(orphan.id);
    if (!orphanNode) { skipped.push({ id: orphan.id, reason: 'not_in_graph' }); continue; }
    if (!fs.existsSync(path.join(ROOT, orphan.id))) { skipped.push({ id: orphan.id, reason: 'file_not_found' }); continue; }

    const candidates = findRepairCandidates(orphanNode, graph);
    if (!candidates.length) { skipped.push({ id: orphan.id, reason: 'no_repair_candidates' }); continue; }

    const topCandidate = candidates[0];
    const sourceAbsPath = path.join(ROOT, topCandidate.id);
    const sourceHtml    = fs.readFileSync(sourceAbsPath, 'utf8');

    if (alreadyLinksTo(sourceHtml, orphan.id)) {
      skipped.push({ id: orphan.id, reason: 'already_linked', source: topCandidate.id });
      continue;
    }

    // Safety check: only inject in safe content zones (not nav/footer/script/schema)
    if (!isSafeInsertionPoint(sourceHtml)) {
      skipped.push({ id: orphan.id, reason: 'unsafe_insertion_context', source: topCandidate.id });
      continue;
    }

    const { html: modifiedHtml, strategy } = injectLinkIntoPage(sourceHtml, orphanNode, orphan.id);

    if (!modifiedHtml || strategy === 'no_insertion_point') {
      skipped.push({ id: orphan.id, reason: 'no_insertion_point', source: topCandidate.id });
      continue;
    }

    if (!dryRun) {
      fs.writeFileSync(sourceAbsPath, modifiedHtml, 'utf8');
    }

    repairs.push({
      orphan:       orphan.id,
      orphan_title: orphanNode.title || orphan.id,
      orphan_type:  orphanNode.type,
      source_page:  topCandidate.id,
      relevance:    topCandidate.relevance,
      strategy,
      status:       dryRun ? 'planned' : 'executed',
      dry_run:      dryRun,
    });

    repairCount++;
    linkCount++;
  }

  return {
    total_orphans:    orphans.length,
    repairs_executed: repairs.filter(r => r.status === 'executed').length,
    repairs_planned:  repairs.filter(r => r.status === 'planned').length,
    links_injected:   linkCount,
    skipped_count:    skipped.length,
    repairs,
    skipped: skipped.slice(0, 20),
  };
}

module.exports = { repairOrphans };

if (require.main === module) {
  const result = repairOrphans({ dryRun: DRY_RUN });
  const output = {
    version:      '1.0',
    generated_at: new Date().toISOString(),
    dry_run:      DRY_RUN,
    ...result,
  };

  console.log(`Orphan repair ${DRY_RUN ? '(DRY RUN)' : '(EXECUTE)'}`);
  console.log(`  Orphans scanned: ${result.total_orphans}`);
  console.log(`  Repairs ${DRY_RUN ? 'planned' : 'executed'}: ${DRY_RUN ? result.repairs_planned : result.repairs_executed}`);
  console.log(`  Skipped: ${result.skipped_count}`);
  if (result.repairs.length) {
    console.log('  Sample repairs:');
    result.repairs.slice(0, 5).forEach(r => {
      console.log(`    [${r.orphan_type}] ${path.basename(r.orphan)} ← ${path.basename(r.source_page)} (relevance: ${r.relevance})`);
    });
  }

  if (WRITE) {
    fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`Report written → ${OUT}`);
  }
}
