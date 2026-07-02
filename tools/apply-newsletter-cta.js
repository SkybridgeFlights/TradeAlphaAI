#!/usr/bin/env node
'use strict';

// Inject a Substack newsletter signup CTA into content pages.
//
// Targets content surfaces only (articles, news, forecasts, briefs, landing
// pages). Skips dashboards, account/workspace, drafts, and any non-content
// utility pages. Idempotent via a versioned marker so the script can re-run
// safely on every workflow build.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SUBSTACK_URL = 'tradealphaai.substack.com';
const VERSION = 'v2';
const MARKER = `<!-- NEWSLETTER_CTA_INSTALLED:${VERSION} -->`;

function buildSnippet(isAr) {
  const title = isAr ? 'انضم للنشرة البحثية' : 'Join the research newsletter';
  const blurb = isAr
    ? 'تحليل سوق مؤسسي يومي — أسهم وصناديق ETF وماكرو. مجاناً.'
    : 'Daily institutional market analysis — stocks, ETFs, and macro. Free.';
  const placeholder = isAr ? 'بريدك الإلكتروني' : 'your@email.com';
  const button = isAr ? 'اشترك' : 'Subscribe';
  const note = isAr
    ? 'لا spam. إلغاء الاشتراك بنقرة واحدة.'
    : 'No spam. Unsubscribe in one click.';

  return `${MARKER}
<aside class="ta-newsletter-cta" role="complementary" aria-label="${title.replace(/"/g, '&quot;')}" dir="${isAr ? 'rtl' : 'ltr'}">
  <div class="ta-newsletter-inner">
    <div class="ta-newsletter-text">
      <h3 class="ta-newsletter-title">${title}</h3>
      <p class="ta-newsletter-blurb">${blurb}</p>
    </div>
    <div id="custom-substack-embed" class="ta-newsletter-form"></div>
    <p class="ta-newsletter-note">${note}</p>
  </div>
</aside>
<style>
  .ta-newsletter-cta {
    margin: 3rem auto 2rem;
    max-width: 720px;
    padding: 1.75rem 1.5rem;
    border: 1px solid rgba(34, 211, 195, 0.28);
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(13, 26, 42, 0.6) 0%, rgba(7, 16, 33, 0.85) 100%);
    color: #e6f7f3;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', 'Cairo', sans-serif;
    box-shadow: 0 12px 36px rgba(34, 211, 195, 0.08);
  }
  .ta-newsletter-inner { display: flex; flex-direction: column; gap: 0.9rem; }
  .ta-newsletter-title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #22d3c3;
  }
  .ta-newsletter-blurb {
    margin: 0;
    font-size: 0.92rem;
    color: #c2d3e0;
    line-height: 1.5;
  }
  .ta-newsletter-form { margin: 0.25rem 0; min-height: 44px; }
  .ta-newsletter-form input[type="email"] {
    background: rgba(7, 16, 33, 0.7) !important;
    color: #e6f7f3 !important;
    border-color: rgba(34, 211, 195, 0.35) !important;
  }
  .ta-newsletter-note {
    margin: 0;
    font-size: 0.75rem;
    color: #6b7a8a;
  }
  @media (max-width: 600px) {
    .ta-newsletter-cta { margin: 2rem 1rem 1.5rem; padding: 1.25rem 1.1rem; }
    .ta-newsletter-title { font-size: 1.05rem; }
    .ta-newsletter-blurb { font-size: 0.85rem; }
  }
</style>
<script>
  window.CustomSubstackWidget = {
    substackUrl: "${SUBSTACK_URL}",
    placeholder: "${placeholder}",
    buttonText: "${button}",
    theme: "custom",
    colors: {
      primary: "#22d3c3",
      input: "#071021",
      email: "#e6f7f3",
      text: "#021018"
    }
  };
</script>
<script src="https://substackapi.com/widget.js" async></script>
`;
}

// Directories whose HTML pages get the CTA.
const CONTENT_DIRS = [
  'insights', 'ar/insights', 'en/insights',
  'market-outlook', 'ar/market-outlook', 'en/market-outlook',
  'intelligence', 'ar/intelligence', 'en/intelligence',
  'market-news', 'ar/market-news',
  'market-structure', 'ar/market-structure',
  'articles', 'ar/articles',
  'briefs', 'ar/briefs',
  'glossary', 'ar/glossary',
  'compare', 'ar/compare'
];

// Root-level + bilingual landing pages that should also carry the CTA.
const ROOT_PAGES = [
  'index.html',
  'en/index.html',
  'ar/index.html'
];

const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'tools', 'data',
  'js', 'css', 'fonts', 'Image', 'icons', 'drafts', 'logs',
  'account', 'workspace', 'ar/account', 'ar/workspace']);

function listHtml(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  const walk = (cur, depth = 0) => {
    if (depth > 4) return;
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        out.push(full);
      }
    }
  };
  walk(abs);
  return out;
}

function detectArabic(html, file) {
  if (file.includes(`${path.sep}ar${path.sep}`) || file.endsWith(`${path.sep}ar`)) return true;
  // Look at <html ...> opening tag only, so hreflang="ar" alternates don't false-trigger.
  const htmlOpen = html.match(/<html\b[^>]*>/i);
  if (!htmlOpen) return false;
  return /\blang=["']ar/i.test(htmlOpen[0]) || /\bdir=["']rtl/i.test(htmlOpen[0]);
}

function injectInto(file) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { return { skipped: true, reason: 'read_error' }; }

  if (html.includes(MARKER)) return { skipped: true, reason: 'already_installed' };

  // Strip older versions of our CTA so we don't end up with multiple forms.
  html = html.replace(/<!-- NEWSLETTER_CTA_INSTALLED:[^>]+ -->[\s\S]*?<script src="https:\/\/substackapi\.com\/widget\.js"[^>]*><\/script>\s*/g, '');

  const bodyCloseIdx = html.search(/<\/body>/i);
  if (bodyCloseIdx === -1) return { skipped: true, reason: 'no_body_tag' };

  const isAr = detectArabic(html, file);
  const snippet = buildSnippet(isAr);

  const before = html.slice(0, bodyCloseIdx);
  const after = html.slice(bodyCloseIdx);
  fs.writeFileSync(file, before + snippet + after, 'utf8');
  return { installed: true };
}

function main() {
  const seen = new Set();
  for (const dir of CONTENT_DIRS) {
    for (const file of listHtml(dir)) seen.add(file);
  }
  for (const rel of ROOT_PAGES) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) seen.add(abs);
  }
  const files = [...seen].sort();

  let installed = 0, skipped = 0, noBody = 0;
  for (const file of files) {
    const r = injectInto(file);
    if (r.installed) installed++;
    else if (r.reason === 'no_body_tag') noBody++;
    else skipped++;
  }

  console.log(`[newsletter-cta] Substack URL:    ${SUBSTACK_URL}`);
  console.log(`[newsletter-cta] marker version:  ${VERSION}`);
  console.log(`[newsletter-cta] scanned pages:   ${files.length}`);
  console.log(`[newsletter-cta] installed:       ${installed}`);
  console.log(`[newsletter-cta] already-present: ${skipped}`);
  console.log(`[newsletter-cta] no <body> (skip):${noBody}`);
}

if (require.main === module) main();

module.exports = { SUBSTACK_URL, MARKER, buildSnippet, injectInto };
