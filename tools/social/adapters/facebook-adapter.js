'use strict';

// Facebook Page Graph API live posting.
//
// Two delivery shapes depending on whether the item has a graphic:
//   1. Image post: POST /{page-id}/photos with url + caption
//   2. Link post:  POST /{page-id}/feed with message + link
//
// Auth: long-lived Page Access Token (NOT user token). Token is bound to a
// single page and grants pages_manage_posts + pages_read_engagement.
// See: https://developers.facebook.com/docs/pages/access-tokens

const https = require('https');
const { URL } = require('url');
const { BaseAdapter } = require('./base-adapter');

const GRAPH_VERSION = 'v18.0';
const GRAPH_HOST = 'graph.facebook.com';

class FacebookAdapter extends BaseAdapter {
  constructor() { super('facebook'); }

  credentialPreflight(env = process.env) {
    const need = ['FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'];
    const missing = need.filter((k) => !env[k]);
    return { ok: missing.length === 0, missing };
  }

  async _deliver(item) {
    const env = process.env;
    const pageId = env.FACEBOOK_PAGE_ID;
    const token = env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const caption = buildCaption(item);
    const sourceUrl = absoluteUrl(item.source_url);
    const graphicUrl = item.graphic_url || absoluteUrl(item.graphic_path);

    try {
      if (graphicUrl) {
        return await postPhoto({ pageId, token, photoUrl: graphicUrl, caption, sourceUrl });
      }
      return await postLink({ pageId, token, message: caption, link: sourceUrl });
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
  const url = absoluteUrl(item.source_url);
  if (url) lines.push(url);
  return lines.join('\n\n').trim();
}

function absoluteUrl(maybeUrl) {
  if (!maybeUrl) return null;
  if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
  const base = process.env.SITE_URL || 'https://www.tradealphaai.com';
  return base.replace(/\/$/, '') + (maybeUrl.startsWith('/') ? maybeUrl : '/' + maybeUrl);
}

async function postPhoto({ pageId, token, photoUrl, caption, sourceUrl }) {
  // /{page-id}/photos accepts a `url` param for a remote image plus `caption`.
  // FB strips bare URLs from caption text but preserves them as clickable text,
  // so we keep the source link inside the caption itself.
  const body = new URLSearchParams({
    url: photoUrl,
    caption,
    access_token: token,
    published: 'true'
  }).toString();
  const res = await graphRequest(`/${GRAPH_VERSION}/${pageId}/photos`, body);
  if (res.ok && res.json && (res.json.post_id || res.json.id)) {
    return { delivered: true, status: 'posted', external_post_id: res.json.post_id || res.json.id };
  }
  return { delivered: false, status: 'graph_api_error', external_post_id: null, error: res.errorText };
}

async function postLink({ pageId, token, message, link }) {
  const params = { message, access_token: token };
  if (link) params.link = link;
  const body = new URLSearchParams(params).toString();
  const res = await graphRequest(`/${GRAPH_VERSION}/${pageId}/feed`, body);
  if (res.ok && res.json && res.json.id) {
    return { delivered: true, status: 'posted', external_post_id: res.json.id };
  }
  return { delivered: false, status: 'graph_api_error', external_post_id: null, error: res.errorText };
}

function graphRequest(pathName, body) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: GRAPH_HOST,
      port: 443,
      path: pathName,
      method: 'POST',
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

module.exports = { FacebookAdapter };
