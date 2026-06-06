'use strict';

const { createTopicModule } = require('./module-factory');

module.exports = createTopicModule({
  id: 'sector-rotation',
  label: 'Sector rotation',
  keywords: ['sector', 'rotation', 'cyclical', 'defensive', 'growth versus value', 'value', 'portfolio risk', 'beta', 'drawdown'],
  terminology: ['relative strength', 'earnings breadth', 'factor exposure', 'operating leverage', 'participation', 'leadership concentration'],
  macro_relationships: [
    'Improving growth expectations can broaden participation toward cyclicals, while falling growth confidence often redirects attention toward earnings stability.',
    'Lower volatility does not confirm healthy rotation unless equal-weight participation and earnings breadth improve with headline indexes.'
  ],
  valuation_concepts: ['relative multiple', 'earnings revision breadth', 'risk premium dispersion', 'quality spread'],
  institutional_positioning_patterns: ['cyclical participation', 'defensive rotation', 'barbell allocation'],
  comparisons: [
    { left: 'SPY', right: 'RSP', reason: 'cap-weight leadership versus equal-weight participation' },
    { left: 'QQQ', right: 'XLP', reason: 'long-duration growth leadership versus defensive earnings stability' }
  ],
  business_cycle: 'Sector leadership reflects the interaction of growth, inflation, policy, earnings revisions, and the market price of risk.',
  earnings_durability: 'Defensive groups emphasize stable demand, while cyclical sectors carry greater operating leverage to changes in activity.',
  liquidity_structure: 'Sector ETFs are generally liquid, but crowded leadership can create faster reversals when participation narrows.',
  risks: ['false breadth signals', 'crowded leadership', 'earnings revision reversals', 'factor overlap', 'policy shocks']
});
