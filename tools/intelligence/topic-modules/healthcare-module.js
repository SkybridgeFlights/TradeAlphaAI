'use strict';

const { createTopicModule } = require('./module-factory');

module.exports = createTopicModule({
  id: 'healthcare',
  label: 'Healthcare',
  keywords: ['healthcare', 'health care', 'biotech', 'xlv', 'vht', 'iyh'],
  terminology: ['reimbursement', 'patent cycle', 'medical utilization', 'managed care', 'clinical pipeline', 'procedure volume'],
  macro_relationships: [
    'Slower growth can increase demand for durable earnings, although higher rates still pressure early-stage biotechnology financing.',
    'Defensive rotation favors stable cash flow, but policy and drug-pricing risk can override the broad sector regime.'
  ],
  valuation_concepts: ['pipeline-adjusted earnings', 'patent-cliff risk', 'free-cash-flow durability', 'reimbursement sensitivity'],
  institutional_positioning_patterns: ['defensive equity sleeve', 'quality earnings allocation', 'innovation-balanced exposure'],
  comparisons: [
    { left: 'XLV', right: 'VHT', reason: 'large-cap concentration versus broader all-cap healthcare participation' },
    { left: 'IYH', right: 'XLV', reason: 'different index construction, expense burden, and top-holdings influence' }
  ],
  business_cycle: 'Healthcare demand is comparatively stable, but hospitals, devices, biotechnology, and managed care respond to different economic and policy channels.',
  earnings_durability: 'Mature pharmaceuticals and insurers can offer durable cash flow, while biotechnology outcomes remain event-dependent.',
  liquidity_structure: 'XLV generally offers the deepest trading market, while broader portfolios add smaller holdings and different creation-basket risks.',
  risks: ['drug-pricing policy', 'clinical failure', 'patent expiry', 'medical-cost inflation', 'reimbursement pressure']
});
