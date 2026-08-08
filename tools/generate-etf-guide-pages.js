'use strict';

// ETF Intelligence Center — /etfs/portfolios/ and /etfs/learn/ (+ Arabic).
//
// PORTFOLIOS are illustrative allocation *models* used to teach how exposures
// combine. They are labelled educational throughout, carry no suggestion that
// any reader should hold them, and every constituent links to its own research
// page so the reader can check the fund rather than trust the model.
//
// LEARN is the conceptual layer: what the structures mean and how to read the
// measurements published elsewhere in the Center.
//
// Usage: node tools/generate-etf-guide-pages.js [--write]

const fs = require('fs');
const path = require('path');

const shell = require('./etf-center-shell');
const { esc, tr, stat } = shell;
const { UNIVERSE, BY_SLUG } = require('./etf-universe');
const P = require('./etf-provenance');

const ROOT = shell.ROOT;
const J = (name) => path.join(ROOT, 'data/intelligence', name);

function readJson(name, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(J(name), 'utf8')); } catch { return fallback; }
}

function indexBySlug(artifact) {
  return new Map(((artifact && artifact.etfs) || []).map((e) => [e.slug, e]));
}

const detailHref = (ar, slug) => `${ar ? '/ar' : ''}/research/etfs/${slug}/`;

// ---------------------------------------------------------------------------
// Allocation models
// ---------------------------------------------------------------------------
// Weights must total 100. Each model explains the idea it illustrates and what
// it deliberately gives up — a model with no stated trade-off reads as advice.

const MODELS = [
  {
    slug: 'single-fund-global',
    en: 'Single-fund global', ar: 'صندوق عالمي واحد',
    ideaEn: 'One fund holding developed and emerging markets together. The simplest structure that still spans most of the investable world.',
    ideaAr: 'صندوق واحد يجمع الأسواق المتقدمة والناشئة معا. وهي أبسط بنية تغطي مع ذلك معظم العالم القابل للاستثمار.',
    tradeoffEn: 'No control over the developed/emerging split, and no bond or commodity component to soften equity drawdowns.',
    tradeoffAr: 'لا تحكّم في توزيع الأسواق المتقدمة والناشئة، ولا مكوّن سندات أو سلع لتخفيف تراجعات الأسهم.',
    holdings: [['vwce', 100]],
  },
  {
    slug: 'developed-plus-emerging',
    en: 'Developed core plus emerging', ar: 'نواة متقدمة مع الناشئة',
    ideaEn: 'A developed-market core held alongside a separate emerging-market fund, so the split between them is an explicit decision rather than an index outcome.',
    ideaAr: 'نواة من الأسواق المتقدمة تُحتفظ إلى جانب صندوق منفصل للأسواق الناشئة، بحيث يصبح التوزيع بينهما قرارا صريحا لا نتيجة لتركيب المؤشر.',
    tradeoffEn: 'Two funds to hold and periodically rebalance instead of one, and two sets of costs.',
    tradeoffAr: 'صندوقان يجب الاحتفاظ بهما وإعادة موازنتهما دوريا بدلا من واحد، ومجموعتان من التكاليف.',
    holdings: [['iwda', 88], ['eimi', 12]],
  },
  {
    slug: 'equity-and-bonds',
    en: 'Global equity with bonds', ar: 'أسهم عالمية مع سندات',
    ideaEn: 'A global equity core with an aggregate bond allocation. The classic structure for reducing the depth of equity drawdowns.',
    ideaAr: 'نواة أسهم عالمية مع تخصيص للسندات التجميعية. وهي البنية الكلاسيكية لتقليل عمق تراجعات الأسهم.',
    tradeoffEn: 'Bonds carry their own interest-rate risk — the bond funds covered here have had deep drawdowns of their own during rate increases.',
    tradeoffAr: 'تحمل السندات مخاطر أسعار الفائدة الخاصة بها — فقد شهدت صناديق السندات المغطاة هنا تراجعات عميقة خلال فترات رفع الفائدة.',
    holdings: [['vwce', 80], ['bnd', 20]],
  },
  {
    slug: 'equity-and-gold',
    en: 'Global equity with gold', ar: 'أسهم عالمية مع ذهب',
    ideaEn: 'A global equity core with a commodity sleeve. Gold has historically shown low correlation to equities in the measured window.',
    ideaAr: 'نواة أسهم عالمية مع شريحة سلعية. وقد أظهر الذهب تاريخيا ارتباطا منخفضا بالأسهم ضمن النافذة المقاسة.',
    tradeoffEn: 'Gold produces no income and has been more volatile than broad equity indices over the observed period.',
    tradeoffAr: 'لا يدرّ الذهب دخلا، وقد كان أكثر تذبذبا من مؤشرات الأسهم الواسعة خلال الفترة المرصودة.',
    holdings: [['vwce', 85], ['gld', 15]],
  },
  {
    slug: 'core-and-satellite',
    en: 'Core and satellite', ar: 'النواة والأقمار',
    ideaEn: 'A broad, low-cost core surrounded by smaller thematic or sector positions. Illustrates how concentration can be bounded to a fixed share of a portfolio.',
    ideaAr: 'نواة واسعة منخفضة التكلفة تحيط بها مراكز موضوعية أو قطاعية أصغر. ويوضح هذا كيف يمكن حصر التركّز في حصة ثابتة من المحفظة.',
    tradeoffEn: 'The satellites raise the blended cost and add concentrated risk that the core does not offset.',
    tradeoffAr: 'ترفع الأقمار التكلفة المجمّعة وتضيف مخاطر مركّزة لا تعوّضها النواة.',
    holdings: [['vwce', 70], ['xlk', 15], ['soxx', 15]],
  },
  {
    slug: 'income-oriented',
    en: 'Income-oriented', ar: 'موجّه نحو الدخل',
    ideaEn: 'Dividend-focused equity alongside investment-grade credit, illustrating a structure built around distributions rather than accumulation.',
    ideaAr: 'أسهم تركّز على التوزيعات إلى جانب ائتمان استثماري، ما يوضح بنية قائمة على التوزيعات بدلا من التراكم.',
    tradeoffEn: 'Dividend screens narrow the opportunity set, and distributions may be taxable on receipt depending on where the holder lives.',
    tradeoffAr: 'تضيّق مرشحات التوزيعات نطاق الفرص، وقد تخضع التوزيعات للضريبة عند استلامها تبعا لمكان إقامة المستثمر.',
    holdings: [['schd', 60], ['lqd', 25], ['vig', 15]],
  },
  {
    slug: 'growth-tilt',
    en: 'Growth tilt', ar: 'ميل نحو النمو',
    ideaEn: 'A broad core deliberately tilted toward growth-classified equity. Illustrates what a factor tilt does to a portfolio: it concentrates the bet on one style rather than adding breadth.',
    ideaAr: 'نواة واسعة مع ميل متعمد نحو الأسهم المصنفة كأسهم نمو. ويوضح هذا ما يفعله الميل العاملي بالمحفظة: فهو يركّز الاعتماد على نمط واحد بدلا من إضافة اتساع.',
    tradeoffEn: 'Growth-classified funds in this universe have shown higher volatility and deeper drawdowns than the broad market. A tilt raises both, and it can underperform the very index it is built from for long stretches.',
    tradeoffAr: 'أظهرت صناديق النمو في هذا العالم تذبذبا أعلى وتراجعات أعمق من السوق الواسع. والميل يرفع الاثنين، وقد يتخلف عن المؤشر نفسه الذي بُني منه لفترات طويلة.',
    holdings: [['vwce', 70], ['vug', 20], ['qqq', 10]],
  },
  {
    slug: 'defensive',
    en: 'Defensive', ar: 'دفاعي',
    ideaEn: 'A structure weighted toward sectors and instruments whose measured drawdowns have been shallower than the broad market. Illustrates trading expected participation for a smoother observed path.',
    ideaAr: 'بنية مرجّحة نحو قطاعات وأدوات كانت تراجعاتها المقاسة أقل عمقا من السوق الواسع. ويوضح هذا مقايضة المشاركة المتوقعة بمسار مرصود أكثر سلاسة.',
    tradeoffEn: 'Defensive positioning has historically lagged in rising markets, and "defensive" describes past behaviour rather than a property that must persist. Bond holdings carry their own interest-rate risk.',
    tradeoffAr: 'تخلّف التمركز الدفاعي تاريخيا في الأسواق الصاعدة، و"الدفاعي" يصف سلوكا سابقا لا خاصية يجب أن تستمر. كما تحمل السندات مخاطر أسعار الفائدة الخاصة بها.',
    holdings: [['vwce', 45], ['bnd', 30], ['xlv', 15], ['gld', 10]],
  },
];

// Categorical slots from css/etf-center.css, assigned in fixed order.
const SLOT_COLORS = ['var(--etf-cat-1)', 'var(--etf-cat-2)', 'var(--etf-cat-3)', 'var(--etf-cat-4)', 'var(--etf-cat-5)'];

const modelHoldings = (model) => model.holdings
  .map(([slug, weight]) => ({ entry: BY_SLUG.get(slug), weight, slug }))
  .filter((h) => h.entry);

// Blended cost, computed only when every constituent publishes a TER. Returns
// complete:false when any one is awaiting data, because a cost blended over a
// subset of the allocation would understate it while looking authoritative.
function blendedCost(holdings, data) {
  let blended = 0;
  for (const holding of holdings) {
    const facts = data.facts.get(holding.slug);
    const ter = facts && P.hasValue(facts.fields.ter_pct) ? facts.fields.ter_pct.value : null;
    if (ter === null) return { blended: 0, complete: false };
    blended += ter * (holding.weight / 100);
  }
  return { blended, complete: true };
}

function modelCard(ar, model, data) {
  const t = tr(ar);
  const holdings = modelHoldings(model);
  if (!holdings.length) return '';

  const { blended, complete } = blendedCost(holdings, data);

  const segments = holdings.map((h, i) => `<span class="etf-alloc-seg" style="inline-size:${h.weight}%;background:${SLOT_COLORS[i % SLOT_COLORS.length]}" title="${esc(h.entry.ticker)} ${h.weight}%"></span>`).join('');
  const legend = holdings.map((h, i) => `<span class="etf-legend-item"><span class="etf-legend-swatch" style="background:${SLOT_COLORS[i % SLOT_COLORS.length]}"></span><a href="${esc(detailHref(ar, h.slug))}">${esc(h.entry.ticker)}</a> <span class="etf-legend-value">${h.weight}%</span></span>`).join('');

  return `        <article class="market-panel" id="model-${esc(model.slug)}" style="margin-block-end:18px">
          <h3>${esc(ar ? model.ar : model.en)}</h3>
          <div class="etf-alloc" role="img" aria-label="${esc(holdings.map((h) => `${h.entry.ticker} ${h.weight}%`).join(', '))}">${segments}</div>
          <div class="etf-legend">${legend}</div>
          <p class="market-copy" style="margin-block-start:14px"><strong>${esc(t('What it illustrates', 'ما يوضّحه'))}:</strong> ${esc(ar ? model.ideaAr : model.ideaEn)}</p>
          <p class="market-copy"><strong>${esc(t('What it gives up', 'ما يتنازل عنه'))}:</strong> ${esc(ar ? model.tradeoffAr : model.tradeoffEn)}</p>
          <p class="etf-source">${esc(t('Constituents', 'المكوّنات'))}: ${holdings.map((h) => `<a href="${esc(detailHref(ar, h.slug))}">${esc(h.entry.ticker)}</a>`).join(' · ')} — ${esc(t('each with its own verified and awaiting-data status on its research page.', 'ولكل منها حالته الموثّقة أو المنتظِرة للبيانات في صفحة بحثه.'))}</p>
          ${complete
    ? `<div class="etf-grid narrow" style="margin-block-start:14px">${stat(t('Blended annual cost', 'التكلفة السنوية المجمّعة'), `${blended.toFixed(3)}%`, t('weighted by the allocation above', 'مرجّحة حسب التوزيع أعلاه'))}</div>`
    : ''}
        </article>`;
}

// Assumptions that apply to every model on the page. Stated once, prominently,
// because a weighted allocation implies a set of premises and a reader cannot
// evaluate the illustration without seeing them.
const MODEL_ASSUMPTIONS = [
  ['Weights are round numbers chosen for legibility, not optimisation output. Nothing here was fitted to historical returns.',
   'الأوزان أرقام صحيحة اختيرت للوضوح، وليست ناتج تحسين. ولم يُلائَم أي شيء هنا مع العوائد التاريخية.'],
  ['Every constituent is a fund the Center already covers, so each one links to its own measured evidence rather than being asserted here.',
   'كل مكوّن هو صندوق يغطيه المركز أصلا، لذا يرتبط كل منها بأدلته المقاسة بدلا من تأكيده هنا.'],
  ['No rebalancing schedule, contribution pattern, tax treatment or trading cost is modelled. Those change outcomes materially and depend on the individual.',
   'لا يُحتسب أي جدول لإعادة الموازنة أو نمط للمساهمات أو معاملة ضريبية أو تكلفة تداول. وهذه تغيّر النتائج جوهريا وتعتمد على الفرد.'],
  ['Combined historical return is deliberately not shown: constituents have different observation windows and trading currencies, so a blended back-test would measure that mismatch rather than the structure.',
   'لا يُعرض العائد التاريخي المجمّع عمدا: إذ تختلف نوافذ الرصد وعملات التداول بين المكوّنات، ما يجعل الاختبار الرجعي المجمّع يقيس هذا التباين لا البنية.'],
];

function assumptionsSection(ar) {
  const t = tr(ar);
  const items = MODEL_ASSUMPTIONS.map(([en, arText]) => `<li>${esc(ar ? arText : en)}</li>`).join('');
  return `      <section class="market-section" id="etf-model-assumptions">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Assumptions', 'الافتراضات'))}</span><h2>${esc(t('What these models assume', 'ما تفترضه هذه النماذج'))}</h2></div>
        <div class="market-panel"><ul class="market-copy">${items}</ul></div>
      </section>`;
}

// The models are illustrations on a public page. Nothing here reads a signed-in
// account, and choosing to hold something is an act only the holder can take.
function notYourPortfolioSection(ar) {
  const t = tr(ar);
  return `      <section class="market-section" id="etf-model-boundary">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Scope', 'النطاق'))}</span><h2>${esc(t('These are illustrations, not a portfolio', 'هذه أمثلة توضيحية وليست محفظة'))}</h2></div>
        <div class="market-panel">
          <p class="market-copy">${esc(t(
    'Nothing on this page is connected to any account. Opening it creates nothing, saves nothing and changes nothing. If you keep a portfolio on TradeAlphaAI, it contains only what you entered yourself — a model shown here is never copied into it, silently or otherwise.',
    'لا يرتبط أي شيء في هذه الصفحة بأي حساب. ففتحها لا يُنشئ شيئا ولا يحفظ شيئا ولا يغيّر شيئا. وإن كنت تحتفظ بمحفظة في TradeAlphaAI فهي تتضمن ما أدخلته بنفسك فقط — ولا يُنسخ أي نموذج معروض هنا إليها، لا ضمنا ولا غير ذلك.',
  ))}</p>
          <p class="market-copy">${esc(t(
    'There is no best portfolio on this page and no ranking between the models. Each shows a different structural trade-off; which trade-offs matter depends on circumstances this site cannot see.',
    'لا توجد محفظة أفضل في هذه الصفحة ولا ترتيب بين النماذج. فكل نموذج يُظهر مقايضة هيكلية مختلفة، وأي المقايضات تهم يعتمد على ظروف لا يستطيع هذا الموقع الاطلاع عليها.',
  ))}</p>
        </div>
      </section>`;
}

// Written out rather than rendered as a digit, because it reads as prose. Arabic
// numerals 3-10 take reverse gender agreement, so the same count needs two forms:
// `fem` attaches to a feminine plural (بنى), `masc` to a masculine one (نماذج).
// Covers the plausible range only; an 11th model falls back to a digit, which
// check:portfolio-pages rejects, so the omission surfaces rather than ships.
const COUNT_WORDS = {
  6: { en: 'Six', fem: 'ست', masc: 'ستة' },
  7: { en: 'Seven', fem: 'سبع', masc: 'سبعة' },
  8: { en: 'Eight', fem: 'ثماني', masc: 'ثمانية' },
  9: { en: 'Nine', fem: 'تسع', masc: 'تسعة' },
  10: { en: 'Ten', fem: 'عشر', masc: 'عشرة' },
};
const countEn = (n) => (COUNT_WORDS[n] ? COUNT_WORDS[n].en : String(n));
const countAr = (n, gender) => (COUNT_WORDS[n] ? COUNT_WORDS[n][gender] : String(n));

function portfoliosBody(ar, data) {
  const t = tr(ar);
  const rendered = MODELS.map((model) => ({ model, holdings: modelHoldings(model) }))
    .filter((m) => m.holdings.length);
  const cards = rendered.map(({ model }) => modelCard(ar, model, data)).filter(Boolean).join('\n');
  // How many models actually printed a cost figure decides which note is true.
  const withCost = rendered.filter((m) => blendedCost(m.holdings, data).complete).length;

  return `      <section class="market-section" id="etf-portfolios-intro">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Educational models', 'نماذج تعليمية'))}</span><h2>${esc(t('How exposures combine', 'كيف تتجمع أنواع التعرض'))}</h2></div>
        <div class="market-panel">
          <p class="market-copy">${esc(t(
    'These are teaching examples, not portfolios anyone is being pointed towards. Each one exists to show how a structural choice changes what a combination holds and what it gives up. The weights are round numbers chosen to make the idea legible.',
    'هذه أمثلة تعليمية، وليست محافظ يُوجَّه إليها أحد. ويهدف كل مثال إلى إظهار كيف يغيّر خيار هيكلي معين ما تحتويه التركيبة وما تتنازل عنه. والأوزان أرقام صحيحة اختيرت لجعل الفكرة واضحة.',
  ))}</p>
          <div class="etf-note">${esc(t(
    'Nothing here accounts for your circumstances, time horizon, tax residence or existing holdings — the things that actually determine whether any structure fits. TradeAlphaAI does not provide investment advice.',
    'لا يأخذ أي مما هنا في الحسبان ظروفك أو أفقك الزمني أو موطنك الضريبي أو ممتلكاتك الحالية — وهي العوامل التي تحدد فعليا ما إذا كانت أي بنية مناسبة. ولا تقدم TradeAlphaAI نصيحة استثمارية.',
  ))}</div>
        </div>
      </section>
${assumptionsSection(ar)}
${notYourPortfolioSection(ar)}
      <section class="market-section" id="etf-portfolios-models">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Models', 'النماذج'))}</span><h2>${esc(t(`${countEn(rendered.length)} illustrative structures`, `${countAr(rendered.length, 'fem')} بنى توضيحية`))}</h2></div>
${cards}
      </section>
      <section class="market-section" id="etf-portfolios-note">
        <div class="market-panel">
        <p class="etf-pending-note">${esc(withCost === 0
    ? t(
      'Blended annual cost is not shown for any model on this page: it requires a verified expense ratio for every constituent, and none of these models has a complete set today. Each model still shows exactly what it holds and in what proportion.',
      'لا تظهر التكلفة السنوية المجمّعة لأي نموذج في هذه الصفحة: فهي تتطلب نسبة مصاريف موثّقة لكل مكوّن، ولا يكتمل ذلك في أي من هذه النماذج اليوم. ويظل كل نموذج يعرض بدقة ما يحتويه وبأي نسبة.',
    )
    : t(
      'Blended annual cost is shown only for models whose every constituent publishes a verified expense ratio. Where it is absent, at least one constituent is still awaiting data, and blending over the rest would understate the figure. Each model still shows exactly what it holds and in what proportion.',
      'تظهر التكلفة السنوية المجمّعة فقط للنماذج التي تتوفر لكل مكوّناتها نسبة مصاريف موثّقة. وحيثما غابت، فذلك لأن أحد المكوّنات على الأقل ما زال ينتظر البيانات، وحساب المتوسط على البقية وحدها سيُظهر التكلفة أقل من حقيقتها. ويظل كل نموذج يعرض بدقة ما يحتويه وبأي نسبة.',
    ))}</p>
        <p class="market-copy">${esc(t(
    'Combined historical return is deliberately not shown for any model: constituents have different observation windows and trading currencies, so a blended back-test would be an artefact of those mismatches rather than a measurement.',
    'ولا يُعرض العائد التاريخي المجمّع عمدا لأي نموذج: إذ تختلف نوافذ الرصد وعملات التداول بين المكوّنات، ما يجعل أي اختبار رجعي مجمّع نتاجا لهذا التباين لا قياسا حقيقيا.',
  ))}</p></div>
      </section>`;
}

// ---------------------------------------------------------------------------
// Learn
// ---------------------------------------------------------------------------

const TOPICS = [
  {
    id: 'what-is-an-etf',
    en: 'What an ETF actually is', ar: 'ما هو صندوق المؤشرات فعليا',
    bodyEn: 'An ETF is a fund whose shares trade on an exchange like a single stock. Buying one share buys a proportional claim on everything the fund holds. Most of the funds covered here are index funds: they follow a published rule set rather than a manager\'s judgement, which is why their costs are low and their holdings predictable.',
    bodyAr: 'صندوق المؤشرات هو صندوق تُتداول أسهمه في البورصة مثل سهم مفرد. وشراء سهم واحد يعني شراء حصة نسبية في كل ما يملكه الصندوق. ومعظم الصناديق المغطاة هنا صناديق مؤشرات: تتبع مجموعة قواعد منشورة بدلا من اجتهاد مدير، ولهذا تنخفض تكاليفها وتصبح مكوناتها قابلة للتوقع.',
  },
  {
    id: 'ter',
    en: 'The expense ratio, and why it compounds', ar: 'نسبة المصاريف ولماذا تتراكم',
    bodyEn: 'The total expense ratio is deducted from fund assets continuously, not billed separately. A 0.20% fund costs roughly twenty times more per year than a 0.01% fund holding much the same thing. Because it is charged every year on the whole balance, the gap widens the longer a position is held — which is why the Center publishes cumulative fee drag alongside the headline percentage.',
    bodyAr: 'تُخصم نسبة المصاريف الإجمالية من أصول الصندوق باستمرار، ولا تُحصّل بفاتورة منفصلة. فالصندوق بنسبة 0.20% يكلّف سنويا نحو عشرين ضعف صندوق بنسبة 0.01% يملك الشيء نفسه تقريبا. ولأنها تُحتسب كل عام على الرصيد كاملا، تتسع الفجوة كلما طالت مدة الاحتفاظ — ولهذا ينشر المركز الأثر التراكمي للرسوم إلى جانب النسبة المعلنة.',
  },
  {
    id: 'accumulating-vs-distributing',
    en: 'Accumulating versus distributing', ar: 'التراكمي مقابل الموزِّع',
    bodyEn: 'An accumulating share class reinvests dividends inside the fund automatically. A distributing class pays them out as cash. The underlying portfolio is usually identical — VWCE and VWRL hold the same strategy, and the Center measures their long-run returns as effectively the same. The difference is what happens to the income, which matters for tax treatment and for whether reinvestment is manual.',
    bodyAr: 'تعيد الفئة التراكمية استثمار التوزيعات داخل الصندوق تلقائيا، بينما تدفعها الفئة الموزِّعة نقدا. وغالبا ما تكون المحفظة الأساسية متطابقة — فصندوقا VWCE وVWRL يتبعان الاستراتيجية نفسها، ويقيس المركز عوائدهما طويلة الأجل على أنها متطابقة عمليا. والفرق هو مصير الدخل، وهو ما يهم في المعاملة الضريبية وفي ما إذا كانت إعادة الاستثمار يدوية.',
  },
  {
    id: 'replication',
    en: 'How a fund tracks its index', ar: 'كيف يتتبع الصندوق مؤشره',
    bodyEn: 'Full physical replication means the fund holds every constituent. Sampling means it holds a representative subset, common where an index has thousands of small or illiquid members. Synthetic replication uses a swap contract with a bank to deliver the index return, which introduces counterparty exposure in exchange for tighter tracking on hard-to-hold markets.',
    bodyAr: 'تعني المحاكاة المادية الكاملة أن الصندوق يملك كل مكوّن. أما المحاكاة بالعينة فتعني امتلاك مجموعة فرعية ممثِّلة، وهو شائع حين يضم المؤشر آلاف المكوّنات الصغيرة أو ضعيفة السيولة. وتستخدم المحاكاة التركيبية عقد مقايضة مع بنك لتوفير عائد المؤشر، ما يُدخل تعرضا للطرف المقابل مقابل تتبع أدق في الأسواق يصعب امتلاكها مباشرة.',
  },
  {
    id: 'tracking',
    en: 'Tracking difference and tracking error', ar: 'فارق التتبع وخطأ التتبع',
    bodyEn: 'Tracking difference is how far a fund\'s return has drifted from its index over a period — a single number. Tracking error is how variable that drift has been — its volatility. A fund can have a small average difference but an erratic path, or a consistent small shortfall that is entirely predictable. The Center reports tracking only against a same-currency proxy, because otherwise the exchange rate dominates the result.',
    bodyAr: 'فارق التتبع هو مدى ابتعاد عائد الصندوق عن مؤشره خلال فترة — وهو رقم واحد. أما خطأ التتبع فهو مدى تقلّب ذلك الابتعاد. وقد يكون لصندوق فارق متوسط صغير لكن مساره متذبذب، أو تخلّف صغير ثابت لكنه متوقع تماما. ولا يعرض المركز التتبع إلا مقابل مؤشر بديل بالعملة نفسها، وإلا هيمن سعر الصرف على النتيجة.',
  },
  {
    id: 'domicile',
    en: 'Why domicile appears on every page', ar: 'لماذا يظهر المقر في كل صفحة',
    bodyEn: 'Where a fund is legally established affects how dividends are taxed before they ever reach the holder. Irish-domiciled funds, for example, access a treaty rate on US dividends that many other domiciles do not. This is a structural property of the fund, published here as a fact — how it applies to any individual depends on their own residence and is outside what this site can assess.',
    bodyAr: 'يؤثر المكان الذي يُؤسَّس فيه الصندوق قانونيا في كيفية فرض الضريبة على التوزيعات قبل وصولها إلى المستثمر. فالصناديق ذات المقر الأيرلندي، مثلا، تستفيد من معدل تعاهدي على التوزيعات الأميركية لا تتاح لمقار أخرى كثيرة. وهذه خاصية هيكلية للصندوق تُنشر هنا كحقيقة — أما كيفية انطباقها على أي فرد فتعتمد على موطنه وتقع خارج ما يستطيع هذا الموقع تقييمه.',
  },
  {
    id: 'reading-risk',
    en: 'Reading the risk numbers', ar: 'قراءة أرقام المخاطر',
    bodyEn: 'Volatility describes how widely returns have scattered around their average. Maximum drawdown is the deepest fall from a peak to the following trough — often the more useful figure, because it describes the worst thing that actually happened rather than an average. Beta describes how much a fund has moved relative to a reference index. All three are measurements of the past; none forecasts the next period.',
    bodyAr: 'يصف التذبذب مدى تشتت العوائد حول متوسطها. أما أقصى تراجع فهو أعمق هبوط من قمة إلى القاع التالي — وهو غالبا الرقم الأنفع، لأنه يصف أسوأ ما حدث فعلا لا متوسطا. ويصف معامل بيتا مقدار حركة الصندوق نسبة إلى مؤشر مرجعي. وجميعها قياسات للماضي، ولا يتنبأ أي منها بالفترة التالية.',
  },
  {
    id: 'liquidity',
    en: 'Liquidity is not fund size', ar: 'السيولة ليست حجم الصندوق',
    bodyEn: 'Daily turnover measures how much of a listing changes hands; assets under management measure how much the fund holds. They usually move together but are different things. A European listing of a very large fund can show modest on-exchange turnover simply because much of the trading happens elsewhere. The Center publishes observed turnover and names it as such, rather than presenting it as size.',
    bodyAr: 'تقيس قيمة التداول اليومية مقدار ما يتغير من ملكية الإدراج، بينما تقيس الأصول المدارة مقدار ما يملكه الصندوق. وهما يتحركان معا عادة لكنهما شيئان مختلفان. فقد يُظهر إدراج أوروبي لصندوق ضخم قيمة تداول متواضعة في البورصة لمجرد أن كثيرا من التداول يجري في مكان آخر. ولهذا ينشر المركز قيمة التداول المرصودة ويسمّيها باسمها بدلا من تقديمها كحجم.',
  },
];

function learnBody(ar) {
  const t = tr(ar);
  const toc = TOPICS.map((topic) => `<a class="etf-chip" href="#${esc(topic.id)}">${esc(ar ? topic.ar : topic.en)}</a>`).join('');
  const sections = TOPICS.map((topic) => `      <section class="market-section" id="${esc(topic.id)}">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Concept', 'مفهوم'))}</span><h2>${esc(ar ? topic.ar : topic.en)}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(ar ? topic.bodyAr : topic.bodyEn)}</p></div>
      </section>`).join('\n');

  return `      <section class="market-section" id="etf-learn-index">
        <div class="market-panel">
          <p class="market-copy">${esc(t(
    'The concepts behind everything the Center measures, in the order they tend to matter. Each one explains a term you will meet on a fund page.',
    'المفاهيم التي تقوم عليها كل قياسات المركز، مرتبة حسب أهميتها المعتادة. ويشرح كل منها مصطلحا ستقابله في صفحة أي صندوق.',
  ))}</p>
          <div class="etf-chips" style="margin-block-start:14px">${toc}</div>
        </div>
      </section>
${sections}`;
}

// ---------------------------------------------------------------------------

function buildPages() {
  const data = {
    facts: indexBySlug(readJson('etf-facts.json')),
    analytics: indexBySlug(readJson('etf-analytics.json')),
    score: indexBySlug(readJson('etf-score.json')),
  };

  const pages = [];
  for (const ar of [false, true]) {
    pages.push({
      out: path.join(ROOT, ar ? 'ar/etfs/portfolio-models/index.html' : 'etfs/portfolio-models/index.html'),
      html: shell.page({
        ar,
        slugPath: 'etfs/portfolio-models/',
        titleEn: 'Educational Portfolio Models',
        titleAr: 'نماذج المحافظ التعليمية',
        descEn: `${countEn(MODELS.length)} illustrative educational allocation models built from covered ETFs, each with the idea it demonstrates, what it gives up, and the constituents behind it.`,
        descAr: `${countAr(MODELS.length, 'masc')} نماذج توزيع تعليمية توضيحية مبنية من الصناديق المغطاة، مع الفكرة التي يوضّحها كل نموذج وما يتنازل عنه والمكوّنات التي يقوم عليها.`,
        eyebrowEn: 'Allocation models', eyebrowAr: 'نماذج التوزيع',
        trail: [[ar ? 'نماذج المحافظ' : 'Portfolio models', null]],
        body: portfoliosBody(ar, data),
      }),
    });

    pages.push({
      out: path.join(ROOT, ar ? 'ar/etfs/learn/index.html' : 'etfs/learn/index.html'),
      html: shell.page({
        ar,
        slugPath: 'etfs/learn/',
        titleEn: 'Understanding ETFs',
        titleAr: 'فهم صناديق المؤشرات',
        descEn: 'How ETFs are built and priced: expense ratios, accumulating versus distributing, replication methods, tracking, domicile, risk measures and liquidity.',
        descAr: 'كيف تُبنى صناديق المؤشرات وتُسعَّر: نسب المصاريف، التراكمي مقابل الموزِّع، طرق المحاكاة، التتبع، المقر، مقاييس المخاطر والسيولة.',
        eyebrowEn: 'Learn', eyebrowAr: 'تعلّم',
        trail: [[ar ? 'تعلّم' : 'Learn', null]],
        body: learnBody(ar),
      }),
    });
  }
  return pages;
}

function main() {
  shell.writePages(buildPages(), 'etf-guide-pages');
}

if (require.main === module) main();

module.exports = { buildPages, MODELS, TOPICS };
