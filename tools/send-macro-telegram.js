'use strict';

// Phase 60.2: Telegram Macro Intelligence Output
// Sends educational macro briefings to Telegram:
//   --type=preview      — upcoming high-impact event preview
//   --type=release      — post-release surprise summary
//   --type=weekly       — weekly macro outlook snippet
//   --type=briefing     — full daily macro briefing
//
// Usage:
//   node tools/send-macro-telegram.js --type=preview [--send] [--event-type=CPI]
//   node tools/send-macro-telegram.js --type=release [--send]
//   node tools/send-macro-telegram.js --type=briefing [--send]

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ROOT          = path.resolve(__dirname, '..');
const CAL_PATH      = path.join(ROOT, 'data', 'economic-calendar.json');
const NARRATIVE_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-narrative.json');
const EXPECT_PATH   = path.join(ROOT, 'data', 'market-expectations.json');
const REGIME_PATH   = path.join(ROOT, 'data', 'intelligence', 'market-regime.json');
const RATE_PATH     = path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json');
const TRANSMISSION_PATH = path.join(ROOT, 'data', 'intelligence', 'cross-asset-transmission.json');
const ETF_FLOW_PATH  = path.join(ROOT, 'data', 'intelligence', 'etf-flow-intelligence.json');
const STATUS_PATH    = path.join(ROOT, 'data', 'intelligence', 'telegram-status.json');

const TYPE     = argValue('--type') || 'briefing';
const SEND     = process.argv.includes('--send');
const EVENT_FILTER = (argValue('--event-type') || '').toLowerCase();
const MAX_LENGTH = 4000; // Telegram message limit

const DISCLAIMER = '⚠️ Educational commentary only. Not financial advice.';

if (!['preview', 'release', 'weekly', 'briefing'].includes(TYPE)) {
  fail(`Unknown --type: ${TYPE}. Use preview, release, weekly, or briefing.`);
}

const calendar  = readJson(CAL_PATH,       { events: [] });
const narrative = readJson(NARRATIVE_PATH, { release_narratives: [], preview_narratives: [], active_themes: [], regime_narrative: null });
const expect    = readJson(EXPECT_PATH,    { expectations: [] });
const regime    = readJson(REGIME_PATH,    { regime: null, regime_label: null, confidence: null });
const ratePath  = readJson(RATE_PATH,      { fed_path: null });
const transmission = readJson(TRANSMISSION_PATH, { regime_transmission_note: null, event_analyses: [] });
const etfFlow   = readJson(ETF_FLOW_PATH,   { rotation_analysis: null });

const message = buildMessage(TYPE, calendar, narrative, expect, regime, ratePath, transmission, etfFlow);
if (!message) {
  console.log(`[macro-telegram] No content to send for type=${TYPE}`);
  if (SEND) writeStatus(false, 'no_content');
  process.exit(0);
}

if (!SEND) {
  console.log('DRY RUN — Telegram macro message preview:');
  console.log('─'.repeat(50));
  console.log(message);
  console.log('─'.repeat(50));
  console.log(`Length: ${message.length} chars`);
  process.exit(0);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const { chatId, source: chatIdSource, masked } = resolveTelegramTarget();
if (!token || !chatId) fail('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (or TELEGRAM_CHANNEL_ID) are required when --send is used.');
console.log(`[macro-telegram] target resolved: source=${chatIdSource} value=${masked}`);

sendTelegram(token, chatId, message)
  .then(() => {
    writeStatus(true, 'sent');
    console.log(`[macro-telegram] Sent ${TYPE} message (${message.length} chars)`);
  })
  .catch((err) => {
    writeStatus(false, `send_failed: ${err.message}`);
    console.warn(`[macro-telegram] Send failed: ${err.message} — non-fatal`);
    process.exit(0);
  });

function writeStatus(sent, result) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, `${JSON.stringify({
    timestamp: new Date().toISOString(),
    type: TYPE,
    sent,
    result
  }, null, 2)}\n`, 'utf8');
}

// ── Message builders ──────────────────────────────────────────────────────────

function buildMessage(type, calendar, narrative, expect, regime, ratePath, transmission, etfFlow) {
  switch (type) {
    case 'preview':   return buildPreviewMessage(calendar, narrative, expect);
    case 'release':   return buildReleaseMessage(narrative, regime, ratePath);
    case 'weekly':    return buildWeeklyMessage(calendar, narrative, expect, regime, transmission, etfFlow);
    case 'briefing':  return buildDailyBriefingMessage(calendar, narrative, expect, regime, ratePath, transmission, etfFlow);
    default:          return null;
  }
}

function buildPreviewMessage(calendar, narrative, expect) {
  const now = Date.now();
  let previews = (narrative.preview_narratives || []).filter((n) => {
    const t = Date.parse(n.event_time);
    return t > now && t <= now + 3 * 86400000;
  });
  if (EVENT_FILTER) previews = previews.filter((n) => (n.event_type || '').toLowerCase().includes(EVENT_FILTER));
  if (!previews.length) return null;

  const lines = [`📅 *Macro Event Preview*\n`];
  for (const n of previews.slice(0, 3)) {
    const time = fmtTime(n.event_time);
    const fc   = n.forecast !== null && n.forecast !== undefined ? ` · Consensus: ${n.forecast}` : '';
    const prev = n.previous !== null && n.previous !== undefined ? ` · Prior: ${n.previous}` : '';
    lines.push(`*${escMd(n.event_name)}* — ${escMd(time)}${fc}${prev}`);
    if (n.narrative_blocks?.[0]) {
      lines.push(escMd(truncate(n.narrative_blocks[0], 300)));
    }
    if (n.confirmation_assets?.length) {
      lines.push(`📊 Watch: ${n.confirmation_assets.slice(0, 5).join(', ')}`);
    }
    lines.push('');
  }
  lines.push(DISCLAIMER);
  return lines.join('\n').slice(0, MAX_LENGTH);
}

function buildReleaseMessage(narrative, regime, ratePath) {
  const releases = (narrative.release_narratives || []).slice(-3);
  if (!releases.length) return null;

  const lines = [`*Macro Release Analysis*\n`];
  for (const n of releases) {
    const surpriseLabel = n.surprise_direction === 'hotter_or_stronger' ? 'above consensus'
      : n.surprise_direction === 'softer_or_weaker' ? 'below consensus' : 'in line with consensus';
    const toneLabel = n.policy_tone?.replace(/_/g, ' ') || '';

    lines.push(`*${escMd(n.event_name)}* — ${escMd(n.event_date)}`);
    lines.push(`Result: ${escMd(surpriseLabel)}${toneLabel ? ` · Policy implication: ${escMd(toneLabel)}` : ''}`);

    // Lead with the fact block
    if (n.narrative_blocks?.[0]) lines.push(escMd(truncate(n.narrative_blocks[0], 280)));

    // Add transmission logic
    if (n.narrative_blocks?.[1]) lines.push(`Transmission: ${escMd(truncate(n.narrative_blocks[1], 240))}`);

    // Add historical context if available
    if (n.narrative_blocks?.[2]) lines.push(`Context: ${escMd(truncate(n.narrative_blocks[2], 180))}`);

    lines.push('');
  }

  // Add regime context if available
  if (regime?.regime && regime.regime_label) {
    const conf = regime.confidence ? ` (${Math.round(regime.confidence * 100)}% signal confidence)` : '';
    lines.push(`*Macro Regime*: ${escMd(regime.regime_label)}${escMd(conf)}`);
    if (regime.regime_summary) lines.push(escMd(truncate(regime.regime_summary, 200)));
    lines.push('');
  } else if (narrative.regime_narrative) {
    lines.push(`*Regime Context*: ${escMd(truncate(narrative.regime_narrative, 200))}\n`);
  }

  // Add rate path if available
  if (ratePath?.fed_path?.current_stance) {
    const fp = ratePath.fed_path;
    lines.push(`*Fed Path*: ${escMd(fp.current_stance)} stance · ${escMd((fp.bias || '').replace(/_/g, ' '))} bias`);
    if (fp.policy_risk) lines.push(escMd(truncate(fp.policy_risk, 180)));
    lines.push('');
  }

  lines.push(DISCLAIMER);
  return lines.join('\n').slice(0, MAX_LENGTH);
}

function buildWeeklyMessage(calendar, narrative, expect, regime, transmission, etfFlow) {
  const now = Date.now();
  const weekEvents = (calendar.events || []).filter((e) => {
    const t = Date.parse(e.event_time || e.date);
    return e.importance === 'high' && t > now && t <= now + 7 * 86400000;
  }).sort((a, b) => Date.parse(a.event_time || a.date) - Date.parse(b.event_time || b.date));

  const themes = (narrative.active_themes || []).slice(0, 4);

  const lines = [`*Weekly Macro Intelligence Briefing*\n`];

  // Regime context upfront
  if (regime?.regime_label && regime.regime_summary) {
    lines.push(`*Macro Regime*: ${escMd(regime.regime_label)}`);
    lines.push(escMd(truncate(regime.regime_summary, 250)));
    lines.push('');
  } else if (themes.length) {
    lines.push(`Active themes: ${themes.map((t) => escMd(t.replace(/_/g, ' '))).join(' · ')}\n`);
  }

  if (weekEvents.length) {
    lines.push(`*High-impact releases this week:*`);
    for (const e of weekEvents.slice(0, 6)) {
      const fc = e.forecast !== null && e.forecast !== undefined ? ` Consensus: ${e.forecast}${e.unit || ''}` : '';
      lines.push(`${escMd(fmtTime(e.event_time || e.date))} — *${escMd(e.event_name)}*${escMd(fc)}`);
    }
    lines.push('');
  } else {
    lines.push('No high-impact events in the current calendar window for this week.');
  }

  if (narrative.preview_narratives?.length) {
    const top = narrative.preview_narratives[0];
    if (top?.narrative_blocks?.[1]) {
      lines.push(`*Key scenario framework (${escMd(top.event_name)}):*`);
      lines.push(escMd(truncate(top.narrative_blocks[1], 320)));
      lines.push('');
    }
  }

  appendInstitutionalState(lines, transmission, etfFlow);

  lines.push(DISCLAIMER);
  return lines.join('\n').slice(0, MAX_LENGTH);
}

function buildDailyBriefingMessage(calendar, narrative, expect, regime, ratePath, transmission, etfFlow) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`*Daily Macro Intelligence — ${today}*\n`];

  // Lead with regime context
  if (regime?.regime_label && regime.regime_summary) {
    const conf = regime.confidence ? ` (${Math.round(regime.confidence * 100)}% confidence)` : '';
    lines.push(`*Regime: ${escMd(regime.regime_label)}*${escMd(conf)}`);
    lines.push(escMd(truncate(regime.regime_summary, 220)));
    lines.push('');
  } else if (narrative.regime_narrative) {
    lines.push(escMd(truncate(narrative.regime_narrative, 200)));
    lines.push('');
  }

  // Rate path context
  if (ratePath?.fed_path?.current_stance && ratePath?.yield_curve?.inferred_shape) {
    const fp = ratePath.fed_path;
    const yc = ratePath.yield_curve;
    lines.push(`*Rate Path*: ${escMd(fp.current_stance)} · ${escMd((fp.bias || '').replace(/_/g, ' '))}`);
    lines.push(`Yield curve: ${escMd((yc.inferred_shape || '').replace(/_/g, ' '))} · Inversion: ${escMd(yc.inversion_status || '—')}`);
    lines.push('');
  }

  // Latest macro release with full transmission analysis
  const latestRelease = (narrative.release_narratives || []).slice(-1)[0];
  if (latestRelease) {
    const surpriseLabel = latestRelease.surprise_direction === 'hotter_or_stronger' ? 'above consensus'
      : latestRelease.surprise_direction === 'softer_or_weaker' ? 'below consensus' : 'in line';
    lines.push(`*${escMd(latestRelease.event_name)}* — ${escMd(surpriseLabel)}`);
    if (latestRelease.narrative_blocks?.[0]) lines.push(escMd(truncate(latestRelease.narrative_blocks[0], 280)));
    if (latestRelease.narrative_blocks?.[1]) lines.push(`Transmission: ${escMd(truncate(latestRelease.narrative_blocks[1], 200))}`);
    lines.push('');
  }

  // Next event preview with scenario
  const nextPreview = (narrative.preview_narratives || [])[0];
  if (nextPreview) {
    const time = fmtTime(nextPreview.event_time);
    lines.push(`*Upcoming: ${escMd(nextPreview.event_name)}* — ${escMd(time)}`);
    if (nextPreview.narrative_blocks?.[0]) lines.push(escMd(truncate(nextPreview.narrative_blocks[0], 250)));
    if (nextPreview.narrative_blocks?.[1]) lines.push(`Scenario: ${escMd(truncate(nextPreview.narrative_blocks[1], 200))}`);
    if (nextPreview.confirmation_assets?.length) {
      lines.push(`Confirmation signals: ${nextPreview.confirmation_assets.slice(0, 5).join(', ')}`);
    }
    lines.push('');
  }

  if (!latestRelease && !nextPreview) {
    lines.push('No active macro releases or previews in the current calendar window.');
  }

  appendInstitutionalState(lines, transmission, etfFlow);

  lines.push(DISCLAIMER);
  return lines.join('\n').slice(0, MAX_LENGTH);
}

function appendInstitutionalState(lines, transmission, etfFlow) {
  const transmissionNote = transmission?.regime_transmission_note;
  const rotation = etfFlow?.rotation_analysis;
  if (transmissionNote && !/^Transmission chain dynamics apply/i.test(transmissionNote)) {
    lines.push('*Cross-Asset Transmission*');
    lines.push(escMd(truncate(transmissionNote, 260)));
    lines.push('');
  }
  if (rotation?.key_spread) {
    lines.push('*Participation Monitor*');
    lines.push(escMd(truncate(rotation.key_spread, 180)));
    if (rotation.rotation_thesis) lines.push(escMd(truncate(rotation.rotation_thesis, 240)));
    lines.push('');
  }
}

// ── Telegram sender ───────────────────────────────────────────────────────────

function sendTelegram(token, chatId, text) {
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const resp = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!resp.ok) reject(new Error(resp.description || 'Telegram API error'));
        else resolve(resp);
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveTelegramTarget() {
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim() || (process.env.TELEGRAM_CHANNEL_ID || '').trim();
  const source = (process.env.TELEGRAM_CHAT_ID || '').trim() ? 'CHAT_ID' : 'CHANNEL_ID';
  const masked = chatId ? chatId.slice(0, 6) + '***' : '(none)';
  return { chatId: chatId || null, source, masked };
}

function fmtTime(dt) {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }); }
  catch { return dt.slice(0, 16).replace('T', ' '); }
}

function truncate(s, max) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function escMd(s) {
  // Escape only characters that break Telegram Markdown v1
  return String(s || '').replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function argValue(name) {
  const m = process.argv.find((a) => a.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : '';
}

function fail(msg) { console.error(msg); process.exit(1); }
