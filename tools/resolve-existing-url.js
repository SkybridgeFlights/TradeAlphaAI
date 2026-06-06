'use strict';

/**
 * Resolves a site-relative URL to a verified disk path.
 * Returns the original href if the file exists, or the fallback.
 *
 * Usage:
 *   const { resolveUrl } = require('./resolve-existing-url');
 *   const href = resolveUrl('/market-outlook/some-slug.html', '/market-outlook/');
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/**
 * @param {string} href       - Site-absolute URL (e.g. '/market-outlook/foo.html')
 * @param {string} fallback   - Fallback href to return when target does not exist
 * @returns {string}          - href if file exists on disk, fallback otherwise
 */
function resolveUrl(href, fallback) {
  if (!href || !href.startsWith('/')) return fallback;
  const relative = href.replace(/^\//, '');
  const absolute = path.join(ROOT, relative);
  return fs.existsSync(absolute) ? href : (fallback || href);
}

/**
 * Given a list of candidate hrefs (most preferred first), return the first one
 * whose file exists on disk, or the final fallback.
 */
function resolveFirstExisting(candidates, fallback) {
  for (const href of candidates) {
    if (!href) continue;
    const relative = href.replace(/^\//, '');
    const absolute = path.join(ROOT, relative);
    if (fs.existsSync(absolute)) return href;
  }
  return fallback;
}

/**
 * For market-outlook slugs: verify the three localized files exist.
 * Returns { en, ar, enPage } with verified paths or directory fallbacks.
 */
function resolveOutlookUrls(slug) {
  const base = `market-outlook/${slug}.html`;
  const enFile  = path.join(ROOT, base);
  const arFile  = path.join(ROOT, 'ar', base);

  const enHref  = fs.existsSync(enFile)  ? `/${base}` : '/market-outlook/';
  const arHref  = fs.existsSync(arFile)  ? `/ar/${base}` : '/ar/market-outlook/';

  return { en: enHref, ar: arHref };
}

module.exports = { resolveUrl, resolveFirstExisting, resolveOutlookUrls };
