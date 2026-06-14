'use strict';

// Phase 116 — Technical Structure Brain entry point.
//
// Publishes ONE deterministic institutional market-structure note per run from
// the current structure-engine artifact — so the structure desk keeps
// publishing even on a quiet macro tape — with topic rotation + cooldown (no
// spam, no duplicate topics) and honest degradation (skips green when the
// structural read is unavailable). Reuses the market-news article wrapper,
// intelligence rail, inline panels and editorial-quality gate on the dedicated
// /market-structure/ surface. NOT retail technical analysis or signals.
//
// Usage: node tools/generate-structure-note.js [--write]

const { publishStructure } = require('./generate-market-news-article');

if (require.main === module) {
  publishStructure(process.argv.includes('--write'));
  process.exit(0);
}

module.exports = { publishStructure };
