'use strict';

// ETF Intelligence Center — /etfs/rankings/ (+ Arabic).
//
// Rankings are orderings of measured values. Every covered fund appears in every
// ranking: those with a measured value are ordered and numbered, and those whose
// measure is awaiting a verified source are listed below the ranked block with
// an explicit status. Nothing is dropped for want of data, and nothing missing
// is treated as a zero or a poor result.
//
// On "largest": fund size has no free verifiable source, so no ranking claims to
// order funds by size. Observed median daily turnover is published under its own
// name — "most traded" — which is what it actually measures.
//
// Usage: node tools/generate-etf-rankings-pages.js [--write]

const fs = require('fs');
const path = require('path');

const shell = require('./etf-center-shell');
const { esc, tr, pct, signedPct, compact } = shell;
const { UNIVERSE } = require('./etf-universe');
const P = require('./etf-provenance');
const { CATEGORIES, categoryMembers } = require('./generate-etf-center-pages');

const ROOT = shell.ROOT;
const J = (name) => path.join(ROOT, 'data/intelligence', name);
const LIMIT = 10;

function readJson(name, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(J(name), 'utf8')); } catch { return fallback; }
}

function indexBySlug(artifact) {
  return new Map(((artifact && artifact.etfs) || []).map((e) => [e.slug, e]));
}

const detailHref = (ar, slug) => `${ar ? '/ar' : ''}/research/etfs/${slug}/`;

/** Display name for a fund, from the verified fund name where one exists. */
function nameFor(entry, data) {
  const facts = data.facts.get(entry.slug);
  return facts && P.hasValue(facts.fields.fund_name) ? facts.fields.fund_name.value : entry.ticker;
}

/**
 * Ranking definitions.
 *
 * `value` returns the sortable number, or null when the measure is awaiting a
 * verified source. Null never means zero — it routes the fund into the awaiting
 * block instead of the ranked block.
 */
const RANKINGS = [
  {
    slug: 'lowest-cost', en: 'Lowest Cost', ar: 'الأقل تكلفة',
    metricEn: 'Total expense ratio', metricAr: 'نسبة المصاريف الإجمالية',
    descEn: 'Covered funds ordered by total expense ratio, cheapest first. Cost is the one input a long-term holder controls directly.',
    descAr: 'الصناديق المغطاة مرتبة حسب نسبة المصاريف الإجمالية، من الأرخص. والتكلفة هي المدخل الوحيد الذي يتحكم فيه المستثمر طويل الأجل مباشرة.',
    direction: 'asc',
    value: (e, d) => {
      const f = d.facts.get(e.slug);
      return f && P.hasValue(f.fields.ter_pct) ? f.fields.ter_pct.value : null;
    },
    format: (v) => `${v}%`,
  },
  {
    slug: 'most-traded', en: 'Most Traded', ar: 'الأكثر تداولا',
    metricEn: 'Median daily turnover', metricAr: 'وسيط قيمة التداول اليومية',
    descEn: 'Ordered by observed median daily turnover over the trailing year. This measures trading activity on the listing, not fund size — the two are related but not the same.',
    descAr: 'مرتبة حسب وسيط قيمة التداول اليومية المرصودة خلال السنة الماضية. وهذا يقيس نشاط التداول على الإدراج، لا حجم الصندوق — وهما مرتبطان لكنهما ليسا الشيء نفسه.',
    direction: 'desc',
    value: (e, d) => { const a = d.analytics.get(e.slug); return a && a.available && a.liquidity ? a.liquidity.median_daily_turnover : null; },
    format: (v, e, d) => { const a = d.analytics.get(e.slug); return `${compact(v)} ${a && a.currency ? a.currency : ''}`.trim(); },
  },
  {
    slug: 'highest-score', en: 'Strongest Structural Scores', ar: 'أقوى الدرجات الهيكلية',
    metricEn: 'TradeAlpha Score', metricAr: 'مؤشر TradeAlpha',
    descEn: 'Ordered by the TradeAlpha Score, which measures breadth, liquidity, tracking and structure from evidenced inputs. It describes fund quality, not expected return.',
    descAr: 'مرتبة حسب مؤشر TradeAlpha الذي يقيس الاتساع والسيولة والتتبع والبنية من مدخلات مُثبتة. وهو يصف جودة الصندوق لا العائد المتوقع.',
    direction: 'desc',
    value: (e, d) => { const s = d.score.get(e.slug); return s && s.overall !== null ? s.overall : null; },
    format: (v) => `${v}/100`,
  },
  {
    slug: 'lowest-volatility', en: 'Lowest Volatility', ar: 'الأقل تذبذبا',
    metricEn: 'Trailing 1-year volatility', metricAr: 'تذبذب السنة الماضية',
    descEn: 'Ordered by annualised volatility over the trailing year, calmest first. Low past volatility is a historical measurement, not a promise of stability.',
    descAr: 'مرتبة حسب التذبذب السنوي خلال السنة الماضية، من الأهدأ. وانخفاض التذبذب السابق قياس تاريخي وليس وعدا بالاستقرار.',
    direction: 'asc',
    value: (e, d) => { const a = d.analytics.get(e.slug); return a && a.available ? a.risk.volatility_1y : null; },
    format: (v) => pct(v),
  },
  {
    slug: 'shallowest-drawdown', en: 'Shallowest Drawdowns', ar: 'الأقل تراجعا',
    metricEn: 'Maximum observed drawdown', metricAr: 'أقصى تراجع مرصود',
    descEn: 'Ordered by the deepest peak-to-trough decline in the observed window, shallowest first. Different funds have different observation windows.',
    descAr: 'مرتبة حسب أعمق هبوط من القمة إلى القاع ضمن النافذة المرصودة، من الأقل. وتختلف نوافذ الرصد بين الصناديق.',
    direction: 'desc',
    value: (e, d) => { const a = d.analytics.get(e.slug); return a && a.available ? a.risk.max_drawdown : null; },
    format: (v) => pct(v),
  },
];

const CATEGORY_RANKINGS = ['long-term', 'dividend', 'ai', 'gold', 'emerging-markets', 'bonds'];

/** Split a fund list into ranked rows and awaiting rows. */
function partition(entries, ranking, data) {
  const measured = [];
  const awaiting = [];
  for (const entry of entries) {
    const value = ranking.value(entry, data);
    if (Number.isFinite(value)) measured.push({ entry, value });
    else awaiting.push({ entry });
  }
  measured.sort((a, b) => (ranking.direction === 'asc' ? a.value - b.value : b.value - a.value));
  return { measured, awaiting };
}

function unmeasuredPanel(ar, ranking, split, data) {
  const t = tr(ar);
  const chips = split.awaiting.map(({ entry }) => `<a class="etf-chip" href="${esc(detailHref(ar, entry.slug))}">${esc(entry.ticker)}</a>`).join('');
  return `<div class="market-panel">
          <p class="market-copy">${esc(t(
    `This ranking orders funds by ${ranking.metricEn.toLowerCase()}. No free verifiable source publishes that figure today, so no fund can yet be ranked and the order is withheld rather than invented.`,
    `يرتّب هذا الجدول الصناديق حسب ${ranking.metricAr}. ولا يوجد مصدر مجاني موثّق ينشر هذا الرقم اليوم، لذا لا يمكن ترتيب أي صندوق بعد، ويُحجب الترتيب بدلا من اختلاقه.`,
  ))}</p>
          <p class="market-copy">${esc(t(
    `All ${split.awaiting.length} covered funds are listed below and remain fully researched — every other measurement on their pages is unaffected.`,
    `جميع الصناديق المغطاة البالغة ${split.awaiting.length} مدرجة أدناه ويظل بحثها كاملا — فبقية القياسات في صفحاتها غير متأثرة.`,
  ))}</p>
          <div class="etf-chips" style="margin-block-start:16px">${chips}</div>
          <p class="etf-pending-note">${esc(t(
    'This ranking populates automatically once a verified source for the measure is connected.',
    'يُعبَّأ هذا الترتيب تلقائيا فور ربط مصدر موثّق لهذا المقياس.',
  ))} <a href="${ar ? '/ar/etfs/data-audit/' : '/etfs/data-audit/'}">${esc(t('Data audit', 'تدقيق البيانات'))}</a></p>
        </div>`;
}

function rankingTable(ar, ranking, split, data) {
  const t = tr(ar);
  const awaitingLabel = t(P.AWAITING_EN, P.AWAITING_AR);
  if (!split.measured.length) return unmeasuredPanel(ar, ranking, split, data);

  const rankedRows = split.measured.slice(0, LIMIT).map((row, index) => {
    const { entry, value } = row;
    const score = data.score.get(entry.slug);
    const analytics = data.analytics.get(entry.slug);
    const oneYear = analytics && analytics.available ? analytics.performance.cumulative['1y'] : null;
    return `<tr>
            <td class="num">${index + 1}</td>
            <td><a href="${esc(detailHref(ar, entry.slug))}"><strong>${esc(entry.ticker)}</strong></a><br /><span class="etf-source">${esc(nameFor(entry, data))}</span></td>
            <td class="num"><strong>${esc(ranking.format(value, entry, data))}</strong></td>
            <td class="num">${score && score.overall !== null ? score.overall : `<span class="etf-awaiting">${esc(awaitingLabel)}</span>`}</td>
            ${oneYear === null ? `<td class="num"><span class="etf-awaiting">${esc(awaitingLabel)}</span></td>` : `<td class="num ${oneYear >= 0 ? 'positive' : 'negative'}">${esc(signedPct(oneYear))}</td>`}
          </tr>`;
  }).join('\n          ');

  // Funds without the measure are listed, not deleted. They carry no rank number
  // because they have not been ranked — only an explicit status.
  const awaitingRows = split.awaiting.map((row) => {
    const { entry } = row;
    const score = data.score.get(entry.slug);
    const analytics = data.analytics.get(entry.slug);
    const oneYear = analytics && analytics.available ? analytics.performance.cumulative['1y'] : null;
    return `<tr class="etf-row-awaiting">
            <td class="num"></td>
            <td><a href="${esc(detailHref(ar, entry.slug))}"><strong>${esc(entry.ticker)}</strong></a><br /><span class="etf-source">${esc(nameFor(entry, data))}</span></td>
            <td class="num"><span class="etf-awaiting">${esc(awaitingLabel)}</span></td>
            <td class="num">${score && score.overall !== null ? score.overall : ''}</td>
            ${oneYear === null ? `<td class="num"><span class="etf-awaiting">${esc(awaitingLabel)}</span></td>` : `<td class="num ${oneYear >= 0 ? 'positive' : 'negative'}">${esc(signedPct(oneYear))}</td>`}
          </tr>`;
  }).join('\n          ');

  const rankedBlock = split.measured.length
    ? rankedRows
    : `<tr><td colspan="5" class="etf-empty">${esc(t(
      'No covered fund has a verified value for this measure yet. Every fund is listed below awaiting verified data.',
      'لا يوجد صندوق مغطى له قيمة موثّقة لهذا المقياس بعد. وجميع الصناديق مدرجة أدناه بانتظار بيانات موثّقة.',
    ))}</td></tr>`;

  const separator = split.awaiting.length && split.measured.length
    ? `<tr><td colspan="5" class="etf-source" style="padding-block:14px">${esc(t(
      `${split.awaiting.length} covered fund(s) awaiting a verified value for this measure:`,
      `${split.awaiting.length} صندوقا مغطى بانتظار قيمة موثّقة لهذا المقياس:`,
    ))}</td></tr>`
    : '';

  return `<div class="etf-table-wrap"><table class="etf-table">
          <thead><tr>
            <th scope="col" class="num">#</th>
            <th scope="col">${esc(t('Fund', 'الصندوق'))}</th>
            <th scope="col" class="num">${esc(ar ? ranking.metricAr : ranking.metricEn)}</th>
            <th scope="col" class="num">${esc(t('Score', 'الدرجة'))}</th>
            <th scope="col" class="num">${esc(t('1Y return', 'عائد سنة'))}</th>
          </tr></thead>
          <tbody>
          ${rankedBlock}
          ${separator}
          ${awaitingRows}
          </tbody>
        </table></div>`;
}

function section(id, eyebrow, title, inner, lead) {
  return `      <section class="market-section" id="${id}">
        <div class="market-section-head"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>
        ${lead ? `<p class="market-copy">${esc(lead)}</p>` : ''}
        ${inner}
      </section>`;
}

function coverageNote(ar, split, total) {
  const t = tr(ar);
  if (!split.awaiting.length) return '';
  // When nothing is measured the explanatory panel already carries this; a
  // second copy underneath just repeats it.
  if (!split.measured.length) return '';
  return `<div class="etf-note">${esc(t(
    `${split.measured.length} of ${total} covered funds have a verified value for this measure. The remaining ${split.awaiting.length} are listed with an explicit status rather than removed — an absent value is not a poor one, and hiding those funds would misrepresent the coverage.`,
    `${split.measured.length} من ${total} صندوقا مغطى لديها قيمة موثّقة لهذا المقياس. أما الـ${split.awaiting.length} المتبقية فتُدرج مع حالة صريحة بدلا من حذفها — فالقيمة الغائبة ليست قيمة سيئة، وإخفاء تلك الصناديق يشوّه صورة التغطية.`,
  ))}</div>`;
}

function rankingsIndexBody(ar, data) {
  const t = tr(ar);
  const cards = RANKINGS.map((ranking) => {
    const href = ar ? `/ar/etfs/rankings/${ranking.slug}/` : `/etfs/rankings/${ranking.slug}/`;
    const split = partition(UNIVERSE, ranking, data);
    const status = split.measured.length
      ? `${split.measured.length}/${UNIVERSE.length} ${t('measured', 'مقاسة')}`
      : t(P.AWAITING_EN, P.AWAITING_AR);
    return `          <a class="market-card etf-card-link" href="${esc(href)}">
            <span class="market-card-kicker">${esc(status)}</span>
            <h3>${esc(ar ? ranking.ar : ranking.en)}</h3>
            <p class="market-copy">${esc(ar ? ranking.descAr : ranking.descEn)}</p>
          </a>`;
  }).join('\n');

  const categoryCards = CATEGORY_RANKINGS.map((slug) => {
    const category = CATEGORIES.find((c) => c.slug === slug);
    if (!category) return '';
    // Only link rankings that are actually generated - see the >=3 member rule.
    const members = categoryMembers(category, data);
    if (members.length < 3) return '';
    const href = ar ? `/ar/etfs/rankings/top-${slug}/` : `/etfs/rankings/top-${slug}/`;
    return `          <a class="market-card etf-card-link" href="${esc(href)}">
            <span class="market-card-kicker">${members.length} ${esc(t('funds', 'صندوقا'))}</span>
            <h3>${esc(t(`Top ${category.en}`, `أعلى ${category.ar}`))}</h3>
            <p class="market-copy">${esc(ar ? category.descAr : category.descEn)}</p>
          </a>`;
  }).filter(Boolean).join('\n');

  return [
    section('etf-rankings-measures', t('Rankings', 'الترتيبات'), t('By measured value', 'حسب القيمة المقاسة'),
      `<div class="etf-grid">\n${cards}\n        </div>`,
      t('Each ranking sorts on one measured field, named at the top of the page. Funds whose value is awaiting a verified source are listed with that status rather than removed.', 'يرتّب كل جدول حسب حقل مقاس واحد يُذكر اسمه أعلى الصفحة. وتُدرج الصناديق التي تنتظر قيمتها مصدرا موثّقا مع بيان تلك الحالة بدلا من حذفها.')),
    section('etf-rankings-categories', t('By category', 'حسب الفئة'), t('Strongest in each exposure', 'الأقوى في كل نوع تعرض'),
      `<div class="etf-grid">\n${categoryCards}\n        </div>`),
  ].join('\n');
}

// What each measure does and does not tell a reader. A ranked table on its own
// invites over-reading; this is the context that makes the ordering usable.
const RANKING_NOTES = {
  'lowest-cost': [
    'Cost is the most reliable predictor of long-run relative outcome among funds tracking the same index, because it is charged with certainty every year.',
    'It says nothing about whether two funds hold the same thing. A cheap sector fund and an expensive world fund are not alternatives.',
    'التكلفة هي المؤشر الأكثر موثوقية للنتيجة النسبية طويلة الأجل بين صناديق تتبع المؤشر نفسه، لأنها تُحتسب بشكل مؤكد كل عام.',
    'لكنها لا تقول شيئا عمّا إذا كان الصندوقان يحتفظان بالشيء نفسه. فالصندوق القطاعي الرخيص والصندوق العالمي الأغلى ليسا بديلين.',
  ],
  'most-traded': [
    'Higher turnover generally means tighter spreads, so the cost of entering and leaving a position is lower.',
    'Turnover is measured on one listing. A fund can trade lightly on one exchange and heavily on another, and this is not a measure of fund size.',
    'ارتفاع قيمة التداول يعني عادة فروق أسعار أضيق، ما يخفّض تكلفة الدخول والخروج من المركز.',
    'وتُقاس قيمة التداول على إدراج واحد. فقد يُتداول الصندوق بخفة في بورصة وبكثافة في أخرى، وهي ليست مقياسا لحجم الصندوق.',
  ],
  'highest-score': [
    'The score combines breadth, liquidity, tracking and structure into one figure, using only inputs the platform can evidence.',
    'It describes how a fund is built, not how it will perform. Two funds with similar scores can hold entirely different things.',
    'يجمع المؤشر بين الاتساع والسيولة والتتبع والبنية في رقم واحد، باستخدام مدخلات تستطيع المنصة إثباتها فقط.',
    'وهو يصف كيف بُني الصندوق لا كيف سيؤدي. فقد يحتفظ صندوقان بدرجات متقاربة بأشياء مختلفة تماما.',
  ],
  'lowest-volatility': [
    'Volatility measures how widely returns have scattered, which is a reasonable proxy for how uncomfortable holding a fund has been.',
    'It is backward-looking and regime-dependent. A fund can be calm for years and then not be.',
    'يقيس التذبذب مدى تشتت العوائد، وهو مؤشر معقول لمدى صعوبة الاحتفاظ بالصندوق نفسيا.',
    'لكنه ينظر إلى الماضي ويعتمد على النظام السائد. فقد يهدأ صندوق لسنوات ثم يتوقف عن ذلك.',
  ],
  'shallowest-drawdown': [
    'Maximum drawdown is often the more useful risk figure, because it describes the worst outcome that actually occurred rather than an average.',
    'Windows differ between funds. A fund listed after a crash has not been tested by it, so a shallow figure can reflect a short history.',
    'غالبا ما يكون أقصى تراجع رقم المخاطر الأنفع، لأنه يصف أسوأ ما حدث فعلا لا متوسطا.',
    'وتختلف النوافذ بين الصناديق. فالصندوق المدرج بعد انهيار لم يُختبر به، لذا قد يعكس الرقم الضحل تاريخا قصيرا.',
  ],
};

function rankingContext(ar, ranking, currentSlug) {
  const t = tr(ar);
  const note = RANKING_NOTES[ranking.slug];
  const useful = note ? `<article class="market-card"><h3>${esc(t('What it tells you', 'ما الذي يخبرك به'))}</h3><p class="market-copy">${esc(ar ? note[2] : note[0])}</p></article>` : '';
  const limit = note ? `<article class="market-card"><h3>${esc(t('What it does not', 'وما لا يخبرك به'))}</h3><p class="market-copy">${esc(ar ? note[3] : note[1])}</p></article>` : '';
  if (!useful) return '';

  const others = RANKINGS.filter((r) => r.slug !== currentSlug)
    .map((r) => `<a class="etf-chip" href="${esc(ar ? `/ar/etfs/rankings/${r.slug}/` : `/etfs/rankings/${r.slug}/`)}">${esc(ar ? r.ar : r.en)}</a>`).join('');

  return `      <section class="market-section" id="etf-ranking-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Reading this ranking', 'قراءة هذا الترتيب'))}</span><h2>${esc(t('What the order means', 'ماذا يعني هذا الترتيب'))}</h2></div>
        <div class="etf-grid">
          ${useful}
          ${limit}
        </div>
      </section>
      <section class="market-section" id="etf-ranking-related">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Related', 'ذات صلة'))}</span><h2>${esc(t('Other rankings', 'ترتيبات أخرى'))}</h2></div>
        <div class="market-panel">
          <div class="etf-chips">${others}</div>
          <p class="market-copy" style="margin-block-start:14px"><a href="${esc(ar ? '/ar/etfs/finder/' : '/etfs/finder/')}">${esc(t('Filter the full universe', 'رشّح العالم الكامل'))}</a> &middot; <a href="${esc(ar ? '/ar/etfs/compare/' : '/etfs/compare/')}">${esc(t('Compare side by side', 'قارن جنبا إلى جنب'))}</a> &middot; <a href="${esc(ar ? '/ar/etfs/methodology/' : '/etfs/methodology/')}">${esc(t('How the score works', 'كيف يعمل المؤشر'))}</a></p>
        </div>
      </section>`;
}

function buildPages() {
  const data = {
    facts: indexBySlug(readJson('etf-facts.json')),
    analytics: indexBySlug(readJson('etf-analytics.json')),
    score: indexBySlug(readJson('etf-score.json')),
  };

  const pages = [];
  const push = (ar, slugPath, out, opts) => {
    pages.push({ out: path.join(ROOT, out), html: shell.page({ ar, slugPath, ...opts }) });
  };

  for (const ar of [false, true]) {
    push(ar, 'etfs/rankings/', ar ? 'ar/etfs/rankings/index.html' : 'etfs/rankings/index.html', {
      titleEn: 'ETF Rankings',
      titleAr: 'ترتيبات صناديق المؤشرات',
      descEn: 'ETFs ordered by measured values: lowest cost, most traded, strongest structural score, lowest volatility and shallowest drawdowns.',
      descAr: 'صناديق المؤشرات مرتبة حسب قيم مقاسة: الأقل تكلفة، الأكثر تداولا، أقوى درجة هيكلية، الأقل تذبذبا والأقل تراجعا.',
      eyebrowEn: 'Rankings', eyebrowAr: 'الترتيبات',
      trail: [[ar ? 'الترتيبات' : 'Rankings', null]],
      body: rankingsIndexBody(ar, data),
    });

    for (const ranking of RANKINGS) {
      const split = partition(UNIVERSE, ranking, data);
      push(ar, `etfs/rankings/${ranking.slug}/`,
        ar ? `ar/etfs/rankings/${ranking.slug}/index.html` : `etfs/rankings/${ranking.slug}/index.html`, {
          titleEn: `${ranking.en} ETFs`,
          titleAr: `صناديق ${ranking.ar}`,
          descEn: ranking.descEn,
          descAr: ranking.descAr,
          eyebrowEn: 'Ranking', eyebrowAr: 'ترتيب',
          trail: [[ar ? 'الترتيبات' : 'Rankings', ar ? '/ar/etfs/rankings/' : '/etfs/rankings/'], [ar ? ranking.ar : ranking.en, null]],
          body: section(`etf-ranking-${ranking.slug}`,
            ar ? ranking.metricAr : ranking.metricEn,
            ar ? ranking.ar : ranking.en,
            rankingTable(ar, ranking, split, data) + coverageNote(ar, split, UNIVERSE.length),
            ar ? ranking.descAr : ranking.descEn) + rankingContext(ar, ranking, ranking.slug),
        });
    }

    const scoreRanking = RANKINGS.find((r) => r.slug === 'highest-score');
    for (const slug of CATEGORY_RANKINGS) {
      const category = CATEGORIES.find((c) => c.slug === slug);
      if (!category) continue;
      const members = categoryMembers(category, data);
      // Ordering one or two funds is not a ranking; those categories are served
      // by their own category page instead.
      if (members.length < 3) continue;
      const split = partition(members, scoreRanking, data);
      push(ar, `etfs/rankings/top-${slug}/`,
        ar ? `ar/etfs/rankings/top-${slug}/index.html` : `etfs/rankings/top-${slug}/index.html`, {
          titleEn: `Top ${category.en} ETFs`,
          titleAr: `أعلى صناديق ${category.ar}`,
          descEn: `${category.descEn} Ordered by TradeAlpha Score, which measures structural quality rather than expected return.`,
          descAr: `${category.descAr} مرتبة حسب مؤشر TradeAlpha الذي يقيس الجودة الهيكلية لا العائد المتوقع.`,
          eyebrowEn: 'Category ranking', eyebrowAr: 'ترتيب الفئة',
          trail: [[ar ? 'الترتيبات' : 'Rankings', ar ? '/ar/etfs/rankings/' : '/etfs/rankings/'], [ar ? category.ar : category.en, null]],
          body: section(`etf-ranking-top-${slug}`,
            tr(ar)('TradeAlpha Score', 'مؤشر TradeAlpha'),
            tr(ar)(`Top ${category.en}`, `أعلى ${category.ar}`),
            rankingTable(ar, scoreRanking, split, data) + coverageNote(ar, split, members.length),
            ar ? category.descAr : category.descEn)
            + rankingContext(ar, scoreRanking, 'highest-score')
            + `      <section class="market-section" id="etf-ranking-category-link">
        <div class="market-panel"><p class="market-copy">${esc(tr(ar)(
      `Every ${category.en.toLowerCase()} fund the Center covers, together with the criteria that separate them, is on the category page.`,
      `كل صناديق ${category.ar} التي يغطيها المركز، مع المعايير التي تميّزها، موجودة في صفحة الفئة.`,
    ))} <a href="${esc(ar ? `/ar/etfs/categories/${slug}/` : `/etfs/categories/${slug}/`)}">${esc(tr(ar)(category.en, category.ar))}</a></p></div>
      </section>`,
        });
    }
  }
  return pages;
}

function main() {
  shell.writePages(buildPages(), 'etf-rankings-pages');
}

if (require.main === module) main();

module.exports = { buildPages, RANKINGS, partition };
