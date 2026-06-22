'use strict';

const fs = require('fs');
const path = require('path');
const { renderGlobalHeader, MARKER_START, MARKER_END } = require('./render-global-header');
const { collectTargetFiles } = require('./apply-global-header');

const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'https://www.tradealphaai.com';
const PUBLIC_SURFACES = [
  ['rankings', '/rankings/', '/ar/rankings/'],
  ['articles', '/articles/', '/ar/articles/'],
  ['market-news', '/market-news/', '/ar/market-news/'],
  ['market-structure', '/market-structure/', '/ar/market-structure/'],
  ['market-outlook', '/market-outlook/', '/ar/market-outlook/'],
  ['briefs', '/briefs/', '/ar/briefs/'],
  ['economic-calendar', '/economic-calendar/', '/ar/economic-calendar/'],
  ['insights', '/insights/', '/ar/insights/']
];
const FORBIDDEN = [/\/system-status(?:\/|$)/, /^\/data\//, /^\/runtime\//, /\.json(?:$|[?#])/];
const failures = [];

const expected = {
  en: navContract(renderGlobalHeader({ locale: 'en' })),
  ar: navContract(renderGlobalHeader({ locale: 'ar' }))
};

validateCanonicalContract(expected.en, expected.ar, failures, true);
validateBakedHeaders();
validatePublicLocaleSwitches();
validateSitemaps();
runNegativeSelfTests();

if (failures.length) {
  console.error(`[surface-discovery] FAILED (${failures.length} issue(s)):`);
  failures.slice(0, 100).forEach((failure) => console.error(`  - ${failure}`));
  if (failures.length > 100) console.error(`  ... ${failures.length - 100} more`);
  process.exit(1);
}

console.log(`[surface-discovery] passed (${collectTargetFiles().length} canonical pages; ${PUBLIC_SURFACES.length} EN/AR public surfaces; links live; internal routes excluded; negative cases detected).`);

function validateCanonicalContract(en, ar, out, checkFiles) {
  if (!en || !ar) {
    out.push('canonical renderer must produce EN and AR navigation');
    return;
  }

  if (en.topLevelCount > 8 || ar.topLevelCount > 8) {
    out.push(`top-level navigation exceeds density cap (en=${en.topLevelCount}, ar=${ar.topLevelCount}, max=8)`);
  }

  const enPaths = en.links.map((link) => normalizeLocalePath(link.href));
  const arPaths = ar.links.map((link) => normalizeLocalePath(link.href));
  if (enPaths.join('|') !== arPaths.join('|')) {
    out.push(`EN/AR navigation path order mismatch: [${enPaths.join(', ')}] vs [${arPaths.join(', ')}]`);
  }

  for (const [name, enRoute, arRoute] of PUBLIC_SURFACES) {
    requireOnce(en, enRoute, `EN ${name}`, out);
    requireOnce(ar, arRoute, `AR ${name}`, out);
    if (checkFiles) {
      validateLocalHref(enRoute, `EN ${name}`, out);
      validateLocalHref(arRoute, `AR ${name}`, out);
    }
  }

  for (const contract of [en, ar]) {
    // Duplicate detection applies to the TOP-LEVEL nav only. Each
    // dropdown is allowed to repeat its section-root href as the
    // parent trigger, the first child (section index), and the
    // "View all" terminal link — that's intentional UX, not a bug.
    const topLevelLinks = contract.links.filter((link) => link.isTopLevel);
    const labels = topLevelLinks.map((link) => link.label.toLocaleLowerCase());
    const hrefs = topLevelLinks.map((link) => link.href);
    for (const label of new Set(labels)) {
      if (labels.filter((value) => value === label).length > 1) {
        out.push(`${contract.locale}: duplicate top-level navigation label "${label}"`);
      }
    }
    // Forbidden-route / file-existence checks still apply to EVERY link
    // (top-level + dropdown children), so internal routes can never
    // sneak in through a dropdown.
    for (const link of contract.links) {
      if (FORBIDDEN.some((pattern) => pattern.test(link.href))) {
        out.push(`${contract.locale}: internal route exposed in public navigation (${link.href})`);
      }
      if (checkFiles) validateLocalHref(link.href, `${contract.locale} navigation`, out);
    }
    for (const href of new Set(hrefs)) {
      if (hrefs.filter((value) => value === href).length > 1) {
        out.push(`${contract.locale}: duplicate top-level navigation route "${href}"`);
      }
    }
  }

  const arabicLabels = ar.links.map((link) => link.label).join(' ');
  if (/[A-Za-z]{4,}/.test(arabicLabels)) {
    out.push('AR navigation contains an untranslated English label');
  }
}

function validatePublicLocaleSwitches() {
  for (const [name, enRoute, arRoute] of PUBLIC_SURFACES) {
    const enHtml = fs.readFileSync(path.join(ROOT, routeToFile(enRoute)), 'utf8');
    const arHtml = fs.readFileSync(path.join(ROOT, routeToFile(arRoute)), 'utf8');
    validateLocaleSwitch(enHtml, enRoute, arRoute, `EN ${name}`, failures);
    validateLocaleSwitch(arHtml, enRoute, arRoute, `AR ${name}`, failures);
  }
}

function validateBakedHeaders() {
  for (const file of collectTargetFiles()) {
    const relative = path.relative(ROOT, file).replaceAll('\\', '/');
    const html = fs.readFileSync(file, 'utf8');
    const locale = relative.startsWith('ar/') ? 'ar' : 'en';
    const contract = navContract(html);
    if (!contract) {
      failures.push(`${relative}: canonical navigation block missing`);
      continue;
    }
    const actual = contract.links.map(signature).join('|');
    const wanted = expected[locale].links.map(signature).join('|');
    if (actual !== wanted) failures.push(`${relative}: navigation differs from canonical ${locale.toUpperCase()} contract`);
    validateRuntimeMarkers(html, relative, failures);
  }
}

function validateSitemaps() {
  const sitemapContents = fs.readdirSync(ROOT)
    .filter((name) => /^sitemap-.*\.xml$/.test(name))
    .map((name) => fs.readFileSync(path.join(ROOT, name), 'utf8'))
    .join('\n');
  validateSitemapContents(sitemapContents, failures);
}

function validateSitemapContents(sitemapContents, out) {
  for (const [name, enRoute, arRoute] of PUBLIC_SURFACES) {
    for (const [locale, route] of [['EN', enRoute], ['AR', arRoute]]) {
      if (!sitemapContents.includes(`<loc>${DOMAIN}${route}</loc>`)) {
        out.push(`${locale} ${name}: public surface missing from sitemaps (${route})`);
      }
    }
  }
}

function validateRuntimeMarkers(html, label, out) {
  if (!html.includes(MARKER_START) || !html.includes(MARKER_END)) out.push(`${label}: global-header markers missing`);
  if (!html.includes('class="mobile-menu-toggle"')) out.push(`${label}: mobile menu toggle missing`);
  if (!html.includes('/css/global-header-canonical.css')) out.push(`${label}: canonical header CSS missing`);
  if (!html.includes('/js/global-header.js')) out.push(`${label}: canonical header runtime missing`);
}

function validateLocaleSwitch(html, enRoute, arRoute, label, out) {
  const routes = localeSwitch(html);
  if (routes.ar !== arRoute || routes.en !== enRoute) {
    out.push(`${label}: locale switch does not preserve the public surface`);
  }
}

function navContract(html) {
  const localeMatch = html.match(/data-locale="(en|ar)"/);
  const navMatch = html.match(/<nav class="nav-group"[\s\S]*?<\/nav>/i);
  if (!navMatch) return null;
  const links = [...navMatch[0].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => {
    const attrs = match[1];
    const href = (attrs.match(/href="([^"]+)"/i) || [])[1] || '';
    const className = (attrs.match(/class="([^"]+)"/i) || [])[1] || '';
    const isTopLevel = /\bnav-link\b/.test(className);
    // Strip the dropdown caret character (▾) that nav-menu triggers
    // append for visual affordance — it's UI chrome, not part of the
    // label. Without this, "Markets▾" would compare differently to
    // a sibling rendered "Markets" (e.g. the dropdown first-child).
    const rawLabel = decodeText(match[2]).replace(/[▾▼▽⌄˅]/g, '').trim();
    return { href, label: rawLabel, isTopLevel };
  });
  return {
    locale: localeMatch ? localeMatch[1] : (links.some((link) => link.href.startsWith('/ar/')) ? 'ar' : 'en'),
    links,
    topLevelCount: (navMatch[0].match(/class="nav-link(?:\s|")/g) || []).length
  };
}

function validateLocalHref(href, label, out) {
  if (!href.startsWith('/')) return;
  const [route, fragment] = href.split('#');
  const rel = routeToFile(route);
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    out.push(`${label}: broken navigation route ${href}`);
    return;
  }
  if (fragment) {
    const html = fs.readFileSync(file, 'utf8');
    const escaped = escapeRegExp(fragment);
    if (!new RegExp(`(?:id|name)=["']${escaped}["']`, 'i').test(html)) {
      out.push(`${label}: broken navigation fragment ${href}`);
    }
  }
}

function routeToFile(route) {
  return route === '/'
    ? 'index.html'
    : route.endsWith('/')
      ? `${route.slice(1)}index.html`
      : route.slice(1);
}

function localeSwitch(html) {
  const region = html.match(/<div class="locale-links"[\s\S]*?<\/div>/i);
  const links = region ? [...region[0].matchAll(/data-locale-route="(ar|en)" href="([^"]+)"/g)] : [];
  return Object.fromEntries(links.map((match) => [match[1], match[2]]));
}

function requireOnce(contract, href, label, out) {
  const count = contract.links.filter((link) => link.href === href).length;
  if (count !== 1) out.push(`${label}: expected exactly one discovery link for ${href}, found ${count}`);
}

function runNegativeSelfTests() {
  const cases = [
    {
      name: 'missing-public-surface',
      en: mutate(expected.en, (links) => links.filter((link) => link.href !== '/market-structure/')),
      ar: expected.ar
    },
    {
      name: 'system-status-exposed',
      en: mutate(expected.en, (links) => [...links, { href: '/system-status/', label: 'System Status' }]),
      ar: expected.ar
    },
    {
      name: 'raw-artifact-exposed',
      en: mutate(expected.en, (links) => [...links, { href: '/data/intelligence/market-pulse.json', label: 'Raw Pulse' }]),
      ar: expected.ar
    },
    {
      // After the 6-item nav redesign, duplicate detection runs over
      // TOP-LEVEL links only (intentional repetition inside a dropdown
      // — trigger + section-index + view-all all pointing at the
      // section root — is standard premium-nav UX, not a duplicate).
      // To still verify the rule fires, rename the TOP-LEVEL Research
      // trigger to "Markets" so the top-level set contains "Markets"
      // twice.
      name: 'duplicate-label',
      en: mutate(expected.en, (links) => links.map((link) => (link.href === '/research/' && link.isTopLevel) ? { ...link, label: 'Markets' } : link)),
      ar: expected.ar
    },
    {
      name: 'arabic-english-leak',
      en: expected.en,
      ar: mutate(expected.ar, (links) => links.map((link) => link.href === '/ar/articles/' ? { ...link, label: 'Educational Articles' } : link))
    },
    {
      name: 'top-level-overflow',
      en: { ...expected.en, topLevelCount: 9 },
      ar: expected.ar
    }
  ];

  for (const test of cases) {
    const detected = [];
    validateCanonicalContract(test.en, test.ar, detected, false);
    if (!detected.length) failures.push(`negative self-test "${test.name}" was not detected`);
  }

  const isolatedCases = [
    ['broken-route', (out) => validateLocalHref('/definitely-missing-surface/', 'negative test', out)],
    ['broken-fragment', (out) => validateLocalHref('/rankings.html#definitely-missing-fragment', 'negative test', out)],
    ['locale-mismatch', (out) => validateLocaleSwitch(
      '<div class="locale-links"><a data-locale-route="ar" href="/ar/"></a><a data-locale-route="en" href="/"></a></div>',
      '/articles/',
      '/ar/articles/',
      'negative test',
      out
    )],
    ['runtime-markers-missing', (out) => validateRuntimeMarkers('<header></header>', 'negative test', out)],
    ['sitemap-surface-missing', (out) => validateSitemapContents('', out)]
  ];

  for (const [name, validate] of isolatedCases) {
    const detected = [];
    validate(detected);
    if (!detected.length) failures.push(`negative self-test "${name}" was not detected`);
  }
}

function mutate(contract, mutateLinks) {
  return { ...contract, links: mutateLinks(contract.links.map((link) => ({ ...link }))) };
}

function normalizeLocalePath(href) {
  return href.replace(/^\/ar(?=\/)/, '') || '/';
}

function signature(link) {
  return `${link.href}::${link.label}`;
}

function decodeText(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
