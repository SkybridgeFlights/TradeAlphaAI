'use strict';

// Phase 115 — Daily Research Brain entry point.
//
// Publishes ONE deterministic institutional research note per run from the
// current regime / liquidity / cross-asset artifacts — so the desk keeps
// publishing high-quality research even on a quiet macro tape — with topic
// rotation + cooldown (no spam, no duplicate topics) and honest degradation
// (skips green when the structural read is unavailable). Reuses the market-news
// article wrapper, intelligence rail, inline panels and editorial-quality gate;
// no parallel rendering system. Writes to /market-news/research-<topic>-<date>.
//
// Usage: node tools/generate-daily-research-note.js [--write]

const { publishResearch } = require('./generate-market-news-article');

if (require.main === module) {
  publishResearch(process.argv.includes('--write'));
  process.exit(0);
}

module.exports = { publishResearch };
