'use strict';

// ETF Intelligence Center — /etfs/compare/ (+ Arabic).
//
// A two-to-four fund comparison built on a compact dataset embedded in the page,
// so it works from the served HTML with no API and no request on interaction.
// Selection state lives in the URL hash, which makes a comparison shareable.
//
// Every row states which measure it shows. A fund missing a measure renders an
// empty cell — never a zero, never a dash pretending to be data.
//
// Usage: node tools/generate-etf-compare-pages.js [--write]

const fs = require('fs');
const path = require('path');

const shell = require('./etf-center-shell');
const { esc, tr } = shell;
const { UNIVERSE } = require('./etf-universe');
const P = require('./etf-provenance');

const ROOT = shell.ROOT;
const J = (name) => path.join(ROOT, 'data/intelligence', name);
const MAX_SLOTS = 4;
// Above this many funds the payload is written as a separate static JSON file
// and fetched on demand instead of being inlined into every page. Inlining is
// preferable while it is small (the page then works straight from the served
// HTML); beyond this it would bloat every request, so the page switches.
const INLINE_LIMIT = 200;
const PAYLOAD_FILE = 'data/etf-compare-index.json';

function readJson(name, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(J(name), 'utf8')); } catch { return fallback; }
}

function indexBySlug(artifact) {
  return new Map(((artifact && artifact.etfs) || []).map((e) => [e.slug, e]));
}

/**
 * Compact per-fund payload for the client.
 *
 * Only the fields the comparison table renders, rounded for display, so the
 * embedded JSON stays small enough to ship inline on every page load.
 */
function comparePayload(data) {
  return UNIVERSE.map((entry) => {
    const facts = data.facts.get(entry.slug);
    const analytics = data.analytics.get(entry.slug);
    const score = data.score.get(entry.slug);
    const fields = (facts && facts.fields) || {};
    // Only verified or derived values enter the comparison payload; anything
    // else stays null and the client renders it as awaiting verified data.
    const fv = (name) => (P.hasValue(fields[name]) ? fields[name].value : null);
    const available = analytics && analytics.available;
    const perf = available ? analytics.performance : null;
    const risk = available ? analytics.risk : null;

    const num = (v, digits = 4) => (Number.isFinite(v) ? Number(v.toFixed(digits)) : null);

    return {
      slug: entry.slug,
      ticker: entry.ticker,
      name: fv('fund_name') || entry.ticker,
      issuer: fv('issuer'),
      benchmark: fv('benchmark'),
      listing: fv('exchange'),
      region: entry.region,
      currency: available ? analytics.currency : null,
      isin: fv('isin'),
      ter: fv('ter_pct'),
      domicile: fv('domicile'),
      replication: fv('replication'),
      distribution: fv('distribution'),
      inception: fv('listing_date'),
      score: score && score.overall !== null ? score.overall : null,
      label: score ? score.label : null,
      r1: perf ? num(perf.cumulative['1y']) : null,
      r3: perf ? num(perf.annualized['3y']) : null,
      r5: perf ? num(perf.annualized['5y']) : null,
      r10: perf ? num(perf.annualized['10y']) : null,
      vol: risk ? num(risk.volatility_1y) : null,
      dd: risk ? num(risk.max_drawdown) : null,
      sharpe: risk ? num(risk.sharpe, 2) : null,
      beta: risk ? num(risk.beta_vs_world_proxy, 2) : null,
      turnover: available && analytics.liquidity ? analytics.liquidity.median_daily_turnover : null,
      basis: available ? analytics.return_basis : null,
    };
  });
}

function body(ar, payload) {
  const t = tr(ar);
  const nameBySlug = new Map(payload.map((f) => [f.slug, f.name]));
  const options = UNIVERSE.map((entry) => `<option value="${esc(entry.slug)}">${esc(entry.ticker)} — ${esc(nameBySlug.get(entry.slug) || entry.ticker)}</option>`).join('');

  const pickers = Array.from({ length: MAX_SLOTS }, (_, i) => `<div class="etf-field">
              <label for="cmp-${i}">${esc(t(`Fund ${i + 1}`, `الصندوق ${i + 1}`))}</label>
              <select id="cmp-${i}" data-compare-slot="${i}"><option value="">${esc(t('Select a fund', 'اختر صندوقا'))}</option>${options}</select>
            </div>`).join('\n            ');

  return `      <section class="market-section" id="etf-compare">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Compare', 'المقارنة'))}</span><h2>${esc(t('Two to four funds, side by side', 'من صندوقين إلى أربعة، جنبا إلى جنب'))}</h2></div>
        <div class="market-panel">
          <div class="etf-filters">
            ${pickers}
          </div>
          <div data-compare-output></div>
          <p class="etf-empty" data-compare-empty>${esc(t('Choose at least two funds to compare.', 'اختر صندوقين على الأقل للمقارنة.'))}</p>
          <div class="etf-note">${esc(t(
    'Returns are stated in each fund\'s own trading currency, so two funds quoted in different currencies are not directly comparable on return — the difference includes the exchange rate. Currency is shown in the table for that reason.',
    'تُعرض العوائد بعملة تداول كل صندوق، لذا فإن صندوقين مسعّرين بعملتين مختلفتين غير قابلين للمقارنة المباشرة على أساس العائد — إذ يتضمن الفارق سعر الصرف. ولهذا السبب تظهر العملة في الجدول.',
  ))}</div>
          <p class="etf-source" style="margin-block-start:12px">${esc(t(
    'Rows marked awaiting verified data have no checkable source for that fund — they are never zero. Comparison runs entirely in your browser and the selection is stored in the page address so it can be shared.',
    'الصفوف الموسومة بانتظار بيانات موثّقة لا مصدر قابلا للتحقق لها في ذلك الصندوق — وهي ليست صفرا أبدا. وتجري المقارنة بالكامل داخل متصفحك، ويُحفظ الاختيار في عنوان الصفحة ليمكن مشاركته.',
  ))}</p>
        </div>
      </section>
      ${payload.length <= INLINE_LIMIT
    ? `<script type="application/json" data-compare-data>${JSON.stringify(payload)}</script>`
    : `<link rel="preload" as="fetch" href="/${PAYLOAD_FILE}" crossorigin />`}
      <script src="/js/etf-compare.js" data-compare-src="/${PAYLOAD_FILE}" defer></script>`;
}

function writePayload(payload) {
  // Always written, whether or not the page inlines it: it is the machine-readable
  // form of the comparison dataset and the fetch target once the universe grows.
  const out = path.join(ROOT, PAYLOAD_FILE);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify({
    schema_version: 2,
    generated_at: new Date().toISOString(),
    note: 'Comparison dataset for /etfs/compare/. Null means the value is awaiting a verified source, never zero.',
    funds: payload,
  }, null, 2)}
`, 'utf8');
}

function buildPages() {
  const data = {
    facts: indexBySlug(readJson('etf-facts.json')),
    analytics: indexBySlug(readJson('etf-analytics.json')),
    score: indexBySlug(readJson('etf-score.json')),
  };
  const payload = comparePayload(data);
  if (process.argv.includes('--write')) writePayload(payload);

  const pages = [];
  for (const ar of [false, true]) {
    pages.push({
      out: path.join(ROOT, ar ? 'ar/etfs/compare/index.html' : 'etfs/compare/index.html'),
      html: shell.page({
        ar,
        slugPath: 'etfs/compare/',
        titleEn: 'Compare ETFs',
        titleAr: 'مقارنة صناديق المؤشرات',
        descEn: 'Compare two to four ETFs side by side: cost, structure, domicile, distribution policy, performance, risk and TradeAlpha Score.',
        descAr: 'قارن بين صندوقين إلى أربعة جنبا إلى جنب: التكلفة والبنية والمقر وسياسة التوزيع والأداء والمخاطر ودرجة TradeAlpha.',
        eyebrowEn: 'Comparison tool', eyebrowAr: 'أداة المقارنة',
        trail: [[ar ? 'المقارنة' : 'Compare', null]],
        body: body(ar, payload),
      }),
    });
  }
  return pages;
}

function main() {
  shell.writePages(buildPages(), 'etf-compare-pages');
}

if (require.main === module) main();

module.exports = { buildPages, comparePayload, MAX_SLOTS };
