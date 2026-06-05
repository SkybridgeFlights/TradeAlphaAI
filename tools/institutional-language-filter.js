'use strict';

// Phase 50: Institutional Language Filter
// Detects retail-style, low-information, and AI-filler phrasing.
// Complements generate-ai-market-outlook-content.js validation.
//
// Usage (module):
//   const { detectRetailPhrasing } = require('./institutional-language-filter');
//   const hits = detectRetailPhrasing(text);   // returns string[] of matched phrases

// ── Retail / low-quality phrases ─────────────────────────────────────────────

const RETAIL_PHRASES = [
  // Undirected directional calls
  'stocks may rise',
  'stocks could rise',
  'stocks may fall',
  'stocks could fall',
  'market may go up',
  'market could go up',
  'market may go down',
  'market could go down',
  'market may rally',
  'market could rally',
  'market might rally',
  'investors may buy',
  'investors could buy',
  'investors may sell',
  'investors could sell',
  // Weak temporal hedges
  'in the long run',
  'over the long term, markets tend to',
  'historically speaking',
  'time will tell',
  'only time will tell',
  // Sensational / tabloid
  'perfect storm',
  'unprecedented times',
  'game changer',
  'tipping point',
  'could be a game',
  'once-in-a-generation',
  // AI-filler openers/connectors
  'in conclusion,',
  'to summarize,',
  'in summary,',
  'it is worth noting that',
  'it is important to note',
  'when considering',
  'it should be noted',
  'needless to say',
  'it goes without saying',
  // Undefined "everyone" phrasing
  'all eyes are on',
  "everyone's watching",
  "all eyes on the",
  'the world is watching',
  'the big question is',
  'the burning question',
  'investors are nervously',
  // Retail macro clichés
  'economic storm clouds',
  'a wall of worry',
  'climbing the wall of worry',
  'running out of steam',
  'markets are pricing in hope',
  // Passive state descriptions (retail)
  'the stock market is experiencing',
  'the market is facing challenges',
  'the market is going through',
];

// ── Phrases to promote (examples for error messages) ─────────────────────────

const INSTITUTIONAL_ALTERNATIVES = {
  'stocks may rise':          'if [catalyst], equities could reprice higher via [mechanism]',
  'all eyes are on':          'market participants are monitoring [specific release/event]',
  'in conclusion,':           '[state the conclusion directly without preamble]',
  'game changer':             '[describe the structural shift with mechanism]',
  'in the long run':          '[reference specific policy horizon or Fed cycle phase]',
  'perfect storm':            '[enumerate the specific concurrent pressures by name]',
};

// ── Detector ─────────────────────────────────────────────────────────────────

function detectRetailPhrasing(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  return RETAIL_PHRASES.filter(phrase => lower.includes(phrase.toLowerCase()));
}

function detectInstitutionalPhrasing(text) {
  if (!text || typeof text !== 'string') return 0;
  const lower = text.toLowerCase();
  const GOOD_SIGNALS = [
    'transmission mechanism',
    'duration risk',
    'credit spread',
    'yield curve',
    'rate-sensitive',
    'risk premium',
    'net interest margin',
    'cross-asset',
    'factor tilt',
    'sector rotation',
    'terminal rate',
    'real yield',
    'implied vol',
    'option-adjusted',
    'convexity',
    'carry',
    'breadth deterioration',
    'selective participation',
    'repricing',
    'normaliz',
    'mean-revert',
  ];
  return GOOD_SIGNALS.filter(p => lower.includes(p)).length;
}

module.exports = {
  RETAIL_PHRASES,
  INSTITUTIONAL_ALTERNATIVES,
  detectRetailPhrasing,
  detectInstitutionalPhrasing,
};
