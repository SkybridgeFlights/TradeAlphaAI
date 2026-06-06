'use strict';

const { createTopicModule } = require('./module-factory');

module.exports = createTopicModule({
  id: 'bond-duration',
  label: 'Bond duration',
  keywords: ['bond', 'treasury', 'duration', 'yield curve', 'tlt', 'ief', 'bnd'],
  terminology: ['effective duration', 'convexity', 'term premium', 'real yield', 'roll-down', 'credit spread'],
  macro_relationships: [
    'A parallel rise in yields reduces bond prices, with a larger mark-to-market effect on portfolios carrying more duration.',
    'Curve steepening driven by term premium differs from steepening driven by easier front-end policy expectations.'
  ],
  valuation_concepts: ['yield-to-maturity', 'real yield', 'term premium', 'spread compensation'],
  institutional_positioning_patterns: ['duration extension', 'barbell allocation', 'liability-matching sleeve'],
  comparisons: [
    { left: 'TLT', right: 'IEF', reason: 'long-duration convexity versus intermediate-rate sensitivity' },
    { left: 'BND', right: 'IEF', reason: 'aggregate credit exposure versus Treasury-only duration' }
  ],
  business_cycle: 'Duration tends to respond to inflation persistence, growth expectations, policy pricing, and changes in the term premium.',
  earnings_durability: 'Bond cash flows are contractual, but reinvestment risk, inflation, and credit quality determine their real durability.',
  liquidity_structure: 'Treasury ETF liquidity is usually deep, while stressed markets can widen fund spreads even when underlying price discovery continues.',
  risks: ['inflation persistence', 'term-premium expansion', 'curve repricing', 'credit-spread widening', 'reinvestment risk']
});
