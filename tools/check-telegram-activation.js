'use strict';

// Phase 117 — check:telegram-activation. Safety gate for controlled Telegram
// publishing activation. HARD-FAILS if the sender could post to any non-Telegram
// social network, if it does not default to dry-run, if it skips the
// credential / URL-200 / duplicate / cap / cooldown gates, if a built message
// for a research/structure note carries advice/trading language or exceeds the
// length cap or lacks the EN/AR links, if the delivery ledger has a duplicate
// sent entry or a sent entry missing message_id / live https url, or if the
// preview-only social posture (X/FB/IG/LI) is not disabled.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SENDER = path.join(ROOT, 'tools', 'send-published-article-telegram.js');
const LEDGER = path.join(ROOT, 'data', 'telegram-delivery-ledger.json');
const MSG_CAP = 900;
const ADVICE = [/\bbuy now\b/i, /\bsell now\b/i, /\bentry\b/i, /\bstop loss\b/i, /\btake profit\b/i, /\bprice target\b/i, /\btarget price\b/i, /\bbreakout trade\b/i, /\bRSI\b/, /\bMACD\b/, /\bguaranteed\b/i, /\bbullish signal\b/i, /\bbearish signal\b/i, /\bto the moon\b/i, /\bmoon\b/i, /\bsniper\b/i, /\balpha call\b/i];
const FOREIGN_HOSTS = ['graph.facebook.com', 'api.twitter.com', 'api.x.com', 'api.linkedin.com', 'graph.instagram.com', 'upload.twitter.com'];

const failures = [];
const fail = (m) => failures.push(m);
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

// ── 1) Static sender safety ──────────────────────────────────────────────────
const src = fs.readFileSync(SENDER, 'utf8');
for (const h of FOREIGN_HOSTS) if (src.includes(h)) fail(`sender references non-Telegram social host ${h} (X/FB/IG/LI activation forbidden)`);
if (!src.includes('api.telegram.org')) fail('sender does not target api.telegram.org');
if (!/DRY_RUN\s*=\s*!SMOKE_TEST\s*&&\s*\(.*!process\.argv\.includes\('--send'\)/.test(src)) fail('sender does not default to dry-run (must require --send)');
if (!/TELEGRAM_BOT_TOKEN/.test(src) || !/TELEGRAM_CHANNEL_ID|TELEGRAM_CHAT_ID/.test(src)) fail('sender does not gate on TELEGRAM_BOT_TOKEN + channel/chat id');
if (!/res\.statusCode === 200/.test(src)) fail('sender URL verification must require exact HTTP 200');
if (!/Promise\.all\(\[verifyUrl\(urls\.url\), verifyUrl\(urls\.ar_url\)\]\)/.test(src)) fail('sender does not verify both EN and AR production URLs before send');
if (!/isDuplicate\(/.test(src)) fail('sender does not enforce duplicate prevention');
if (!/sentToday\(/.test(src) || !/PER_DAY_CAP/.test(src)) fail('sender does not enforce a per-day cap');
if (!/cooldownActive\(/.test(src)) fail('sender does not enforce a per-type cooldown');

// ── 2) Ledger integrity ──────────────────────────────────────────────────────
const ledger = readJson(LEDGER, { deliveries: [] });
const deliveries = Array.isArray(ledger.deliveries) ? ledger.deliveries : [];
const seen = new Set();
for (const d of deliveries) {
  if (d.status !== 'sent') continue;
  const key = `${d.content_type}:${d.slug}`;
  if (seen.has(key)) fail(`duplicate sent ledger entry ${key}`);
  seen.add(key);
  if (!d.message_id) fail(`sent ledger entry ${key} missing message_id`);
  if (!/^https:\/\/www\.tradealphaai\.com\//.test(String(d.url || ''))) fail(`sent ledger entry ${key} has non-live url ${d.url}`);
  if (!d.sent_at || Number.isNaN(Date.parse(d.sent_at))) fail(`sent ledger entry ${key} has invalid sent_at`);
}

// ── 3) Message safety (live dry-run for each published research/structure note) ─
function notes(dirRel, prefix) {
  const dir = path.join(ROOT, dirRel);
  try { return fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')); } catch { return []; }
}
function educationalNotes() {
  const dir = path.join(ROOT, 'articles');
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html' && (fs.readFileSync(path.join(dir, f), 'utf8')).includes('data-educational-article=')).map((f) => f.replace(/\.html$/, '')); } catch { return []; }
}
const samples = [
  ...notes('market-news', 'research-').slice(0, 2).map((slug) => ['daily-research', slug]),
  ...notes('market-structure', 'structure-').slice(0, 2).map((slug) => ['market-structure', slug]),
  ...educationalNotes().slice(0, 2).map((slug) => ['educational', slug]),
];
for (const [type, slug] of samples) {
  let out = '';
  try { out = execFileSync('node', [SENDER, `--slug=${slug}`, `--content-type=${type}`, '--dry-run'], { encoding: 'utf8', cwd: ROOT }); } catch (e) { out = String(e.stdout || '') + String(e.message || ''); }
  const m = out.match(/message preview:\n---\n([\s\S]*?)\n---/);
  if (!m) { fail(`${type}/${slug}: could not build a dry-run message preview`); continue; }
  const msg = m[1];
  for (const re of ADVICE) if (re.test(msg)) fail(`${type}/${slug}: Telegram message contains advice/trading language ${re}`);
  if (msg.length > MSG_CAP) fail(`${type}/${slug}: Telegram message ${msg.length} chars exceeds cap ${MSG_CAP}`);
  if (!/EN: https:\/\//.test(msg)) fail(`${type}/${slug}: message missing EN link`);
  if (!/AR: https:\/\//.test(msg)) fail(`${type}/${slug}: message missing AR link (bilingual content)`);
  if (!/not investment advice/i.test(msg)) fail(`${type}/${slug}: message missing educational disclaimer`);
}

// ── 4) Preview-only social posture (X/FB/IG/LI disabled) ─────────────────────
const postingLedger = readJson(path.join(ROOT, 'data', 'social', 'posting-ledger.json'), null);
if (postingLedger && postingLedger.posting_enabled === true) fail('data/social/posting-ledger.json posting_enabled=true (external social must stay preview-only)');

if (failures.length) {
  failures.forEach((m) => console.error(`[telegram-activation] FAIL: ${m}`));
  process.exit(1);
}
console.log(`[telegram-activation] check:telegram-activation passed (sender dry-run-default + URL-200 + dup/cap/cooldown gated, ${samples.length} message(s) advice-free & bilingual, ledger clean, social preview-only).`);
