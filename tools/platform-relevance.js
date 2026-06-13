'use strict';

// Phase 93 — Platform Relevance Intelligence.
// Canonical content-type -> platform affinity matrix: the single source of
// truth for WHERE each kind of institutional content belongs. The Phase 88
// social layer already scores individual stories per platform; this layer sits
// above it and routes by content TYPE, so the Distribution Brain can decide
// platform targeting consistently across every editorial surface.
//
// Affinity is 0–100. A platform below a content type's floor is simply not a
// target for that type — distribution is platform-aware, never copy-paste.

const PLATFORMS = ['telegram', 'x', 'linkedin', 'facebook', 'instagram'];

const CONTENT_TYPES = [
  'market-outlook', 'educational-article', 'macro-news', 'daily-brief',
  'continuous-intelligence', 'divergence-graphic', 'institutional-graphic',
];

// Rows: content type. Cols: platform affinity. Derived from the Phase 93
// objective-8 mapping (e.g. Market Outlook -> Telegram/X/LinkedIn). A 0 means
// "not a target". Text content favors text platforms; visual content favors
// visual platforms.
const CONTENT_PLATFORM_MATRIX = {
  'market-outlook': { telegram: 90, x: 84, linkedin: 80, facebook: 40, instagram: 30 },
  'educational-article': { linkedin: 86, facebook: 78, telegram: 64, x: 55, instagram: 35 },
  'macro-news': { telegram: 92, x: 88, linkedin: 58, facebook: 50, instagram: 30 },
  'daily-brief': { telegram: 90, linkedin: 76, x: 60, facebook: 40, instagram: 28 },
  'continuous-intelligence': { telegram: 88, x: 82, linkedin: 50, facebook: 30, instagram: 30 },
  'divergence-graphic': { x: 88, instagram: 84, linkedin: 66, telegram: 60, facebook: 48 },
  'institutional-graphic': { instagram: 88, linkedin: 84, x: 80, telegram: 62, facebook: 52 },
};

// A platform must clear this affinity to be a target for a content type.
const TARGET_FLOOR = 60;

function normalizeType(type) {
  const t = String(type || '').toLowerCase().trim();
  // Accept the brain's content-type names and the social candidate kinds.
  const alias = {
    editorial: 'educational-article', article: 'educational-article',
    outlook: 'market-outlook', 'market_outlook': 'market-outlook',
    'news-analysis': 'macro-news', news: 'macro-news',
    brief: 'daily-brief', 'daily-intelligence-brief': 'daily-brief', session: 'daily-brief',
    intraday: 'continuous-intelligence', alert: 'continuous-intelligence',
    chart: 'divergence-graphic', graphic: 'institutional-graphic',
  };
  return alias[t] || (CONTENT_TYPES.includes(t) ? t : null);
}

function relevanceScore(contentType, platform) {
  const type = normalizeType(contentType);
  if (!type) return 0;
  const row = CONTENT_PLATFORM_MATRIX[type] || {};
  return Number(row[platform]) || 0;
}

// Ranked target platforms for a content type (affinity >= floor), strongest
// first. Returns [{ platform, affinity }].
function platformsForContentType(contentType, floor = TARGET_FLOOR) {
  const type = normalizeType(contentType);
  if (!type) return [];
  const row = CONTENT_PLATFORM_MATRIX[type] || {};
  return PLATFORMS
    .map((platform) => ({ platform, affinity: Number(row[platform]) || 0 }))
    .filter((entry) => entry.affinity >= floor)
    .sort((a, b) => b.affinity - a.affinity);
}

// Combine the static content-type affinity with an optional per-item social
// relevance score (0–100). Mean keeps both signals honest: a high-affinity
// platform still drops if the specific item scored weakly, and vice versa.
function combinedRelevance(contentType, platform, itemScore = null) {
  const affinity = relevanceScore(contentType, platform);
  if (affinity === 0) return 0;
  if (!Number.isFinite(itemScore)) return affinity;
  return Math.round((affinity + Math.max(0, Math.min(100, itemScore))) / 2);
}

module.exports = {
  PLATFORMS,
  CONTENT_TYPES,
  CONTENT_PLATFORM_MATRIX,
  TARGET_FLOOR,
  normalizeType,
  relevanceScore,
  platformsForContentType,
  combinedRelevance,
};
