'use strict';

const token     = (process.env.TELEGRAM_BOT_TOKEN   || '').trim();
const chatId    = (process.env.TELEGRAM_CHAT_ID     || '').trim();
const channelId = (process.env.TELEGRAM_CHANNEL_ID  || '').trim();

const failures = [];

if (!token) {
  failures.push('TELEGRAM_BOT_TOKEN is not set');
} else if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
  failures.push('TELEGRAM_BOT_TOKEN format looks invalid (expected <bot_id>:<alphanum_secret>)');
}

const target = channelId || chatId;
if (!target) {
  failures.push('Neither TELEGRAM_CHAT_ID nor TELEGRAM_CHANNEL_ID is set');
} else if (!target.trim()) {
  failures.push('Resolved Telegram target ID is empty');
}

if (failures.length) {
  for (const f of failures) console.error(`[TELEGRAM PREFLIGHT] FAIL: ${f}`);
  process.exit(1);
}

console.log('[TELEGRAM PREFLIGHT] secrets=ok target=configured');
