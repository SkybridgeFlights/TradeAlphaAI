'use strict';

const { createTopicModule } = require('./module-factory');

module.exports = createTopicModule({
  id: 'cloud-computing',
  label: 'Cloud computing',
  keywords: ['cloud', 'software', 'saas', 'wcld', 'skyy', 'clou'],
  terminology: ['remaining performance obligations', 'net retention', 'consumption pricing', 'hyperscaler', 'infrastructure utilization', 'free-cash-flow conversion'],
  macro_relationships: [
    'A rise in real yields reduces the present value of distant cash flows and usually increases valuation sensitivity across long-duration software.',
    'Enterprise optimization can slow consumption growth even when migration remains a durable structural theme.'
  ],
  valuation_concepts: ['enterprise-value-to-sales', 'free-cash-flow yield', 'growth-adjusted multiple', 'revenue duration'],
  institutional_positioning_patterns: ['duration-sensitive growth sleeve', 'profitable software preference', 'infrastructure versus application split'],
  comparisons: [
    { left: 'SKYY', right: 'WCLD', reason: 'infrastructure-weighted exposure versus faster-growth software concentration' },
    { left: 'CLOU', right: 'SKYY', reason: 'different definitions of cloud revenue and mega-cap influence' }
  ],
  business_cycle: 'Cloud demand combines structural migration with cyclical enterprise budgets, so bookings can weaken before reported recurring revenue does.',
  earnings_durability: 'Contracted revenue improves visibility, but consumption models and elevated stock-based compensation can weaken cash-flow comparability.',
  liquidity_structure: 'Broad cloud funds tend to trade more steadily than narrow baskets dominated by smaller application vendors.',
  risks: ['valuation compression', 'budget optimization', 'hyperscaler concentration', 'margin execution', 'competitive pricing']
});
