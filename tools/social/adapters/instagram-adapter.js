'use strict';

// Instagram Business API live posting (via Facebook Graph API).
//
// Prerequisites (one-time setup):
//   1. Instagram Business or Creator account
//   2. Linked to a Facebook Page (Meta Business Suite)
//   3. App with instagram_basic + instagram_content_publish + pages_show_list
//   4. Long-lived Page Access Token (same token that posts to FB Page)
//   5. The IG-User-ID (different from the Facebook Page ID)
//
// Two-step publishing flow (mandatory; IG doesn't accept one-shot posts):
//   Step A: POST /{ig-user-id}/media        → returns creation_id
//   Step B: POST /{ig-user-id}/media_publish → publishes the container
//
// Note: Instagram requires the image to be a public URL hosted somewhere
// reachable by Instagram's crawlers. The site's social-export PNGs hosted
// at https://www.tradealphaai.com/data/visual/social-exports/ qualify.

const https = require('https');
const { BaseAdapter } = require('./base-adapter');

const GRAPH_VERSION = 'v18.0';
const GRAPH_HOST = 'graph.facebook.com';

class InstagramAdapter extends BaseAdapter {
  constructor() { super('instagram'); }

  credentialPreflight(env = process.env) {
    const need = ['INSTAGRAM_BUSINESS_ACCOUNT_ID', 'INSTAGRAM_ACCESS_TOKEN'];
    const missing = need.filter((k) => !env[k]);
    return { ok: missing.length === 0, missing };
  }

  async _deliver(item) {
    const env = process.env;
    const igUserId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    const token = env.INSTAGRAM_ACCESS_TOKEN;
    const caption = buildCaption(item);
    const imageUrl = item.graphic_url || absoluteUrl(item.graphic_path);

    if (!imageUrl) {
      return { delivered: false, status: 'no_image_url', external_post_id: null, error: 'Instagram requires a public image URL' };
    }

    try {
      // Step A — create container
      const containerBody = new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: token
      }).toString();
      const containerRes = await graphRequest(`/${GRAPH_VERSION}/${igUserId}/media`, containerBody);
      if (!containerRes.ok || !containerRes.json || !containerRes.json.id) {
        return { delivered: false, status: 'container_create_failed', external_post_id: null, error: containerRes.errorText };
      }
      const creationId = containerRes.json.id;

      // Step B — publish container
      const publishBody = new URLSearchParams({
        creation_id: creationId,
        access_token: token
      }).toString();
      const publishRes = await graphRequest(`/${GRAPH_VERSION}/${igUserId}/media_publish`, publishBody);
      if (publishRes.ok && publishRes.json && publishRes.json.id) {
        return { delivered: true, status: 'posted', external_post_id: publishRes.json.id };
      }
      return { delivered: false, status: 'publish_failed', external_post_id: null, error: publishRes.errorText };
    } catch (err) {
      return { delivered: false, status: 'network_error', external_post_id: null, error: String(err && err.message || err) };
    }
  }
}

function buildCaption(item) {
  const lines = [];
  if (item.hook) lines.push(item.hook.trim());
  if (item.body) lines.push(item.body.trim());
  if (item.cta) lines.push(item.cta.trim());
  // Instagram does not auto-link URLs in captions, so we intentionally do
  // NOT append the source URL. The orchestrator's payload builder for
  // Instagram either omits source_url entirely or routes users to the
  // brand domain via the CTA / link-in-bio convention.
  return lines.join('\n\n').trim();
}

function absoluteUrl(maybeUrl) {
  if (!maybeUrl) return null;
  if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
  const base = process.env.SITE_URL || 'https://www.tradealphaai.com';
  return base.replace(/\/$/, '') + (maybeUrl.startsWith('/') ? maybeUrl : '/' + maybeUrl);
}

function graphRequest(pathName, body) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: GRAPH_HOST, port: 443, path: pathName, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let chunks = '';
      res.on('data', (d) => { chunks += d; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(chunks); } catch { /* not json */ }
        const ok = res.statusCode >= 200 && res.statusCode < 300 && json && !json.error;
        resolve({ ok, status: res.statusCode, json, errorText: ok ? null : (json && json.error && json.error.message) || chunks.slice(0, 240) });
      });
    });
    req.on('error', (err) => resolve({ ok: false, status: 0, json: null, errorText: String(err.message || err) }));
    req.write(body);
    req.end();
  });
}

module.exports = { InstagramAdapter };
