'use strict';

// Verifies account frontend API paths map to deployable Vercel function files.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_FILES = [
  'js/account-watchlists.js',
  'js/account-preferences.js',
  'js/account-profile.js',
  'js/clerk-bootstrap.js',
];

function routeToFile(route) {
  const clean = route.split('?')[0].replace(/^\/+/, '');
  return path.join(ROOT, `${clean}.js`);
}

function extractRoutes(text) {
  const routes = new Set();
  const re = /['"`](\/api\/account\/[^'"`?]+)(?:\?[^'"`]*)?['"`]/g;
  let m;
  while ((m = re.exec(text))) routes.add(m[1]);
  return Array.from(routes).sort();
}

function check() {
  const fails = [];
  const seen = new Set();
  for (const rel of FRONTEND_FILES) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) continue;
    const routes = extractRoutes(fs.readFileSync(full, 'utf8'));
    for (const route of routes) {
      seen.add(route);
      const file = routeToFile(route);
      if (!fs.existsSync(file)) fails.push(`${rel}: ${route} has no function file ${path.relative(ROOT, file)}`);
    }
  }
  if (!seen.has('/api/account/watchlists/entities')) fails.push('frontend no longer references /api/account/watchlists/entities; update route test intentionally');
  return fails;
}

function selfTest() {
  const routes = extractRoutes("helpers.apiFetch('/api/account/watchlists/entities', {}); fetch('/api/account/preferences?name=x')");
  const cases = [
    ['extract nested route', routes.includes('/api/account/watchlists/entities')],
    ['extract query route base', routes.includes('/api/account/preferences')],
    ['route maps to function', routeToFile('/api/account/watchlists/entities').endsWith(path.join('api', 'account', 'watchlists', 'entities.js'))],
  ];
  let ok = 0;
  for (const [name, pass] of cases) {
    if (pass) ok += 1;
    else console.error('[account-api-routes] self-test failed:', name);
  }
  console.log(`[account-api-routes] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  const fails = check();
  if (fails.length) {
    fails.forEach((f) => console.error('[account-api-routes] FAIL:', f));
    process.exit(1);
  }
  console.log('[account-api-routes] OK');
}

module.exports = { extractRoutes, routeToFile, check };
