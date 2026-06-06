'use strict';

const { createTopicModule } = require('./module-factory');

module.exports = createTopicModule({
  id: 'cybersecurity',
  label: 'Cybersecurity',
  keywords: ['cybersecurity', 'cyber security', 'hack', 'cibr', 'bug'],
  terminology: ['annual recurring revenue', 'net retention', 'endpoint security', 'identity access', 'zero-trust architecture', 'billings duration'],
  macro_relationships: [
    'Higher real yields raise the discount rate applied to subscription cash flows and can compress software valuation multiples.',
    'Persistent breach activity supports security budgets, but procurement cycles still lengthen when enterprise spending is constrained.'
  ],
  valuation_concepts: ['free-cash-flow margin', 'revenue duration', 'sales multiple dispersion', 'stock-based compensation'],
  institutional_positioning_patterns: ['quality-growth allocation', 'profitable platform preference', 'vendor-consolidation exposure'],
  comparisons: [
    { left: 'CIBR', right: 'HACK', reason: 'different index construction, holdings breadth, and concentration in security vendors' },
    { left: 'BUG', right: 'CIBR', reason: 'pure-play exposure versus a broader cybersecurity ecosystem' }
  ],
  business_cycle: 'Security spending is less discretionary than many software categories, although new-project timing remains sensitive to enterprise confidence.',
  earnings_durability: 'Recurring contracts support revenue visibility, while renewal quality and customer concentration determine how durable that visibility is.',
  liquidity_structure: 'ETF liquidity reflects both secondary-market volume and the tradability of smaller software constituents.',
  risks: ['multiple compression', 'platform competition', 'slower billings', 'customer concentration', 'execution after acquisitions']
});
