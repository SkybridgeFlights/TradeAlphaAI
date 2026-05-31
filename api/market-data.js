// Vercel serverless function — wraps the existing Netlify handler so all
// provider logic, caching, and fallback behaviour stay in one place.
//
// Environment variables (set in Vercel dashboard, never in frontend code):
//   FINNHUB_API_KEY       — real-time market data key
//   MARKET_DATA_PROVIDER  — "finnhub" | "mock" (auto-detected if omitted)

const netlifyHandler = require("../netlify/functions/market-data");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
    res.status(204).end();
    return;
  }

  // Auto-select finnhub when FINNHUB_API_KEY is present and no explicit
  // MARKET_DATA_PROVIDER override is set in the environment or query string.
  const provider =
    req.query.provider ||
    process.env.MARKET_DATA_PROVIDER ||
    (process.env.FINNHUB_API_KEY ? "finnhub" : "mock");

  const event = {
    queryStringParameters: {
      ...req.query,
      provider
    }
  };

  try {
    const result = await netlifyHandler.handler(event);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const cc = (result.headers || {})["Cache-Control"];
    if (cc) res.setHeader("Cache-Control", cc);
    res.status(result.statusCode).send(result.body);
  } catch (err) {
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
};
