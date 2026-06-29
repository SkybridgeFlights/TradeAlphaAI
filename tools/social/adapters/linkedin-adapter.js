'use strict';

// LinkedIn API v2 live posting (UGC Posts API).
//
// Auth: Bearer token (OAuth 2.0).
// Required credentials:
//   LINKEDIN_ACCESS_TOKEN  — 3-legged OAuth 2.0 access token with w_member_social
//                            (for personal page) or w_organization_social (for
//                            company page). Tokens expire — refresh manually
//                            from LinkedIn Developer Portal periodically.
//   LINKEDIN_AUTHOR_URN    — Either "urn:li:person:{id}" or
//                            "urn:li:organization:{id}".
//
// Posting shapes:
//   * Text + URL preview: single POST /v2/ugcPosts with shareCommentary +
//     ARTICLE media.
//   * Text + uploaded image: 3-step (register upload → PUT image bytes →
//     create post referencing asset URN). Image not required.

const https = require('https');
const fs = require('fs');
const path = require('path');
const { BaseAdapter } = require('./base-adapter');

class LinkedInAdapter extends BaseAdapter {
  constructor() { super('linkedin'); }

  credentialPreflight(env = process.env) {
    const need = ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_AUTHOR_URN'];
    const missing = need.filter((k) => !env[k]);
    return { ok: missing.length === 0, missing };
  }

  async _deliver(item) {
    const env = process.env;
    const token = env.LINKEDIN_ACCESS_TOKEN;
    const authorUrn = env.LINKEDIN_AUTHOR_URN;
    const text = buildShareCommentary(item);
    const sourceUrl = absoluteUrl(item.source_url);
    const graphicPath = resolveGraphicPath(item);

    try {
      let imageAssetUrn = null;
      if (graphicPath && fs.existsSync(graphicPath)) {
        imageAssetUrn = await uploadImage(token, authorUrn, graphicPath);
      }

      const post = buildPostPayload({ authorUrn, text, sourceUrl, imageAssetUrn });
      const result = await createPost(token, post);

      if (result.ok && result.json && result.json.id) {
        return { delivered: true, status: 'posted', external_post_id: result.json.id };
      }
      return { delivered: false, status: 'ugc_post_error', external_post_id: null, error: result.errorText };
    } catch (err) {
      return { delivered: false, status: 'network_error', external_post_id: null, error: String(err && err.message || err) };
    }
  }
}

function buildShareCommentary(item) {
  const lines = [];
  if (item.hook) lines.push(item.hook.trim());
  if (item.body) lines.push(item.body.trim());
  if (item.cta) lines.push(item.cta.trim());
  return lines.join('\n\n').trim();
}

function buildPostPayload({ authorUrn, text, sourceUrl, imageAssetUrn }) {
  const payload = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };

  if (imageAssetUrn) {
    payload.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
    payload.specificContent['com.linkedin.ugc.ShareContent'].media = [{
      status: 'READY',
      media: imageAssetUrn,
      description: { text: text.slice(0, 200) },
      title: { text: 'TradeAlphaAI research' }
    }];
  } else if (sourceUrl) {
    payload.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
    payload.specificContent['com.linkedin.ugc.ShareContent'].media = [{
      status: 'READY',
      originalUrl: sourceUrl
    }];
  }

  return payload;
}

function createPost(token, payload) {
  const body = JSON.stringify(payload);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.linkedin.com', port: 443, path: '/v2/ugcPosts', method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Restli-Protocol-Version': '2.0.0'
      }
    }, (res) => {
      let chunks = '';
      res.on('data', (d) => { chunks += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(chunks); } catch { /* not json */ }
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        resolve({ ok, status: res.statusCode, json, errorText: ok ? null : (json && json.message) || chunks.slice(0, 240) });
      });
    });
    req.on('error', (err) => resolve({ ok: false, status: 0, json: null, errorText: String(err.message || err) }));
    req.write(body);
    req.end();
  });
}

// ── Image upload (3-step) ─────────────────────────────────────────────────────

async function uploadImage(token, authorUrn, filePath) {
  // Step 1: register upload
  const registerBody = JSON.stringify({
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: authorUrn,
      serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }]
    }
  });
  const registerRes = await rawRequest({
    hostname: 'api.linkedin.com', path: '/v2/assets?action=registerUpload', method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(registerBody),
      'X-Restli-Protocol-Version': '2.0.0'
    }
  }, registerBody);
  if (!registerRes.ok || !registerRes.json || !registerRes.json.value) return null;

  const uploadUrl = registerRes.json.value.uploadMechanism &&
    registerRes.json.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'] &&
    registerRes.json.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const assetUrn = registerRes.json.value.asset;
  if (!uploadUrl || !assetUrn) return null;

  // Step 2: PUT bytes
  const imageBytes = fs.readFileSync(filePath);
  const parsed = new URL(uploadUrl);
  const putResult = await rawRequest({
    hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/octet-stream',
      'Content-Length': imageBytes.length
    }
  }, imageBytes);
  if (!putResult.ok) return null;

  return assetUrn;
}

function rawRequest(opts, body) {
  return new Promise((resolve) => {
    const req = https.request({ port: 443, ...opts }, (res) => {
      let chunks = '';
      res.on('data', (d) => { chunks += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(chunks); } catch { /* not json */ }
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        resolve({ ok, status: res.statusCode, json, errorText: ok ? null : chunks.slice(0, 240) });
      });
    });
    req.on('error', (err) => resolve({ ok: false, status: 0, json: null, errorText: String(err.message || err) }));
    if (body) req.write(body);
    req.end();
  });
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

module.exports = { LinkedInAdapter };
