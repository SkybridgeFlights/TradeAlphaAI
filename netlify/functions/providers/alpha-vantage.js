async function getMarketData() {
  // TODO: Implement server-side Alpha Vantage calls with process.env.ALPHA_VANTAGE_API_KEY.
  // Keep API keys server-side only. Add rate limiting and caching before production use.
  throw new Error("Alpha Vantage provider is not configured.");
}

module.exports = { getMarketData };

