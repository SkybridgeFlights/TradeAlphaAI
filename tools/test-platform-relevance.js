'use strict';

// Phase 93 — platform relevance logic tests (no file writes).

const {
  platformsForContentType, relevanceScore, combinedRelevance, normalizeType,
  CONTENT_TYPES, PLATFORMS,
} = require('./platform-relevance');

let failures = 0;
function assert(name, cond) {
  if (cond) { console.log(`  PASS ${name}`); } else { failures += 1; console.error(`  FAIL ${name}`); }
}

console.log('[test] objective-8 content-type → platform mappings');
const targets = (ct) => platformsForContentType(ct).map((t) => t.platform);
assert('market-outlook → telegram/x/linkedin', JSON.stringify(targets('market-outlook')) === JSON.stringify(['telegram', 'x', 'linkedin']));
assert('educational-article leads linkedin then facebook', targets('educational-article').slice(0, 2).join(',') === 'linkedin,facebook');
assert('macro-news → telegram,x only', targets('macro-news').join(',') === 'telegram,x');
assert('divergence-graphic includes x + instagram top2', targets('divergence-graphic').slice(0, 2).sort().join(',') === 'instagram,x');
assert('daily-brief leads telegram', targets('daily-brief')[0] === 'telegram');
assert('institutional-graphic leads instagram', targets('institutional-graphic')[0] === 'instagram');

console.log('[test] floor + ordering');
assert('all targets clear floor 60', CONTENT_TYPES.every((ct) => platformsForContentType(ct).every((t) => t.affinity >= 60)));
assert('targets ranked desc', CONTENT_TYPES.every((ct) => {
  const a = platformsForContentType(ct).map((t) => t.affinity);
  return a.every((v, i) => i === 0 || a[i - 1] >= v);
}));
assert('educational excludes instagram (below floor)', !targets('educational-article').includes('instagram'));

console.log('[test] aliases');
assert('editorial → educational-article', normalizeType('editorial') === 'educational-article');
assert('news-analysis → macro-news', normalizeType('news-analysis') === 'macro-news');
assert('outlook → market-outlook', normalizeType('outlook') === 'market-outlook');
assert('intraday → continuous-intelligence', normalizeType('intraday') === 'continuous-intelligence');
assert('unknown → null', normalizeType('nonsense-type') === null);

console.log('[test] relevance scoring');
assert('non-target scores below floor are real numbers', relevanceScore('educational-article', 'instagram') === 35);
assert('unknown type scores 0', relevanceScore('nonsense', 'x') === 0);
assert('combined is mean of affinity and item score', combinedRelevance('market-outlook', 'x', 50) === Math.round((84 + 50) / 2));
assert('combined ignores item score when absent', combinedRelevance('market-outlook', 'x') === 84);
assert('combined 0 for unknown platform', combinedRelevance('macro-news', 'tiktok', 90) === 0);

console.log('[test] platform set integrity');
assert('5 platforms', PLATFORMS.length === 5);
assert('every matrix platform is a known platform', CONTENT_TYPES.every((ct) => platformsForContentType(ct, 0).every((t) => PLATFORMS.includes(t.platform))));

if (failures) {
  console.error(`[test] ${failures} failure(s).`);
  process.exit(1);
}
console.log('[test] all platform-relevance tests passed.');
