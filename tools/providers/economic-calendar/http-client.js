'use strict';

const https = require('https');

function getJson(url, options = {}) {
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
        try {
          resolve(JSON.parse(body));
        } catch {
          const error = new Error(`Invalid JSON from ${safeEndpoint}`);
          error.responseSize = byteSize;
          error.endpoint = safeEndpoint;
          reject(error);
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error(`Timeout from ${safeEndpoint}`)));
  });
}

module.exports = { getJson };
