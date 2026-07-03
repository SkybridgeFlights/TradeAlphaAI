#!/usr/bin/env node
'use strict';

// AI-driven editorial topic ideation.
//
// The autonomous publishing brain reads editorial-topic-queue.json and picks
// a draft/planned topic to publish. When the queue drains (everything is
// published or stuck in manual review), the brain returns "no eligible topic"
// and nothing publishes. This tool tops up the queue by asking OpenAI to
// propose new institutional-research educational topics that don't duplicate
// anything already covered.
//
// Runs in the workflow BEFORE the editorial slot, but only when the queue
// has fewer than MIN_ELIGIBLE_TOPICS eligible entries — so we don't waste
// tokens topping up a healthy queue.

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ROOT               = path.resolve(__dirname, '..');
const QUEUE_PATH         = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const REGISTRY_PATH      = path.join(ROOT, 'data', 'insights', 'article-registry.json');
const MODEL              = process.env.OPENAI_MODEL || 'gpt-4o';
const TIMEOUT_MS         = 60_000;

// Only refill when eligible topics fall below this threshold.
const MIN_ELIGIBLE_TOPICS = 3;
// Ask the model for this many new topics per invocation.
const REQUEST_COUNT       = 6;
// Eligible statuses match DRAFT_STATUSES in autonomous-publishing-brain.js.
const ELIGIBLE_STATUSES = new Set(['draft', 'planned', 'queued', 'in_review', 'pending', 'generated']);

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); }
  catch { return fallback; }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function callOpenAI(systemPrompt, userPrompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model:           MODEL,
      messages:        [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature:     0.85,
      max_tokens:      3000,
      response_format: { type: 'json_object' },
    });
    const req = https.request({
      hostname: 'api.openai.com',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers:  {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: TIMEOUT_MS,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const parsed = JSON.parse(raw);
          if (parsed.error) { reject(new Error(`OpenAI: ${parsed.error.message}`)); return; }
          const text = parsed.choices?.[0]?.message?.content;
          if (!text) { reject(new Error('OpenAI returned empty content')); return; }
          resolve(JSON.parse(text));
        } catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)); });
    req.write(body);
    req.end();
  });
}

function collectCoveredTitles(queue, registry) {
  const covered = [];
  for (const topic of queue.topics || []) {
    if (topic.title_en) covered.push(topic.title_en);
  }
  for (const article of registry.articles || []) {
    const en = article.languages?.en?.title;
    if (en) covered.push(en);
  }
  return [...new Set(covered)];
}

// Auto-discover the list of valid hub pages from disk. `related_hubs` must
// point at real hub files (checked by check-editorial-quality.js) — hardcoding
// would drift as new hubs land.
function discoverHubs() {
  const hubs = new Set();
  for (const file of fs.readdirSync(ROOT)) {
    const m = file.match(/^([a-z0-9-]+-(?:stocks|etfs))\.html$/);
    if (m) hubs.add(m[1]);
  }
  return [...hubs].sort();
}

// Category → best-guess hub fallback when the model returns no hubs.
// The categories mirror what the ideation prompt asks the model to use.
function fallbackHub(category, availableHubs) {
  const cat = String(category || '').toLowerCase();
  const pick = (needle) => availableHubs.find((h) => h.includes(needle));
  if (cat.includes('etf'))       return pick('etfs') || availableHubs[0];
  if (cat.includes('sector'))    return pick('stocks') || availableHubs[0];
  if (cat.includes('macro'))     return pick('defensive') || availableHubs[0];
  if (cat.includes('portfolio')) return pick('defensive') || availableHubs[0];
  if (cat.includes('structure')) return pick('growth') || availableHubs[0];
  return availableHubs[0];
}

function normalizeTopic(raw, availableHubs, dayOffset = 1) {
  if (!raw || typeof raw !== 'object') return null;
  const titleEn = String(raw.title_en || raw.title || '').trim();
  const titleAr = String(raw.title_ar || '').trim();
  if (!titleEn || !titleAr) return null;
  const slug = slugify(raw.slug || titleEn);
  if (!slug) return null;

  // Stagger target publish dates so the editorial-schedule check (1/day cap)
  // doesn't complain when we drop 6 new topics at once.
  const today = new Date();
  const publishTarget = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Only keep hubs the model returned that actually exist on disk — anything
  // else fails check-editorial-quality.js when it looks up the hub page.
  const proposedHubs = Array.isArray(raw.related_hubs) ? raw.related_hubs.map(String) : [];
  const validHubs = proposedHubs.filter((h) => availableHubs.includes(h));
  if (validHubs.length === 0) {
    const fallback = fallbackHub(raw.category, availableHubs);
    if (fallback) validHubs.push(fallback);
  }

  return {
    slug,
    title_en:            titleEn,
    title_ar:            titleAr,
    category:            String(raw.category || 'Market Research').trim() || 'Market Research',
    tags:                Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 6) : [],
    related_stocks:      Array.isArray(raw.related_stocks) ? raw.related_stocks.map((s) => String(s).toUpperCase()).slice(0, 6) : [],
    related_etfs:        Array.isArray(raw.related_etfs) ? raw.related_etfs.map((s) => String(s).toUpperCase()).slice(0, 6) : [],
    related_comparisons: Array.isArray(raw.related_comparisons) ? raw.related_comparisons.map(String).slice(0, 4) : [],
    related_hubs:        validHubs.slice(0, 4),
    priority:            2,
    status:              'planned',
    target_publish_date: publishTarget,
    estimated_read_time: 8,
    language_support:    ['en', 'ar'],
    evergreen_category:  String(raw.evergreen_category || raw.category || 'market research').toLowerCase(),
    discovery_cluster:   String(raw.discovery_cluster || raw.category || 'market research').toLowerCase(),
    scheduled_publish_time: '14:00',
    telegram_status:     'not_ready',
    review_status:       'pending',
    editor_notes:        'AI-generated candidate — autonomous review pending',
    revision_count:      0,
    source:              'ai-ideation',
  };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const dryRun = !process.argv.includes('--write');

  const queue = readJson(QUEUE_PATH, { version: '1.0', topics: [] });
  const eligible = (queue.topics || []).filter((t) => ELIGIBLE_STATUSES.has(t.status));

  console.log(`[ai-topics] queue total=${queue.topics.length} eligible=${eligible.length} threshold=${MIN_ELIGIBLE_TOPICS}`);

  if (eligible.length >= MIN_ELIGIBLE_TOPICS) {
    console.log('[ai-topics] queue healthy — skipping ideation');
    return;
  }

  if (!apiKey) {
    console.log('[ai-topics] OPENAI_API_KEY not set — cannot ideate; skipping');
    return;
  }

  const registry = readJson(REGISTRY_PATH, { articles: [] });
  const covered = collectCoveredTitles(queue, registry);
  const existingSlugs = new Set((queue.topics || []).map((t) => t.slug));
  const availableHubs = discoverHubs();

  const systemPrompt = [
    'You are an institutional research editor for TradeAlphaAI, a bilingual (English + Arabic) educational financial research platform.',
    'Your role: propose new, timeless "evergreen" educational topics about market structure, ETF mechanics, factor investing, macro frameworks, sector cycles, and portfolio risk.',
    '',
    'CRITICAL rules:',
    '- Topics MUST be educational — never actionable trade recommendations, price targets, or "buy/sell" content.',
    '- Every topic MUST have both English and Arabic titles. Arabic must be natural Arabic (فصحى), not transliteration.',
    '- Avoid duplicating already-covered topics (list provided). Propose meaningfully distinct angles.',
    '- Focus areas: ETFs (mechanics, risk, factor exposure), sector cycles, macro (rates, dollar, inflation), market structure (liquidity, breadth, regimes), portfolio construction.',
    '- Titles should be specific and analytical (not vague). Examples of good style: "ETF Diversification Guide: Holdings, Sectors, Overlap, and Risk" — bad style: "Investing Tips".',
    '',
    'Output JSON only.',
  ].join('\n');

  const userPrompt = [
    `Propose ${REQUEST_COUNT} NEW educational topics.`,
    '',
    'Already covered (do NOT duplicate any of these angles):',
    ...covered.slice(0, 60).map((t, i) => `${i + 1}. ${t}`),
    '',
    `Available hub pages (each topic MUST reference at least 1-2, exact strings):`,
    availableHubs.join(', '),
    '',
    'Return JSON with this exact shape:',
    '{',
    '  "topics": [',
    '    {',
    '      "title_en": "Descriptive analytical title in English",',
    '      "title_ar": "عنوان تحليلي وصفي بالعربية",',
    '      "category": "ETF Education | Sector Outlook | Market Structure | Macro Research | Portfolio Risk",',
    '      "tags": ["3-5 topical tags"],',
    '      "related_stocks": ["TICKER1", "TICKER2"],',
    '      "related_etfs": ["ETF1", "ETF2"],',
    '      "related_hubs": ["one-or-two-hub-slugs-from-the-list-above"],',
    '      "evergreen_category": "sector education | etf education | macro education | portfolio education",',
    '      "discovery_cluster": "short cluster name"',
    '    }',
    '  ]',
    '}',
  ].join('\n');

  console.log(`[ai-topics] asking OpenAI for ${REQUEST_COUNT} candidates (model=${MODEL})...`);
  let response;
  try {
    response = await callOpenAI(systemPrompt, userPrompt, apiKey);
  } catch (e) {
    console.error(`[ai-topics] OpenAI call failed: ${e.message}`);
    process.exit(0);  // Non-fatal — workflow continues without new topics.
  }

  const raw = Array.isArray(response.topics) ? response.topics : [];
  const accepted = [];
  const rejected = [];

  let dayOffset = 1;
  for (const item of raw) {
    const topic = normalizeTopic(item, availableHubs, dayOffset);
    if (!topic) { rejected.push({ reason: 'missing_required_fields', raw: item }); continue; }
    if (existingSlugs.has(topic.slug)) { rejected.push({ reason: 'duplicate_slug', slug: topic.slug }); continue; }
    existingSlugs.add(topic.slug);
    accepted.push(topic);
    dayOffset++;
  }

  console.log(`[ai-topics] proposals: ${raw.length}, accepted: ${accepted.length}, rejected: ${rejected.length}`);
  for (const r of rejected) console.log(`  reject: ${r.reason}${r.slug ? ' ('+r.slug+')' : ''}`);
  for (const a of accepted) console.log(`  + ${a.slug} — ${a.title_en}`);

  if (!accepted.length) {
    console.log('[ai-topics] no acceptable candidates — nothing to write');
    return;
  }

  if (dryRun) {
    console.log('[ai-topics] dry-run (pass --write to persist)');
    return;
  }

  queue.topics = [...(queue.topics || []), ...accepted];
  queue.updated = new Date().toISOString();
  writeJson(QUEUE_PATH, queue);
  console.log(`[ai-topics] queue updated: ${queue.topics.length} total, +${accepted.length} new`);
}

if (require.main === module) {
  main().catch((e) => { console.error('[ai-topics] fatal:', e.message); process.exit(0); });
}

module.exports = { normalizeTopic, slugify };
