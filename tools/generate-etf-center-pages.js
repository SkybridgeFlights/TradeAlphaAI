'use strict';

// ETF Intelligence Center — home, finder and category pages.
//
// Takes ownership of /etfs/ from generate-etf-discovery-pages.js. It satisfies
// every requirement check-etf-discovery.js enforces on that route (the "ETF
// Intelligence Universe" identity, links to /research/etfs/ and /market-map/etfs/,
// a research link for every registry fund, the plural safety disclaimer) and adds
// the full Center experience on top. The discovery validator keeps passing.
//
// Routes: /etfs/, /etfs/finder/, /etfs/categories/, /etfs/categories/<slug>/
//         plus the /ar/ mirror of each.
//
// Usage: node tools/generate-etf-center-pages.js [--write]

const fs = require('fs');
const path = require('path');

const shell = require('./etf-center-shell');
const { esc, tr, pct, signedPct, compact, stat } = shell;
const { UNIVERSE } = require('./etf-universe');
const { ETFS: REGISTRY } = require('./etf-registry');
const { arLabel } = require('./etf-detail-sections');
const P = require('./etf-provenance');

const ROOT = shell.ROOT;
const J = (name) => path.join(ROOT, 'data/intelligence', name);

// Category surfaces, in the order they appear on the home page. `match` decides
// membership from the universe entry alone so a new fund joins automatically.
const CATEGORIES = [
  {
    slug: 'long-term', en: 'Long-Term Core', ar: 'النواة طويلة الأجل',
    descEn: 'Broad, diversified funds most often researched as the core of a long-horizon portfolio.',
    descAr: 'صناديق واسعة ومتنوعة يكثر بحثها بوصفها نواة لمحفظة طويلة الأجل.',
    match: (e) => ['world_equity', 'broad_market'].includes(e.category),
  },
  {
    slug: 'dividend', en: 'Dividend', ar: 'التوزيعات',
    descEn: 'Funds built around dividend quality and distribution growth.',
    descAr: 'صناديق مبنية حول جودة التوزيعات ونموّها.',
    match: (e) => e.category === 'dividend_quality',
  },
  {
    slug: 'growth', en: 'Growth', ar: 'النمو',
    descEn: 'Growth-tilted equity exposure, typically with higher volatility.',
    descAr: 'تعرض للأسهم بميل نحو النمو، عادة بتذبذب أعلى.',
    match: (e) => e.category === 'growth',
  },
  {
    slug: 'ai', en: 'Artificial Intelligence', ar: 'الذكاء الاصطناعي',
    descEn: 'Thematic AI, robotics and semiconductor exposure. Concentrated by construction.',
    descAr: 'تعرض موضوعي للذكاء الاصطناعي والروبوتات وأشباه الموصلات. مركّز بحكم تكوينه.',
    match: (e) => ['thematic_ai', 'semiconductors'].includes(e.category),
  },
  {
    slug: 'technology', en: 'Technology', ar: 'التكنولوجيا',
    descEn: 'Technology sector and semiconductor funds.',
    descAr: 'صناديق قطاع التكنولوجيا وأشباه الموصلات.',
    match: (e) => e.exposure_type === 'technology_sector' || e.category === 'semiconductors',
  },
  {
    slug: 'gold', en: 'Gold & Commodities', ar: 'الذهب والسلع',
    descEn: 'Commodity exposure, including gold.',
    descAr: 'تعرض للسلع، بما في ذلك الذهب.',
    match: (e) => e.category === 'commodity',
  },
  {
    slug: 'healthcare', en: 'Healthcare', ar: 'الرعاية الصحية',
    descEn: 'Healthcare sector exposure with defensive earnings characteristics.',
    descAr: 'تعرض لقطاع الرعاية الصحية بخصائص أرباح دفاعية.',
    match: (e) => e.exposure_type === 'healthcare_sector',
  },
  {
    slug: 'emerging-markets', en: 'Emerging Markets', ar: 'الأسواق الناشئة',
    descEn: 'Emerging-market equity exposure, commonly paired with a developed core.',
    descAr: 'تعرض لأسهم الأسواق الناشئة، يُقرن عادة بنواة من الأسواق المتقدمة.',
    match: (e) => e.category === 'emerging_markets',
  },
  {
    slug: 'bonds', en: 'Bonds & Credit', ar: 'السندات والائتمان',
    descEn: 'Government, aggregate and corporate credit exposure across the duration spectrum.',
    descAr: 'تعرض للسندات الحكومية والتجميعية وائتمان الشركات عبر أطياف المدة.',
    match: (e) => ['fixed_income', 'credit'].includes(e.category),
  },
  {
    slug: 'real-estate', en: 'Real Estate', ar: 'العقارات',
    descEn: 'Listed real-estate exposure, highly sensitive to financing conditions.',
    descAr: 'تعرض للعقارات المدرجة، شديد الحساسية لظروف التمويل.',
    match: (e) => e.category === 'real_estate' || e.exposure_type === 'real_estate_sector',
  },
  {
    slug: 'esg', en: 'ESG & Screened', ar: 'الاستدامة والفرز',
    descEn: 'Equity exposure filtered through environmental, social and governance screens.',
    descAr: 'تعرض للأسهم مُرشَّح عبر معايير بيئية واجتماعية وحوكمية.',
    match: (e) => e.category === 'esg',
  },
];

function readJson(name, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(J(name), 'utf8')); } catch { return fallback; }
}

function indexBySlug(artifact) {
  return new Map(((artifact && artifact.etfs) || []).map((e) => [e.slug, e]));
}

function detailHref(ar, slug) {
  return `${ar ? '/ar' : ''}/research/etfs/${slug}/`;
}

/** One fund card: score, cost and a headline return, each omitted when absent. */
function fundCard(ar, entry, data) {
  const t = tr(ar);
  const score = data.score.get(entry.slug);
  const facts = data.facts.get(entry.slug);
  const analytics = data.analytics.get(entry.slug);
  const fields = (facts && facts.fields) || {};

  const bits = [];
  if (score && score.overall !== null) {
    bits.push(`<span class="etf-chip accent">${esc(t('Score', 'الدرجة'))} ${score.overall}</span>`);
  }
  if (P.hasValue(fields.ter_pct)) bits.push(`<span class="etf-chip">${esc(t('TER', 'المصاريف'))} ${fields.ter_pct.value}%</span>`);
  if (analytics && analytics.available) {
    const oneYear = analytics.performance.cumulative['1y'];
    if (oneYear !== null) bits.push(`<span class="etf-chip">1Y ${esc(signedPct(oneYear))}</span>`);
  }

  return `          <a class="market-card etf-card-link" href="${esc(detailHref(ar, entry.slug))}">
            <span class="market-card-kicker">${esc(entry.ticker)}${P.hasValue(fields.issuer) ? ` · ${esc(fields.issuer.value)}` : ''}</span>
            <h3>${esc(P.hasValue(fields.fund_name) ? fields.fund_name.value : entry.ticker)}</h3>
            <p class="market-copy">${esc(ar ? entry.role_ar : entry.role_en)}</p>
            <div class="etf-chips">${bits.join('')}</div>
          </a>`;
}

/** Funds in a category, ordered by score where available. */
function categoryMembers(category, data) {
  return UNIVERSE.filter(category.match).sort((a, b) => {
    const sa = data.score.get(a.slug);
    const sb = data.score.get(b.slug);
    const va = sa && sa.overall !== null ? sa.overall : -1;
    const vb = sb && sb.overall !== null ? sb.overall : -1;
    return vb - va;
  });
}

function section(id, eyebrow, title, inner, lead) {
  return `      <section class="market-section" id="${id}">
        <div class="market-section-head"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>
        ${lead ? `<p class="market-copy">${esc(lead)}</p>` : ''}
        ${inner}
      </section>`;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function homeBody(ar, data) {
  const t = tr(ar);
  const out = [];

  // Coverage summary from the live artifacts.
  const scored = [...data.score.values()].filter((s) => s.overall !== null);
  const verified = [...data.facts.values()].filter((f) => (f.provenance_counts || {}).fetched > 0);
  out.push(section('etf-center-coverage', t('Coverage', 'التغطية'), t('What this section covers', 'ما يغطيه هذا القسم'),
    `<div class="market-panel">
          <div class="etf-grid narrow">
            ${stat(t('Funds covered', 'الصناديق المغطاة'), String(UNIVERSE.length))}
            ${stat(t('Scored', 'مُقيَّمة'), String(scored.length))}
            ${stat(t('With verified provider facts', 'بحقائق موثّقة من المزود'), String(verified.length))}
            ${stat(t('US / European listings', 'إدراجات أميركية / أوروبية'), `${UNIVERSE.filter((e) => e.region === 'us').length} / ${UNIVERSE.filter((e) => e.region === 'ucits').length}`)}
          </div>
          <p class="market-copy" style="margin-block-start:14px">${esc(t(
      'Performance and risk are derived from verified daily prices. Fund facts are published only where a data provider supplied them, each labelled with its source. Anything without a verifiable source is shown as awaiting verified data, never estimated.',
      'يُشتق الأداء والمخاطر من أسعار يومية موثّقة. ولا تُنشر حقائق الصناديق إلا حين يوفرها مزود بيانات، مع بيان مصدر كل منها. وكل ما لا مصدر موثّق له يظهر بانتظار بيانات موثّقة، ولا يُقدَّر أبدا.',
    ))}</p>
        </div>`));

  // Primary navigation into the Center.
  const entries = [
    ['/etfs/finder/', t('ETF Finder', 'باحث الصناديق'), t('Filter the full universe by cost, region, structure, risk and score.', 'رشّح العالم الكامل حسب التكلفة والمنطقة والبنية والمخاطر والدرجة.')],
    ['/etfs/rankings/', t('Rankings', 'الترتيبات'), t('Lowest cost, most traded, and the strongest scores in each category.', 'الأقل تكلفة والأكثر تداولا وأقوى الدرجات في كل فئة.')],
    ['/etfs/compare/', t('Compare', 'المقارنة'), t('Put two to four funds side by side across every measured dimension.', 'ضع صندوقين إلى أربعة جنبا إلى جنب عبر كل بعد مقاس.')],
    ['/etfs/portfolios/', t('Allocation models', 'نماذج التوزيع'), t('Illustrative educational portfolios built from covered funds.', 'محافظ تعليمية توضيحية مبنية من الصناديق المغطاة.')],
    ['/etfs/learn/', t('Learn', 'تعلّم'), t('How ETFs are built, what they cost, and how to read the numbers.', 'كيف تُبنى صناديق المؤشرات وكم تكلّف وكيف تُقرأ أرقامها.')],
    ['/etfs/methodology/', t('Methodology', 'المنهجية'), t('Every formula behind the TradeAlpha Score, published in full.', 'كل معادلة وراء مؤشر TradeAlpha، منشورة بالكامل.')],
  ].map(([href, title, desc]) => `          <a class="market-card etf-card-link" href="${esc(ar ? `/ar${href}` : href)}"><h3>${esc(title)}</h3><p class="market-copy">${esc(desc)}</p></a>`).join('\n');
  out.push(section('etf-center-explore', t('Explore', 'استكشف'), t('Start here', 'ابدأ من هنا'), `<div class="etf-grid">\n${entries}\n        </div>`));

  // Highest-scoring covered fund, described as a measurement rather than a pick.
  const top = scored.slice().sort((a, b) => b.overall - a.overall)[0];
  if (top) {
    const entry = UNIVERSE.find((e) => e.slug === top.slug);
    if (entry) {
      out.push(section('etf-center-featured', t('Highest structural score', 'أعلى درجة هيكلية'), t('Top of the covered universe', 'الأعلى ضمن العالم المغطى'),
        `<div class="market-panel">
          <div class="etf-identity"><span class="etf-ticker-badge">${esc(entry.ticker)}</span><span class="etf-identity-name">${esc((() => { const f = data.facts.get(entry.slug); return f && P.hasValue(f.fields.fund_name) ? f.fields.fund_name.value : entry.ticker; })())}</span></div>
          <p class="market-copy">${esc(ar ? entry.role_ar : entry.role_en)}</p>
          <div class="etf-score" style="margin-block-start:16px">
            <div class="etf-score-dial" style="--score:${top.overall}"><span class="etf-score-figure"><span class="etf-score-value">${top.overall}</span><span class="etf-score-max">/ 100</span></span></div>
            <div class="etf-score-meta"><div class="etf-score-label">${esc(t(top.label, arLabel(top.label)))}</div>
            <p class="etf-score-coverage">${esc(t(
          'This is the highest structural score among covered funds, reflecting cost, breadth, liquidity and tracking. It is a measurement of fund structure, not a suggestion to hold it.',
          'هذه أعلى درجة هيكلية بين الصناديق المغطاة، وتعكس التكلفة والاتساع والسيولة والتتبع. وهي قياس لبنية الصندوق، وليست اقتراحا بالاحتفاظ به.',
        ))}</p></div>
          </div>
          <p style="margin-block-start:16px"><a class="market-btn primary" href="${esc(detailHref(ar, entry.slug))}">${esc(t('Open full research', 'افتح البحث الكامل'))}</a></p>
        </div>`));
    }
  }

  // Category rails.
  for (const category of CATEGORIES) {
    const members = categoryMembers(category, data).slice(0, 6);
    if (!members.length) continue;
    const cards = members.map((entry) => fundCard(ar, entry, data)).join('\n');
    const href = ar ? `/ar/etfs/categories/${category.slug}/` : `/etfs/categories/${category.slug}/`;
    out.push(section(`etf-cat-${category.slug}`, t('Category', 'فئة'), ar ? category.ar : category.en,
      `<div class="etf-grid">\n${cards}\n        </div>
        <p style="margin-block-start:14px"><a class="market-btn" href="${esc(href)}">${esc(t('View all', 'عرض الكل'))} — ${esc(ar ? category.ar : category.en)}</a></p>`,
      ar ? category.descAr : category.descEn));
  }

  // Required by check-etf-discovery.js: links to the sibling ETF surfaces and a
  // research link for every registry fund.
  const registryLinks = REGISTRY.map((etf) => `<a href="${esc(detailHref(ar, etf.slug))}">${esc(etf.symbol)}</a>`).join(' · ');
  out.push(section('etf-center-network', t('ETF network', 'شبكة الصناديق'), t('Every covered fund', 'كل صندوق مغطى'),
    `<div class="market-panel">
          <p class="market-copy"><a href="${ar ? '/ar/research/etfs/' : '/research/etfs/'}">${esc(t('ETF Research Network', 'شبكة أبحاث الصناديق'))}</a> · <a href="${ar ? '/ar/market-map/etfs/' : '/market-map/etfs/'}">${esc(t('ETF Map', 'خريطة الصناديق'))}</a> · <a href="${ar ? '/ar/etfs/coverage/' : '/etfs/coverage/'}">${esc(t('Data coverage', 'تغطية البيانات'))}</a></p>
          <p class="market-copy">${registryLinks}</p>
          <p class="market-copy">${esc(t(
      'ETF intelligence surfaces describe observed institutional context only. They are not trading signals or investment advice.',
      'تصف أسطح استخبارات الصناديق السياق المؤسسي المرصود فقط. وهي ليست إشارات تداول أو نصيحة استثمارية.',
    ))}</p>
        </div>`));

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Finder
// ---------------------------------------------------------------------------

function finderBody(ar, data) {
  const t = tr(ar);
  const awaiting = t(P.AWAITING_EN, P.AWAITING_AR);
  // A column and filter that no fund can populate is an empty state, not a
  // feature. While cost is unverified across the board, both are withheld and
  // a single line explains why — rather than repeating a status in 39 cells.
  const anyTer = UNIVERSE.some((e) => {
    const f = data.facts.get(e.slug);
    return f && P.hasValue(f.fields.ter_pct);
  });
  const rows = UNIVERSE.map((entry) => {
    const score = data.score.get(entry.slug);
    const facts = data.facts.get(entry.slug);
    const analytics = data.analytics.get(entry.slug);
    const fields = (facts && facts.fields) || {};
    const fv = (name) => (P.hasValue(fields[name]) ? fields[name].value : null);
    const oneYear = analytics && analytics.available ? analytics.performance.cumulative['1y'] : null;
    const vol = analytics && analytics.available ? analytics.risk.volatility_1y : null;

    // Data attributes drive client-side filtering without a second data fetch.
    const attrs = [
      `data-slug="${esc(entry.slug)}"`,
      `data-ticker="${esc(entry.ticker)}"`,
      `data-name="${esc(String(fv('fund_name') || entry.ticker).toLowerCase())}"`,
      `data-issuer="${esc(fv('issuer') || '')}"`,
      `data-region="${esc(entry.region)}"`,
      `data-category="${esc(entry.category)}"`,
      `data-currency="${esc((analytics && analytics.currency) || '')}"`,
      `data-replication="${esc(fv('replication') || '')}"`,
      `data-distribution="${esc(fv('distribution') || '')}"`,
      `data-ter="${fv('ter_pct') === null ? '' : fv('ter_pct')}"`,
      `data-score="${score && score.overall !== null ? score.overall : ''}"`,
      `data-vol="${vol === null ? '' : (vol * 100).toFixed(1)}"`,
    ].join(' ');

    const cell = (value, cls = 'num') => `<td class="${cls}">${value === null || value === undefined ? '' : esc(value)}</td>`;
    return `<tr ${attrs}>
            <td><a href="${esc(detailHref(ar, entry.slug))}"><strong>${esc(entry.ticker)}</strong></a><br /><span class="etf-source">${esc(fv('fund_name') || entry.ticker)}</span></td>
            ${cell(fv('issuer') || '', '')}
            ${cell(entry.region === 'ucits' ? t('Europe', 'أوروبا') : t('US', 'أميركا'), '')}
            ${anyTer ? (fv('ter_pct') === null ? `<td class="num"><span class="etf-awaiting">${esc(awaiting)}</span></td>` : cell(`${fv('ter_pct')}%`)) : ''}
            ${cell(score && score.overall !== null ? score.overall : null)}
            ${oneYear === null ? '<td class="num"></td>' : `<td class="num ${oneYear >= 0 ? 'positive' : 'negative'}">${esc(signedPct(oneYear))}</td>`}
            ${cell(pct(vol))}
          </tr>`;
  }).join('\n          ');

  const issuers = [...new Set(UNIVERSE.map((e) => {
    const f = data.facts.get(e.slug);
    return f && P.hasValue(f.fields.issuer) ? f.fields.issuer.value : null;
  }).filter(Boolean))].sort();
  const categories = [...new Set(UNIVERSE.map((e) => e.category))].sort();

  const opts = (values, labelFn) => values.map((v) => `<option value="${esc(v)}">${esc(labelFn ? labelFn(v) : v)}</option>`).join('');

  return section('etf-finder', t('ETF Finder', 'باحث الصناديق'), t('Filter the universe', 'رشّح العالم الكامل'),
    `<div class="market-panel">
          <div class="etf-filters">
            <div class="etf-field"><label for="f-q">${esc(t('Search', 'بحث'))}</label><input id="f-q" type="search" data-etf-filter="query" placeholder="${esc(t('Ticker or name', 'الرمز أو الاسم'))}" /></div>
            <div class="etf-field"><label for="f-region">${esc(t('Listing region', 'منطقة الإدراج'))}</label><select id="f-region" data-etf-filter="region"><option value="">${esc(t('All', 'الكل'))}</option><option value="us">${esc(t('US', 'أميركا'))}</option><option value="ucits">${esc(t('Europe (UCITS)', 'أوروبا (UCITS)'))}</option></select></div>
            <div class="etf-field"><label for="f-issuer">${esc(t('Issuer', 'الجهة المُصدِرة'))}</label><select id="f-issuer" data-etf-filter="issuer"><option value="">${esc(t('All', 'الكل'))}</option>${opts(issuers)}</select></div>
            <div class="etf-field"><label for="f-category">${esc(t('Category', 'الفئة'))}</label><select id="f-category" data-etf-filter="category"><option value="">${esc(t('All', 'الكل'))}</option>${opts(categories, (v) => v.replace(/_/g, ' '))}</select></div>
            <div class="etf-field"><label for="f-dist">${esc(t('Distribution', 'التوزيع'))}</label><select id="f-dist" data-etf-filter="distribution"><option value="">${esc(t('All', 'الكل'))}</option><option value="accumulating">${esc(t('Accumulating', 'تراكمي'))}</option><option value="distributing">${esc(t('Distributing', 'موزِّع'))}</option></select></div>
            <div class="etf-field"><label for="f-repl">${esc(t('Replication', 'المحاكاة'))}</label><select id="f-repl" data-etf-filter="replication"><option value="">${esc(t('All', 'الكل'))}</option><option value="physical_full">${esc(t('Full physical', 'مادية كاملة'))}</option><option value="physical_sampling">${esc(t('Sampling', 'بالعينة'))}</option><option value="synthetic">${esc(t('Synthetic', 'تركيبية'))}</option></select></div>
            ${anyTer ? `<div class="etf-field"><label for="f-ter">${esc(t('Maximum TER', 'أقصى نسبة مصاريف'))}</label><select id="f-ter" data-etf-filter="maxTer"><option value="">${esc(t('Any', 'أي'))}</option><option value="0.1">0.10%</option><option value="0.2">0.20%</option><option value="0.35">0.35%</option><option value="0.5">0.50%</option></select></div>` : ''}
            <div class="etf-field"><label for="f-score">${esc(t('Minimum score', 'أدنى درجة'))}</label><select id="f-score" data-etf-filter="minScore"><option value="">${esc(t('Any', 'أي'))}</option><option value="80">80+</option><option value="70">70+</option><option value="60">60+</option><option value="50">50+</option></select></div>
          </div>
          <p class="etf-result-count" data-etf-count></p>
          <div class="etf-table-wrap"><table class="etf-table" data-etf-table>
            <thead><tr>
              <th scope="col">${esc(t('Fund', 'الصندوق'))}</th>
              <th scope="col">${esc(t('Issuer', 'الجهة'))}</th>
              <th scope="col">${esc(t('Region', 'المنطقة'))}</th>
              ${anyTer ? `<th scope="col" class="num sortable" data-sort="ter">${esc(t('TER', 'المصاريف'))}<span class="sort-icon">↕</span></th>` : ''}
              <th scope="col" class="num sortable" data-sort="score">${esc(t('Score', 'الدرجة'))}<span class="sort-icon">↕</span></th>
              <th scope="col" class="num">${esc(t('1Y return', 'عائد سنة'))}</th>
              <th scope="col" class="num sortable" data-sort="vol">${esc(t('Volatility', 'التذبذب'))}<span class="sort-icon">↕</span></th>
            </tr></thead>
            <tbody>
          ${rows}
            </tbody>
          </table></div>
          <p class="etf-empty" data-etf-empty hidden>${esc(t('No funds match these filters.', 'لا توجد صناديق مطابقة لهذه المرشحات.'))}</p>
          ${anyTer ? '' : `<p class="etf-pending-note">${esc(t(
      'Cost filtering is unavailable: no free verifiable source publishes expense ratios, so the column and its filter are withheld rather than shown empty. They return automatically once a verified cost source is connected.',
      'التصفية حسب التكلفة غير متاحة: لا يوجد مصدر مجاني موثّق ينشر نسب المصاريف، لذا حُجب العمود ومرشّحه بدلا من عرضهما فارغين. وسيعودان تلقائيا فور ربط مصدر تكلفة موثّق.',
    ))} <a href="${ar ? '/ar/etfs/data-audit/' : '/etfs/data-audit/'}">${esc(t('Data audit', 'تدقيق البيانات'))}</a></p>`}
          <p class="etf-source" style="margin-block-start:12px">${esc(t(
      'Filtering happens entirely in your browser; nothing is sent anywhere.',
      'تتم التصفية بالكامل داخل متصفحك، ولا يُرسل أي شيء إلى أي جهة.',
    ))}</p>
        </div>
        <script src="${ar ? '/js/etf-finder.js' : '/js/etf-finder.js'}" defer></script>`);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function categoryIndexBody(ar, data) {
  const t = tr(ar);
  const cards = CATEGORIES.map((category) => {
    const count = categoryMembers(category, data).length;
    if (!count) return '';
    const href = ar ? `/ar/etfs/categories/${category.slug}/` : `/etfs/categories/${category.slug}/`;
    return `          <a class="market-card etf-card-link" href="${esc(href)}">
            <span class="market-card-kicker">${count} ${esc(t('funds', 'صندوقا'))}</span>
            <h3>${esc(ar ? category.ar : category.en)}</h3>
            <p class="market-copy">${esc(ar ? category.descAr : category.descEn)}</p>
          </a>`;
  }).filter(Boolean).join('\n');
  return section('etf-categories', t('Categories', 'الفئات'), t('Browse by exposure', 'تصفّح حسب نوع التعرض'), `<div class="etf-grid">\n${cards}\n        </div>`);
}

// What actually separates funds inside each category - the questions a reader
// should be asking. Gives thin categories genuine editorial substance rather
// than leaving a one-fund page looking unfinished.
const CATEGORY_CRITERIA = {
  'long-term': [
    ['Breadth of the index', 'اتساع المؤشر',
      'Whether the fund holds developed markets only or emerging markets too. This changes what it is exposed to more than any other single choice.',
      'ما إذا كان الصندوق يحتفظ بالأسواق المتقدمة فقط أم يشمل الناشئة أيضا. وهذا يغيّر تعرضه أكثر من أي خيار مفرد آخر.'],
    ['Accumulating or distributing', 'تراكمي أم موزِّع',
      'Whether income is reinvested inside the fund or paid out, which affects tax treatment and whether reinvestment is manual.',
      'ما إذا كان الدخل يُعاد استثماره داخل الصندوق أم يُدفع، وهو ما يؤثر في المعاملة الضريبية وفي كون إعادة الاستثمار يدوية.'],
    ['Ongoing cost', 'التكلفة الجارية',
      'Charged every year on the whole balance, so small differences compound noticeably over a long horizon.',
      'تُحتسب كل عام على الرصيد كاملا، لذا تتراكم الفروق الصغيرة بشكل ملحوظ عبر أفق طويل.'],
  ],
  dividend: [
    ['How the index screens', 'كيف يفرز المؤشر',
      'Some screen for a history of dividend growth, others for current yield. The two produce very different holdings.',
      'بعضها يفرز حسب سجل نمو التوزيعات وبعضها حسب العائد الحالي. وينتج عن الاثنين مكوّنات مختلفة تماما.'],
    ['Sector concentration', 'التركّز القطاعي',
      'Dividend screens often tilt heavily toward a few sectors, which narrows diversification more than the fund name suggests.',
      'كثيرا ما تميل مرشحات التوزيعات بقوة نحو قطاعات قليلة، ما يضيّق التنويع أكثر مما يوحي اسم الصندوق.'],
    ['Distribution frequency', 'وتيرة التوزيع',
      'How often income is paid out, and whether that matches how it is intended to be used.',
      'كم مرة يُدفع الدخل، وما إذا كان ذلك يطابق الغرض من استخدامه.'],
  ],
  gold: [
    ['Physical or futures-based', 'مادي أم قائم على العقود الآجلة',
      'Whether the fund holds the metal itself or derivative contracts. The two behave differently over long holding periods.',
      'ما إذا كان الصندوق يحتفظ بالمعدن نفسه أم بعقود مشتقة. ويتصرف الاثنان بشكل مختلف عبر فترات احتفاظ طويلة.'],
    ['Correlation to equities', 'الارتباط بالأسهم',
      'Commodity exposure is usually held because it behaves differently from stocks. The correlation figure on each fund page shows whether that held.',
      'يُحتفظ بالتعرض السلعي عادة لأنه يتصرف بشكل مختلف عن الأسهم. ويُظهر رقم الارتباط في صفحة كل صندوق ما إذا تحقق ذلك.'],
    ['No income', 'بلا دخل',
      'Commodities produce no dividends or interest, so the entire return depends on price movement alone.',
      'لا تدرّ السلع توزيعات ولا فوائد، لذا يعتمد العائد بالكامل على حركة السعر وحدها.'],
  ],
  bonds: [
    ['Duration', 'المدة',
      'How sensitive the fund is to interest-rate moves. This is the single biggest driver of how a bond fund behaves.',
      'مدى حساسية الصندوق لتحركات أسعار الفائدة. وهو المحرّك الأكبر لسلوك صندوق السندات.'],
    ['Credit quality', 'جودة الائتمان',
      'Government, investment-grade or high-yield exposure, each with a different relationship to equity risk.',
      'تعرض حكومي أو استثماري أو عالي العائد، ولكل منها علاقة مختلفة بمخاطر الأسهم.'],
    ['Behaviour in drawdowns', 'السلوك أثناء التراجعات',
      'Bond funds are often held as ballast. The drawdown figures show how each one actually behaved when it mattered.',
      'تُحتفظ صناديق السندات غالبا كموازن. وتُظهر أرقام التراجع كيف تصرّف كل منها فعليا عندما كان ذلك مهما.'],
  ],
};

const DEFAULT_CRITERIA = [
  ['What the index holds', 'ما يحتويه المؤشر',
    'The rules the index follows decide the holdings. Read the benchmark before reading the performance.',
    'قواعد المؤشر هي التي تحدد المكوّنات. اقرأ المؤشر المرجعي قبل قراءة الأداء.'],
  ['Concentration', 'التركّز',
    'Narrower mandates hold fewer positions, which raises both the dispersion of outcomes and the depth of drawdowns.',
    'التفويضات الأضيق تحتفظ بمراكز أقل، ما يرفع تشتت النتائج وعمق التراجعات معا.'],
  ['Observed volatility and drawdown', 'التذبذب والتراجع المرصودان',
    'Every fund page reports both, measured from verified daily prices rather than described in words.',
    'تعرض كل صفحة صندوق كليهما، مقاسين من أسعار يومية موثّقة بدلا من وصفهما بالكلمات.'],
];

function categoryContext(ar, category, members) {
  const t = tr(ar);
  const criteria = CATEGORY_CRITERIA[category.slug] || DEFAULT_CRITERIA;
  const cards = criteria.map(([en, arLabel2, descEn, descAr]) => `          <article class="market-card">
            <h3>${esc(ar ? arLabel2 : en)}</h3>
            <p class="market-copy">${esc(ar ? descAr : descEn)}</p>
          </article>`).join('\n');

  const siblings = CATEGORIES.filter((c) => c.slug !== category.slug).slice(0, 6)
    .map((c) => `<a class="etf-chip" href="${esc(ar ? `/ar/etfs/categories/${c.slug}/` : `/etfs/categories/${c.slug}/`)}">${esc(ar ? c.ar : c.en)}</a>`).join('');

  const narrow = members.length < 3
    ? `<p class="etf-pending-note">${esc(t(
      `Coverage in this category is currently ${members.length === 1 ? 'one fund' : `${members.length} funds`}. The Center covers ${UNIVERSE.length} in total, and this category grows as more are added. The comparison criteria above apply whatever the count.`,
      `التغطية في هذه الفئة حاليا ${members.length === 1 ? 'صندوق واحد' : `${members.length} صناديق`}. ويغطي المركز ${UNIVERSE.length} صندوقا إجمالا، وتتوسع هذه الفئة مع إضافة المزيد. ومعايير المقارنة أعلاه تنطبق مهما كان العدد.`,
    ))}</p>`
    : '';

  return `      <section class="market-section" id="etf-category-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('How to compare', 'كيف تقارن'))}</span><h2>${esc(t('What separates funds in this category', 'ما الذي يميّز الصناديق في هذه الفئة'))}</h2></div>
        <div class="etf-grid">
${cards}
        </div>
        ${narrow}
      </section>
      <section class="market-section" id="etf-category-related">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Related', 'ذات صلة'))}</span><h2>${esc(t('Continue from here', 'تابع من هنا'))}</h2></div>
        <div class="market-panel">
          <div class="etf-chips">${siblings}</div>
          <p class="market-copy" style="margin-block-start:14px"><a href="${esc(ar ? '/ar/etfs/learn/' : '/etfs/learn/')}">${esc(t('Understanding ETFs', 'فهم صناديق المؤشرات'))}</a> &middot; <a href="${esc(ar ? '/ar/etfs/finder/' : '/etfs/finder/')}">${esc(t('Search all funds', 'ابحث في كل الصناديق'))}</a> &middot; <a href="${esc(ar ? '/ar/etfs/compare/' : '/etfs/compare/')}">${esc(t('Compare side by side', 'قارن جنبا إلى جنب'))}</a></p>
        </div>
      </section>`;
}

function categoryBody(ar, category, data) {
  const t = tr(ar);
  const awaiting = t(P.AWAITING_EN, P.AWAITING_AR);
  const anyTer = UNIVERSE.some((e) => {
    const f = data.facts.get(e.slug);
    return f && P.hasValue(f.fields.ter_pct);
  });
  const members = categoryMembers(category, data);
  const cards = members.map((entry) => fundCard(ar, entry, data)).join('\n');

  const rows = members.map((entry) => {
    const score = data.score.get(entry.slug);
    const facts = data.facts.get(entry.slug);
    const analytics = data.analytics.get(entry.slug);
    const fields = (facts && facts.fields) || {};
    const awaitingCell = `<span class="etf-awaiting">${esc(awaiting)}</span>`;
    const oneYear = analytics && analytics.available ? analytics.performance.cumulative['1y'] : null;
    return `<tr>
            <td><a href="${esc(detailHref(ar, entry.slug))}"><strong>${esc(entry.ticker)}</strong></a></td>
            <td style="white-space:normal">${esc(P.hasValue(fields.fund_name) ? fields.fund_name.value : entry.ticker)}</td>
            ${anyTer ? `<td class="num">${P.hasValue(fields.ter_pct) ? `${fields.ter_pct.value}%` : awaitingCell}</td>` : ''}
            <td class="num">${score && score.overall !== null ? score.overall : ''}</td>
            ${oneYear === null ? '<td class="num"></td>' : `<td class="num ${oneYear >= 0 ? 'positive' : 'negative'}">${esc(signedPct(oneYear))}</td>`}
          </tr>`;
  }).join('\n          ');

  return [
    section(`etf-category-${category.slug}`, t('Category', 'فئة'), ar ? category.ar : category.en,
      `<div class="etf-grid">\n${cards}\n        </div>`, ar ? category.descAr : category.descEn),
    categoryContext(ar, category, members),
    section('etf-category-table', t('Side by side', 'جنبا إلى جنب'), t('All funds in this category', 'كل الصناديق في هذه الفئة'),
      `<div class="etf-table-wrap"><table class="etf-table">
          <thead><tr>
            <th scope="col">${esc(t('Ticker', 'الرمز'))}</th>
            <th scope="col">${esc(t('Fund', 'الصندوق'))}</th>
            ${anyTer ? `<th scope="col" class="num">${esc(t('TER', 'المصاريف'))}</th>` : ''}
            <th scope="col" class="num">${esc(t('Score', 'الدرجة'))}</th>
            <th scope="col" class="num">${esc(t('1Y return', 'عائد سنة'))}</th>
          </tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table></div>
        <p class="etf-source" style="margin-block-start:12px">${esc(t(
        'Ordered by TradeAlpha Score. Blank cells mean the value is not published for that fund. Ordering describes structural quality, not expected return.',
        'مرتبة حسب مؤشر TradeAlpha. وتعني الخانات الفارغة أن القيمة غير منشورة لذلك الصندوق. ويصف الترتيب الجودة الهيكلية، لا العائد المتوقع.',
      ))}</p>`),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function buildPages() {
  const data = {
    facts: indexBySlug(readJson('etf-facts.json')),
    analytics: indexBySlug(readJson('etf-analytics.json')),
    score: indexBySlug(readJson('etf-score.json')),
    similarity: indexBySlug(readJson('etf-similarity.json')),
  };

  const pages = [];
  const push = (ar, slugPath, out, opts) => {
    pages.push({ out: path.join(ROOT, out), html: shell.page({ ar, slugPath, ...opts }) });
  };

  for (const ar of [false, true]) {
    // Home — must keep the "ETF Intelligence Universe" identity string that
    // check-etf-discovery.js looks for.
    push(ar, 'etfs/', ar ? 'ar/etfs/index.html' : 'etfs/index.html', {
      titleEn: 'ETF Intelligence Center',
      titleAr: 'مركز استخبارات صناديق المؤشرات',
      descEn: 'Research, compare and evaluate ETFs: TradeAlpha Scores, performance and risk computed from observed prices, costs, structure and allocation models.',
      descAr: 'ابحث وقارن وقيّم صناديق المؤشرات: درجات TradeAlpha، والأداء والمخاطر المحتسبة من الأسعار المرصودة، والتكاليف والبنية ونماذج التوزيع.',
      eyebrowEn: 'ETF Intelligence Universe',
      eyebrowAr: 'عالم استخبارات صناديق المؤشرات',
      trail: [[ar ? 'مركز الاستخبارات' : 'Intelligence Center', null]],
      body: homeBody(ar, data),
    });

    push(ar, 'etfs/finder/', ar ? 'ar/etfs/finder/index.html' : 'etfs/finder/index.html', {
      titleEn: 'ETF Finder',
      titleAr: 'باحث صناديق المؤشرات',
      descEn: 'Filter every covered ETF by cost, listing region, issuer, replication, distribution policy, volatility and TradeAlpha Score.',
      descAr: 'رشّح كل صندوق مغطى حسب التكلفة ومنطقة الإدراج والجهة المُصدِرة وطريقة المحاكاة وسياسة التوزيع والتذبذب ودرجة TradeAlpha.',
      eyebrowEn: 'Finder', eyebrowAr: 'الباحث',
      trail: [[ar ? 'باحث الصناديق' : 'ETF Finder', null]],
      body: finderBody(ar, data),
    });

    push(ar, 'etfs/categories/', ar ? 'ar/etfs/categories/index.html' : 'etfs/categories/index.html', {
      titleEn: 'ETF Categories',
      titleAr: 'فئات صناديق المؤشرات',
      descEn: 'Browse covered ETFs by exposure: long-term core, dividend, growth, AI, technology, gold, healthcare, emerging markets, bonds, real estate and ESG.',
      descAr: 'تصفّح الصناديق المغطاة حسب التعرض: النواة طويلة الأجل، التوزيعات، النمو، الذكاء الاصطناعي، التكنولوجيا، الذهب، الرعاية الصحية، الأسواق الناشئة، السندات، العقارات والاستدامة.',
      eyebrowEn: 'Categories', eyebrowAr: 'الفئات',
      trail: [[ar ? 'الفئات' : 'Categories', null]],
      body: categoryIndexBody(ar, data),
    });

    for (const category of CATEGORIES) {
      if (!categoryMembers(category, data).length) continue;
      push(ar, `etfs/categories/${category.slug}/`,
        ar ? `ar/etfs/categories/${category.slug}/index.html` : `etfs/categories/${category.slug}/index.html`, {
          titleEn: `Best ${category.en} ETFs`,
          titleAr: `أفضل صناديق ${category.ar}`,
          descEn: `${category.descEn} Ranked by TradeAlpha Score with costs, performance and risk measured from observed prices.`,
          descAr: `${category.descAr} مرتبة حسب مؤشر TradeAlpha مع التكاليف والأداء والمخاطر المقاسة من الأسعار المرصودة.`,
          eyebrowEn: 'Category', eyebrowAr: 'فئة',
          trail: [[ar ? 'الفئات' : 'Categories', ar ? '/ar/etfs/categories/' : '/etfs/categories/'], [ar ? category.ar : category.en, null]],
          body: categoryBody(ar, category, data),
        });
    }
  }
  return pages;
}

function main() {
  shell.writePages(buildPages(), 'etf-center-pages');
}

if (require.main === module) main();

module.exports = { buildPages, CATEGORIES, categoryMembers };
