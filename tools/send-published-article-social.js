#!/usr/bin/env node
'use strict';

// Unified social distribution sender.
//
// Called by tradealpha-workflow.yml after each successful Telegram delivery.
// Composes a per-platform payload, runs it through the BaseAdapter gates,
// and posts to whichever platforms have ENABLE_<PLATFORM>_POSTING=true and
// valid credentials.
//
// Usage:
//   node tools/send-published-article-social.js \
//     --slug=<slug> --content-type=<editorial|market-outlook|continuous-intelligence>
//
// Behaviour:
//   * For each of 4 platforms (Facebook, Instagram, X, LinkedIn):
//     - Build a per-platform optimized payload from the published article
//     - Send via the platform's adapter
//     - Record outcome in data/social/delivery-ledger.json
//   * Adapters in 'disabled' mode (no flag set) short-circuit silently.
//   * Missing credentials -> skip platform with structured warning, never fail.
//
// Exit code is always 0 unless a programmer error occurs. The workflow
// continues on per-platform failure so one bad platform never blocks others.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { getAdapter } = require('./social/adapters');
const { PLATFORMS, modeFor } = require('./social/social-flags');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = process.env.SITE_URL || 'https://www.tradealphaai.com';
const LEDGER_PATH = path.join(ROOT, 'data', 'social', 'delivery-ledger.json');

function argValue(flag) {
  const m = process.argv.find((a) => a.startsWith(flag + '='));
  return m ? m.slice(flag.length + 1) : '';
}

async function main() {
  const slug = argValue('--slug');
  const contentType = argValue('--content-type');

  if (!slug || !contentType) {
    console.log('[social] usage: --slug=<slug> --content-type=<type>');
    process.exit(0);
  }

  // 1) Resolve published article URL + extract metadata
  const article = resolveArticle(slug, contentType);
  if (!article) {
    console.log(`[social] could not locate article for ${contentType}/${slug} — skipping`);
    process.exit(0);
  }

  console.log(`[social] sending '${article.title}' to social platforms`);
  console.log(`[social] source_url: ${article.source_url}`);

  // 2) Build per-platform payloads
  const ledger = loadLedger();
  const urlChecker = makeUrlChecker();
  const results = [];

  for (const platform of PLATFORMS) {
    const mode = modeFor(platform, process.env);
    if (mode === 'disabled') {
      console.log(`[social] ${platform}: disabled (flag not set)`);
      results.push({ platform, status: 'disabled' });
      continue;
    }

    const adapter = getAdapter(platform);
    if (!adapter) {
      console.log(`[social] ${platform}: no adapter`);
      continue;
    }

    const item = buildPayload(platform, article);
    let outcome;
    try {
      outcome = await adapter.post(item, { env: process.env, ledger, urlChecker });
    } catch (err) {
      outcome = { platform, status: 'failed', error: String(err && err.message || err) };
    }

    const violationSuffix = (outcome.violations && outcome.violations.length)
      ? ' — violations: ' + outcome.violations.join('; ')
      : '';
    console.log(`[social] ${platform}: ${outcome.status}${outcome.error ? ' — ' + outcome.error : ''}${violationSuffix}${outcome.external_post_id ? ' (id=' + outcome.external_post_id + ')' : ''}`);
    results.push({
      platform,
      slug,
      content_type: contentType,
      status: outcome.status,
      external_post_id: outcome.external_post_id || null,
      posted_at: outcome.posted ? new Date().toISOString() : null,
      error: outcome.error || null
    });

    // Append to ledger for delivered posts (BaseAdapter expects this shape)
    if (outcome.posted) {
      ledger.records = ledger.records || [];
      ledger.records.push({
        platform,
        slug,
        content_type: contentType,
        status: 'posted',
        external_post_id: outcome.external_post_id,
        posted_at: new Date().toISOString(),
        source_url: article.source_url
      });
    }
  }

  // 3) Persist ledger
  saveLedger(ledger);

  // 4) Summary
  const posted = results.filter((r) => r.status === 'posted').length;
  console.log(`[social] summary: ${posted}/${results.length} posted`);
}

// ── Article resolution ────────────────────────────────────────────────────────

function resolveArticle(slug, contentType) {
  const dirMap = {
    'editorial': 'insights',
    'market-outlook': 'market-outlook',
    'continuous-intelligence': 'intelligence',
    'news-analysis': 'market-news'
  };
  const dir = dirMap[contentType];
  if (!dir) return null;

  const file = path.join(ROOT, dir, slug + '.html');
  if (!fs.existsSync(file)) return null;

  const html = fs.readFileSync(file, 'utf8');
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [null, slug.replace(/-/g, ' ')])[1]
    .replace(/<[^>]+>/g, '').trim();
  const desc = (html.match(/<meta name="description" content="([^"]+)"/) || [null, ''])[1];

  return {
    slug,
    content_type: contentType,
    title,
    description: desc,
    source_url: `${SITE_URL}/${dir}/${slug}.html`,
    graphic_path: findGraphicPath(slug),
    graphic_url: findGraphicUrl(slug)
  };
}

function findGraphicPath(slug) {
  // Prefer rendered PNG export tied to this slug; otherwise fall back to
  // the TradeAlphaAI brand image so Instagram (which requires PNG/JPG)
  // can still publish. SVG is intentionally excluded.
  const candidates = [
    path.join(ROOT, 'data', 'social', 'exports', slug + '.png'),
    path.join(ROOT, 'data', 'visual', 'social-exports', slug + '.png'),
    path.join(ROOT, 'Image', '1.png')   // brand fallback (PNG, not SVG)
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function findGraphicUrl(slug) {
  // Public URL for image-hosted-by-URL platforms (Instagram + Facebook
  // photo posts). PNG only — Instagram and X reject SVG. When no
  // per-article PNG exists yet, fall back to the brand PNG hosted at
  // /Image/1.png so Instagram does not skip silently with no_image_url.
  const candidates = [
    { local: path.join(ROOT, 'data', 'social', 'exports', slug + '.png'), url: `${SITE_URL}/data/social/exports/${slug}.png` },
    { local: path.join(ROOT, 'data', 'visual', 'social-exports', slug + '.png'), url: `${SITE_URL}/data/visual/social-exports/${slug}.png` },
    { local: path.join(ROOT, 'Image', '1.png'), url: `${SITE_URL}/Image/1.png` }
  ];
  for (const c of candidates) if (fs.existsSync(c.local)) return c.url;
  return null;
}

// ── Per-platform payload builders ─────────────────────────────────────────────

function buildPayload(platform, article) {
  const baseHook = article.title;
  const baseBody = article.description || `New research from TradeAlphaAI on ${article.title}.`;
  const baseCta = 'Read the full analysis on TradeAlphaAI.';

  // Adapt per platform's tone + length.
  if (platform === 'x') {
    return {
      platform,
      slug: article.slug,
      duplicate_key: `x:${article.slug}`,
      approval_status: 'approved',
      language: 'en',
      hook: trim(baseHook, 90),
      body: trim(baseBody, 140),
      cta: '',
      source_url: article.source_url,
      graphic_path: article.graphic_path
    };
  }
  if (platform === 'instagram') {
    return {
      platform,
      slug: article.slug,
      duplicate_key: `instagram:${article.slug}`,
      approval_status: 'approved',
      language: 'en',
      hook: baseHook,
      body: baseBody,
      cta: baseCta,
      source_url: article.source_url,
      graphic_path: article.graphic_path,
      graphic_url: article.graphic_url
    };
  }
  if (platform === 'facebook') {
    return {
      platform,
      slug: article.slug,
      duplicate_key: `facebook:${article.slug}`,
      approval_status: 'approved',
      language: 'en',
      hook: baseHook,
      body: baseBody,
      cta: baseCta,
      source_url: article.source_url,
      graphic_path: article.graphic_path,
      graphic_url: article.graphic_url
    };
  }
  if (platform === 'linkedin') {
    return {
      platform,
      slug: article.slug,
      duplicate_key: `linkedin:${article.slug}`,
      approval_status: 'approved',
      language: 'en',
      hook: baseHook,
      body: baseBody,
      cta: baseCta,
      source_url: article.source_url,
      graphic_path: article.graphic_path
    };
  }
  return null;
}

function trim(s, max) {
  if (!s) return '';
  s = s.trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

// ── Ledger I/O ────────────────────────────────────────────────────────────────

function loadLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); } catch { return { records: [] }; }
}

function saveLedger(ledger) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  ledger.updated_at = new Date().toISOString();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');
}

// ── URL liveness checker ──────────────────────────────────────────────────────

function makeUrlChecker() {
  return (url) => new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = https.request({
        hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search,
        method: 'HEAD', timeout: 8000
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[social] fatal:', err && err.message || err);
    process.exit(0); // Never block the workflow on social failure.
  });
}
