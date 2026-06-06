'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'data', 'intelligence', 'article-reasoning-plan.json');
const MODULES = [
  require('./topic-modules/cybersecurity-module'),
  require('./topic-modules/cloud-computing-module'),
  require('./topic-modules/semiconductor-module'),
  require('./topic-modules/healthcare-module'),
  require('./topic-modules/bond-duration-module'),
  require('./topic-modules/sector-rotation-module')
];

const ARCHETYPES = [
  'Macro Transmission',
  'Comparative ETF Construction',
  'Allocation Tradeoffs',
  'Valuation Compression/Expansion',
  'Scenario Framework',
  'Liquidity Structure',
  'Business-Cycle Alignment',
  'Portfolio Use Case'
];

function buildInstitutionalReasoningPlan(topic, context = {}, options = {}) {
  const module = selectTopicModule(topic);
  const comparisons = normalizeComparisons(topic, module);
  const plan = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    slug: topic.slug,
    title: topic.title_en,
    topic_module: module.id,
    evidence_status: context.evidence_status || 'conditional',
    context_note: context.context_note || '',
    required_reasoning_layers: {
      macro_transmission_chain: buildTransmission(module),
      probability_weighted_scenarios: buildScenarios(module),
      portfolio_construction_logic: comparisons.map((item) => ({
        instruments: [item.left, item.right],
        tradeoff: item.reason,
        decision_variable: `The comparison depends on ${module.liquidity_structure.toLowerCase()}`
      })),
      risk_premium_analysis: `The relevant risk premium reflects ${module.risks.slice(0, 3).join(', ')}, rather than the theme label alone.`,
      valuation_sensitivity: `Valuation should be tested through ${module.valuation_concepts.join(', ')} across different rate and growth assumptions.`,
      liquidity_and_volatility: module.liquidity_structure,
      business_cycle_alignment: module.business_cycle,
      earnings_cash_flow_durability: module.earnings_durability,
      regime_dependence: buildRegimeMap(module),
      cross_asset_linkage: buildCrossAsset(module)
    },
    terminology: module.terminology,
    comparisons,
    risk_factors: module.risks,
    section_plan: buildSectionPlan(module, comparisons),
    publication_requirements: {
      causal_reasoning: true,
      evidence_linkage: true,
      comparative_analysis: true,
      explicit_scenarios: true,
      analytical_density: 0.42,
      minimum_sections: 8,
      minimum_paragraphs_per_section: 3
    }
  };
  if (options.write !== false) writeJson(OUTPUT, plan);
  return plan;
}

function selectTopicModule(topic) {
  const ranked = MODULES.map((module) => ({ module, score: module.match(topic) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0].score > 0 ? ranked[0].module : MODULES[5];
}

function normalizeComparisons(topic, module) {
  const tickers = [...new Set(topic.related_etfs || [])].slice(0, 4);
  if (tickers.length >= 2) {
    return tickers.slice(1).map((ticker, index) => ({
      left: tickers[0],
      right: ticker,
      reason: module.comparisons[index]?.reason || 'different construction, concentration, liquidity, and factor exposure'
    }));
  }
  return module.comparisons;
}

function buildTransmission(module) {
  return module.macro_relationships.map((mechanism, index) => ({
    driver: index === 0 ? 'rates and financial conditions' : 'growth and earnings expectations',
    mechanism,
    intermediate_effect: index === 0 ? 'discount-rate and risk-premium repricing' : 'revenue, margin, and participation revisions',
    asset_effect: `${module.label} exposures may diverge according to construction and cash-flow duration.`,
    caveat: 'The relationship is conditional and requires confirmation from yields, breadth, volatility, and earnings revisions.'
  }));
}

function buildScenarios(module) {
  return [
    {
      name: 'base_case',
      probability_range: [45, 60],
      catalyst: 'Macro conditions remain mixed without a decisive change in growth or inflation.',
      transmission: `Selective allocation rewards stronger cash-flow durability while ${module.risks[0]} limits broad multiple expansion.`,
      implication: 'Relative performance is more likely to depend on construction and earnings quality than on theme-level beta.',
      invalidation: 'A synchronized change in rates, earnings revisions, and breadth would invalidate the selective regime.'
    },
    {
      name: 'bullish',
      probability_range: [20, 35],
      catalyst: 'Financial conditions ease while earnings expectations remain resilient.',
      transmission: `Lower discount-rate pressure combines with improving participation, supporting ${module.institutional_positioning_patterns[0]}.`,
      implication: 'Broader participation could reduce dependence on the largest constituents.',
      invalidation: 'Renewed real-yield pressure or weaker forward guidance would challenge the expansion case.'
    },
    {
      name: 'bearish',
      probability_range: [15, 30],
      catalyst: `Growth expectations weaken or ${module.risks[1]} intensifies.`,
      transmission: 'Risk premiums widen, liquidity preference rises, and weaker constituents transmit stress to the thematic basket.',
      implication: 'Concentration, balance-sheet quality, and trading liquidity become more important than headline exposure.',
      invalidation: 'Stabilizing earnings revisions and improving breadth would reduce the downside regime probability.'
    }
  ];
}

function buildRegimeMap(module) {
  return {
    risk_on: `${module.label} participation depends on earnings breadth rather than index gains alone.`,
    recession: `Cash-flow durability and balance-sheet quality become the principal differentiators.`,
    inflation_persistence: `Higher real yields and input costs test valuation support and margin resilience.`,
    disinflation: `Lower rate volatility can support duration, provided growth expectations do not deteriorate sharply.`,
    soft_landing: `A selective expansion favors exposures with improving revisions and manageable valuation risk.`
  };
}

function buildCrossAsset(module) {
  return [
    'Treasury yields alter discount rates and financing conditions.',
    'The U.S. dollar affects multinational revenue translation and global liquidity.',
    'Equity breadth distinguishes broad risk appetite from concentrated index leadership.',
    `Volatility determines whether ${module.label.toLowerCase()} exposure is treated as a stable allocation or a source of beta.`
  ];
}

function buildSectionPlan(module, comparisons) {
  return ARCHETYPES.map((archetype, index) => ({
    id: archetype.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    archetype,
    minimum_paragraphs: 3,
    required_terms: [
      module.terminology[index % module.terminology.length],
      module.valuation_concepts[index % module.valuation_concepts.length],
      comparisons[index % comparisons.length]?.left || module.label
    ],
    objective: sectionObjective(archetype, module)
  }));
}

function sectionObjective(archetype, module) {
  const objectives = {
    'Macro Transmission': `Trace rates, growth, liquidity, and volatility into ${module.label.toLowerCase()} cash flows and valuation.`,
    'Comparative ETF Construction': 'Compare weighting, concentration, holdings breadth, liquidity, and factor exposure.',
    'Allocation Tradeoffs': 'Explain why allocators may prefer one implementation under different constraints.',
    'Valuation Compression/Expansion': 'Connect discount rates and earnings revisions to plausible multiple changes.',
    'Scenario Framework': 'Present base, constructive, and adverse cases with probabilities and invalidation conditions.',
    'Liquidity Structure': 'Distinguish screen liquidity, underlying liquidity, spread behavior, and concentration.',
    'Business-Cycle Alignment': 'Map earnings durability and operating leverage to the cycle.',
    'Portfolio Use Case': 'Frame educational use, monitoring variables, risk budgets, and non-advisory conclusions.'
  };
  return objectives[archetype];
}

function readJson(file, fallback = {}) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function main() {
  const slugArg = process.argv.find((arg) => arg.startsWith('--slug='));
  const slug = slugArg ? slugArg.slice(7) : '';
  const queue = readJson(path.join(ROOT, 'data', 'editorial-topic-queue.json'), { topics: [] });
  const topic = (queue.topics || []).find((item) => item.slug === slug);
  if (!topic) {
    console.error(`Topic not found: ${slug || '(missing --slug)'}`);
    process.exit(1);
  }
  console.log(JSON.stringify(buildInstitutionalReasoningPlan(topic, {}, { write: true }), null, 2));
}

if (require.main === module) main();

module.exports = { buildInstitutionalReasoningPlan, selectTopicModule, ARCHETYPES };
