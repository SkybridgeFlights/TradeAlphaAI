'use strict';

function resolveTelegramTarget() {
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim()
    || (process.env.TELEGRAM_CHANNEL_ID || '').trim();
  const source = (process.env.TELEGRAM_CHAT_ID || '').trim() ? 'CHAT_ID' : 'CHANNEL_ID';
  const masked = chatId ? chatId.slice(0, 6) + '***' : '(not set)';
  return { chatId: chatId || null, source, masked };
}

const token     = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const chatIdEnv = (process.env.TELEGRAM_CHAT_ID   || '').trim();
const channelEnv = (process.env.TELEGRAM_CHANNEL_ID || '').trim();
const { chatId, source, masked } = resolveTelegramTarget();

console.log('Telegram configuration check');
console.log('-------------------------------------------');
console.log(`  TELEGRAM_BOT_TOKEN:    ${token    ? token.slice(0, 6) + '*** (set)' : '(not set)'}`);
console.log(`  TELEGRAM_CHAT_ID:      ${chatIdEnv  ? chatIdEnv.slice(0, 6) + '*** (set)' : '(not set)'}`);
console.log(`  TELEGRAM_CHANNEL_ID:   ${channelEnv ? channelEnv.slice(0, 6) + '*** (set)' : '(not set)'}`);
console.log('-------------------------------------------');
console.log(`  resolved_target:       ${chatId ? masked : '(none)'}`);
console.log(`  telegram_target_source: ${chatId ? source : 'N/A'}`);

const failures = [];
if (!token)   failures.push('TELEGRAM_BOT_TOKEN is not set');
if (!chatId)  failures.push('Neither TELEGRAM_CHAT_ID nor TELEGRAM_CHANNEL_ID is set');

if (failures.length) {
  console.error('\nTelegram config check FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nTelegram config check passed — bot token and target ID are present.');
