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
    dryRun         = DRY_RUN,
    maxOrphanRepairs  = MAX_ORPHAN,
    maxLinkInjections = MAX_INJECTIONS,
    quiet             = false,
  } = options;

  if (!quiet) {
    console.log(`\n[authority-repair-cycle] Starting (${dryRun ? 'DRY RUN' : 'EXECUTE'})`);
    console.log(`  max_orphan_repairs: ${maxOrphanRepairs}  max_link_injections: ${maxLinkInjections}`);
  }

  const startMs = Date.now();

  // Phase 1: rebuild all knowledge/topology data
  const rebuildResults = runRebuildSteps();
  const rebuildFailed  = rebuildResults.filter(r => !r.ok);

  // Phase 2: safe orphan repair (within caps)
  const orphanResult = runOrphanRepair(dryRun, maxOrphanRepairs, maxLinkInjections);

  // Phase 3: refresh graph with any new links
  if (!dryRun) runFinalRefresh();

  const elapsed = Date.now() - startMs;
  const summary = {
    dry_run:              dryRun,
    rebuild_steps:        rebuildResults.length,
    rebuild_failures:     rebuildFailed.map(r => r.step),
    orphan_repairs:       orphanResult.repaired_orphans,
    injected_links:       orphanResult.injected_links,
    elapsed_ms:           elapsed,
    success:              rebuildFailed.length === 0,
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
