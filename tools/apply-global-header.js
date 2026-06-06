'use strict';

const fs = require('fs');
const path = require('path');
const { renderSiteHeader } = require('./global-layout-renderer');

const ROOT = path.resolve(__dirname, '..');
const roots = [
  'index.html', 'ar/index.html',
  'insights', 'ar/insights', 'en/insights',
  'market-outlook', 'ar/market-outlook', 'en/market-outlook',
  'economic-calendar', 'ar/economic-calendar',
  'system-status'
];

let changed = 0;
for (const target of roots) {
  const absolute = path.join(ROOT, target);
  if (!fs.existsSync(absolute)) continue;
  if (fs.statSync(absolute).isDirectory()) {
    for (const file of walkHtml(absolute)) apply(file);
  } else {
    apply(absolute);
  }
}
console.log(`[global-header] Applied homepage header to ${changed} page(s).`);

function apply(file) {
  let html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  const ar = relative.startsWith('ar/');
  const active = activeSection(relative);
  const languageHref = counterpart(relative, ar);
  const header = renderSiteHeader({
    locale: ar ? 'ar' : 'en',
    active,
    languageHref,
    englishHref: ar ? languageHref : undefined
  });
  const start = findHeaderStart(html);
  const contentStart = findContentStart(html, start);
  if (start < 0 || contentStart < 0) {
    console.warn(`[global-header] Skipped ${relative}: header/content boundary not found`);
    return;
  }
  html = `${html.slice(0, start)}${header}\n\n  ${html.slice(contentStart)}`;
  if (!html.includes('/css/global-layout.css')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="/css/global-layout.css" />\n</head>');
  }
  if (!html.includes('js/mobile-nav.js')) {
    html = html.replace('</body>', '  <script src="/js/mobile-nav.js" defer></script>\n</body>');
  }
  fs.writeFileSync(file, html, 'utf8');
  changed += 1;
}

function findHeaderStart(html) {
  const candidates = [
    html.search(/<div class="topbar"[^>]*>/i),
    html.search(/<header class="[^"]*\btopbar\b[^"]*"[^>]*>/i),
    html.search(/<header class="[^"]*\bsite-header\b[^"]*"[^>]*>/i)
  ].filter((index) => index >= 0);
  return candidates.length ? Math.min(...candidates) : -1;
}

function findContentStart(html, after) {
  const tail = html.slice(after);
  const candidates = [
    tail.search(/<main\b/i),
    tail.search(/<div class="site-shell"/i)
  ].filter((index) => index >= 0);
  return candidates.length ? after + Math.min(...candidates) : -1;
}

function activeSection(relative) {
  if (/^(?:ar\/)?index\.html$/.test(relative)) return 'home';
  if (relative.includes('/insights/') || relative.startsWith('insights/')) return 'insights';
  if (relative.includes('market-outlook/')) return 'market-outlook';
  if (relative.includes('economic-calendar/')) return 'economic-calendar';
  return '';
}

function counterpart(relative, ar) {
  if (ar) return `/${relative.slice(3).replace(/index\.html$/, '')}`;
  if (relative === 'index.html') return '/ar/';
  const localized = relative.startsWith('en/') ? relative.slice(3) : relative;
  return `/ar/${localized.replace(/index\.html$/, '')}`;
}

function walkHtml(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkHtml(absolute));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(absolute);
  }
  return files;
}
