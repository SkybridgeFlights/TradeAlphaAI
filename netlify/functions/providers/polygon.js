async function getMarketData() {
  // TODO: Implement server-side Polygon.io calls with process.env.POLYGON_API_KEY.
  // Keep API keys server-side only. Add rate limiting and caching before production use.
  throw new Error("Polygon provider is not configured.");
}

module.exports = { getMarketData };

