'use strict';

/**
 * Applies the canonical global header to all HTML pages site-wide.
 *
 * Replaces any existing header (topbar, site-header) with the output of
 * render-global-header.js, wrapped in GLOBAL_HEADER_START/END markers.
 * Ensures global-header.css and mobile-nav.js are in every processed page.
 *
 * Usage:
 *   node tools/apply-global-header.js [--dry-run]
 */

const fs   = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderStyles, globalHeaderScripts, MARKER_START, MARKER_END } = require('./render-global-header');
const { renderGlobalFooter, globalFooterStyles, FOOTER_MARKER_START, FOOTER_MARKER_END } = require('./render-global-footer');

// Site typography (Cairo + Inter via Google Fonts) was only linked on the
// homepage — every other page silently fell back to Segoe UI, which is the
// single biggest "these pages don't look like the same site" factor. The
// bake guarantees the font stack on every page.
const FONT_LINKS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com" />',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;700&family=Cairo:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />',
].join('\n  ');

const ROOT   = path.resolve(__dirname, '..');
const DRY    = process.argv.includes('--dry-run');
const NAV_ONLY = process.argv.includes('--navigation-only');

// All page roots to process
const ROOTS = [
  // Root pages
  'index.html',
  'ar/index.html',
  'stocks.html',
  'ar/stocks.html',
  'rankings.html',
  'ar/rankings.html',
  'etfs.html',
  'ar/etfs.html',
  'ai-stock-screener.html',
  'ar/ai-stock-screener.html',
  'methodology.html',
  'ar/methodology.html',
  // Directories
  'insights',
  'ar/insights',
  'en/insights',
  'market-outlook',
  'ar/market-outlook',
  'en/market-outlook',
  // Phase 99: canonical editorial desks exposed in the global nav
  'articles',
  'ar/articles',
  'market-news',
  'ar/market-news',
  'market-structure',
  'ar/market-structure',
  'rankings',
  'ar/rankings',
  'briefs',
  'ar/briefs',
  'intelligence',
  'ar/intelligence',
  'economic-calendar',
  'ar/economic-calendar',
  'system-status',
  'stocks',
  'ar/stocks',
  'etfs',
  'ar/etfs',
  'compare',
  'ar/compare',
  // Phase 68: intelligence dashboards
  'market-dashboard',
  'ar/market-dashboard',
  'macro-dashboard',
  'ar/macro-dashboard',
  'etf-dashboard',
  'ar/etf-dashboard',
  // Phase 69: market replay
  'market-replay',
  'ar/market-replay',
  'explorer',
  'ar/explorer',
  'workspace',
  'ar/workspace',
  // Phase 149+: SEO/marketing surfaces (glossary, newsletter archive, /links/)
  'glossary',
  'ar/glossary',
  'newsletter',
  'ar/newsletter',
  'links',
  'ar/links',
  // Phase 172+: interactive calculators live under /tools/{name}/
  'tools',
  'ar/tools',
  // E-E-A-T trust pages.
  'about',
  'ar/about',
  'editorial-policy',
  'ar/editorial-policy',
  'contact',
  'ar/contact',
];

// Phase 99: legacy pre-canonical pages that predate the global-header markers
// and carry no recognizable header anchor. They are unindexed (absent from the
// sitemaps) and not linked from the institutional /articles/ surface, so they
// are excluded from the canonical-header invariant rather than mutated in a
// nav-only phase. Excluded uniformly from the bake and the runtime checks.
const EXCLUDE = new Set([
  'articles/best-forex-strategy.html',
  'articles/capital-management.html',
  'articles/use-signals.html',
]);

let changed = 0;
let skipped = 0;
let failures = 0;

if (require.main === module) {
  for (const file of collectTargetFiles()) processFile(file);
  console.log(`[global-header] ${DRY ? '[dry-run] ' : ''}${NAV_ONLY ? 'Navigation applied' : 'Applied'} to ${changed} page(s), skipped ${skipped}.`);
  if (failures) process.exit(1);
}

function processFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  const ar = relative.startsWith('ar/');
  const active = detectActive(relative);
  const { arabicHref, englishHref } = computeLocaleHrefs(relative, ar);

  const header = renderGlobalHeader({ locale: ar ? 'ar' : 'en', activePage: active, arabicHref, englishHref });

  // Find and replace existing header region
  let newHtml;
  if (NAV_ONLY) {
    newHtml = replaceNavigationFragments(html, header, relative);
    if (!newHtml) return;
    if (html === newHtml) return;
    if (!DRY) fs.writeFileSync(file, newHtml, 'utf8');
    changed++;
    if (DRY) console.log(`[global-header] [dry] would update: ${relative}`);
    return;
  } else if (html.includes(MARKER_START) && html.includes(MARKER_END)) {
    // Already has markers — replace the block
    const before = html.slice(0, html.indexOf(MARKER_START));
    const after  = html.slice(html.indexOf(MARKER_END) + MARKER_END.length);
    newHtml = `${before}${header}${after}`;
  } else {
    const headerStart = findHeaderStart(html);
    const contentStart = findContentStart(html, headerStart);
    if (headerStart < 0 || contentStart < 0) {
      console.warn(`[global-header] Skipped ${relative}: header/content boundary not found`);
      skipped++;
      return;
    }
    newHtml = `${html.slice(0, headerStart)}${header}\n\n  ${html.slice(contentStart)}`;
  }

  // Ensure BOTH header stylesheets are linked (base component styles +
  // canonical layout contract). Strip any existing copies of either first so
  // repeated rebakes stay idempotent.
  newHtml = removeAssetTags(newHtml, /\/?css\/global-header(?:-canonical)?\.css(?:[?#][^"']*)?/i, 'link');
  newHtml = newHtml.replace('</head>', `  ${globalHeaderStyles()}\n</head>`);

  // Ensure the site font stack on every page (strip existing copies first).
  newHtml = newHtml.replace(/[ \t]*<link[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>[ \t]*(?:\r?\n)?/gi, '');
  newHtml = newHtml.replace('</head>', `  ${FONT_LINKS}\n</head>`);

  // market-shell pages are designed on styles.css (theme variables + core
  // typography). Some generated families (market-outlook daily briefings)
  // shipped without it and rendered off-theme.
  if (newHtml.includes('market-shell') && !/<link[^>]*href="[^"]*styles\.css"/i.test(newHtml)) {
    newHtml = newHtml.replace('</head>', '  <link rel="stylesheet" href="/styles.css" />\n</head>');
  }

  // ── Canonical global footer ────────────────────────────────────────────────
  // Every content page carries the same trust block (brand + nav +
  // education/no-advice disclaimer + copyright). The landing footer on the
  // homepage (<footer class="footer">) is richer by design and stays.
  newHtml = removeAssetTags(newHtml, /\/?css\/global-footer\.css(?:[?#][^"']*)?/i, 'link');
  const hasLandingFooter = /<footer[^>]*class="footer[\s"]/i.test(newHtml);
  if (!hasLandingFooter) {
    newHtml = newHtml.replace('</head>', `  ${globalFooterStyles()}\n</head>`);
    // Drop a previously baked canonical footer (marker block).
    const fStart = newHtml.indexOf(FOOTER_MARKER_START);
    const fEnd = newHtml.indexOf(FOOTER_MARKER_END);
    if (fStart >= 0 && fEnd > fStart) {
      newHtml = newHtml.slice(0, fStart) + newHtml.slice(fEnd + FOOTER_MARKER_END.length);
    }
    // Drop legacy per-template site-footer blocks so the canonical one is the
    // single source of truth.
    newHtml = newHtml.replace(/[ \t]*<footer class="site-footer">[\s\S]*?<\/footer>[ \t]*(?:\r?\n)?/g, '');
    newHtml = newHtml.replace(/<\/body>/i, `${renderGlobalFooter(ar ? 'ar' : 'en')}\n</body>`);
  }

  // Strip every script the global header owns so we don't accumulate copies
  // on repeated rebakes. The set must match globalHeaderScripts() exactly.
  newHtml = removeAssetTags(newHtml, /\/?js\/(?:global-header|mobile-nav|clerk-config|clerk-bootstrap|search-autocomplete)\.js(?:[?#][^"']*)?/i, 'script');
  // Also drop the inline service-worker registration emitted by globalHeaderScripts().
  newHtml = newHtml.replace(/[ \t]*<script>if \("serviceWorker" in navigator\)[\s\S]*?<\/script>[ \t]*(?:\r?\n)?/g, '');
  newHtml = newHtml.replace('</body>', `  ${globalHeaderScripts()}\n</body>`);

  if (html === newHtml) return; // No change

  if (!DRY) fs.writeFileSync(file, newHtml, 'utf8');
  changed++;
  if (DRY) console.log(`[global-header] [dry] would update: ${relative}`);
}

function findHeaderStart(html) {
  const patterns = [
    MARKER_START,
    '<div class="topbar"',
    '<div class="topbar "',
    '<header class="topbar"',
    '<header class="site-header"',
    '<div class="site-header"'
  ];
  const candidates = patterns
    .map((p) => html.indexOf(p))
    .filter((i) => i >= 0);
  return candidates.length ? Math.min(...candidates) : -1;
}

function findContentStart(html, after) {
  if (after < 0) return -1;
  const tail = html.slice(after);
  const candidates = [
    tail.search(/<main\b/i),
    tail.search(/<div class="site-shell"/i),
    tail.search(/<div class="market-shell"/i),
    tail.search(/<div class="page-shell"/i),
    tail.search(/<div class="wrap"/i),
    tail.search(/<section\b/i)
  ].filter((i) => i >= 0);
  return candidates.length ? after + Math.min(...candidates) : -1;
}

function detectActive(relative) {
  if (/^(?:ar\/)?index\.html$/.test(relative)) return 'home';
  if (/^(?:ar\/)?stocks\.html$/.test(relative)) return 'stocks';
  if (/^(?:ar\/)?rankings\.html$/.test(relative)) return 'rankings';
  if (/^(?:ar\/)?etfs(?:\.html|\/)/.test(relative)) return 'etfs';
  if (/^(?:ar\/)?ai-stock-screener\.html$/.test(relative)) return 'screener';
  if (/^(?:ar\/)?methodology\.html$/.test(relative)) return 'methodology';
  if (/(?:^|[/\\])insights[/\\]/.test(relative) || /^(?:ar\/|en\/)?insights\//.test(relative)) return 'insights';
  if (/(?:^|[/\\])articles[/\\]/.test(relative)) return 'articles';
  if (/(?:^|[/\\])market-news[/\\]/.test(relative)) return 'market-news';
  if (/(?:^|[/\\])rankings[/\\]/.test(relative)) return 'relative-rankings';
  if (/(?:^|[/\\])briefs[/\\]/.test(relative)) return 'briefs';
  if (/(?:^|[/\\])intelligence[/\\]/.test(relative)) return 'intelligence';
  if (/(?:^|[/\\])research[/\\]/.test(relative)) return 'research';
  if (/(?:^|[/\\])market-map[/\\]/.test(relative)) return 'market-map';
  if (/(?:^|[/\\])explorer[/\\]/.test(relative)) return 'explorer';
  if (/(?:^|[/\\])workspace[/\\]/.test(relative)) return 'workspace';
  if (/market-outlook[/\\]/.test(relative)) return 'market-outlook';
  if (/market-structure[/\\]/.test(relative)) return 'market-structure';
  if (/economic-calendar[/\\]/.test(relative)) return 'economic-calendar';
  if (/^(?:ar\/)?stocks[/\\]/.test(relative)) return 'stocks';
  if (/^(?:ar\/)?etfs[/\\]/.test(relative)) return 'etfs';
  if (/^(?:ar\/)?compare[/\\]/.test(relative)) return 'stocks';
  return '';
}

function computeLocaleHrefs(relative, ar) {
  // For insight articles (not the index), point directly to the counterpart article
  const insightMatch = relative.match(/^(?:ar\/|en\/)?insights\/([^/]+\.html)$/);
  if (insightMatch && insightMatch[1] !== 'index.html') {
    const slug = insightMatch[1];
    return {
      arabicHref:  `/ar/insights/${slug}`,
      englishHref: `/insights/${slug}`
    };
  }
  // For market-outlook articles (not the index), point to the counterpart article
  const outlookMatch = relative.match(/^(?:ar\/|en\/)?market-outlook\/([^/]+\.html)$/);
  if (outlookMatch && outlookMatch[1] !== 'index.html') {
    const slug = outlookMatch[1];
    return {
      arabicHref:  `/ar/market-outlook/${slug}`,
      englishHref: `/market-outlook/${slug}`
    };
  }
  // For economic-calendar index, point to the counterpart section
  if (relative.match(/^(?:ar\/)?economic-calendar\//)) {
    return { arabicHref: '/ar/economic-calendar/', englishHref: '/economic-calendar/' };
  }
  const rankingMatch = relative.match(/^(?:ar\/)?rankings(?:\/(assets|sectors|equities))?\/index\.html$/);
  if (rankingMatch) {
    const child = rankingMatch[1] ? `${rankingMatch[1]}/` : '';
    return { arabicHref: `/ar/rankings/${child}`, englishHref: `/rankings/${child}` };
  }
  const explorerMatch = relative.match(/^(?:ar\/)?explorer\/(.+\/)?index\.html$/);
  if (explorerMatch) {
    const child = explorerMatch[1] || '';
    return { arabicHref: `/ar/explorer/${child}`, englishHref: `/explorer/${child}` };
  }
  const workspaceMatch = relative.match(/^(?:ar\/)?workspace\/(.+\/)?index\.html$/);
  if (workspaceMatch) {
    const child = workspaceMatch[1] || '';
    return { arabicHref: `/ar/workspace/${child}`, englishHref: `/workspace/${child}` };
  }
  // Phase 99: canonical editorial desks — point the locale switch at the
  // matching counterpart (index or specific article) so it never falls back home.
  for (const sec of ['articles', 'market-news', 'market-structure', 'briefs', 'intelligence']) {
    const m = relative.match(new RegExp(`^(?:ar\\/|en\\/)?${sec}\\/([^/]+\\.html)$`));
    if (m) {
      const slug = m[1] === 'index.html' ? '' : m[1];
      return { arabicHref: `/ar/${sec}/${slug}`, englishHref: `/${sec}/${slug}` };
    }
  }
  // SEO surfaces: glossary term/index + /links/ + /newsletter/ + /compare/.
  // Newsletter has no per-locale digest yet, so the AR toggle points at the
  // (bilingual) archive index; ditto for /ar/ counterparts of links + compare.
  const glossaryMatch = relative.match(/^(?:ar\/)?glossary\/([^/]+\.html)$/);
  if (glossaryMatch) {
    const slug = glossaryMatch[1] === 'index.html' ? '' : glossaryMatch[1];
    return { arabicHref: `/ar/glossary/${slug}`, englishHref: `/glossary/${slug}` };
  }
  const compareMatch = relative.match(/^(?:ar\/)?compare\/([^/]+\.html)$/);
  if (compareMatch) {
    const slug = compareMatch[1] === 'index.html' ? '' : compareMatch[1];
    return { arabicHref: `/ar/compare/${slug}`, englishHref: `/compare/${slug}` };
  }
  if (relative.match(/^(?:ar\/)?links\/index\.html$/)) {
    return { arabicHref: '/ar/links/', englishHref: '/links/' };
  }
  if (relative.match(/^newsletter\//)) {
    return { arabicHref: '/ar/newsletter/', englishHref: '/newsletter/' };
  }
  // Interactive tools live at /tools/{slug}/index.html — a 3-segment path
  // that the flat generic-fallback regex below doesn't handle. Explicit
  // rule points the toggle at the same-slug mirror.
  const toolsMatch = relative.match(/^(?:ar\/)?tools\/([^/]+)\/(?:index\.html)?$/);
  if (toolsMatch) {
    const slug = toolsMatch[1];
    return { arabicHref: `/ar/tools/${slug}/`, englishHref: `/tools/${slug}/` };
  }
  // Generic fallback: for any /{section}/{...path}.html page (arbitrary depth),
  // point the locale toggle at the mirror URL if it exists on disk. Prevents
  // new content directories from silently regressing to the home page just
  // because they weren't added to the hardcoded section list above.
  const genericMatch = relative.match(/^(ar\/)?([^/]+)\/(.+\.html)$/);
  if (genericMatch) {
    const isArPage = Boolean(genericMatch[1]);
    const section = genericMatch[2];
    const rest = genericMatch[3];  // may include nested subdirs
    // Guard against picking up top-level tech directories we don't want to
    // auto-mirror. 'tools' is INTENTIONALLY not here — the explicit tools
    // matcher above covers it.
    const SKIP_SECTIONS = new Set(['js', 'css', 'Image', 'icons', 'data', 'node_modules', '.git', '.github']);
    if (!SKIP_SECTIONS.has(section)) {
      const arPath = path.join(ROOT, 'ar', section, rest);
      const enPath = path.join(ROOT, section, rest);
      const bothExist = fs.existsSync(arPath) && fs.existsSync(enPath);
      if (bothExist) {
        // Strip trailing index.html so directory-index pages produce clean URLs
        // (e.g. `/insights/` not `/insights/index.html`). Handles both nested
        // paths and the bare `index.html` case at the section root.
        const restPath = rest === 'index.html'
          ? ''
          : rest.endsWith('/index.html')
            ? rest.slice(0, -'index.html'.length)
            : rest;
        return { arabicHref: `/ar/${section}/${restPath}`, englishHref: `/${section}/${restPath}` };
      }
      // Even if the counterpart doesn't exist yet, keep the toggle within the
      // same section (points to section index) rather than dropping to home.
      if (isArPage && fs.existsSync(path.join(ROOT, section))) {
        return { arabicHref: `/ar/${section}/`, englishHref: `/${section}/` };
      }
      if (!isArPage && fs.existsSync(path.join(ROOT, 'ar', section))) {
        return { arabicHref: `/ar/${section}/`, englishHref: `/${section}/` };
      }
    }
  }
  // Default: let the renderer compute section-level counterpart
  return { arabicHref: undefined, englishHref: undefined };
}

function replaceNavigationFragments(html, expectedHeader, relative) {
  const start = html.indexOf(MARKER_START);
  const end = html.indexOf(MARKER_END);
  if (start < 0 || end < start) {
    console.error(`[global-header] ${relative}: navigation-only update requires canonical markers`);
    failures++;
    return null;
  }

  const before = html.slice(0, start);
  const region = html.slice(start, end + MARKER_END.length);
  const after = html.slice(end + MARKER_END.length);
  const navPattern = /<nav class="nav-group"[\s\S]*?<\/nav>/;
  const localePattern = /<div class="locale-links"[\s\S]*?<\/div>/;
  const expectedNav = expectedHeader.match(navPattern);
  const expectedLocale = expectedHeader.match(localePattern);

  if (!expectedNav || !expectedLocale || !navPattern.test(region) || !localePattern.test(region)) {
    console.error(`[global-header] ${relative}: canonical navigation fragments not found`);
    failures++;
    return null;
  }

  const active = expectedHeader.match(/data-active-section="([^"]*)"/);
  let nextRegion = region
    .replace(navPattern, expectedNav[0])
    .replace(localePattern, expectedLocale[0]);
  if (active) {
    nextRegion = nextRegion.replace(/data-active-section="[^"]*"/, `data-active-section="${active[1]}"`);
  }
  return `${before}${nextRegion}${after}`;
}

function walkHtml(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function collectTargetFiles() {
  const files = new Set();
  for (const target of ROOTS) {
    const absolute = path.join(ROOT, target);
    if (!fs.existsSync(absolute)) continue;
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      for (const file of walkHtml(absolute)) files.add(file);
    } else {
      files.add(absolute);
    }
  }
  // Hub pages live as root-level *-stocks.html / *-etfs.html files — they
  // were never in ROOTS, so 22 EN + 22 AR high-traffic hubs shipped without
  // the canonical header/footer/font bake and drifted visually.
  const hubPattern = /^[a-z0-9-]+-(?:stocks|etfs)\.html$/;
  for (const name of fs.readdirSync(ROOT)) {
    if (hubPattern.test(name)) files.add(path.join(ROOT, name));
  }
  const arDir = path.join(ROOT, 'ar');
  if (fs.existsSync(arDir)) {
    for (const name of fs.readdirSync(arDir)) {
      if (hubPattern.test(name)) files.add(path.join(arDir, name));
    }
  }
  return [...files]
    .filter((f) => !EXCLUDE.has(path.relative(ROOT, f).replaceAll('\\', '/')))
    .sort();
}

function removeAssetTags(html, assetPattern, tagName) {
  const tagPattern = tagName === 'link'
    ? /[ \t]*<link\b[^>]*>[ \t]*(?:\r?\n)?/gi
    : /[ \t]*<script\b[^>]*>[\s\S]*?<\/script>[ \t]*(?:\r?\n)?/gi;
  return html.replace(tagPattern, (tag) => assetPattern.test(tag) ? '' : tag);
}

module.exports = {
  ROOTS,
  collectTargetFiles
};
