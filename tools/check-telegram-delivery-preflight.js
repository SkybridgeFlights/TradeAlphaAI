'use strict';

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const SMOKE_FILE = path.join(ROOT, 'data', 'telegram-smoke-test.json');

function run(args) {
  const result = spawnSync('node', args, {
    encoding: 'utf8',
    stdio: 'inherit',
    env: process.env,
    cwd: ROOT,
  });
  return result.status === 0;
}

console.log('[TELEGRAM PREFLIGHT] Step 1/3: checking secrets...');
if (!run(['tools/check-telegram-secrets.js'])) {
  console.error('[TELEGRAM PREFLIGHT] FAIL: secrets check failed — ensure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID/TELEGRAM_CHANNEL_ID are set');
  process.exit(1);
}

console.log('[TELEGRAM PREFLIGHT] Step 2/3: running smoke test send...');
if (!run(['tools/send-published-article-telegram.js', '--smoke-test'])) {
  console.error('[TELEGRAM PREFLIGHT] FAIL: smoke test send failed');
  process.exit(1);
}

console.log('[TELEGRAM PREFLIGHT] Step 3/3: verifying smoke test output...');

if (!fs.existsSync(SMOKE_FILE)) {
  console.error('[TELEGRAM PREFLIGHT] FAIL: data/telegram-smoke-test.json was not created');
  process.exit(1);
}

let smokeResult;
try {
  smokeResult = JSON.parse(fs.readFileSync(SMOKE_FILE, 'utf8'));
} catch (err) {
  console.error(`[TELEGRAM PREFLIGHT] FAIL: could not parse data/telegram-smoke-test.json: ${err.message}`);
  process.exit(1);
}

if (!smokeResult.message_id) {
  console.error('[TELEGRAM PREFLIGHT] FAIL: message_id missing from smoke test result');
  process.exit(1);
}

console.log(`[TELEGRAM PREFLIGHT] PASS: smoke test ok — message_id=${smokeResult.message_id}`);
console.log('[TELEGRAM PREFLIGHT] all checks passed — Telegram delivery is operational');
