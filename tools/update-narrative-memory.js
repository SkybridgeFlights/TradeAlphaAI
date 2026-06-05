'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, appendSnapshot, buildSnapshot, readJson, readMemory, windowedSnapshots } = require('./macro-intelligence-core');
const { detectNarrativeDrift } = require('./detect-narrative-drift');
const { buildRegimeSequence } = require('./build-regime-sequence');
const { detectCrossAssetDivergence } = require('./detect-cross-asset-divergence');

const slug = argValue('--slug');
const contentFile = argValue('--content-file');
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--dry-run=true');

let generatedContent = null;
if (contentFile) generatedContent = readJson(path.resolve(ROOT, contentFile), null);

const snapshot = buildSnapshot({ slug, generatedContent });
const memoryBefore = readMemory();
const drift = detectNarrativeDrift(snapshot, memoryBefore);
const sequence = buildRegimeSequence(snapshot, memoryBefore);
const divergence = detectCrossAssetDivergence(snapshot);

snapshot.drift_notes = drift.notes;
snapshot.regime_sequence = sequence.primary_sequence;
snapshot.cross_asset_divergence = divergence.primary_tension;

if (!dryRun) appendSnapshot(snapshot);

const memoryAfter = dryRun ? { ...memoryBefore, snapshots: [...memoryBefore.snapshots, snapshot] } : readMemory();
const windows = windowedSnapshots(memoryAfter);

console.log(JSON.stringify({
  dry_run: dryRun,
  appended: !dryRun,
  snapshot,
  window_counts: {
    short_term: windows.short_term.length,
    medium_term: windows.medium_term.length,
    structural: windows.structural.length
  },
  drift_notes: drift.notes,
  sequence: sequence.primary_sequence,
  divergence: divergence.primary_tension
}, null, 2));

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}
