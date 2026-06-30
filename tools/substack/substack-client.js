'use strict';

// Thin HTTP client for the (private, undocumented) Substack publishing API.
//
// Auth is via the `substack.sid` cookie extracted from a logged-in browser
// session. The cookie typically lasts ~90 days; when it expires the user must
// re-extract it and update SUBSTACK_SESSION_COOKIE in GitHub Secrets.
//
// Endpoints used here have been stable for years in community tooling
// (py-substack, substack-api, etc.) but Substack reserves the right to change
// them at any time. If a call starts failing with a non-401 status we should
// log the response body and fall back to manual posting until the contract
// is re-verified.

const https = require('https');
const { URL } = require('url');

class SubstackClient {
  constructor({ hostname, sessionCookie, userAgent }) {
    if (!hostname) throw new Error('SubstackClient: hostname is required (e.g. "tradealphaai.substack.com")');
    if (!sessionCookie) throw new Error('SubstackClient: sessionCookie is required (substack.sid value)');
    this.hostname = hostname.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    this.sessionCookie = sessionCookie;
    this.userAgent = userAgent || 'TradeAlphaAI-Newsletter/1.0 (+https://www.tradealphaai.com)';
  }

  request(method, pathOrUrl, body) {
    return new Promise((resolve, reject) => {
      const url = pathOrUrl.startsWith('http')
        ? new URL(pathOrUrl)
        : new URL(`https://${this.hostname}${pathOrUrl}`);

      const payload = body == null
        ? null
        : (typeof body === 'string' ? body : JSON.stringify(body));

      const headers = {
        'User-Agent': this.userAgent,
        'Accept': 'application/json, text/plain, */*',
        'Cookie': `substack.sid=${this.sessionCookie}`,
        'Origin': `https://${this.hostname}`,
        'Referer': `https://${this.hostname}/`
      };
      if (payload != null) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = https.request({
        method,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        headers
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          if (raw) {
            try { parsed = JSON.parse(raw); } catch { /* not JSON */ }
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, body: parsed, raw });
          } else {
            const err = new Error(`Substack API ${method} ${url.pathname} → ${res.statusCode}`);
            err.status = res.statusCode;
            err.body = parsed;
            err.raw = raw;
            reject(err);
          }
        });
      });
      req.on('error', reject);
      if (payload != null) req.write(payload);
      req.end();
    });
  }

  // GET /api/v1/subscription — returns the active user's profile + the publication's settings.
  // We use it to fetch the byline `user_id` and as a health-check for the cookie.
  async getMe() {
    const res = await this.request('GET', '/api/v1/subscription');
    return res.body;
  }

  // POST /api/v1/drafts — creates a draft post.
  // bodyDoc must be a ProseMirror JSON document (see prosemirror-builder.js).
  async createDraft({ title, subtitle, bodyDoc, byline_user_id, audience }) {
    if (!title) throw new Error('createDraft: title is required');
    if (!bodyDoc) throw new Error('createDraft: bodyDoc is required');

    const payload = {
      draft_title: title,
      draft_subtitle: subtitle || '',
      draft_body: JSON.stringify(bodyDoc),
      draft_bylines: byline_user_id ? [{ id: byline_user_id, is_guest: false }] : undefined,
      audience: audience || 'everyone',
      type: 'newsletter',
      should_send_email: false
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const res = await this.request('POST', '/api/v1/drafts', payload);
    return res.body;
  }

  // PUT /api/v1/drafts/{id} — updates an existing draft (rarely needed but useful for retries).
  async updateDraft(draftId, fields) {
    const res = await this.request('PUT', `/api/v1/drafts/${draftId}`, fields);
    return res.body;
  }

  // POST /api/v1/drafts/{id}/prepublish — Substack runs validation before allowing publish.
  async prepublishDraft(draftId) {
    const res = await this.request('POST', `/api/v1/drafts/${draftId}/prepublish`, {});
    return res.body;
  }

  // POST /api/v1/drafts/{id}/publish — publish + (optionally) email subscribers.
  async publishDraft(draftId, { sendEmail = true, shareAutomatically = false } = {}) {
    const res = await this.request('POST', `/api/v1/drafts/${draftId}/publish`, {
      send: sendEmail,
      share_automatically: shareAutomatically
    });
    return res.body;
  }
}

module.exports = { SubstackClient };
