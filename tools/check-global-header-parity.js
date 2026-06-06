'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pairs = [
  ['index.html', 'insights/index.html'],
  ['ar/index.html', 'ar/insights/index.html']
];
const failures = [];

for (const [homeFile, targetFile] of pairs) {
  const home = signature(read(homeFile));
  const target = signature(read(targetFile));
  if (!home || !target) {
    failures.push(`${homeFile} or ${targetFile}: canonical header missing`);
    continue;
  }
  for (const key of ['classes', 'navOrder', 'logoStructure', 'controlsStructure']) {
    if (JSON.stringify(home[key]) !== JSON.stringify(target[key])) {
      failures.push(`${targetFile}: ${key} differs from ${homeFile}`);
    }
  }
}

if (failures.length) {
  console.error(`Global header parity failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Global header parity passed for English and Arabic homepage/insights pairs.');

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function signature(html) {
  const start = html.indexOf('<div class="topbar"');
  const endMarker = '\n\n  <';
  const end = start >= 0 ? html.indexOf(endMarker, start) : -1;
  if (start < 0 || end < 0) return null;
  const header = html.slice(start, end)
    .replace(/\s+is-active\b/g, '')
    .replace(/\s+aria-current="page"/g, '')
    .replace(/\s+data-active-section="[^"]*"/g, '');
  const classes = [...header.matchAll(/class="([^"]+)"/g)]
    .map((match) => match[1].trim().replace(/\s+/g, ' '));
  const nav = (header.match(/<nav class="nav-group"[\s\S]*?<\/nav>/i) || [''])[0];
  const navOrder = [...nav.matchAll(/<a href="([^"]+)" class="nav-link(?: nav-menu-trigger)?"/g)]
    .map((match) => match[1].replace(/^\/ar/, '').replace(/#.*$/, ''));
  const brand = (header.match(/<a class="brand"[\s\S]*?<\/a>/i) || [''])[0];
  const controls = (header.match(/<a href="https:\/\/t\.me[\s\S]*?<button class="mobile-menu-toggle"[\s\S]*?<\/button>/i) || [''])[0];
  return {
    classes,
    navOrder,
    logoStructure: tagClassSignature(brand),
    controlsStructure: tagClassSignature(controls)
  };
}

function tagClassSignature(fragment) {
  return [...String(fragment).matchAll(/<([a-z0-9-]+)(?:[^>]*class="([^"]*)")?/gi)]
    .map((match) => `${match[1].toLowerCase()}.${(match[2] || '').trim().replace(/\s+/g, '.')}`)
    .join('>');
}
