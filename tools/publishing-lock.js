'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const LOCK_PATH = path.join(ROOT, 'data', 'runtime', 'publishing-lock.json');
const STALE_MS  = 30 * 60 * 1000; // 30 minutes

function readJson(p, fallback = {}) {
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}

function writeJson(p, data) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function isStale(lock) {
  if (!lock || !lock.acquired_at) return true;
  return (Date.now() - new Date(lock.acquired_at).getTime()) > STALE_MS;
}

/**
 * Attempt to acquire the publishing lock.
 * Returns { ok, error, lock }
 */
function acquire({ run_id, actor = 'autonomous-brain', mode = 'full_pipeline' }) {
  const existing = readJson(LOCK_PATH, null);

  if (existing && existing.held) {
    if (isStale(existing)) {
      console.log(`[publishing-lock] Stale lock detected (held since ${existing.acquired_at}) — recovering.`);
    } else {
      // Lock is actively held by another run
      const msg = `Lock held by run_id=${existing.run_id} since ${existing.acquired_at}`;
      console.error(`[publishing-lock] BLOCKED — ${msg}`);
      return { ok: false, error: msg, existing };
    }
  }

  const lock = {
    held:        true,
    run_id:      run_id || `run-${Date.now()}`,
    actor,
    mode,
    acquired_at: new Date().toISOString(),
    released_at: null,
    stale:       false,
  };
  writeJson(LOCK_PATH, lock);
  console.log(`[publishing-lock] Acquired  run_id=${lock.run_id}`);
  return { ok: true, lock };
}

/**
 * Release the publishing lock.
 */
function release({ run_id } = {}) {
  const lock = readJson(LOCK_PATH, {});
  if (!lock.held) {
    console.log('[publishing-lock] No lock held — nothing to release.');
    return { ok: true };
  }
  if (run_id && lock.run_id !== run_id) {
    console.warn(`[publishing-lock] WARNING: releasing lock owned by ${lock.run_id} from run_id=${run_id}`);
  }
  lock.held        = false;
  lock.released_at = new Date().toISOString();
  writeJson(LOCK_PATH, lock);
  console.log(`[publishing-lock] Released  run_id=${lock.run_id}`);
  return { ok: true };
}

/** Check lock status without acquiring. */
function status() {
  const lock = readJson(LOCK_PATH, { held: false });
  const stale = lock.held && isStale(lock);
  return { held: Boolean(lock.held), stale, lock };
}

module.exports = { acquire, release, status };

// CLI
if (require.main === module) {
  const cmd    = process.argv[2] || '--status';
  const run_id = process.argv[3] || `run-${Date.now()}`;

  if (cmd === '--acquire') {
    const result = acquire({ run_id, actor: 'cli', mode: 'manual' });
    process.exit(result.ok ? 0 : 1);
  } else if (cmd === '--release') {
    release({ run_id });
  } else if (cmd === '--status') {
    const s = status();
    console.log(`[publishing-lock] held=${s.held} stale=${s.stale} run_id=${s.lock.run_id || 'none'}`);
  } else if (cmd === '--force-release') {
    release({});
  }
}
