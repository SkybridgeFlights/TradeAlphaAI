'use strict';

// Phase 231 — guards the keyboard accessibility of the global header.
//
//   node tools/check-header-a11y.js              structural check
//   node tools/check-header-a11y.js --self-test  negative tests
//
// WHY THIS EXISTS. The dropdowns were keyboard-unreachable in production for
// months and nothing noticed: the CSS opener listed :focus-within, so the
// stylesheet looked correct, while the runtime bound menu state to `click`
// only. Panels stayed visibility:hidden for a keyboard user, which removes
// their descendants from the tab order — roughly fifty links, including the
// entire ETF Center and My Investments menus, unreachable without a mouse.
//
// No existing validator could see it. check:global-header compares markup
// parity; nothing asserted an interaction model. These rules do.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME = 'js/global-header.js';
const GENERATOR = 'tools/render-global-header.js';

const read = (rel) => {
  const f = path.join(ROOT, rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};

function validateRuntime(src = read(RUNTIME)) {
  const failures = [];
  if (src === null) return [`${RUNTIME}: missing — the header has no runtime`];

  // The interaction model. focus/blur do NOT bubble, so a listener on
  // .nav-menu would never see focus landing on a child link; focusin/focusout
  // are the only correct events here and their absence is the original bug.
  if (!/addEventListener\(\s*['"]focusin['"]/.test(src)) {
    failures.push(`${RUNTIME}: no focusin listener — dropdowns cannot open by keyboard`);
  }
  if (!/addEventListener\(\s*['"]focusout['"]/.test(src)) {
    failures.push(`${RUNTIME}: no focusout listener — dropdowns cannot close when focus leaves`);
  }
  // relatedTarget containment is what keeps the menu open while focus moves
  // from the trigger into the panel. Without it the menu closes on the way in.
  if (!/relatedTarget/.test(src)) {
    failures.push(`${RUNTIME}: focusout does not inspect relatedTarget — focus entering the panel would close it`);
  }
  if (!/contains\(\s*\w+\s*\)/.test(src)) {
    failures.push(`${RUNTIME}: no containment check on focusout`);
  }
  // Escape must close and return focus, or a keyboard user is stranded.
  if (!/['"]Escape['"]/.test(src)) failures.push(`${RUNTIME}: Escape is not handled`);

  // ARIA. A trigger that opens a menu must say so, and must report its state.
  if (!/aria-haspopup/.test(src)) failures.push(`${RUNTIME}: never sets aria-haspopup on triggers`);
  if (!/aria-expanded/.test(src)) failures.push(`${RUNTIME}: never sets aria-expanded on triggers`);

  // Mouse behaviour must survive: the click handler and :hover path stay.
  if (!/is-open/.test(src)) failures.push(`${RUNTIME}: no is-open state handling`);
  return failures;
}

function validateNoDuplicateRuntime(files = null) {
  const failures = [];
  // A second copy of the header runtime is how the accessibility model
  // silently diverges: one file gets fixed, the other does not.
  const candidates = files || fs.readdirSync(path.join(ROOT, 'js'))
    .filter((f) => f.endsWith('.js'))
    .filter((f) => {
      const src = read(`js/${f}`);
      return src && /nav-menu-trigger|__TRADEALPHA_NAV_INIT__/.test(src);
    })
    .map((f) => `js/${f}`);

  // A second runtime is tolerated ONLY because a few legacy pages still load
  // js/mobile-nav.js. What must never happen is divergence: the file that ships
  // to those pages losing the accessibility model while the canonical one keeps
  // it, leaving some pages keyboard-navigable and others not. So every runtime
  // present must implement the same model.
  for (const rel of candidates) {
    const src = read(rel);
    if (!src) continue;
    const hasModel = /addEventListener\(\s*['"]focusin['"]/.test(src) && /aria-haspopup/.test(src);
    if (!hasModel) {
      failures.push(`${rel}: is a header runtime but lacks the keyboard model — it would ship inaccessible pages`);
    }
  }
  if (candidates.length > 2) {
    failures.push(`${candidates.length} header runtimes found (${candidates.join(', ')}) — consolidate`);
  }
  return failures;
}

function validateEmission(src = read(GENERATOR)) {
  const failures = [];
  if (src === null) return [`${GENERATOR}: missing`];
  // The runtime must actually be emitted into generated pages, exactly once.
  // Count only actual <script src> emissions. The generator also NAMES this
  // file inside its asset-strip regex, which is not an emission.
  const emitted = (src.match(/src="\/js\/global-header\.js"/g) || []).length;
  if (emitted === 0) failures.push(`${GENERATOR}: does not emit ${RUNTIME} — pages would ship with no header runtime`);
  if (emitted > 1) failures.push(`${GENERATOR}: emits ${RUNTIME} ${emitted} times — duplicate evaluation`);

  // And a generated page must carry it. Spot-check the homepage.
  const home = read('index.html');
  if (home) {
    const tags = (home.match(/src="\/js\/global-header\.js"/g) || []).length;
    if (tags === 0) failures.push('index.html: header runtime script tag absent');
    if (tags > 1) failures.push(`index.html: header runtime emitted ${tags} times`);
  }
  return failures;
}

const CHECKS = {
  runtime: () => ({ name: 'check:header-a11y-runtime', failures: validateRuntime() }),
  duplicate: () => ({ name: 'check:header-a11y-duplicate', failures: validateNoDuplicateRuntime() }),
  emission: () => ({ name: 'check:header-a11y-emission', failures: validateEmission() }),
};

function selfTest() {
  const real = read(RUNTIME);
  const gen = read(GENERATOR);
  const cases = [
    ['runtime clean', () => validateRuntime(), false],
    ['runtime missing', () => validateRuntime(null), true],
    ['focusin removed', () => validateRuntime(real.replace(/['"]focusin['"]/g, "'click'")), true],
    ['focusout removed', () => validateRuntime(real.replace(/['"]focusout['"]/g, "'click'")), true],
    ['relatedTarget check removed', () => validateRuntime(real.replace(/relatedTarget/g, 'target')), true],
    ['Escape handling removed', () => validateRuntime(real.replace(/['"]Escape['"]/g, "'X'")), true],
    ['aria-haspopup removed', () => validateRuntime(real.replace(/aria-haspopup/g, 'data-x')), true],
    ['aria-expanded removed', () => validateRuntime(real.replace(/aria-expanded/g, 'data-y')), true],

    ['duplicate clean', () => validateNoDuplicateRuntime(), false],
    ['duplicate runtimes that both carry the model', () => validateNoDuplicateRuntime(['js/global-header.js', 'js/mobile-nav.js']), false],
    ['a runtime missing the model', () => validateNoDuplicateRuntime(['js/global-header.js', 'js/search-autocomplete.js']), true],

    ['emission clean', () => validateEmission(), false],
    ['runtime not emitted', () => validateEmission(gen.replace(/js\/global-header\.js/g, 'js/nothing.js')), true],
  ];

  let ok = 0;
  for (const [label, run, shouldFail] of cases) {
    let failed;
    try { failed = run().length > 0; } catch { failed = true; }
    if (failed === shouldFail) ok += 1;
    else console.error(`[header-a11y] self-test MISMATCH: ${label} (expected ${shouldFail ? 'fail' : 'pass'})`);
  }
  console.log(`[header-a11y] self-test: ${ok}/${cases.length} passed`);
  return ok === cases.length;
}

function main() {
  if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  const a = (process.argv.find((x) => x.startsWith('--check=')) || '').split('=')[1];
  if (a && !CHECKS[a]) { console.error(`usage: --check=<${Object.keys(CHECKS).join('|')}> | --self-test`); process.exit(2); }
  let bad = 0;
  for (const fn of Object.values(a ? { [a]: CHECKS[a] } : CHECKS)) {
    const { name, failures } = fn();
    if (failures.length) { bad += 1; for (const f of failures.slice(0, 6)) console.error(`[${name}] FAIL: ${f}`); }
    else console.log(`[${name}] OK`);
  }
  process.exit(bad ? 1 : 0);
}

if (require.main === module) main();

module.exports = { validateRuntime, validateNoDuplicateRuntime, validateEmission };
