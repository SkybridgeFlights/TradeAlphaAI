'use strict';

function createTopicModule(config) {
  const module = {
    id: config.id,
    label: config.label,
    keywords: config.keywords || [],
    terminology: config.terminology || [],
    macro_relationships: config.macro_relationships || [],
    valuation_concepts: config.valuation_concepts || [],
    institutional_positioning_patterns: config.institutional_positioning_patterns || [],
    comparisons: config.comparisons || [],
    business_cycle: config.business_cycle || '',
    earnings_durability: config.earnings_durability || '',
    liquidity_structure: config.liquidity_structure || '',
    risks: config.risks || [],
    match(topic) {
      const values = [
        topic.slug,
        topic.title_en,
        topic.category,
        ...(topic.tags || []),
        ...(topic.related_etfs || [])
      ].filter(Boolean).map((value) => String(value).toLowerCase());
      return this.keywords.reduce((score, keyword) => {
        const normalized = keyword.toLowerCase();
        const matched = normalized.length <= 4
          ? values.some((value) => value.split(/[^a-z0-9]+/).includes(normalized))
          : values.some((value) => value.includes(normalized));
        return score + (matched ? 1 : 0);
      }, 0);
    }
  };
  return Object.freeze(module);
}

module.exports = { createTopicModule };
