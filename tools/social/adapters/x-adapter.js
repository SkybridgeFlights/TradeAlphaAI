'use strict';

// X (Twitter) API v2 live posting with OAuth 1.0a signed requests.
//
// Auth: OAuth 1.0a HMAC-SHA1 (per X API v2 user-context requirements).
// Requires the four classic OAuth credentials issued by the X Developer Portal
// for an app authorized on the posting account:
//   X_API_KEY       — Consumer Key
//   X_API_SECRET    — Consumer Secret
//   X_ACCESS_TOKEN  — User Access Token
//   X_ACCESS_SECRET — User Access Token Secret
//
// Two-step posting when a graphic is present:
//   Step A: POST /1.1/media/upload.json with image bytes → returns media_id_string
//   Step B: POST /2/tweets with text + media.media_ids array
//
// IMPORTANT: X API access tiers — the free tier is severely rate-limited
// (~500 writes/month). Plan accordingly.

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { BaseAdapter } = require('./base-adapter');

class XAdapter extends BaseAdapter {
  constructor() { super('x'); }

  credentialPreflight(env = process.env) {
    const need = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'];
    const missing = need.filter((k) => !env[k]);
    return { ok: missing.length === 0, missing };
  }

  async _deliver(item) {
    const env = process.env;
    const creds = {
      consumerKey: env.X_API_KEY,
      consumerSecret: env.X_API_SECRET,
      token: env.X_ACCESS_TOKEN,
      tokenSecret: env.X_ACCESS_SECRET
    };
    const text = buildTweetText(item);
    const graphicPath = resolveGraphicPath(item);

    try {
      let mediaIds = null;
      if (graphicPath && fs.existsSync(graphicPath)) {
        const mediaId = await uploadMedia(creds, graphicPath);
        if (mediaId) mediaIds = [mediaId];
      }

      const tweetBody = { text };
      if (mediaIds) tweetBody.media = { media_ids: mediaIds };

      const result = await postTweet(creds, tweetBody);
      if (result.ok && result.json && result.json.data && result.json.data.id) {
        return { delivered: true, status: 'posted', external_post_id: result.json.data.id };
      }
      return { delivered: false, status: 'tweet_api_error', external_post_id: null, error: result.errorText };
    } catch (err) {
      return { delivered: false, status: 'network_error', external_post_id: null, error: String(err && err.message || err) };
    }
  }
}

function buildTweetText(item) {
  // X limit is 280 chars. The base validator already enforces <= 280 for the
  // body; we still trim defensively and append the source URL last so it
  // shortens via t.co automatically (~23 chars).
  const url = absoluteUrl(item.source_url);
  const parts = [];
  if (item.hook) parts.push(item.hook.trim());
  if (item.body) parts.push(item.body.trim());
  let text = parts.join(' — ').trim();
  if (url) {
    // Reserve ~24 chars for the t.co-shortened URL.
    const room = 280 - 25;
    if (text.length > room) text = text.slice(0, room - 1).trimEnd() + '…';
    text += ' ' + url;
  } else if (text.length > 280) {
    text = text.slice(0, 279).trimEnd() + '…';
  }
  return text;
}

function resolveGraphicPath(item) {
  if (!item.graphic_path) return null;
  if (path.isAbsolute(item.graphic_path)) return item.graphic_path;
  return path.resolve(process.cwd(), item.graphic_path);
}

function absoluteUrl(maybeUrl) {
  if (!maybeUrl) return null;
  if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
  const base = process.env.SITE_URL || 'https://www.tradealphaai.com';
  return base.replace(/\/$/, '') + (maybeUrl.startsWith('/') ? maybeUrl : '/' + maybeUrl);
}

// ── OAuth 1.0a signing ────────────────────────────────────────────────────────

function percentEncode(s) {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function oauthHeader(creds, method, url, extraParams = {}) {
  const oauthParams = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.token,
    oauth_version: '1.0'
  };

  // Signature base string is built from method + URL + sorted percent-encoded params.
  const allParams = { ...oauthParams, ...extraParams };
  const paramString = Object.keys(allParams).sort()
    .map((k) => percentEncode(k) + '=' + percentEncode(allParams[k]))
    .join('&');
  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = percentEncode(creds.consumerSecret) + '&' + percentEncode(creds.tokenSecret);
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams.oauth_signature = signature;
  return 'OAuth ' + Object.keys(oauthParams).sort()
    .map((k) => percentEncode(k) + '="' + percentEncode(oauthParams[k]) + '"')
    .join(', ');
}

// ── /2/tweets ────────────────────────────────────────────────────────────────

function postTweet(creds, tweetBody) {
  const url = 'https://api.twitter.com/2/tweets';
  const auth = oauthHeader(creds, 'POST', url);
  const body = JSON.stringify(tweetBody);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.twitter.com', port: 443, path: '/2/tweets', method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let chunks = '';
      res.on('data', (d) => { chunks += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(chunks); } catch { /* not json */ }
        const ok = res.statusCode >= 200 && res.statusCode < 300 && json && !json.errors;
        resolve({ ok, status: res.statusCode, json, errorText: ok ? null : (json && (json.detail || (json.errors && JSON.stringify(json.errors)))) || chunks.slice(0, 240) });
      });
    });
    req.on('error', (err) => resolve({ ok: false, status: 0, json: null, errorText: String(err.message || err) }));
    req.write(body);
    req.end();
  });
}

// ── /1.1/media/upload.json (multipart upload for image) ───────────────────────

async function uploadMedia(creds, filePath) {
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  const fileBuffer = fs.readFileSync(filePath);
  const boundary = '----TradeAlphaAIBoundary' + crypto.randomBytes(8).toString('hex');
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : 'image/png';

  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="media"; filename="${path.basename(filePath)}"\r\n` +
    `Content-Type: ${mime}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, fileBuffer, tail]);

  // Note: media upload uses OAuth params in Authorization, NOT in body.
  const auth = oauthHeader(creds, 'POST', url);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'upload.twitter.com', port: 443, path: '/1.1/media/upload.json', method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let chunks = '';
      res.on('data', (d) => { chunks += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(chunks); } catch { /* not json */ }
        if (json && json.media_id_string) resolve(json.media_id_string);
        else resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

module.exports = { XAdapter };
