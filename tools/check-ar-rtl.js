'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, results) {
  results = results || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules', '.git', '.claude', 'drafts'].includes(e.name)) {
      walk(p, results);
    } else if (e.isFile() && e.name.endsWith('.html')) {
      results.push(p);
    }
  }
  return results;
}

const REVERSED_STRINGS = [
  'قوسلا تاعقوت',
  'قوسلا',
  'تاعقوت',
  'ةيجهنملا',
  'تالاقملا',
  'رخآ تاعقوت',
];

const issues = [];
const arFiles = walk(ROOT).filter(function(f) {
  return f.replace(ROOT, '').replace(/\\/g, '/').slice(1).startsWith('ar/');
});

// 1. Check all AR pages have lang="ar" dir="rtl"
for (const f of arFiles) {
  const rel = f.replace(ROOT, '').replace(/\\/g, '/').slice(1);
  const content = fs.readFileSync(f, 'utf8');
  const m = content.match(/<html[^>]*>/i);
  const tag = m ? m[0] : '';
  if (!/lang="ar"/i.test(tag) || !/dir="rtl"/i.test(tag)) {
    issues.push('MISSING lang=ar dir=rtl: ' + rel + ' -- html tag: ' + tag.slice(0, 80));
  }
}

// 2. Check all files for reversed Arabic strings
for (const f of walk(ROOT)) {
  const rel = f.replace(ROOT, '').replace(/\\/g, '/').slice(1);
  let content;
  try { content = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  for (const rev of REVERSED_STRINGS) {
    if (content.includes(rev)) {
      issues.push('REVERSED Arabic string "' + rev + '" in: ' + rel);
    }
  }
}

if (issues.length === 0) {
  console.log('AR RTL check passed.');
  console.log('  AR pages with lang=ar dir=rtl: ' + arFiles.length);
  console.log('  No reversed Arabic strings found.');
} else {
  console.error('AR RTL check FAILED:');
  for (const issue of issues) console.error('  - ' + issue);
  process.exit(1);
}
