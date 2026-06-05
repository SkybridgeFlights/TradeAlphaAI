'use strict';

// Phase 50.1: Institutional Language Filter
// Three tiers:
//   FINANCIAL_ADVICE_PHRASES — hard fail on any 1 hit (explicit advice language)
//   RETAIL_PHRASES           — hard fail at 5+ hits (soft warnings below)
//   INSTITUTIONAL_SIGNALS    — positive scoring (higher = better)
//
// Usage (module):
//   const { detectRetailPhrasing, detectFinancialAdvice } = require('./institutional-language-filter');

// ── Tier 1: Financial advice / promotional (hard fail, ≥1 hit) ──────────────

const FINANCIAL_ADVICE_PHRASES = [
  'you should buy',
  'you should sell',
  'you must buy',
  'you must sell',
  'guaranteed return',
  'guaranteed profit',
  'certain to rise',
  'certain to fall',
  'will definitely',
  'no risk',
  'risk-free investment',
  'invest now',
  'buy now',
  'sell now',
  'don\'t miss this',
  'act now',
];

// ── Tier 2: Retail / low-quality phrases (hard fail at ≥5 hits) ──────────────

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
  'all eyes are on':          '[specific institution/release] will determine [mechanism]',
  'in conclusion,':           '[state the analytical finding directly without preamble]',
  'game changer':             '[describe the structural shift with mechanism and affected instruments]',
  'in the long run':          '[reference specific policy horizon, Fed cycle phase, or dated event]',
  'perfect storm':            '[enumerate the specific concurrent pressures by name and mechanism]',
};

// ── Tier 3: Institutional quality signals (positive scoring) ─────────────────

const INSTITUTIONAL_SIGNALS = [
  'transmission mechanism',
  'transmission chain',
  'duration risk',
  'duration-sensitive',
  'duration exposure',
  'credit spread',
  'yield curve',
  'yield spread',
  'basis points',
  'rate-sensitive',
  'rate sensitivity',
  'risk premium',
  'net interest margin',
  'cross-asset',
  'factor tilt',
  'sector rotation',
  'defensive rotation',
  'terminal rate',
  'real yield',
  'implied vol',
  'option-adjusted',
  'convexity',
  'carry',
  'breadth deterioration',
  'breadth signal',
  'selective participation',
  'broad participation',
  'concentration risk',
  'narrow leadership',
  'repricing',
  'normalizing',
  'mean-revert',
  'risk appetite',
  'risk-on',
  'risk-off',
  'positioning',
  'macro hedge',
  'monetary transmission',
  'monetary policy',
  'policy path',
  'curve steepening',
  'curve flattening',
  'vol regime',
  'volatility regime',
  'vol compression',
  'vol expansion',
  'equal-weight',
  'cap-weight',
  'relative strength',
  'conditional on',
  'historically correlated',
  'tends to precede',
];

// ── Detectors ─────────────────────────────────────────────────────────────────

function detectFinancialAdvice(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  return FINANCIAL_ADVICE_PHRASES.filter(phrase => lower.includes(phrase.toLowerCase()));
}

function detectRetailPhrasing(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  return RETAIL_PHRASES.filter(phrase => lower.includes(phrase.toLowerCase()));
}

function detectInstitutionalPhrasing(text) {
  if (!text || typeof text !== 'string') return 0;
  const lower = text.toLowerCase();
  return INSTITUTIONAL_SIGNALS.filter(p => lower.includes(p)).length;
}

module.exports = {
  FINANCIAL_ADVICE_PHRASES,
  RETAIL_PHRASES,
  INSTITUTIONAL_ALTERNATIVES,
  INSTITUTIONAL_SIGNALS,
  detectFinancialAdvice,
  detectRetailPhrasing,
  detectInstitutionalPhrasing,
};
