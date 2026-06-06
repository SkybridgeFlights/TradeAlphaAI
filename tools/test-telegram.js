'use strict';

// Part 1 — Telegram connectivity test
// Prints credential detection status, resolves target type (channel/group/private),
// and optionally sends a minimal test message to confirm end-to-end delivery.
//
// Usage:
//   node tools/test-telegram.js               → credential check only (dry run)
//   node tools/test-telegram.js --send        → send test message
//   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHANNEL_ID=@chan node tools/test-telegram.js --send

const https = require('https');

const SEND = process.argv.includes('--send');

function resolveTelegramTarget() {
  const chatIdRaw   = (process.env.TELEGRAM_CHAT_ID    || '').trim();
  const channelRaw  = (process.env.TELEGRAM_CHANNEL_ID || '').trim();
  const chatId      = chatIdRaw || channelRaw;
  const source      = chatIdRaw ? 'TELEGRAM_CHAT_ID' : (channelRaw ? 'TELEGRAM_CHANNEL_ID' : 'none');
  const masked      = chatId ? chatId.slice(0, 6) + '***' : '(none)';
  return { chatId: chatId || null, source, masked };
}

const token               = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const { chatId, source, masked } = resolveTelegramTarget();

console.log('[test-telegram] Credential diagnostics:');
console.log(`  TELEGRAM_BOT_TOKEN detected: ${token ? 'yes' : 'no'}`);
console.log(`  TELEGRAM_CHANNEL_ID detected: ${process.env.TELEGRAM_CHANNEL_ID ? 'yes (' + (process.env.TELEGRAM_CHANNEL_ID || '').slice(0,6) + '***)' : 'no'}`);
console.log(`  TELEGRAM_CHAT_ID    detected: ${process.env.TELEGRAM_CHAT_ID    ? 'yes (' + (process.env.TELEGRAM_CHAT_ID    || '').slice(0,6) + '***)' : 'no'}`);
console.log(`  Resolved target source: ${source}`);
console.log(`  Resolved target value:  ${masked}`);

if (!token || !chatId) {
  console.error('\n[test-telegram] FAIL — credentials missing. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID or TELEGRAM_CHANNEL_ID.');
  process.exit(1);
}

if (!SEND) {
  console.log('\n[test-telegram] Credentials configured. DRY RUN — pass --send to send a test message.');
  process.exit(0);
}

(async () => {
  // getChat to confirm destination type
  let chatInfo;
  try {
    chatInfo = await apiCall(token, 'getChat', { chat_id: chatId });
    console.log('\n[test-telegram] Chat info:');
    console.log(`  type:     ${chatInfo.type}`);
    console.log(`  title:    ${chatInfo.title || chatInfo.username || '(private/unknown)'}`);
    console.log(`  id:       ${chatInfo.id}`);
  } catch (err) {
    console.error(`\n[test-telegram] getChat failed: ${err.message}`);
    console.error('[test-telegram] Check TELEGRAM_BOT_TOKEN is valid and the bot has access to the target chat/channel.');
    process.exit(1);
  }

  // Send test message
  const testText = `\u{1F514} TradeAlphaAI — Telegram integration test\nTimestamp: ${new Date().toUTCString()}\nThis confirms end-to-end delivery to ${chatInfo.title || chatInfo.username || chatInfo.id}.`;
  let msgResult;
  try {
    msgResult = await apiCall(token, 'sendMessage', {
      chat_id: chatId,
      text: testText,
      disable_web_page_preview: true
    });
  } catch (err) {
    console.error(`\n[test-telegram] sendMessage failed: ${err.message}`);
    process.exit(1);
  }

  console.log('\n[test-telegram] SUCCESS — message delivered');
  console.log(`  telegram_target:     ${chatInfo.type} — ${chatInfo.title || chatInfo.username || chatInfo.id}`);
  console.log(`  telegram_message_id: ${msgResult.message_id}`);
  console.log(`  delivery_timestamp:  ${new Date(msgResult.date * 1000).toUTCString()}`);
  console.log(`  chat_type:           ${msgResult.chat?.type}`);
})();

function apiCall(tokenValue, method, params) {
  const body = JSON.stringify(params);
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${tokenValue}/${method}`,
    method: 'POST',
    headers: {
      'Content-Type':   'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body, 'utf8')
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { return reject(new Error(`Non-JSON response (HTTP ${res.statusCode}): ${data.slice(0, 120)}`)); }
        if (!parsed.ok) return reject(new Error(`Telegram API error ${res.statusCode}: ${parsed.description || data.slice(0, 120)}`));
        resolve(parsed.result);
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Request timeout after 15s')));
    req.write(body, 'utf8');
    req.end();
  });
}
