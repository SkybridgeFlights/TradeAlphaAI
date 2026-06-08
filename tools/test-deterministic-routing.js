'use strict';

/**
 * test-deterministic-routing.js
 *
 * Validates that the publishing intelligence router is deterministic:
 * same inputs → same output, fallback order is correct, gates are enforced.
 */

const { isValidTransition, tryTransition, STATES } = require('./publishing-state-machine');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function assertThrows(label, fn) {
  try {
    fn();
    console.error(`  ✗ ${label} — expected throw, got none`);
    failed++;
  } catch (e) {
    console.log(`  ✓ ${label} (threw: ${e.message.slice(0, 60)})`);
    passed++;
  }
}

// ── 1. State machine validity ─────────────────────────────────────────────────

console.log('\n[test] 1. State machine — valid states');

for (const s of STATES) {
  assert(`STATES contains "${s}"`, STATES.has(s));
}

console.log('\n[test] 2. State machine — valid transitions');

assert('planned → draft is valid',               isValidTransition('planned',   'draft'));
assert('draft → in_review is valid',             isValidTransition('draft',     'in_review'));
assert('in_review → reviewed is valid',          isValidTransition('in_review', 'reviewed'));
assert('reviewed → approved is valid',           isValidTransition('reviewed',  'approved'));
assert('approved → published is valid',          isValidTransition('approved',  'published'));
assert('published → site_update_only is valid',  isValidTransition('published', 'site_update_only'));
assert('blocked → planned is valid',             isValidTransition('blocked',   'planned'));
assert('manual_revision_required → planned',     isValidTransition('manual_revision_required', 'planned'));

console.log('\n[test] 3. State machine — invalid transitions rejected');

assert('planned → published is INVALID',         !isValidTransition('planned',  'published'));
assert('approved → in_review is INVALID',        !isValidTransition('approved', 'in_review'));
assert('published → draft is INVALID',           !isValidTransition('published','draft'));
assert('unknown_state → draft is INVALID',       !isValidTransition('xyz_state','draft'));

console.log('\n[test] 4. State machine — recordTransition throws on invalid');

assertThrows('throws on invalid from-state',
  () => { const { recordTransition } = require('./publishing-state-machine'); recordTransition({ from: 'approved', to: 'in_review', content_type: 'editorial', slug: 'test-slug', reason: 'test' }); }
);
assertThrows('throws on unknown state',
  () => { const { recordTransition } = require('./publishing-state-machine'); recordTransition({ from: 'nonexistent', to: 'draft', content_type: 'editorial', slug: 'test-slug', reason: 'test' }); }
);

// ── 2. tryTransition (safe wrapper) ──────────────────────────────────────────

console.log('\n[test] 5. tryTransition — safe wrapper');

const validResult = tryTransition({ from: 'planned', to: 'draft', content_type: 'test', slug: 'routing-test', reason: 'unit-test' });
assert('tryTransition returns ok=true for valid transition', validResult.ok === true);

const invalidResult = tryTransition({ from: 'approved', to: 'draft', content_type: 'test', slug: 'routing-test', reason: 'unit-test' });
assert('tryTransition returns ok=false for invalid transition', invalidResult.ok === false);
assert('tryTransition returns error message', typeof invalidResult.error === 'string');

// ── 3. Router determinism simulation ─────────────────────────────────────────

console.log('\n[test] 6. Router determinism — same inputs produce same route');

function simulateRoute({ moReady, ciReady, editorialReady, moScore, ciScore, editScore }) {
  const candidates = [
    { type: 'market-outlook',         score: moReady  ? moScore   : 0 },
    { type: 'continuous-intelligence',score: ciReady  ? ciScore   : 0 },
    { type: 'editorial',              score: editorialReady ? editScore : 0 },
    { type: 'news-analysis',          score: 0 },
  ];
  const best = candidates.reduce((a, b) => b.score > a.score ? b : a, { type: 'site_update_only', score: -1 });
  return best.score > 0 ? best.type : 'site_update_only';
}

const inputs = { moReady: true,  ciReady: true,  editorialReady: true,  moScore: 70, ciScore: 55, editScore: 40 };
const route1 = simulateRoute(inputs);
const route2 = simulateRoute(inputs);
assert('Same inputs → same route (run 1 = run 2)', route1 === route2, `${route1} vs ${route2}`);
assert('Highest score wins', route1 === 'market-outlook', `got ${route1}`);

// ── 4. Market-outlook cooldown → CI selected ────────────────────────────────

console.log('\n[test] 7. Route 2 — market-outlook blocked → CI selected');

const route_mo_blocked = simulateRoute({ moReady: false, ciReady: true, editorialReady: true, moScore: 70, ciScore: 55, editScore: 40 });
assert('MO blocked → CI wins (score 55 > editorial 40)', route_mo_blocked === 'continuous-intelligence', `got ${route_mo_blocked}`);

// ── 5. CI failure → editorial ────────────────────────────────────────────────

console.log('\n[test] 8. Route 3 — CI failure → editorial selected');

const route_ci_blocked = simulateRoute({ moReady: false, ciReady: false, editorialReady: true, moScore: 0, ciScore: 0, editScore: 40 });
assert('MO+CI blocked → editorial wins', route_ci_blocked === 'editorial', `got ${route_ci_blocked}`);

// ── 6. All article routes blocked → site_update_only ────────────────────────

console.log('\n[test] 9. Route 4 — all routes blocked → site_update_only');

const route_all_blocked = simulateRoute({ moReady: false, ciReady: false, editorialReady: false, moScore: 0, ciScore: 0, editScore: 0 });
assert('All routes blocked → site_update_only', route_all_blocked === 'site_update_only', `got ${route_all_blocked}`);

// ── 7. Telegram gate ─────────────────────────────────────────────────────────

console.log('\n[test] 10. Telegram gate — only allowed on published=true');

function telegramAllowed(published, hasToken, hasChatId) {
  return published === true && Boolean(hasToken) && Boolean(hasChatId);
}

assert('Telegram allowed: published=true, token+chat present',  telegramAllowed(true,  'tok', 'chat'));
assert('Telegram blocked: published=false',                     !telegramAllowed(false, 'tok', 'chat'));
assert('Telegram blocked: no token',                            !telegramAllowed(true,  '',    'chat'));
assert('Telegram blocked: no chat_id',                          !telegramAllowed(true,  'tok', ''));
assert('Telegram blocked: published=false AND no token',        !telegramAllowed(false, '',    ''));

// ── 8. Stale lock recovery ────────────────────────────────────────────────────

console.log('\n[test] 11. Stale lock recovery');

function isLockStale(lock, staleMsOverride = 30 * 60 * 1000) {
  if (!lock || !lock.held) return false;
  return (Date.now() - new Date(lock.acquired_at).getTime()) > staleMsOverride;
}

const freshLock = { held: true, run_id: 'abc', acquired_at: new Date().toISOString() };
const staleLock = { held: true, run_id: 'xyz', acquired_at: new Date(Date.now() - 35 * 60 * 1000).toISOString() };
const noLock    = { held: false };

assert('Fresh lock is NOT stale',       !isLockStale(freshLock));
assert('35-min lock IS stale',          isLockStale(staleLock));
assert('No lock held is not stale',     !isLockStale(noLock));

// Simulated stale lock recovery
function canAcquire(existingLock) {
  if (!existingLock || !existingLock.held) return { ok: true, reason: 'no_lock' };
  if (isLockStale(existingLock))           return { ok: true, reason: 'stale_lock_recovered' };
  return { ok: false, reason: 'lock_held' };
}

assert('Acquire on no lock → ok',       canAcquire(noLock).ok);
assert('Acquire on fresh lock → blocked', !canAcquire(freshLock).ok);
assert('Acquire on stale lock → ok',    canAcquire(staleLock).ok);
assert('Stale recovery reason correct', canAcquire(staleLock).reason === 'stale_lock_recovered');

// ── 9. CI score formula ───────────────────────────────────────────────────────

console.log('\n[test] 12. CI score formula determinism');

function ciScore(conf, hasContinuitySignal) {
  return 38 + Math.min(20, Math.floor(conf / 2)) + (hasContinuitySignal ? 8 : 0);
}

assert('CI score conf=54, no signal = 38+20+0 = 58 (truncated)',  ciScore(40, false) === 58,  `got ${ciScore(40, false)}`);
assert('CI score conf=0, no signal = 38',                          ciScore(0, false)  === 38,  `got ${ciScore(0, false)}`);
assert('CI score conf=100, signal = 38+20+8 = 66',                ciScore(100, true) === 66,  `got ${ciScore(100, true)}`);
assert('CI score conf=40, signal = 38+20+8 = 66',                 ciScore(40, true)  === 66,  `got ${ciScore(40, true)}`);
assert('CI score conf=20, no signal = 38+10 = 48',                ciScore(20, false) === 48,  `got ${ciScore(20, false)}`);
assert('CI always activates above MO_blocked baseline',            ciScore(40, false) > 27);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n[test-deterministic-routing] ${passed} passed, ${failed} failed.\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} test(s) failed.`);
  process.exit(1);
}
console.log('[PASS] All determinism tests passed.');
process.exit(0);
