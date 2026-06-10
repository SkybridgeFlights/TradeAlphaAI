'use strict';

const https = require('https');

// Raw HTTP GET — resolves with body string regardless of content type.
function getRaw(url, options = {}) {
  const timeout = options.timeout || 15000;
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const safeEndpoint = `${parsed.origin}${parsed.pathname}`;
    const req = https.get(parsed, { headers: options.headers || {} }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const byteSize = body.length;
        console.log(`[HTTP_CLIENT] GET ${safeEndpoint} status=${res.statusCode} size=${byteSize}B`);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(`HTTP ${res.statusCode} from ${safeEndpoint}`);
          error.statusCode = res.statusCode;
          error.responseSize = byteSize;
          error.endpoint = safeEndpoint;
          reject(error);
          return;
        }
        resolve(body);
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error(`Timeout from ${safeEndpoint}`)));
  });
}

// JSON GET — wraps getRaw and parses response.
function getJson(url, options = {}) {
  return getRaw(url, options).then((body) => {
    const parsed = new URL(url);
    const safeEndpoint = `${parsed.origin}${parsed.pathname}`;
    try {
      return JSON.parse(body);
    } catch {
      const error = new Error(`Invalid JSON from ${safeEndpoint}`);
      error.responseSize = body.length;
      error.endpoint = safeEndpoint;
      throw error;
    }
  });
}

// JSON GET with exponential-backoff retry on 5xx errors.
// maxRetries=2 → up to 3 total attempts: 0ms, 500ms, 1000ms delays.
// Does NOT retry 4xx, timeout, or parse errors — those are permanent failures.
async function getJsonWithRetry(url, options = {}) {
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;
  const baseDelay  = options.baseDelay  !== undefined ? options.baseDelay  : 500;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await getJson(url, options);
    } catch (err) {
      lastError = err;
      const status      = err.statusCode;
      const is5xx       = status !== undefined && status >= 500 && status < 600;
      const shouldRetry = attempt < maxRetries && is5xx;
      if (!shouldRetry) break;
      const delay = baseDelay * Math.pow(2, attempt); // 500ms, 1000ms
      console.log(`[HTTP_CLIENT] retry attempt=${attempt + 1}/${maxRetries} delay=${delay}ms http_status=${status}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

module.exports = { getRaw, getJson, getJsonWithRetry };
