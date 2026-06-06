'use strict';

const { createTopicModule } = require('./module-factory');

module.exports = createTopicModule({
  id: 'semiconductor',
  label: 'Semiconductors',
  keywords: ['semiconductor', 'chip', 'ai infrastructure', 'smh', 'soxx'],
  terminology: ['wafer capacity', 'book-to-bill', 'advanced packaging', 'foundry utilization', 'memory pricing', 'capital intensity'],
  macro_relationships: [
    'Tighter financial conditions can pressure semiconductor multiples before demand estimates change because the group carries both duration and cycle exposure.',
    'AI capital expenditure can support leading suppliers while consumer, industrial, and memory end markets remain in a different inventory phase.'
  ],
  valuation_concepts: ['through-cycle earnings', 'forward earnings multiple', 'replacement cost', 'inventory normalization'],
  institutional_positioning_patterns: ['AI infrastructure leadership', 'cyclical recovery allocation', 'equipment versus designer split'],
  comparisons: [
    { left: 'SMH', right: 'SOXX', reason: 'different concentration, weighting rules, and exposure to the largest AI beneficiaries' },
    { left: 'SOXX', right: 'XSD', reason: 'market-cap leadership versus equal-weight participation' }
  ],
  business_cycle: 'Semiconductors are inventory-sensitive and usually transmit changes in end demand through orders, utilization, pricing, and capital spending.',
  earnings_durability: 'Durability differs sharply between recurring infrastructure demand and product cycles exposed to customer inventory correction.',
  liquidity_structure: 'Large semiconductor ETFs are liquid, but concentration can make their risk profile resemble a small group of mega-cap holdings.',
  risks: ['inventory correction', 'export restrictions', 'customer concentration', 'capital-spending reversals', 'multiple compression']
});
