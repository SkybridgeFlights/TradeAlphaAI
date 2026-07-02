#!/usr/bin/env node
'use strict';

// Interactive financial calculators — high-search-volume SEO magnets.
// v1 ships the compound interest calculator; the same generator will host
// additional calculators (retirement, investment return, dividend reinvest)
// as they land.
//
// Each calculator is a static page rendered inside the site's canonical
// shell (market-page body + GLOBAL_HEADER markers + market-shell wrap).
// The interactive form runs entirely client-side, so no serverless
// dependencies. Result: crawlable HTML for Google + instant response for
// the user.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = 'https://www.tradealphaai.com';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function writeIfChanged(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let prev = ''; try { prev = fs.readFileSync(file, 'utf8'); } catch {}
  if (prev === content) return false;
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

// ── Compound interest calculator page ────────────────────────────────────────

function compoundInterestPage(isAr) {
  const lang = isAr ? 'ar' : 'en';
  const dir = isAr ? 'rtl' : 'ltr';

  const T = {
    title: isAr
      ? 'حاسبة الفائدة المركبة — احسب نمو استثمارك (2026)'
      : 'Compound Interest Calculator — See How Money Grows (2026)',
    desc: isAr
      ? 'حاسبة الفائدة المركبة المجانية من TradeAlphaAI. أدخل المبلغ الأولي، المساهمة الشهرية، ومعدل العائد لترى كيف تنمو استثماراتك بمرور الوقت. تعليمية فقط.'
      : 'Free compound interest calculator from TradeAlphaAI. Enter initial amount, monthly contribution, and annual return rate to see how your investment grows over time. Educational only.',
    home: isAr ? 'الرئيسية' : 'Home',
    tools: isAr ? 'الأدوات' : 'Tools',
    breadcrumbCurrent: isAr ? 'حاسبة الفائدة المركبة' : 'Compound Interest Calculator',
    eyebrow: isAr ? 'حاسبة تفاعلية' : 'Interactive Calculator',
    h1: isAr ? 'حاسبة الفائدة المركبة' : 'Compound Interest Calculator',
    lead: isAr
      ? 'اكتشف قوة النمو الأُسّي. أدخل بياناتك أدناه واحصل على النتائج فوراً.'
      : 'Discover the power of exponential growth. Enter your figures below and see results instantly.',
    inputsHeading: isAr ? 'المدخلات' : 'Inputs',
    initial: isAr ? 'المبلغ الأولي ($)' : 'Initial amount ($)',
    monthly: isAr ? 'المساهمة الشهرية ($)' : 'Monthly contribution ($)',
    rate: isAr ? 'العائد السنوي (%)' : 'Annual return (%)',
    years: isAr ? 'عدد السنوات' : 'Years',
    frequency: isAr ? 'دورية التركيب' : 'Compounding',
    freqOptions: [
      [1,  isAr ? 'سنوياً' : 'Annually'],
      [4,  isAr ? 'ربع سنوي' : 'Quarterly'],
      [12, isAr ? 'شهرياً' : 'Monthly'],
      [365,isAr ? 'يومياً' : 'Daily']
    ],
    resultsHeading: isAr ? 'النتائج' : 'Results',
    finalValue: isAr ? 'القيمة النهائية' : 'Final value',
    totalContrib: isAr ? 'إجمالي مساهماتك' : 'Total contributions',
    totalInterest: isAr ? 'إجمالي الفائدة المكتسبة' : 'Total interest earned',
    breakdownHeading: isAr ? 'التوزيع السنوي' : 'Yearly Breakdown',
    thYear: isAr ? 'السنة' : 'Year',
    thContrib: isAr ? 'المساهمات التراكمية' : 'Cumulative contributions',
    thInterest: isAr ? 'الفائدة التراكمية' : 'Cumulative interest',
    thBalance: isAr ? 'الرصيد' : 'Balance',
    aboutHeading: isAr ? 'كيف تعمل الحاسبة' : 'How this calculator works',
    aboutBody: isAr
      ? 'الفائدة المركبة تُحسب على المبلغ الأصلي بالإضافة إلى الفوائد المتراكمة سابقاً. المعادلة: <code>A = P(1 + r/n)^(n·t) + PMT × [((1+r/n)^(n·t) − 1)/(r/n)]</code>. حيث A النتيجة، P المبلغ الأولي، r معدل الفائدة، n دورية التركيب، t عدد السنوات، PMT المساهمة الدورية.'
      : 'Compound interest is calculated on the initial principal plus all previously accumulated interest. Formula: <code>A = P(1 + r/n)^(n·t) + PMT × [((1+r/n)^(n·t) − 1)/(r/n)]</code>. Where A is final amount, P is principal, r is rate, n is compounding periods, t is years, PMT is periodic contribution.',
    disclaimer: isAr
      ? 'هذه الأداة تعليمية فقط. لا تُشكّل نصيحة استثمارية. العائدات الفعلية تختلف حسب الأسواق والضرائب والرسوم.'
      : 'This tool is educational only. Not investment advice. Actual returns vary with markets, taxes, and fees.',
    ruleOf72: isAr ? 'قاعدة الـ72 السريعة' : 'Rule of 72 shortcut',
    ruleOf72Body: isAr
      ? 'اقسم 72 على معدل العائد السنوي لتحصل على السنوات اللازمة لمضاعفة أموالك. عند 8% ← 9 سنوات. عند 12% ← 6 سنوات.'
      : 'Divide 72 by your annual return rate to estimate years to double your money. At 8% → ~9 years. At 12% → ~6 years.',
    faqHeading: isAr ? 'أسئلة شائعة' : 'Frequently asked questions',
    faqs: isAr ? [
      { q: 'ما هي الفائدة المركبة؟', a: 'الفائدة المحسوبة على المبلغ الأصلي والفوائد المتراكمة سابقاً — بخلاف الفائدة البسيطة التي تُحسب فقط على المبلغ الأصلي.' },
      { q: 'ما أفضل دورية تركيب؟', a: 'كلما زاد التركيب (يومياً مقابل سنوياً)، زادت النتيجة قليلاً. الفرق يصبح ملحوظاً على فترات طويلة أو معدلات مرتفعة.' },
      { q: 'هل الحاسبة تُدرج التضخم؟', a: 'لا. النتائج قبل التضخم. للنتائج الحقيقية، اطرح ~2-3% من معدل العائد.' },
      { q: 'هل الحاسبة تُدرج الضرائب؟', a: 'لا. تحقق من قوانين الضرائب في بلدك — الحسابات المُعفاة (401k/IRA/Roth) تختلف عن الحسابات الخاضعة للضريبة.' }
    ] : [
      { q: 'What is compound interest?', a: 'Interest calculated on the initial principal AND on the accumulated interest of previous periods — unlike simple interest, which is calculated on the principal alone.' },
      { q: 'Which compounding frequency is best?', a: 'The more frequent (daily vs annual), the slightly higher the result. The difference becomes noticeable over long periods or high rates.' },
      { q: 'Does this calculator include inflation?', a: 'No. Results are pre-inflation. For real returns, subtract ~2-3% from your annual return rate.' },
      { q: 'Does it account for taxes?', a: 'No. Check your local tax rules — tax-advantaged accounts (401k/IRA/Roth) differ substantially from taxable brokerage accounts.' }
    ],
    ctaHeading: isAr ? 'تعلم أكثر عن الفائدة المركبة' : 'Learn more about compounding',
    ctaBody: isAr
      ? 'قاموس TradeAlphaAI يشرح الفائدة المركبة والمفاهيم المرتبطة بها مع أمثلة ومعادلات.'
      : 'The TradeAlphaAI glossary explains compound interest and related concepts with examples and formulas.',
    ctaBtn: isAr ? 'افتح قاموس المصطلحات' : 'Open glossary',
  };

  const canonical = `${SITE}/${isAr ? 'ar/' : ''}tools/compound-interest/`;
  const altEn = `${SITE}/tools/compound-interest/`;
  const altAr = `${SITE}/ar/tools/compound-interest/`;
  const glossaryHref = isAr ? '/ar/glossary/compound-interest.html' : '/glossary/compound-interest.html';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: T.h1,
        description: T.desc,
        url: canonical,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any (web browser)',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: T.home, item: `${SITE}/${isAr ? 'ar/' : ''}` },
          { '@type': 'ListItem', position: 2, name: T.tools, item: `${SITE}/${isAr ? 'ar/' : ''}tools/` },
          { '@type': 'ListItem', position: 3, name: T.breadcrumbCurrent, item: canonical }
        ]
      },
      {
        '@type': 'FAQPage',
        mainEntity: T.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a }
        }))
      }
    ]
  }, null, 2);

  const freqOpts = T.freqOptions.map(([v, l], i) => `<option value="${v}"${i === 2 ? ' selected' : ''}>${esc(l)}</option>`).join('');

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(T.title)} | TradeAlphaAI</title>
  <meta name="description" content="${esc(T.desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${altEn}" />
  <link rel="alternate" hreflang="ar" href="${altAr}" />
  <link rel="alternate" hreflang="x-default" href="${altEn}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(T.title)}" />
  <meta property="og:description" content="${esc(T.desc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${SITE}/Image/og-image.svg" />
  <meta property="og:locale" content="${isAr ? 'ar_SA' : 'en_US'}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(T.title)}" />
  <meta name="twitter:description" content="${esc(T.desc)}" />
  <meta name="twitter:image" content="${SITE}/Image/og-image.svg" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <script type="application/ld+json">
${jsonLd}
  </script>
  <style>
    .calc-shell { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
    @media (max-width: 900px) { .calc-shell { grid-template-columns: 1fr; } }
    .calc-form { display: grid; gap: 14px; }
    .calc-field label { display: block; font-size: .82rem; color: var(--muted); margin-bottom: 6px; font-weight: 600; letter-spacing: .02em; }
    .calc-field input, .calc-field select { width: 100%; padding: 10px 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12); border-radius: 10px; color: var(--text, #e6f7f3); font: inherit; }
    .calc-field input:focus, .calc-field select:focus { outline: none; border-color: rgba(34,211,195,.5); background: rgba(34,211,195,.05); }
    .calc-results { display: grid; gap: 10px; }
    .calc-result-card { padding: 14px 16px; background: rgba(34,211,195,.06); border: 1px solid rgba(34,211,195,.28); border-radius: 12px; }
    .calc-result-card span { display: block; font-size: .78rem; color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
    .calc-result-card strong { display: block; font-size: 1.6rem; color: var(--accent); margin-top: 4px; }
    .calc-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: .88rem; }
    .calc-table th, .calc-table td { padding: 8px 10px; text-align: right; border-bottom: 1px solid rgba(255,255,255,.06); }
    .calc-table th { color: var(--muted); font-weight: 600; text-align: right; }
    [dir="ltr"] .calc-table th, [dir="ltr"] .calc-table td { text-align: right; }
    [dir="ltr"] .calc-table th:first-child, [dir="ltr"] .calc-table td:first-child { text-align: left; }
    [dir="rtl"] .calc-table th, [dir="rtl"] .calc-table td { text-align: left; }
    [dir="rtl"] .calc-table th:first-child, [dir="rtl"] .calc-table td:first-child { text-align: right; }
    .calc-table tbody tr:hover { background: rgba(34,211,195,.03); }
    .calc-chart { height: 200px; background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; margin-top: 12px; padding: 12px; }
    .calc-chart svg { width: 100%; height: 100%; }
    .calc-faq details { padding: 12px 16px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; margin: 8px 0; }
    .calc-faq summary { cursor: pointer; font-weight: 600; color: var(--text, #e6f7f3); }
    .calc-faq p { margin: 10px 0 0; color: var(--muted); line-height: 1.6; }
  </style>
</head>
<body class="market-page">
  <!-- GLOBAL_HEADER_START -->
  <!-- GLOBAL_HEADER_END -->

  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="/${isAr ? 'ar/' : ''}">${T.home}</a><span>/</span><a href="/${isAr ? 'ar/' : ''}tools/">${T.tools}</a><span>/</span><span>${T.breadcrumbCurrent}</span></nav>

      <section class="market-section">
        <div class="market-panel insight-hero-card">
          <div class="insight-label-row">
            <span class="insight-category-badge">${T.eyebrow}</span>
          </div>
          <h1>${T.h1}</h1>
          <p class="market-lead">${T.lead}</p>
          <p class="insight-hero-disclaimer">${T.disclaimer}</p>
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel">
          <div class="calc-shell">
            <div>
              <h2 style="color:var(--accent);margin:0 0 16px">${T.inputsHeading}</h2>
              <form class="calc-form" id="calc-form" onsubmit="return false;">
                <div class="calc-field"><label for="ci-p">${T.initial}</label><input type="number" id="ci-p" value="10000" min="0" step="100" /></div>
                <div class="calc-field"><label for="ci-pmt">${T.monthly}</label><input type="number" id="ci-pmt" value="500" min="0" step="50" /></div>
                <div class="calc-field"><label for="ci-r">${T.rate}</label><input type="number" id="ci-r" value="8" min="0" max="50" step="0.1" /></div>
                <div class="calc-field"><label for="ci-t">${T.years}</label><input type="number" id="ci-t" value="20" min="1" max="60" step="1" /></div>
                <div class="calc-field"><label for="ci-n">${T.frequency}</label><select id="ci-n">${freqOpts}</select></div>
              </form>
            </div>
            <div>
              <h2 style="color:var(--accent);margin:0 0 16px">${T.resultsHeading}</h2>
              <div class="calc-results">
                <div class="calc-result-card"><span>${T.finalValue}</span><strong id="ci-final">$0</strong></div>
                <div class="calc-result-card"><span>${T.totalContrib}</span><strong id="ci-contrib">$0</strong></div>
                <div class="calc-result-card"><span>${T.totalInterest}</span><strong id="ci-interest">$0</strong></div>
              </div>
              <div class="calc-chart" id="ci-chart" aria-hidden="true"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel">
          <h2>${T.breakdownHeading}</h2>
          <div style="overflow-x:auto">
            <table class="calc-table"><thead><tr><th>${T.thYear}</th><th>${T.thContrib}</th><th>${T.thInterest}</th><th>${T.thBalance}</th></tr></thead><tbody id="ci-table"></tbody></table>
          </div>
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel">
          <span class="eyebrow">${T.ruleOf72}</span>
          <p class="market-copy">${T.ruleOf72Body}</p>
          <h2 style="margin-top:24px">${T.aboutHeading}</h2>
          <p class="market-copy">${T.aboutBody}</p>
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel calc-faq">
          <h2>${T.faqHeading}</h2>
          ${T.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel" style="text-align:center;padding:32px">
          <h2 style="color:var(--accent);margin:0 0 8px">${T.ctaHeading}</h2>
          <p class="market-copy" style="max-width:560px;margin:0 auto 20px">${T.ctaBody}</p>
          <a class="cta" href="${glossaryHref}">${T.ctaBtn}</a>
        </div>
      </section>
    </div>
  </main>

  <script>
  (() => {
    const $ = (id) => document.getElementById(id);
    const money = (v) => Number(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    function calc() {
      const P = Math.max(0, Number($('ci-p').value) || 0);
      const pmtMonthly = Math.max(0, Number($('ci-pmt').value) || 0);
      const r = Math.max(0, Number($('ci-r').value) || 0) / 100;
      const t = Math.max(1, Math.min(60, Number($('ci-t').value) || 1));
      const n = Number($('ci-n').value) || 12;
      // Convert monthly contribution to compounding period contribution.
      const pmtPeriod = (pmtMonthly * 12) / n;
      const rows = [];
      let balance = P;
      let cumContrib = P;
      for (let year = 1; year <= t; year++) {
        for (let p = 0; p < n; p++) {
          balance = balance * (1 + r / n) + pmtPeriod;
          cumContrib += pmtPeriod;
        }
        rows.push({ year, contrib: cumContrib, interest: balance - cumContrib, balance });
      }
      const final = rows[rows.length - 1];
      $('ci-final').textContent = money(final.balance);
      $('ci-contrib').textContent = money(final.contrib);
      $('ci-interest').textContent = money(final.interest);
      const tbody = $('ci-table');
      tbody.innerHTML = rows.map((row) =>
        '<tr><td>' + row.year + '</td><td>' + money(row.contrib) + '</td><td>' + money(row.interest) + '</td><td>' + money(row.balance) + '</td></tr>'
      ).join('');
      drawChart(rows);
    }
    function drawChart(rows) {
      const el = $('ci-chart');
      const w = 600, h = 180, pad = 20;
      const maxY = Math.max(...rows.map((r) => r.balance)) || 1;
      const stepX = (w - pad * 2) / Math.max(1, rows.length - 1);
      const scaleY = (y) => h - pad - (y / maxY) * (h - pad * 2);
      const linePath = rows.map((r, i) => (i === 0 ? 'M' : 'L') + (pad + i * stepX).toFixed(1) + ',' + scaleY(r.balance).toFixed(1)).join(' ');
      const contribPath = rows.map((r, i) => (i === 0 ? 'M' : 'L') + (pad + i * stepX).toFixed(1) + ',' + scaleY(r.contrib).toFixed(1)).join(' ');
      el.innerHTML =
        '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
        '<path d="' + contribPath + '" fill="none" stroke="#9aa8b6" stroke-width="1.5" stroke-dasharray="4 4" />' +
        '<path d="' + linePath + '" fill="none" stroke="#22d3c3" stroke-width="2.5" />' +
        '</svg>';
    }
    document.getElementById('calc-form').addEventListener('input', calc);
    calc();
  })();
  </script>
</body>
</html>
`;
}

// ── Shared shell for follow-on calculators ──────────────────────────────────
//
// Same design system, same schemas — differs only in inputs, live-computed
// results, and educational copy. Keeps each calc under ~120 lines instead of
// duplicating the 300-line compound-interest scaffold.

function calcShellHtml(cfg, isAr) {
  const lang = isAr ? 'ar' : 'en';
  const dir = isAr ? 'rtl' : 'ltr';
  const T = cfg.T;
  const canonical = `${SITE}/${isAr ? 'ar/' : ''}tools/${cfg.slug}/`;
  const altEn = `${SITE}/tools/${cfg.slug}/`;
  const altAr = `${SITE}/ar/tools/${cfg.slug}/`;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebApplication', name: T.h1, description: T.desc, url: canonical,
        applicationCategory: 'FinanceApplication', operatingSystem: 'Any (web browser)',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: T.home, item: `${SITE}/${isAr ? 'ar/' : ''}` },
        { '@type': 'ListItem', position: 2, name: T.tools, item: `${SITE}/${isAr ? 'ar/' : ''}tools/` },
        { '@type': 'ListItem', position: 3, name: T.breadcrumbCurrent, item: canonical }
      ]},
      { '@type': 'FAQPage', mainEntity: T.faqs.map((f) => ({
        '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))}
    ]
  }, null, 2);

  const inputsHtml = cfg.inputs.map((inp) => {
    if (inp.type === 'select') {
      const opts = inp.options.map(([v, l], i) => `<option value="${v}"${i === (inp.defaultIndex || 0) ? ' selected' : ''}>${esc(l)}</option>`).join('');
      return `<div class="calc-field"><label for="${esc(inp.id)}">${esc(inp.label)}</label><select id="${esc(inp.id)}">${opts}</select></div>`;
    }
    return `<div class="calc-field"><label for="${esc(inp.id)}">${esc(inp.label)}</label><input type="${inp.type || 'number'}" id="${esc(inp.id)}" value="${esc(String(inp.value))}"${inp.min != null ? ` min="${inp.min}"` : ''}${inp.max != null ? ` max="${inp.max}"` : ''}${inp.step != null ? ` step="${inp.step}"` : ''} /></div>`;
  }).join('');

  const resultsHtml = cfg.results.map((r) =>
    `<div class="calc-result-card"><span>${esc(r.label)}</span><strong id="${esc(r.id)}">${esc(r.placeholder || '—')}</strong></div>`
  ).join('');

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(T.title)} | TradeAlphaAI</title>
  <meta name="description" content="${esc(T.desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${altEn}" />
  <link rel="alternate" hreflang="ar" href="${altAr}" />
  <link rel="alternate" hreflang="x-default" href="${altEn}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(T.title)}" />
  <meta property="og:description" content="${esc(T.desc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${SITE}/Image/og-image.svg" />
  <meta property="og:locale" content="${isAr ? 'ar_SA' : 'en_US'}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(T.title)}" />
  <meta name="twitter:description" content="${esc(T.desc)}" />
  <meta name="twitter:image" content="${SITE}/Image/og-image.svg" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <script type="application/ld+json">
${jsonLd}
  </script>
  <style>
    .calc-shell { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
    @media (max-width: 900px) { .calc-shell { grid-template-columns: 1fr; } }
    .calc-form { display: grid; gap: 14px; }
    .calc-field label { display: block; font-size: .82rem; color: var(--muted); margin-bottom: 6px; font-weight: 600; letter-spacing: .02em; }
    .calc-field input, .calc-field select { width: 100%; padding: 10px 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12); border-radius: 10px; color: var(--text, #e6f7f3); font: inherit; }
    .calc-field input:focus, .calc-field select:focus { outline: none; border-color: rgba(34,211,195,.5); background: rgba(34,211,195,.05); }
    .calc-results { display: grid; gap: 10px; }
    .calc-result-card { padding: 14px 16px; background: rgba(34,211,195,.06); border: 1px solid rgba(34,211,195,.28); border-radius: 12px; }
    .calc-result-card span { display: block; font-size: .78rem; color: var(--muted); letter-spacing: .04em; text-transform: uppercase; }
    .calc-result-card strong { display: block; font-size: 1.6rem; color: var(--accent); margin-top: 4px; }
    .calc-faq details { padding: 12px 16px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; margin: 8px 0; }
    .calc-faq summary { cursor: pointer; font-weight: 600; color: var(--text, #e6f7f3); }
    .calc-faq p { margin: 10px 0 0; color: var(--muted); line-height: 1.6; }
  </style>
</head>
<body class="market-page">
  <!-- GLOBAL_HEADER_START -->
  <!-- GLOBAL_HEADER_END -->

  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="/${isAr ? 'ar/' : ''}">${T.home}</a><span>/</span><a href="/${isAr ? 'ar/' : ''}tools/">${T.tools}</a><span>/</span><span>${T.breadcrumbCurrent}</span></nav>

      <section class="market-section">
        <div class="market-panel insight-hero-card">
          <div class="insight-label-row">
            <span class="insight-category-badge">${T.eyebrow}</span>
          </div>
          <h1>${T.h1}</h1>
          <p class="market-lead">${T.lead}</p>
          <p class="insight-hero-disclaimer">${T.disclaimer}</p>
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel">
          <div class="calc-shell">
            <div>
              <h2 style="color:var(--accent);margin:0 0 16px">${T.inputsHeading}</h2>
              <form class="calc-form" id="calc-form" onsubmit="return false;">${inputsHtml}</form>
            </div>
            <div>
              <h2 style="color:var(--accent);margin:0 0 16px">${T.resultsHeading}</h2>
              <div class="calc-results">${resultsHtml}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel">
          <h2>${T.aboutHeading}</h2>
          <p class="market-copy">${T.aboutBody}</p>
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel calc-faq">
          <h2>${T.faqHeading}</h2>
          ${T.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel" style="text-align:center;padding:32px">
          <h2 style="color:var(--accent);margin:0 0 8px">${T.ctaHeading}</h2>
          <p class="market-copy" style="max-width:560px;margin:0 auto 20px">${T.ctaBody}</p>
          <a class="cta" href="${cfg.glossaryHref(isAr)}">${T.ctaBtn}</a>
        </div>
      </section>
    </div>
  </main>

  <script>
  (() => {
    const $ = (id) => document.getElementById(id);
    const money = (v) => Number(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    const pct = (v) => (Number(v) * 100).toFixed(2) + '%';
    ${cfg.script}
    document.getElementById('calc-form').addEventListener('input', calc);
    calc();
  })();
  </script>
</body>
</html>
`;
}

// ── Retirement calculator ────────────────────────────────────────────────────

function retirementPage(isAr) {
  const T = isAr ? {
    title: 'حاسبة التقاعد — كم تحتاج للتقاعد؟ (2026)',
    desc: 'حاسبة التقاعد المجانية من TradeAlphaAI. أدخل العمر الحالي، عمر التقاعد، المدخرات، والمساهمات لترى كم ستملك عند التقاعد. تعليمية فقط.',
    home: 'الرئيسية', tools: 'الأدوات', breadcrumbCurrent: 'حاسبة التقاعد',
    eyebrow: 'حاسبة تفاعلية',
    h1: 'حاسبة التقاعد',
    lead: 'اعرف كم ستملك عند التقاعد بناءً على مدخراتك ومساهماتك.',
    disclaimer: 'أداة تعليمية فقط. لا تُشكّل نصيحة استثمارية. اعمل مع مستشار مالي مؤهّل للتخطيط الفعلي.',
    inputsHeading: 'المدخلات', resultsHeading: 'النتائج',
    aboutHeading: 'كيف تعمل الحاسبة',
    aboutBody: 'تحسب النتيجة القيمة المستقبلية لمدخراتك الحالية بالإضافة إلى المساهمات الشهرية المستقبلية، بمعدل عائد ثابت مركّب شهرياً. ثم تُحسب نسبة الأمان لسحب 4% سنوياً (قاعدة Bengen الشهيرة) لدخل التقاعد.',
    faqHeading: 'أسئلة شائعة',
    faqs: [
      { q: 'ما هي قاعدة الـ4%؟', a: 'قاعدة تشير إلى أن سحب 4% سنوياً من محفظتك عند التقاعد يجب أن يُغطّي 30 سنة من الإنفاق تاريخياً. القاعدة مبنية على أبحاث William Bengen عام 1994.' },
      { q: 'ما معدل العائد المفترض؟', a: 'S&P 500 حقّق ~10% سنوياً بمتوسط منذ 1926. الاستخدام المحافظ 6-7% لحساب التضخم والرسوم.' },
      { q: 'هل الحاسبة تشمل التضخم؟', a: 'لا. النتائج بأرقام اسمية. للأرقام الحقيقية، اطرح 2-3% من معدل العائد.' },
      { q: 'هل الحاسبة تشمل الضمان الاجتماعي؟', a: 'لا. أضِف دخلك المتوقع من الضمان الاجتماعي/التقاعد الحكومي منفصلاً.' }
    ],
    ctaHeading: 'اقرأ أكثر عن التقاعد', ctaBody: 'قاموس TradeAlphaAI يشرح مفاهيم التقاعد والاستثمار طويل الأمد.', ctaBtn: 'افتح قاموس المصطلحات'
  } : {
    title: 'Retirement Calculator — How Much You Need (2026)',
    desc: 'Free retirement calculator from TradeAlphaAI. Enter current age, retirement age, savings, and contributions to see your projected nest egg. Educational only.',
    home: 'Home', tools: 'Tools', breadcrumbCurrent: 'Retirement Calculator',
    eyebrow: 'Interactive Calculator',
    h1: 'Retirement Calculator',
    lead: 'See what your nest egg could look like at retirement, based on savings and contributions.',
    disclaimer: 'Educational only. Not investment advice. Work with a qualified financial advisor for real planning.',
    inputsHeading: 'Inputs', resultsHeading: 'Results',
    aboutHeading: 'How this calculator works',
    aboutBody: 'The result compounds your current savings plus future monthly contributions at a fixed annual rate, then applies the classic 4% safe withdrawal rate (Bengen 1994) for retirement income.',
    faqHeading: 'Frequently asked questions',
    faqs: [
      { q: 'What is the 4% rule?', a: 'A rule of thumb suggesting a 4% annual withdrawal from your portfolio at retirement should historically last 30 years. Based on William Bengen\'s 1994 research.' },
      { q: 'What return rate should I assume?', a: 'The S&P 500 averaged ~10% annually since 1926. A conservative planning number is 6-7% to account for inflation and fees.' },
      { q: 'Does this account for inflation?', a: 'No. Results are in nominal dollars. For real (inflation-adjusted) numbers, subtract 2-3% from your return rate.' },
      { q: 'Does this include Social Security?', a: 'No. Add your expected Social Security or government pension separately for a complete picture.' }
    ],
    ctaHeading: 'Learn more about retirement planning', ctaBody: 'The TradeAlphaAI glossary explains retirement and long-term investing concepts.', ctaBtn: 'Open glossary'
  };
  return calcShellHtml({
    slug: 'retirement',
    T,
    inputs: [
      { id: 'r-age',      label: isAr ? 'العمر الحالي' : 'Current age',          value: 30, min: 18, max: 80, step: 1 },
      { id: 'r-retire',   label: isAr ? 'عمر التقاعد' : 'Retirement age',        value: 65, min: 30, max: 90, step: 1 },
      { id: 'r-saved',    label: isAr ? 'المدخرات الحالية ($)' : 'Current savings ($)', value: 20000, min: 0, step: 1000 },
      { id: 'r-monthly',  label: isAr ? 'المساهمة الشهرية ($)' : 'Monthly contribution ($)', value: 800, min: 0, step: 50 },
      { id: 'r-rate',     label: isAr ? 'العائد السنوي (%)' : 'Annual return (%)', value: 7, min: 0, max: 20, step: 0.1 }
    ],
    results: [
      { id: 'r-nest',     label: isAr ? 'الرصيد عند التقاعد' : 'Nest egg at retirement' },
      { id: 'r-contrib',  label: isAr ? 'إجمالي المساهمات' : 'Total contributions' },
      { id: 'r-interest', label: isAr ? 'الفائدة المكتسبة' : 'Interest earned' },
      { id: 'r-income',   label: isAr ? 'دخل سنوي (قاعدة 4%)' : 'Annual income (4% rule)' }
    ],
    glossaryHref: (isAr) => isAr ? '/ar/glossary/compound-interest.html' : '/glossary/compound-interest.html',
    script: `function calc() {
      const age = Math.max(18, Number($('r-age').value) || 30);
      const retire = Math.max(age + 1, Number($('r-retire').value) || 65);
      const P = Math.max(0, Number($('r-saved').value) || 0);
      const pmt = Math.max(0, Number($('r-monthly').value) || 0);
      const r = Math.max(0, Number($('r-rate').value) || 0) / 100;
      const years = retire - age;
      const n = 12;
      let balance = P, cumContrib = P;
      for (let i = 0; i < years * n; i++) { balance = balance * (1 + r / n) + pmt; cumContrib += pmt; }
      $('r-nest').textContent = money(balance);
      $('r-contrib').textContent = money(cumContrib);
      $('r-interest').textContent = money(balance - cumContrib);
      $('r-income').textContent = money(balance * 0.04);
    }`
  }, isAr);
}

// ── CAGR / Investment Return calculator ─────────────────────────────────────

function cagrPage(isAr) {
  const T = isAr ? {
    title: 'حاسبة CAGR — معدل النمو السنوي المركّب (2026)',
    desc: 'حاسبة CAGR المجانية من TradeAlphaAI. أدخل القيمة الأولية والنهائية وعدد السنوات لحساب معدل النمو السنوي المركّب لاستثمارك.',
    home: 'الرئيسية', tools: 'الأدوات', breadcrumbCurrent: 'حاسبة CAGR',
    eyebrow: 'حاسبة تفاعلية',
    h1: 'حاسبة معدل النمو السنوي المركّب (CAGR)',
    lead: 'قيّم أداء استثمارك السنوي المُعدَّل — الطريقة الصحيحة لمقارنة العوائد على فترات مختلفة.',
    disclaimer: 'أداة تعليمية فقط. الأداء الماضي لا يضمن العوائد المستقبلية.',
    inputsHeading: 'المدخلات', resultsHeading: 'النتائج',
    aboutHeading: 'ما هو CAGR؟',
    aboutBody: 'معدل النمو السنوي المركّب هو المعدل الثابت الذي كان سيُعطي نفس العائد الفعلي لو نما الاستثمار بشكل مستقر كل سنة. المعادلة: <code>CAGR = (V_نهائي / V_أولي)^(1/عدد السنوات) − 1</code>. مفيد لمقارنة استثمارات ذات آجال مختلفة.',
    faqHeading: 'أسئلة شائعة',
    faqs: [
      { q: 'ما الفرق بين CAGR والعائد البسيط؟', a: 'العائد البسيط يقسم الربح الإجمالي على السنوات. CAGR يحسب النمو المركّب — الرقم الأصح لمقارنة الأداء بمرور الوقت.' },
      { q: 'هل CAGR يشمل توزيعات الأرباح؟', a: 'فقط إذا أعدت استثمارها. أدخل القيمة النهائية شاملة إعادة استثمار الأرباح لأدق النتائج.' },
      { q: 'ما CAGR الجيد للأسهم؟', a: 'تاريخياً، S&P 500 حقّق ~10% CAGR منذ 1926. أي شيء فوق ذلك على المدى الطويل نادر.' }
    ],
    ctaHeading: 'المزيد عن الأداء المُعدَّل', ctaBody: 'قاموسنا يشرح CAGR، Sharpe Ratio، وألفا وبيتا.', ctaBtn: 'افتح القاموس'
  } : {
    title: 'CAGR Calculator — Compound Annual Growth Rate (2026)',
    desc: 'Free CAGR calculator from TradeAlphaAI. Enter start value, end value, and number of years to compute the compound annual growth rate of your investment.',
    home: 'Home', tools: 'Tools', breadcrumbCurrent: 'CAGR Calculator',
    eyebrow: 'Interactive Calculator',
    h1: 'CAGR Calculator (Compound Annual Growth Rate)',
    lead: 'Measure the smoothed annualized return of your investment — the right way to compare returns across different time horizons.',
    disclaimer: 'Educational only. Past performance is not a guarantee of future returns.',
    inputsHeading: 'Inputs', resultsHeading: 'Results',
    aboutHeading: 'What is CAGR?',
    aboutBody: 'The Compound Annual Growth Rate is the constant rate at which an investment would have grown if it compounded steadily every year. Formula: <code>CAGR = (End / Start)^(1/years) − 1</code>. Useful for comparing investments over different periods.',
    faqHeading: 'Frequently asked questions',
    faqs: [
      { q: 'How is CAGR different from average return?', a: 'Average return divides total gain by years. CAGR captures compounding — the more accurate number for comparing performance over time.' },
      { q: 'Does CAGR include dividends?', a: 'Only if you reinvested them. Enter the ending value INCLUDING reinvested dividends for the most accurate result.' },
      { q: 'What is a good CAGR for stocks?', a: 'Historically, the S&P 500 has delivered ~10% CAGR since 1926. Anything above that consistently over long periods is rare.' }
    ],
    ctaHeading: 'More on risk-adjusted performance', ctaBody: 'The glossary covers CAGR, Sharpe Ratio, alpha, beta, and more.', ctaBtn: 'Open glossary'
  };
  return calcShellHtml({
    slug: 'cagr',
    T,
    inputs: [
      { id: 'c-start', label: isAr ? 'القيمة الأولية ($)' : 'Starting value ($)', value: 10000, min: 1, step: 100 },
      { id: 'c-end',   label: isAr ? 'القيمة النهائية ($)' : 'Ending value ($)',  value: 25000, min: 1, step: 100 },
      { id: 'c-years', label: isAr ? 'عدد السنوات' : 'Years',                    value: 10, min: 1, max: 60, step: 1 }
    ],
    results: [
      { id: 'c-cagr',   label: isAr ? 'CAGR' : 'CAGR' },
      { id: 'c-total',  label: isAr ? 'العائد الإجمالي' : 'Total return' },
      { id: 'c-double', label: isAr ? 'سنوات لمضاعفة الاستثمار' : 'Years to double at this rate' }
    ],
    glossaryHref: (isAr) => isAr ? '/ar/glossary/compound-interest.html' : '/glossary/compound-interest.html',
    script: `function calc() {
      const start = Math.max(1, Number($('c-start').value) || 1);
      const end = Math.max(1, Number($('c-end').value) || 1);
      const years = Math.max(1, Number($('c-years').value) || 1);
      const cagr = Math.pow(end / start, 1 / years) - 1;
      const total = (end - start) / start;
      const doubleYears = cagr > 0 ? Math.log(2) / Math.log(1 + cagr) : Infinity;
      $('c-cagr').textContent = pct(cagr);
      $('c-total').textContent = pct(total);
      $('c-double').textContent = isFinite(doubleYears) ? doubleYears.toFixed(1) + (${isAr ? "' سنة'" : "' years'"}) : '—';
    }`
  }, isAr);
}

// ── Dividend Yield calculator ───────────────────────────────────────────────

function dividendYieldPage(isAr) {
  const T = isAr ? {
    title: 'حاسبة عائد الأرباح — احسب الدخل السنوي (2026)',
    desc: 'حاسبة عائد الأرباح المجانية من TradeAlphaAI. أدخل سعر السهم وقيمة الأرباح السنوية لحساب نسبة العائد والدخل الشهري المتوقع.',
    home: 'الرئيسية', tools: 'الأدوات', breadcrumbCurrent: 'حاسبة عائد الأرباح',
    eyebrow: 'حاسبة تفاعلية',
    h1: 'حاسبة عائد الأرباح',
    lead: 'احسب نسبة عائد الأرباح والدخل السنوي/الشهري من أسهمك.',
    disclaimer: 'أداة تعليمية فقط. عوائد الأرباح تتغيّر وقد تُلغى الشركات توزيعاتها.',
    inputsHeading: 'المدخلات', resultsHeading: 'النتائج',
    aboutHeading: 'كيف يُحسب عائد الأرباح',
    aboutBody: 'عائد الأرباح = (الأرباح السنوية للسهم / سعر السهم) × 100%. مقياس رئيسي لأسهم الدخل. قاعدة تقريبية: العائد فوق 8% غالباً يُشير لمخاطر تخفيض توزيعات مستقبلي.',
    faqHeading: 'أسئلة شائعة',
    faqs: [
      { q: 'ما عائد الأرباح الجيد؟', a: 'يعتمد على القطاع. المرافق والاستهلاك الأساسي 3-5%. REITs 4-8%. أسهم النمو غالباً 0-2%. عائد فوق 8% علامة تحذير عادة.' },
      { q: 'هل يجب اختيار أعلى عائد؟', a: 'ليس تلقائياً. عوائد مرتفعة جداً غالباً تعكس سعراً هابطاً وتوقع تخفيض توزيعات. راجع نسبة التوزيع (payout ratio) والتدفق النقدي الحر أولاً.' },
      { q: 'ما نسبة التوزيع الآمنة؟', a: 'تحت 60% من الأرباح مريح عادة. فوق 80% يُشير لضعف الغطاء وخطر تخفيض في الركود.' }
    ],
    ctaHeading: 'المزيد عن الاستثمار في الأرباح', ctaBody: 'قاموسنا يشرح عائد الأرباح والتوزيعات وقواعد أرستقراطي الأرباح.', ctaBtn: 'افتح القاموس'
  } : {
    title: 'Dividend Yield Calculator — Compute Annual Income (2026)',
    desc: 'Free dividend yield calculator from TradeAlphaAI. Enter share price and annual dividend to compute the yield percentage and expected monthly/annual income.',
    home: 'Home', tools: 'Tools', breadcrumbCurrent: 'Dividend Yield Calculator',
    eyebrow: 'Interactive Calculator',
    h1: 'Dividend Yield Calculator',
    lead: 'Compute the dividend yield and annual/monthly income from your dividend-paying stocks.',
    disclaimer: 'Educational only. Dividend yields change; companies can cut or suspend dividends.',
    inputsHeading: 'Inputs', resultsHeading: 'Results',
    aboutHeading: 'How dividend yield is calculated',
    aboutBody: 'Dividend Yield = (Annual dividend per share / Share price) × 100%. A key metric for income stocks. Rule of thumb: yields above 8% often signal risk of a future dividend cut.',
    faqHeading: 'Frequently asked questions',
    faqs: [
      { q: 'What is a good dividend yield?', a: 'Depends on sector. Utilities and consumer staples: 3-5%. REITs: 4-8%. Growth stocks: often 0-2%. Yields above 8% are usually a warning sign.' },
      { q: 'Should I chase the highest yield?', a: 'Not automatically. Very high yields often reflect a falling stock price and anticipated dividend cut. Check the payout ratio and free cash flow first.' },
      { q: 'What is a safe payout ratio?', a: 'Under 60% of earnings is typically comfortable. Above 80% suggests weak coverage and cut risk during a downturn.' }
    ],
    ctaHeading: 'More on dividend investing', ctaBody: 'The glossary covers dividend yield, payout ratios, and the Dividend Aristocrat concept.', ctaBtn: 'Open glossary'
  };
  return calcShellHtml({
    slug: 'dividend-yield',
    T,
    inputs: [
      { id: 'd-price',    label: isAr ? 'سعر السهم ($)' : 'Share price ($)', value: 100, min: 0.01, step: 0.01 },
      { id: 'd-dividend', label: isAr ? 'الأرباح السنوية للسهم ($)' : 'Annual dividend per share ($)', value: 4, min: 0, step: 0.01 },
      { id: 'd-shares',   label: isAr ? 'عدد الأسهم' : 'Number of shares', value: 100, min: 1, step: 1 }
    ],
    results: [
      { id: 'd-yield',   label: isAr ? 'عائد الأرباح' : 'Dividend yield' },
      { id: 'd-annual',  label: isAr ? 'الدخل السنوي' : 'Annual income' },
      { id: 'd-monthly', label: isAr ? 'الدخل الشهري (تقديري)' : 'Monthly income (avg)' }
    ],
    glossaryHref: (isAr) => isAr ? '/ar/glossary/dividend-yield.html' : '/glossary/dividend-yield.html',
    script: `function calc() {
      const price = Math.max(0.01, Number($('d-price').value) || 0.01);
      const dividend = Math.max(0, Number($('d-dividend').value) || 0);
      const shares = Math.max(1, Number($('d-shares').value) || 1);
      const yieldPct = dividend / price;
      const annual = dividend * shares;
      $('d-yield').textContent = pct(yieldPct);
      $('d-annual').textContent = money(annual);
      $('d-monthly').textContent = money(annual / 12);
    }`
  }, isAr);
}

// ── Tools index page ────────────────────────────────────────────────────────

function toolsIndexPage(isAr) {
  const lang = isAr ? 'ar' : 'en';
  const dir = isAr ? 'rtl' : 'ltr';
  const T = {
    title: isAr ? 'الأدوات المالية | TradeAlphaAI' : 'Financial Tools | TradeAlphaAI',
    desc: isAr
      ? 'حاسبات ومحلّلات تفاعلية مجانية من TradeAlphaAI — الفائدة المركبة، الاستثمار، التقاعد وأكثر.'
      : 'Free interactive calculators and analyzers from TradeAlphaAI — compound interest, investment growth, retirement, and more.',
    home: isAr ? 'الرئيسية' : 'Home',
    breadcrumbCurrent: isAr ? 'الأدوات' : 'Tools',
    h1: isAr ? 'الأدوات المالية التفاعلية' : 'Interactive Financial Tools',
    lead: isAr
      ? 'حاسبات مجانية تعمل مباشرة في متصفحك. لا تسجيل، لا انتظار.'
      : 'Free calculators that run instantly in your browser. No signup, no wait.'
  };
  const canonical = `${SITE}/${isAr ? 'ar/' : ''}tools/`;
  const items = [
    {
      href: `/${isAr ? 'ar/' : ''}tools/compound-interest/`,
      title: isAr ? 'حاسبة الفائدة المركبة' : 'Compound Interest Calculator',
      desc: isAr
        ? 'احسب نمو استثمارك مع المساهمات الشهرية.'
        : 'See how your money grows with monthly contributions and compounding returns.'
    }
  ];

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(T.title)}</title>
  <meta name="description" content="${esc(T.desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${SITE}/tools/" />
  <link rel="alternate" hreflang="ar" href="${SITE}/ar/tools/" />
  <link rel="alternate" hreflang="x-default" href="${SITE}/tools/" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(T.title)}" />
  <meta property="og:description" content="${esc(T.desc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE}/Image/og-image.svg" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
</head>
<body class="market-page">
  <!-- GLOBAL_HEADER_START -->
  <!-- GLOBAL_HEADER_END -->

  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="/${isAr ? 'ar/' : ''}">${T.home}</a><span>/</span><span>${T.breadcrumbCurrent}</span></nav>

      <section class="market-section">
        <div class="market-panel insight-hero-card">
          <div class="insight-label-row"><span class="insight-category-badge">${T.breadcrumbCurrent}</span></div>
          <h1>${T.h1}</h1>
          <p class="market-lead">${T.lead}</p>
        </div>
      </section>

      <section class="market-section">
        <div class="insight-stat-grid">
          ${items.map((it) => `<a class="insight-stat-card" href="${esc(it.href)}" style="text-decoration:none"><span>${T.breadcrumbCurrent}</span><strong>${esc(it.title)}</strong><p>${esc(it.desc)}</p></a>`).join('')}
        </div>
      </section>
    </div>
  </main>
</body>
</html>
`;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  // Only ship the calculator pages here — the existing /tools/ hub landing
  // page is comprehensive and shouldn't be blown away. When we add more
  // calculators we'll extend the existing hub via a separate targeted patch.
  let written = 0;
  const calcs = [
    ['compound-interest', compoundInterestPage],
    ['retirement',        retirementPage],
    ['cagr',              cagrPage],
    ['dividend-yield',    dividendYieldPage]
  ];
  const targets = [];
  for (const [slug, render] of calcs) {
    targets.push({ path: path.join(ROOT, 'tools', slug, 'index.html'),          content: render(false) });
    targets.push({ path: path.join(ROOT, 'ar', 'tools', slug, 'index.html'),    content: render(true) });
  }
  for (const t of targets) if (writeIfChanged(t.path, t.content)) written++;
  console.log(`[calculators] ${targets.length} pages targeted, ${written} updated`);
}

if (require.main === module) main();

module.exports = { compoundInterestPage, retirementPage, cagrPage, dividendYieldPage, toolsIndexPage };
